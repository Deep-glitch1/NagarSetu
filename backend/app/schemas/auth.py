"""
Pydantic schemas for authentication endpoints.
"""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


# ============================================================
# REGISTER
# ============================================================

class CitizenRegisterRequest(BaseModel):
    """Body for POST /auth/citizen/register."""

    name: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Citizen's full name",
    )

    email: EmailStr = Field(
        ...,
        description="Unique email address",
    )

    phone: str | None = Field(
        default=None,
        max_length=15,
        description="Optional phone number",
    )

    password: str = Field(
        ...,
        min_length=6,
        max_length=128,
        description="Plain-text password",
    )

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        cleaned = v.strip()

        if not cleaned:
            raise ValueError("Name cannot be blank")

        return cleaned

    @field_validator("phone")
    @classmethod
    def normalise_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None

        cleaned = v.strip()

        return cleaned or None


# ============================================================
# LOGIN
# ============================================================

class LoginRequest(BaseModel):
    """Body for login."""

    email: EmailStr

    password: str = Field(
        ...,
        min_length=1,
    )


# ============================================================
# CHANGE PASSWORD
# ============================================================

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(
        ...,
        min_length=1,
        max_length=128,
    )

    new_password: str = Field(
        ...,
        min_length=6,
        max_length=128,
    )


# ============================================================
# FORGOT PASSWORD
# ============================================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    account_type: Literal["citizen", "employee"]


# ============================================================
# RESET PASSWORD
# ============================================================

class ResetPasswordRequest(BaseModel):
    token: str = Field(
        ...,
        min_length=1,
    )

    new_password: str = Field(
        ...,
        min_length=6,
        max_length=128,
    )


# ============================================================
# USER
# ============================================================

class UserInfo(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str

class AuthResponse(BaseModel):
    user: UserInfo

# ============================================================
# VerifyEmail
# ============================================================

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
    )


class ResendVerificationRequest(BaseModel):
    email: EmailStr