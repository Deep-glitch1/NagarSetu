"""
NagarSetu complaint service.

Responsible for normal complaint creation flow.

Intelligent operations are delegated to
complaint_intelligence.py.
"""

from pathlib import Path
from uuid import uuid4

from fastapi import (
    HTTPException,
    UploadFile,
    status,
)

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.models.category import ComplaintCategory
from app.db.models.complaint import Complaint
from app.db.models.photo import ComplaintPhoto

from app.routers.citizen import (
    get_authenticated_citizen,
)

from app.services.classifier import (
    classify_photo,
)

from app.services.complaint_intelligence import (
    calculate_priority,
    find_department,
    find_duplicate_master,
    refresh_category_clusters,
)


# ============================================================
# FILE STORAGE
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1].parent

UPLOAD_DIR = (
    BASE_DIR
    / "uploads"
    / "complaints"
)

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

MAX_IMAGE_SIZE = 10 * 1024 * 1024


# ============================================================
# CREATE COMPLAINT
# ============================================================

async def create_complaint(
    *,
    expected_class: str,
    title: str,
    description: str | None,
    latitude: float,
    longitude: float,
    file: UploadFile,
    current_user: dict,
    db: Session,
):
    """
    Create a complaint after:

    - authentication
    - image validation
    - ML classification
    - portal validation
    - duplicate detection
    - department routing
    - clustering
    - priority calculation
    - photo storage
    """

    # ========================================================
    # AUTHENTICATED CITIZEN
    # ========================================================

    citizen = get_authenticated_citizen(
        current_user=current_user,
        db=db,
    )

    # ========================================================
    # FILE VALIDATION
    # ========================================================

    if not file.content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Image content type is missing."
            ),
        )

    if not file.content_type.startswith(
        "image/"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only image files are allowed."
            ),
        )

    photo_bytes = await file.read()

    if not photo_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Uploaded image is empty."
            ),
        )

    if len(photo_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            ),
            detail=(
                "Image size must not exceed 10 MB."
            ),
        )

    # ========================================================
    # ML CLASSIFICATION
    # ========================================================

    try:
        classification = classify_photo(
            photo_bytes
        )

    except Exception as exc:

        print(
            "Complaint image classification failed:",
            exc,
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Unable to classify the uploaded image."
            ),
        )

    predicted_class = (
        classification["category_code"]
    )

    confidence = float(
        classification["confidence"]
    )

    # ========================================================
    # PORTAL VALIDATION
    # ========================================================

    if predicted_class != expected_class:

        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),

            detail={
                "message": (
                    "Image does not match the "
                    "selected complaint portal."
                ),

                "expected": expected_class,

                "predicted": predicted_class,

                "confidence": confidence,
            },
        )

    # ========================================================
    # FIND CATEGORY
    # ========================================================

    category = db.execute(
        select(ComplaintCategory)
        .where(
            ComplaintCategory.code
            == expected_class,

            ComplaintCategory.is_active.is_(True),
        )
    ).scalar_one_or_none()

    if category is None:

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                f"Complaint category "
                f"'{expected_class}' "
                "is not configured."
            ),
        )

    # ========================================================
    # FIND DUPLICATE
    # ========================================================

    duplicate_master_id = (
        find_duplicate_master(
            db=db,

            category_id=category.id,

            citizen_id=citizen.id,

            latitude=latitude,

            longitude=longitude,
        )
    )

    # ========================================================
    # FIND DEPARTMENT
    # ========================================================

    department_id = find_department(
        db=db,
        category_id=category.id,
    )

    if department_id is None:

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                f"No active department is mapped to "
                f"category '{expected_class}'."
            ),
        )

    # ========================================================
    # CREATE COMPLAINT
    # ========================================================

    complaint = Complaint(
        reported_by=citizen.id,

        category_id=category.id,

        department_id=department_id,

        master_complaint_id=(
            duplicate_master_id
        ),

        title=title,

        description=description,

        latitude=latitude,

        longitude=longitude,

        status="received",

        # Initial placeholder.
        # Recalculated immediately below.
        priority="low",
    )

    db.add(complaint)

    # ========================================================
    # FLUSH
    # ========================================================

    try:

        db.flush()

    except Exception as exc:

        db.rollback()

        print(
            "Complaint database flush failed:",
            exc,
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                "Failed to prepare complaint creation."
            ),
        )

    # ========================================================
    # PRIORITY INFORMATION
    # ========================================================

    cluster_size = 1

    # --------------------------------------------------------
    # DUPLICATE
    # --------------------------------------------------------

    if duplicate_master_id is not None:

        master_priority = db.execute(
            text(
                """
                SELECT priority

                FROM complaints

                WHERE id = :master_id
                """
            ),
            {
                "master_id": duplicate_master_id,
            },
        ).scalar_one_or_none()

        complaint.priority = (
            master_priority
            if master_priority is not None
            else "low"
        )

        priority_data = {
            "score": None,

            "priority": complaint.priority,

            "category_score": None,

            "cluster_score": None,

            "time_score": None,

            "cluster_size": None,

            "elapsed_hours": None,

            "elapsed_percentage": None,

            "sla_state": "duplicate",

            "target_hours": None,
        }

    # --------------------------------------------------------
    # NEW MASTER COMPLAINT
    # --------------------------------------------------------

    else:

        try:

            # Refresh category clusters after inserting
            # the new complaint.
            cluster_sizes = (
                refresh_category_clusters(
                    db=db,

                    category_id=category.id,
                )
            )

            cluster_size = cluster_sizes.get(
                complaint.id,
                1,
            )

            # ------------------------------------------------
            # SLA TARGET
            # ------------------------------------------------

            sla_target_hours = db.execute(
                text(
                    """
                    SELECT target_hours

                    FROM complaint_sla

                    WHERE category_id = :category_id
                    """
                ),
                {
                    "category_id": category.id,
                },
            ).scalar_one_or_none()

            # Safe fallback only if configuration is missing.
            if sla_target_hours is None:
                sla_target_hours = 72

            # ------------------------------------------------
            # PRIORITY
            # ------------------------------------------------

            priority_data = calculate_priority(
                category_code=expected_class,

                cluster_size=cluster_size,

                created_at=(
                    complaint.created_at
                ),

                target_hours=int(
                    sla_target_hours
                ),

                is_emergency=bool(
                    category.is_emergency
                ),
            )

            complaint.priority = (
                priority_data["priority"]
            )

            db.flush()

        except Exception as exc:

            db.rollback()

            print(
                "Complaint clustering/priority failed:",
                exc,
            )

            raise HTTPException(
                status_code=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),

                detail=(
                    "Failed to calculate complaint priority."
                ),
            )

    # ========================================================
    # FILE EXTENSION
    # ========================================================

    extension = ".jpg"

    if file.content_type == "image/png":
        extension = ".png"

    elif file.content_type == "image/webp":
        extension = ".webp"

    elif file.content_type == "image/jpeg":
        extension = ".jpg"

    # ========================================================
    # SAVE IMAGE
    # ========================================================

    filename = (
        f"{uuid4().hex}{extension}"
    )

    file_path = (
        UPLOAD_DIR / filename
    )

    try:

        file_path.write_bytes(
            photo_bytes
        )

    except Exception as exc:

        db.rollback()

        print(
            "Complaint image save failed:",
            exc,
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                "Failed to save complaint image."
            ),
        )

    # ========================================================
    # PHOTO RECORD
    # ========================================================

    photo = ComplaintPhoto(
        complaint_id=complaint.id,

        photo_url=(
            f"/uploads/complaints/"
            f"{filename}"
        ),

        photo_type="initial",

        # FK points to employees, so citizen-uploaded
        # photo must keep uploaded_by NULL.
        uploaded_by=None,
    )

    db.add(photo)

    # ========================================================
    # COMMIT
    # ========================================================

    try:

        db.commit()

    except Exception as exc:

        db.rollback()

        if file_path.exists():

            try:
                file_path.unlink()
            except Exception:
                pass

        print(
            "Complaint commit failed:",
            exc,
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),

            detail=(
                "Failed to create complaint."
            ),
        )

    # ========================================================
    # REFRESH
    # ========================================================

    db.refresh(complaint)

    # ========================================================
    # RESPONSE
    # ========================================================

    return {
        "success": True,

        "message": (
            "Complaint created successfully."
        ),

        "complaint_id": complaint.id,

        "complaint_number": (
            complaint.complaint_number
        ),

        "category": expected_class,

        "ml_prediction": predicted_class,

        "ml_confidence": confidence,

        "status": complaint.status,

        "priority": complaint.priority,

        "priority_score": (
            priority_data["score"]
        ),

        "photo_url": photo.photo_url,

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

        "cluster_size": cluster_size,

        "sla_state": (
            priority_data["sla_state"]
        ),

        "elapsed_hours": (
            priority_data["elapsed_hours"]
        ),

        "elapsed_percentage": (
            priority_data["elapsed_percentage"]
        ),

        "sla_target_hours": (
            priority_data["target_hours"]
        ),
    }

