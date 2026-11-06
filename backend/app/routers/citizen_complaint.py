"""
NagarSetu citizen complaint API routes.

This router contains only citizen-facing complaint operations.
Employee complaint operations live in employee_complaint.py.
"""

from fastapi import (
   APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel
from sqlalchemy import desc, func, select, text
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models.category import (
    ComplaintCategory,
)
from app.db.models.complaint import (
    Complaint,
)
from app.db.models.photo import (
    ComplaintPhoto,
)
from app.routers.auth import (
    get_current_identity,
)
from app.routers.citizen import (
    get_authenticated_citizen,
)
from app.services.complaint_service import (
    create_complaint,
)
# ============================================================
# ROUTER
# ============================================================
router = APIRouter(
    prefix="/citizen/complaints",
    tags=["complaints"],
)

class CitizenResponseRequest(BaseModel):
    response: str
    rating: int | None = None
    review: str | None = None

# ============================================================
# GET MY COMPLAINTS
# GET /citizen/complaints
# ============================================================

@router.get("")
def get_my_complaints(
    current_user: dict = Depends(
        get_current_identity
    ),

    db: Session = Depends(get_db),
):
    """
    Return all complaints of the authenticated citizen.
    """

    citizen = get_authenticated_citizen(
        current_user=current_user,
        db=db,
    )

    rows = db.execute(
        select(
            Complaint,

            ComplaintCategory.code.label(
                "category"
            ),

            ComplaintPhoto.photo_url.label(
                "photo_url"
            ),
        )

        .join(
            ComplaintCategory,
            ComplaintCategory.id
            == Complaint.category_id,
        )

        .outerjoin(
            ComplaintPhoto,
            (
                (
                    ComplaintPhoto.complaint_id == Complaint.id
                )
                &
                (
                    ComplaintPhoto.photo_type == "initial"
                )
            ),
        )

        .where(
            Complaint.reported_by
            == citizen.id
        )

        .order_by(
            desc(
                Complaint.created_at
            )
        )
    ).all()

    complaints = []

    for complaint, category, photo_url in rows:

        complaints.append(
            {
                "id": complaint.id,

                "complaint_number": (
                    complaint.complaint_number
                ),

                "category": category,

                "title": complaint.title,

                "description": (
                    complaint.description
                ),

                "latitude": (
                    complaint.latitude
                ),

                "longitude": (
                    complaint.longitude
                ),

                "status": complaint.status,

                "priority": complaint.priority,

                "department_id": (
                    complaint.department_id
                ),

                "master_complaint_id": (
                    complaint.master_complaint_id
                ),

                "is_duplicate": (
                    complaint.master_complaint_id
                    is not None
                ),

                "created_at": (
                    complaint.created_at
                ),

                "updated_at": (
                    complaint.updated_at
                ),

                "photo_url": photo_url,
            }
        )

    return {
        "success": True,

        "count": len(
            complaints
        ),

        "complaints": complaints,
    }


# ============================================================
# GET MY IMPACT
# GET /citizen/complaints/impact
# ============================================================

@router.get("/impact")
def get_my_impact(
    current_user: dict = Depends(
        get_current_identity
    ),

    db: Session = Depends(get_db),
):
    """
    Return citizen complaint impact statistics.
    """

    citizen = get_authenticated_citizen(
        current_user=current_user,
        db=db,
    )

    # --------------------------------------------------------
    # STATUS COUNTS
    # --------------------------------------------------------

    status_rows = db.execute(
        select(
            Complaint.status,

            func.count(
                Complaint.id
            ),
        )

        .where(
            Complaint.reported_by
            == citizen.id
        )

        .group_by(
            Complaint.status
        )
    ).all()

    status_counts = {
        complaint_status: count

        for complaint_status, count
        in status_rows
    }

    total_reports = sum(
        status_counts.values()
    )

    closed_reports = (
        status_counts.get(
            "closed",
            0,
        )
    )

    verified_reports = (
        status_counts.get(
            "verified",
            0,
        )
    )

    rejected_reports = (
        status_counts.get(
            "rejected",
            0,
        )
    )

    active_reports = (
        total_reports

        - closed_reports

        - rejected_reports
    )

    # --------------------------------------------------------
    # CATEGORY COUNTS
    # --------------------------------------------------------

    category_rows = db.execute(
        select(
            ComplaintCategory.code,

            func.count(
                Complaint.id
            ),
        )

        .join(
            ComplaintCategory,

            ComplaintCategory.id
            == Complaint.category_id,
        )

        .where(
            Complaint.reported_by
            == citizen.id
        )

        .group_by(
            ComplaintCategory.code
        )
    ).all()

    category_counts = {
        code: count

        for code, count
        in category_rows
    }

    road_reports = (
        category_counts.get(
            "ROAD_DAMAGED",
            0,
        )
    )

    garbage_reports = (
        category_counts.get(
            "GARBAGE",
            0,
        )
    )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "success": True,

        "trust_score": (
            float(
                citizen.trust_score
            )

            if citizen.trust_score is not None

            else None
        ),

        "stats": {
            "total_reports": (
                total_reports
            ),

            "closed_reports": (
                closed_reports
            ),

            "verified_reports": (
                verified_reports
            ),

            "active_reports": (
                active_reports
            ),

            "rejected_reports": (
                rejected_reports
            ),
        },

        "categories": {
            "road_damaged": (
                road_reports
            ),

            "garbage": (
                garbage_reports
            ),
        },
    }


