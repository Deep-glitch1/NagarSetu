"""
NagarSetu complaint router.

Citizen complaint portals:
- Road Issue  -> accepts only ROAD_DAMAGED
- Garbage     -> accepts only GARBAGE

The image is classified before the complaint is created.
"""

from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.database import get_db

# ------------------------------------------------------------
# SQLAlchemy models
# ------------------------------------------------------------

from app.db.models.citizen import Citizen
from app.db.models.category import ComplaintCategory
from app.db.models.complaint import Complaint
from app.db.models.department import Department
from app.db.models.photo import ComplaintPhoto
from app.db.models.status_history import StatusHistory

# These models are required so SQLAlchemy can resolve
# the foreign-key metadata used by Complaint / ComplaintPhoto.
from app.db.models.administrative_unit import AdministrativeUnit
from app.db.models.employee import Employee
from app.db.models.road_segment import RoadSegment

from app.routers.auth import get_current_identity
from app.routers.citizen import get_authenticated_citizen
from app.services.classifier import classify_photo


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/citizen/complaints",
    tags=["complaints"],
)


# ============================================================
# FILE STORAGE
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

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
    Return all complaints belonging to the
    currently authenticated citizen.
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
                    ComplaintPhoto.complaint_id
                    == Complaint.id
                )
                &
                (
                    ComplaintPhoto.photo_type
                    == "initial"
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
                "latitude": complaint.latitude,
                "longitude": complaint.longitude,
                "status": complaint.status,
                "priority": complaint.priority,
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
        "count": len(complaints),
        "complaints": complaints,
    }




@router.get("/impact")
def get_my_impact(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    citizen = get_authenticated_citizen(
        current_user=current_user,
        db=db,
    )

    # --------------------------------------------------------
    # TOTAL / STATUS COUNTS
    # --------------------------------------------------------

    status_rows = db.execute(
        select(
            Complaint.status,
            func.count(Complaint.id),
        )
        .where(
            Complaint.reported_by == citizen.id
        )
        .group_by(Complaint.status)
    ).all()

    status_counts = {
        status: count
        for status, count in status_rows
    }

    total_reports = sum(
        status_counts.values()
    )

    closed_reports = (
        status_counts.get("closed", 0)
    )

    verified_reports = (
        status_counts.get("verified", 0)
    )

    rejected_reports = (
        status_counts.get("rejected", 0)
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
            func.count(Complaint.id),
        )
        .join(
            ComplaintCategory,
            ComplaintCategory.id == Complaint.category_id,
        )
        .where(
            Complaint.reported_by == citizen.id
        )
        .group_by(
            ComplaintCategory.code
        )
    ).all()

    category_counts = {
        code: count
        for code, count in category_rows
    }

    road_reports = category_counts.get(
        "ROAD_DAMAGED",
        0,
    )

    garbage_reports = category_counts.get(
        "GARBAGE",
        0,
    )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "success": True,

        "trust_score": (
            float(citizen.trust_score)
            if citizen.trust_score is not None
            else None
        ),

        "stats": {
            "total_reports": total_reports,
            "closed_reports": closed_reports,
            "verified_reports": verified_reports,
            "active_reports": active_reports,
            "rejected_reports": rejected_reports,
        },

        "categories": {
            "road_damaged": road_reports,
            "garbage": garbage_reports,
        },
    }


# ============================================================
# GET SINGLE COMPLAINT DETAIL
# GET /citizen/complaints/{complaint_id}
# ============================================================

@router.get("/{complaint_id}")
def get_my_complaint_detail(
    complaint_id: int,
    current_user: dict = Depends(
        get_current_identity
    ),
    db: Session = Depends(get_db),
):
    """
    Return complete details of a complaint
    belonging to the authenticated citizen.

    Includes:
    - complaint information
    - category
    - all photos
    - status history
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
            Complaint.id == complaint_id,
            Complaint.reported_by
            == citizen.id,
        )
    ).one_or_none()

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found.",
        )

    complaint, category, category_name = result

    # --------------------------------------------------------
    # PHOTOS
    # --------------------------------------------------------

    photos = db.execute(
        select(ComplaintPhoto)
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
        select(StatusHistory)
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

            "category_name": category_name,

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

                "remarks": item.remarks,

                "changed_at": (
                    item.changed_at
                ),
            }
            for item in history
        ],
    }


# ============================================================
# CREATE COMPLAINT HELPER
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
    Common complaint creation logic used by:
    - Road complaint
    - Garbage complaint
    """

    # --------------------------------------------------------
    # AUTHENTICATED CITIZEN
    # --------------------------------------------------------

    citizen = get_authenticated_citizen(
        current_user=current_user,
        db=db,
    )

    # --------------------------------------------------------
    # FILE VALIDATION
    # --------------------------------------------------------

    if not file.content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image content type is missing.",
        )

    if not file.content_type.startswith(
        "image/"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed.",
        )

    photo_bytes = await file.read()

    if not photo_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image is empty.",
        )

    if len(photo_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image size must not exceed 10 MB.",
        )

    # --------------------------------------------------------
    # ML CLASSIFICATION
    # --------------------------------------------------------

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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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

    # --------------------------------------------------------
    # PORTAL VALIDATION
    # --------------------------------------------------------

    if predicted_class != expected_class:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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

    # --------------------------------------------------------
    # FIND CATEGORY
    # --------------------------------------------------------

    category = db.execute(
        select(ComplaintCategory).where(
            ComplaintCategory.code
            == expected_class,
            ComplaintCategory.is_active.is_(True),
        )
    ).scalar_one_or_none()

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Complaint category "
                f"'{expected_class}' "
                "is not configured."
            ),
        )

    # --------------------------------------------------------
    # CREATE COMPLAINT
    # --------------------------------------------------------

    complaint = Complaint(
        reported_by=citizen.id,

        category_id=category.id,

        title=title,

        description=description,

        latitude=latitude,

        longitude=longitude,

        status="received",

        priority="medium",
    )

    db.add(complaint)

    # Flush so complaint.id is available
    # before creating the photo row.
    try:
        db.flush()

    except Exception as exc:
        db.rollback()

        print(
            "Complaint database flush failed:",
            exc,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to prepare complaint creation."
            ),
        )

    # --------------------------------------------------------
    # DETERMINE FILE EXTENSION
    # --------------------------------------------------------

    extension = ".jpg"

    if file.content_type == "image/png":
        extension = ".png"

    elif file.content_type == "image/webp":
        extension = ".webp"

    elif file.content_type == "image/jpeg":
        extension = ".jpg"

    # --------------------------------------------------------
    # SAVE IMAGE
    # --------------------------------------------------------

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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Failed to save complaint image."
            ),
        )

    # --------------------------------------------------------
    # CREATE PHOTO RECORD
    # --------------------------------------------------------

    photo = ComplaintPhoto(
        complaint_id=complaint.id,

        photo_url=(
            f"/uploads/complaints/"
            f"{filename}"
        ),

        photo_type="initial",

        # Citizen uploaded photo.
        # uploaded_by references employees,
        # therefore it must remain NULL.
        uploaded_by=None,
    )

    db.add(photo)

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create complaint.",
        )

    # --------------------------------------------------------
    # REFRESH
    # --------------------------------------------------------

    db.refresh(complaint)

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

        "photo_url": photo.photo_url,
    }


# ============================================================
# ROAD COMPLAINT
# POST /citizen/complaints/road
# ============================================================

@router.post("/road")
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

    Only ROAD_DAMAGED predictions
    are accepted.
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

@router.post("/garbage")
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

    Only GARBAGE predictions
    are accepted.
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