# ============================================================
# EMPLOYEE PERMISSION
# ============================================================

def require_employee_permission(
    *,
    db: Session,
    employee_id: int,
    permission_code: str,
) -> None:
    """
    Ensure the authenticated employee is active and has the
    requested RBAC permission.

    The database assignment procedure performs its own final
    permission check as well. This helper protects read APIs
    such as the available-officers endpoint too.
    """

    employee_exists = db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM employees
                WHERE id = :employee_id
                  AND is_active = TRUE
            )
            """
        ),
        {
            "employee_id": employee_id,
        },
    ).scalar_one()

    if not employee_exists:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee account is not active or does not exist.",
        )

    has_permission = db.execute(
        text(
            """
            SELECT fn_has_permission(
                :employee_id,
                :permission_code
            )
            """
        ),
        {
            "employee_id": employee_id,
            "permission_code": permission_code,
        },
    ).scalar_one()

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You do not have permission to perform this action."
            ),
        )


# ============================================================
# OFFICER LIST
# ============================================================

def get_available_officers(
    *,
    db: Session,
    complaint_id: int,
) -> list[dict]:
    """
    Return active officers belonging to the complaint's
    department.

    Also returns current active assignment count so the
    Admin Portal can show workload.
    """

    complaint = db.execute(
        text(
            """
            SELECT
                id,
                department_id,
                master_complaint_id,
                status
            FROM complaints
            WHERE id = :complaint_id
            """
        ),
        {
            "complaint_id": complaint_id,
        },
    ).mappings().first()

    if complaint is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found.",
        )

    # --------------------------------------------------------
    # Duplicate complaints are handled through their master.
    # --------------------------------------------------------

    target_complaint_id = (
        complaint["master_complaint_id"]
        if complaint["master_complaint_id"] is not None
        else complaint["id"]
    )

    target_department_id = db.execute(
        text(
            """
            SELECT department_id
            FROM complaints
            WHERE id = :complaint_id
            """
        ),
        {
            "complaint_id": target_complaint_id,
        },
    ).scalar_one_or_none()

    if target_department_id is None:
        return []

    officers = db.execute(
        text(
            """
            SELECT
                e.id,
                e.employee_id,
                e.name,
                e.email,

                COUNT(
                    CASE
                        WHEN ca.unassigned_at IS NULL
                        THEN 1
                    END
                ) AS active_assignments

            FROM employees e

            JOIN employee_roles er
                ON er.employee_id = e.id

            JOIN roles r
                ON r.id = er.role_id

            LEFT JOIN complaint_assignments ca
                ON ca.officer_id = e.id
               AND ca.unassigned_at IS NULL

            WHERE e.department_id = :department_id

              AND e.is_active = TRUE

              AND r.name = 'officer'

            GROUP BY
                e.id,
                e.employee_id,
                e.name,
                e.email

            ORDER BY
                active_assignments ASC,
                e.id ASC
            """
        ),
        {
            "department_id": target_department_id,
        },
    ).mappings().all()

    return [
        {
            "id": int(officer["id"]),
            "employee_id": officer["employee_id"],
            "name": officer["name"],
            "email": officer["email"],
            "active_assignments": int(
                officer["active_assignments"]
            ),
        }
        for officer in officers
    ]


# ============================================================
# ASSIGN COMPLAINT TO OFFICER
# ============================================================

def assign_complaint(
    *,
    db: Session,
    complaint_id: int,
    officer_id: int,
    assigned_by: int,
) -> dict:
    """
    Assign a complaint to an officer.

    The actual assignment is performed through the existing
    database procedure `sp_assign_complaint`, which handles:

    - complaint locking
    - assigning employee validation
    - COMPLAINT_ASSIGN permission
    - officer validation
    - department validation
    - assignable-status validation
    - closing previous assignment
    - inserting new assignment
    - changing complaint status to `assigned`

    Duplicate child complaints are automatically resolved
    to their master complaint.
    """

    # --------------------------------------------------------
    # GET COMPLAINT
    # --------------------------------------------------------

    complaint = db.execute(
        text(
            """
            SELECT
                id,
                department_id,
                master_complaint_id,
                status
            FROM complaints
            WHERE id = :complaint_id
            """
        ),
        {
            "complaint_id": complaint_id,
        },
    ).mappings().first()

    if complaint is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found.",
        )

    # --------------------------------------------------------
    # DUPLICATE -> ASSIGN MASTER
    # --------------------------------------------------------

    target_complaint_id = (
        int(complaint["master_complaint_id"])
        if complaint["master_complaint_id"] is not None
        else int(complaint["id"])
    )

    # --------------------------------------------------------
    # CALL DATABASE PROCEDURE
    # --------------------------------------------------------

    try:

        db.execute(
            text(
                """
                CALL sp_assign_complaint(
                    :complaint_id,
                    :officer_id,
                    :assigned_by
                )
                """
            ),
            {
                "complaint_id": target_complaint_id,
                "officer_id": officer_id,
                "assigned_by": assigned_by,
            },
        )

        db.commit()

    except Exception as exc:

        db.rollback()

        message = str(exc)

        print(
            "Complaint assignment failed:",
            message,
        )

        if (
            "permission" in message.lower()
            or "does not have permission"
            in message.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have permission "
                    "to assign complaints."
                ),
            )

        if (
            "does not exist or is inactive"
            in message.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message,
            )

        if (
            "does not belong to the department"
            in message.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Selected officer does not "
                    "belong to this complaint's department."
                ),
            )

        if (
            "cannot be assigned"
            in message.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message,
            )

        if (
            "already assigned"
            in message.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message,
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign complaint.",
        )

    # --------------------------------------------------------
    # GET CURRENT ASSIGNMENT
    # --------------------------------------------------------

    assignment = db.execute(
        text(
            """
            SELECT
                ca.id AS assignment_id,
                ca.complaint_id,
                ca.officer_id,
                ca.assigned_by,
                ca.assigned_at,

                e.employee_id,
                e.name AS officer_name,
                e.email AS officer_email

            FROM complaint_assignments ca

            JOIN employees e
                ON e.id = ca.officer_id

            WHERE ca.complaint_id = :complaint_id

              AND ca.unassigned_at IS NULL

            LIMIT 1
            """
        ),
        {
            "complaint_id": target_complaint_id,
        },
    ).mappings().first()

    # --------------------------------------------------------
    # GET UPDATED COMPLAINT
    # --------------------------------------------------------

    updated_complaint = db.execute(
        text(
            """
            SELECT
                id,
                complaint_number,
                status,
                priority,
                department_id,
                master_complaint_id

            FROM complaints

            WHERE id = :complaint_id
            """
        ),
        {
            "complaint_id": target_complaint_id,
        },
    ).mappings().first()

    return {
        "success": True,

        "message": (
            "Complaint assigned successfully."
        ),

        "complaint": {
            "id": int(
                updated_complaint["id"]
            ),

            "complaint_number": (
                updated_complaint[
                    "complaint_number"
                ]
            ),

            "status": (
                updated_complaint["status"]
            ),

            "priority": (
                updated_complaint["priority"]
            ),

            "department_id": (
                updated_complaint["department_id"]
            ),

            "master_complaint_id": (
                updated_complaint[
                    "master_complaint_id"
                ]
            ),
        },

        "assignment": (
            {
                "assignment_id": int(
                    assignment["assignment_id"]
                ),

                "officer_id": int(
                    assignment["officer_id"]
                ),

                "employee_id": (
                    assignment["employee_id"]
                ),

                "officer_name": (
                    assignment["officer_name"]
                ),

                "officer_email": (
                    assignment["officer_email"]
                ),

                "assigned_by": int(
                    assignment["assigned_by"]
                ),

                "assigned_at": (
                    assignment["assigned_at"]
                ),
            }

            if assignment is not None
            else None
        ),
    }