# ============================================================
# GET SINGLE COMPLAINT DETAIL
# GET /citizen/complaints/{complaint_id}
# ============================================================

@router.get(
    "/{complaint_id}"
)
def get_my_complaint_detail(
    complaint_id: int,

    current_user: dict = Depends(
        get_current_identity
    ),

    db: Session = Depends(get_db),
):
    """
    Return complete complaint details.
    """

    citizen = get_authenticated_citizen(
        current_user=current_user,
        db=db,
    )

    # --------------------------------------------------------
    # COMPLAINT
    # --------------------------------------------------------

    result = db.execute(
        select(
            Complaint,

            ComplaintCategory.code.label(
                "category"
            ),

            ComplaintCategory.name.label(
                "category_name"
            ),
        )

        .join(
            ComplaintCategory,

            ComplaintCategory.id
            == Complaint.category_id,
        )

        .where(
            Complaint.id
            == complaint_id,

            Complaint.reported_by
            == citizen.id,
        )
    ).one_or_none()

    if result is None:

        from fastapi import (
            HTTPException,
            status,
        )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,

            detail="Complaint not found.",
        )

    complaint, category, category_name = result

    # --------------------------------------------------------
    # PHOTOS + UPLOADER
    # --------------------------------------------------------

    photo_rows = db.execute(
        text(
            """
            SELECT
                cp.id,
                cp.photo_url,
                cp.photo_type,
                cp.uploaded_by,
                cp.uploaded_at,
                e.name AS uploaded_by_name
            FROM complaint_photos cp
            LEFT JOIN employees e
                ON e.id = cp.uploaded_by
            WHERE cp.complaint_id = :complaint_id
            ORDER BY cp.uploaded_at ASC
            """
        ),
        {
            "complaint_id": complaint.id,
        },
    ).mappings().all()

    # --------------------------------------------------------
    # STATUS HISTORY + ACTOR
    # --------------------------------------------------------

    status_rows = db.execute(
        text(
            """
            SELECT
                sh.id,
                sh.old_status,
                sh.new_status,
                sh.changed_by,
                e.name AS changed_by_name,
                sh.remarks,
                sh.changed_at
            FROM status_history sh
            LEFT JOIN employees e
                ON e.id = sh.changed_by
            WHERE sh.complaint_id = :complaint_id
            ORDER BY sh.changed_at ASC
            """
        ),
        {
            "complaint_id": complaint.id,
        },
    ).mappings().all()

    # --------------------------------------------------------
    # ASSIGNMENT HISTORY
    # --------------------------------------------------------

    assignment_rows = db.execute(
        text(
            """
            SELECT
                ca.id,
                ca.officer_id,
                officer.employee_id AS officer_employee_id,
                officer.name AS officer_name,
                ca.assigned_by,
                assigner.name AS assigned_by_name,
                ca.assigned_at,
                ca.unassigned_at
            FROM complaint_assignments ca
            JOIN employees officer
                ON officer.id = ca.officer_id
            LEFT JOIN employees assigner
                ON assigner.id = ca.assigned_by
            WHERE ca.complaint_id = :complaint_id
            ORDER BY ca.assigned_at ASC
            """
        ),
        {
            "complaint_id": complaint.id,
        },
    ).mappings().all()

    # --------------------------------------------------------
    # SLA ESCALATIONS
    # --------------------------------------------------------

    escalation_rows = db.execute(
        text(
            """
            SELECT
                ce.id,
                ce.escalation_level,
                ce.escalation_percentage,
                ce.escalated_to,
                e.name AS escalated_to_name,
                ce.reason,
                ce.escalated_at
            FROM complaint_escalations ce
            LEFT JOIN employees e
                ON e.id = ce.escalated_to
            WHERE ce.complaint_id = :complaint_id
            ORDER BY ce.escalated_at ASC
            """
        ),
        {
            "complaint_id": complaint.id,
        },
    ).mappings().all()

    # --------------------------------------------------------
    # CITIZEN RESPONSE
    # --------------------------------------------------------

    citizen_response = db.execute(
        text(
            """
            SELECT
                response,
                rating,
                review,
                responded_at
            FROM complaint_citizen_responses
            WHERE complaint_id = :complaint_id
            LIMIT 1
            """
        ),
        {
            "complaint_id": complaint.id,
        },
    ).mappings().first()

    # --------------------------------------------------------
    # UNIFIED TIMELINE
    # --------------------------------------------------------

    timeline = [
        {
            "id": f"created-{complaint.id}",
            "event_type": "created",
            "timestamp": complaint.created_at,
            "title": "Complaint submitted",
            "actor_name": "Citizen",
        }
    ]

    for item in status_rows:
        timeline.append(
            {
                "id": f"status-{item['id']}",
                "event_type": "status",
                "timestamp": item["changed_at"],
                "title": "Status updated",
                "old_status": item["old_status"],
                "new_status": item["new_status"],
                "remarks": item["remarks"],
                "actor_name": item["changed_by_name"] or "System",
            }
        )

    for item in assignment_rows:
        timeline.append(
            {
                "id": f"assignment-{item['id']}",
                "event_type": "assignment",
                "timestamp": item["assigned_at"],
                "title": "Complaint assigned",
                "description": (
                    f"Assigned to {item['officer_name']}"
                ),
                "actor_name": item["assigned_by_name"] or "System",
                "officer_name": item["officer_name"],
                "officer_employee_id": item["officer_employee_id"],
            }
        )

        if item["unassigned_at"] is not None:
            timeline.append(
                {
                    "id": f"assignment-end-{item['id']}",
                    "event_type": "assignment_ended",
                    "timestamp": item["unassigned_at"],
                    "title": "Officer assignment ended",
                    "description": (
                        f"Assignment to {item['officer_name']} ended"
                    ),
                    "actor_name": "System",
                    "officer_name": item["officer_name"],
                }
            )

    for item in photo_rows:
        if item["photo_type"] == "resolution":
            timeline.append(
                {
                    "id": f"photo-{item['id']}",
                    "event_type": "resolution",
                    "timestamp": item["uploaded_at"],
                    "title": "Resolution evidence uploaded",
                    "description": "An officer submitted resolution evidence for verification.",
                    "actor_name": item["uploaded_by_name"] or "Officer",
                    "photo_url": item["photo_url"],
                }
            )

    for item in escalation_rows:
        timeline.append(
            {
                "id": f"escalation-{item['id']}",
                "event_type": "escalation",
                "timestamp": item["escalated_at"],
                "title": (
                    f"SLA escalation — Level {item['escalation_level']}"
                ),
                "description": item["reason"],
                "actor_name": "SLA system",
                "escalation_level": item["escalation_level"],
                "escalation_percentage": item["escalation_percentage"],
                "escalated_to_name": item["escalated_to_name"],
            }
        )

    if citizen_response is not None:
        response_label = (
            "Citizen confirmed resolution"
            if citizen_response["response"] == "satisfied"
            else "Citizen reopened the complaint"
        )

        timeline.append(
            {
                "id": f"response-{complaint.id}",
                "event_type": "citizen_response",
                "timestamp": citizen_response["responded_at"],
                "title": response_label,
                "actor_name": "Citizen",
                "response": citizen_response["response"],
                "rating": citizen_response["rating"],
                "review": citizen_response["review"],
            }
        )

    timeline.sort(
        key=lambda event: event["timestamp"]
    )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "success": True,

        "complaint": {
            "id": complaint.id,

            "complaint_number": (
                complaint.complaint_number
            ),

            "category": category,

            "category_name": (
                category_name
            ),

            "title": complaint.title,

            "description": (
                complaint.description
            ),

            "latitude": (
                complaint.latitude
            ),

            "longitude": (
                complaint.longitude
            ),

            "status": complaint.status,

            "priority": complaint.priority,

            "department_id": (
                complaint.department_id
            ),

            "master_complaint_id": (
                complaint.master_complaint_id
            ),

            "is_duplicate": (
                complaint.master_complaint_id
                is not None
            ),

            "created_at": (
                complaint.created_at
            ),

            "updated_at": (
                complaint.updated_at
            ),

            "photos": [
                {
                    "id": int(photo["id"]),
                    "photo_url": photo["photo_url"],
                    "photo_type": photo["photo_type"],
                    "uploaded_by": (
                        int(photo["uploaded_by"])
                        if photo["uploaded_by"] is not None
                        else None
                    ),
                    "uploaded_by_name": photo["uploaded_by_name"],
                    "uploaded_at": photo["uploaded_at"],
                }
                for photo in photo_rows
            ],
        },

        "status_history": [
            {
                "id": int(item["id"]),
                "old_status": item["old_status"],
                "new_status": item["new_status"],
                "remarks": item["remarks"],
                "changed_by": (
                    int(item["changed_by"])
                    if item["changed_by"] is not None
                    else None
                ),
                "changed_by_name": item["changed_by_name"],
                "changed_at": item["changed_at"],
            }
            for item in status_rows
        ],

        "assignment_history": [
            {
                "id": int(item["id"]),
                "officer_id": int(item["officer_id"]),
                "officer_employee_id": item["officer_employee_id"],
                "officer_name": item["officer_name"],
                "assigned_by": (
                    int(item["assigned_by"])
                    if item["assigned_by"] is not None
                    else None
                ),
                "assigned_by_name": item["assigned_by_name"],
                "assigned_at": item["assigned_at"],
                "unassigned_at": item["unassigned_at"],
            }
            for item in assignment_rows
        ],

        "escalations": [
            {
                "id": int(item["id"]),
                "escalation_level": int(item["escalation_level"]),
                "escalation_percentage": (
                    int(item["escalation_percentage"])
                    if item["escalation_percentage"] is not None
                    else None
                ),
                "escalated_to": (
                    int(item["escalated_to"])
                    if item["escalated_to"] is not None
                    else None
                ),
                "escalated_to_name": item["escalated_to_name"],
                "reason": item["reason"],
                "escalated_at": item["escalated_at"],
            }
            for item in escalation_rows
        ],

        "citizen_response": (
            {
                "response": citizen_response["response"],
                "rating": (
                    int(citizen_response["rating"])
                    if citizen_response["rating"] is not None
                    else None
                ),
                "review": citizen_response["review"],
                "responded_at": citizen_response["responded_at"],
            }
            if citizen_response is not None
            else None
        ),

        "timeline": timeline,
    }


