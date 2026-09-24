from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, field_validator


# ============================================================
# UPDATE PROFILE REQUEST
# ============================================================

class CitizenProfileUpdateRequest(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
        description="Citizen's full name",
    )

    phone: str | None = Field(
        default=None,
        max_length=15,
        description="Citizen's phone number",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        if not cleaned:
            raise ValueError("Name cannot be blank")

        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        return cleaned or None


# ============================================================
# PROFILE RESPONSE
# ============================================================

class CitizenProfileResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str | None

    trust_score: Decimal | None

    email_verified: bool
    email_verified_at: datetime | None

    is_active: bool

    created_at: datetime
    updated_at: datetime