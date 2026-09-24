from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.citizen import Citizen
from app.routers.auth import get_current_identity
from app.schemas.citizen import (
    CitizenProfileResponse,
    CitizenProfileUpdateRequest,
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/citizen",
    tags=["citizen"],
)


# ============================================================
# HELPER
# ============================================================

def get_authenticated_citizen(
    current_user: dict,
    db: Session,
) -> Citizen:

    if current_user.get("role") != "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizen access required.",
        )

    citizen = db.execute(
        select(Citizen).where(
            Citizen.id == current_user["id"]
        )
    ).scalar_one_or_none()

    if citizen is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Citizen account not found.",
        )

    if not citizen.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    return citizen


# ============================================================
# GET PROFILE
# GET /citizen/profile
# ============================================================

@router.get(
    "/profile",
    response_model=CitizenProfileResponse,
)
def get_profile(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    citizen = get_authenticated_citizen(
        current_user=current_user,
        db=db,
    )

    return citizen


# ============================================================
# UPDATE PROFILE
# PATCH /citizen/profile
# ============================================================

@router.patch(
    "/profile",
    response_model=CitizenProfileResponse,
)
def update_profile(
    payload: CitizenProfileUpdateRequest,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    citizen = get_authenticated_citizen(
        current_user=current_user,
        db=db,
    )

    updates = payload.model_dump(
        exclude_unset=True
    )

    # --------------------------------------------------------
    # NOTHING TO UPDATE
    # --------------------------------------------------------

    if not updates:
        return citizen

    # --------------------------------------------------------
    # UPDATE ALLOWED FIELDS ONLY
    # --------------------------------------------------------

    if "name" in updates:
        citizen.name = updates["name"]

    if "phone" in updates:
        citizen.phone = updates["phone"]

    citizen.updated_at = datetime.now(timezone.utc)

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    try:
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This phone number is already registered.",
        )

    # --------------------------------------------------------
    # REFRESH
    # --------------------------------------------------------

    db.refresh(citizen)

    return citizen