# ============================================================
# ROAD COMPLAINT
# POST /citizen/complaints/road
# ============================================================

@router.post(
    "/road"
)
async def create_road_complaint(
    title: str = Form(
        "Report Road Issue"
    ),

    description: str | None = Form(
        default=None
    ),

    latitude: float = Form(...),

    longitude: float = Form(...),

    file: UploadFile = File(...),

    current_user: dict = Depends(
        get_current_identity
    ),

    db: Session = Depends(get_db),
):
    """
    Create a road complaint.

    Only ROAD_DAMAGED is accepted.
    """

    return await create_complaint(
        expected_class="ROAD_DAMAGED",
        title=title,
        description=description,
        latitude=latitude,
        longitude=longitude,
        file=file,
        current_user=current_user,
        db=db,
    )
# ============================================================
# GARBAGE COMPLAINT
# POST /citizen/complaints/garbage
# ============================================================

@router.post(
    "/garbage"
)
async def create_garbage_complaint(
    title: str = Form(
        "Report Garbage"
    ),

    description: str | None = Form(
        default=None
    ),

    latitude: float = Form(...),
    longitude: float = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(
        get_current_identity
    ),
    db: Session = Depends(get_db),
):
    """
    Create a garbage complaint.
    Only GARBAGE is accepted.
    """
    return await create_complaint(
        expected_class="GARBAGE",
        title=title,
        description=description,
        latitude=latitude,
        longitude=longitude,
        file=file,
        current_user=current_user,
        db=db,
    )
# ============================================================
# SUBMIT CITIZEN RESPONSE
# POST /citizen/complaints/{complaint_id}/response
# ============================================================
# ============================================================
# SUBMIT CITIZEN RESPONSE
# POST /citizen/complaints/{complaint_id}/response
# ============================================================

@router.post("/{complaint_id}/response")
def submit_citizen_response(
    complaint_id: int,
    payload: CitizenResponseRequest,

    current_user: dict = Depends(
        get_current_identity
    ),

    db: Session = Depends(get_db),
):
    """
    Submit citizen satisfaction/reopen response.
    """

    citizen = get_authenticated_citizen(
        current_user=current_user,
        db=db,
    )

    try:
        db.execute(
            text("""
                CALL sp_submit_citizen_response(
                    :complaint_id,
                    :citizen_id,
                    :response,
                    :rating,
                    :review
                )
            """),
            {
                "complaint_id": complaint_id,
                "citizen_id": citizen.id,
                "response": payload.response,
                "rating": payload.rating,
                "review": payload.review,
            },
        )

        db.commit()

        return {
            "success": True,
            "message": "Response submitted successfully.",
        }

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )