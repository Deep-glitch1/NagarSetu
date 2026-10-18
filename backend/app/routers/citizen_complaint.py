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
from app.db.models.status_history import (
    StatusHistory,
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
    # PHOTOS
    # --------------------------------------------------------

    photos = db.execute(
        select(
            ComplaintPhoto
        )

        .where(
            ComplaintPhoto.complaint_id
            == complaint.id
        )

        .order_by(
            ComplaintPhoto.uploaded_at.asc()
        )
    ).scalars().all()

    # --------------------------------------------------------
    # STATUS HISTORY
    # --------------------------------------------------------

    history = db.execute(
        select(
            StatusHistory
        )

        .where(
            StatusHistory.complaint_id
            == complaint.id
        )

        .order_by(
            StatusHistory.changed_at.asc()
        )
    ).scalars().all()

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
                    "id": photo.id,

                    "photo_url": (
                        photo.photo_url
                    ),

                    "photo_type": (
                        photo.photo_type
                    ),

                    "uploaded_at": (
                        photo.uploaded_at
                    ),
                }

                for photo in photos
            ],
        },

        "status_history": [
            {
                "id": item.id,

                "old_status": (
                    item.old_status
                ),

                "new_status": (
                    item.new_status
                ),

                "remarks": (
                    item.remarks
                ),

                "changed_at": (
                    item.changed_at
                ),
            }

            for item in history
        ],
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