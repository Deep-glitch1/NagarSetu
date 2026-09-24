"""
Authentication endpoints for NagarSetu.

Endpoints:
    POST /auth/citizen/register
    POST /auth/citizen/verify-email
    POST /auth/citizen/resend-verification
    POST /auth/citizen/login
    POST /auth/employee/login
    POST /auth/change-password
    POST /auth/forgot-password
    POST /auth/reset-password
    POST /auth/logout
    GET  /auth/me
"""

# ============================================================
# STANDARD LIBRARY
# ============================================================

import smtplib
import ssl

from datetime import datetime, timezone
from email.message import EmailMessage


# ============================================================
# THIRD-PARTY
# ============================================================

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request,
    Response,
)

from app.core.security import (
    hash_password,
    verify_password,
)

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


# ============================================================
# APPLICATION IMPORTS
# ============================================================

from app.core.config import settings

from app.db.database import get_db

from app.db.models.citizen import Citizen

from app.db.redis_auth import (
    generate_password_reset_token,
    store_password_reset_token,
    get_password_reset_account,
    consume_password_reset_token,

    generate_email_otp,
    store_email_verification_otp,
    verify_email_otp,
    can_resend_email_verification,
    delete_email_verification_otp,

     create_session,
    get_session,
    delete_session,
    SESSION_COOKIE_NAME,
)

from app.schemas.auth import (
    CitizenRegisterRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    LoginRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
     AuthResponse,
    UserInfo,
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


# ============================================================
# SESSION HELPERS
# ============================================================

SESSION_MAX_AGE = 60 * 60 * 24 * 7


def set_session_cookie(
    response: Response,
    session_id: str,
) -> None:
    """Set the server-side authentication session cookie."""

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=settings.FRONTEND_URL.startswith("https://"),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(
    response: Response,
) -> None:
    """Remove the authentication session cookie from the browser."""

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )


def build_user_response(
    account_id: int,
    name: str,
    email: str,
    role: str,
) -> dict:
    """Return the non-sensitive user object sent to the frontend."""

    return {
        "id": account_id,
        "name": name,
        "email": email,
        "role": role,
    }





# ============================================================
# EMAIL HELPERS
# ============================================================

def send_password_reset_email(
    to_email: str,
    reset_link: str,
) -> None:
    """
    Send password reset email through SMTP.
    """

    # --------------------------------------------------------
    # VALIDATE SMTP CONFIGURATION
    # --------------------------------------------------------

    if not all(
        [
            settings.SMTP_HOST,
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD,
            settings.SMTP_FROM_EMAIL,
        ]
    ):
        raise RuntimeError(
            "SMTP configuration is incomplete. "
            "Check SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD "
            "and SMTP_FROM_EMAIL in .env."
        )

    # --------------------------------------------------------
    # CREATE EMAIL
    # --------------------------------------------------------

    message = EmailMessage()

    message["Subject"] = "NagarSetu - Reset Your Password"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email

    message.set_content(
        f"""
Hello,

We received a request to reset your NagarSetu account password.

Click the link below to create a new password:

{reset_link}

This link will expire in 15 minutes and can only be used once.

If you did not request a password reset, you can safely ignore this email.

Regards,
NagarSetu Team
""".strip()
    )

    # --------------------------------------------------------
    # SECURE SMTP CONNECTION
    # --------------------------------------------------------

    ssl_context = ssl.create_default_context()

    with smtplib.SMTP(
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        timeout=10,
    ) as smtp:

        smtp.ehlo()

        smtp.starttls(
            context=ssl_context
        )

        smtp.ehlo()

        smtp.login(
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD,
        )

        smtp.send_message(message)


def send_email_verification_code(
    to_email: str,
    code: str,
) -> None:
    """
    Send citizen email verification OTP through SMTP.
    """

    # --------------------------------------------------------
    # VALIDATE SMTP CONFIGURATION
    # --------------------------------------------------------

    if not all(
        [
            settings.SMTP_HOST,
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD,
            settings.SMTP_FROM_EMAIL,
        ]
    ):
        raise RuntimeError(
            "SMTP configuration is incomplete. "
            "Check SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD "
            "and SMTP_FROM_EMAIL in .env."
        )

    # --------------------------------------------------------
    # CREATE EMAIL
    # --------------------------------------------------------

    message = EmailMessage()

    message["Subject"] = "NagarSetu - Verify Your Email"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email

    message.set_content(
        f"""
Hello,

Your NagarSetu email verification code is:

{code}

This code is valid for 1 minute.

If you did not create a NagarSetu account, you can safely ignore this email.

Regards,
NagarSetu Team
""".strip()
    )

    # --------------------------------------------------------
    # SECURE SMTP CONNECTION
    # --------------------------------------------------------

    ssl_context = ssl.create_default_context()

    with smtplib.SMTP(
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        timeout=10,
    ) as smtp:

        smtp.ehlo()

        smtp.starttls(
            context=ssl_context
        )

        smtp.ehlo()

        smtp.login(
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD,
        )

        smtp.send_message(message)


# ============================================================
# CURRENT USER / EMPLOYEE
# ============================================================

def get_current_identity(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Authenticate the current user using the server-side
    Redis session stored in the HttpOnly browser cookie.
    """

    session_id = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    session = get_session(session_id)

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
        )

    account_id = session.get("account_id")
    role = session.get("role")

    if not account_id or role not in {
        "citizen",
        "employee",
    }:
        delete_session(session_id)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session.",
        )

    # --------------------------------------------------------
    # CITIZEN
    # --------------------------------------------------------

    if role == "citizen":

        citizen = db.execute(
            select(Citizen).where(
                Citizen.id == account_id
            )
        ).scalar_one_or_none()

        if citizen is None:
            delete_session(session_id)

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account not found.",
            )

        if not citizen.is_active:
            delete_session(session_id)

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated.",
            )

        if not citizen.email_verified:
            delete_session(session_id)

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification is required.",
            )

        return {
            "id": citizen.id,
            "name": citizen.name,
            "email": citizen.email,
            "role": "citizen",
            "password_hash": citizen.password_hash,
        }

    # --------------------------------------------------------
    # EMPLOYEE
    # --------------------------------------------------------

    employee = db.execute(
        text(
            """
            SELECT
                id,
                name,
                email,
                password_hash,
                is_active
            FROM employees
            WHERE id = :employee_id
            LIMIT 1
            """
        ),
        {
            "employee_id": account_id
        },
    ).mappings().first()

    if employee is None:
        delete_session(session_id)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found.",
        )

    if not employee["is_active"]:
        delete_session(session_id)

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    return {
        "id": employee["id"],
        "name": employee["name"],
        "email": employee["email"],
        "role": "employee",
        "password_hash": employee["password_hash"],
    }
# ============================================================
# CITIZEN REGISTER
# POST /auth/citizen/register
# ============================================================

@router.post(
    "/citizen/register",
    status_code=status.HTTP_201_CREATED,
)
def register_citizen(
    payload: CitizenRegisterRequest,
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # CLEAN INPUT
    # --------------------------------------------------------

    name = payload.name.strip()

    email = str(
        payload.email
    ).strip().lower()

    phone = (
        payload.phone.strip()
        if payload.phone
        else None
    )

    if phone == "":
        phone = None

    # --------------------------------------------------------
    # DUPLICATE EMAIL
    # --------------------------------------------------------

    existing_email = db.execute(
        select(Citizen).where(
            Citizen.email == email
        )
    ).scalar_one_or_none()

    if existing_email is not None:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # --------------------------------------------------------
    # DUPLICATE PHONE
    # --------------------------------------------------------

    if phone is not None:

        existing_phone = db.execute(
            select(Citizen).where(
                Citizen.phone == phone
            )
        ).scalar_one_or_none()

        if existing_phone is not None:

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this phone number already exists.",
            )

    # --------------------------------------------------------
    # HASH PASSWORD
    # --------------------------------------------------------

    password_hash = hash_password(
        payload.password
    )

    # --------------------------------------------------------
    # CREATE CITIZEN
    # --------------------------------------------------------

    now = datetime.now(timezone.utc)

    new_citizen = Citizen(
        name=name,
        email=email,
        phone=phone,
        password_hash=password_hash,
        trust_score=80.00,
        is_active=True,
        email_verified=False,
        email_verified_at=None,
        created_at=now,
        updated_at=now,
    )

    db.add(new_citizen)

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    try:

        db.commit()

    except IntegrityError as e:

        db.rollback()

        print(
            f"Citizen registration IntegrityError: {e.orig}",
            flush=True,
        )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email or phone number already exists.",
        )

    # --------------------------------------------------------
    # REFRESH
    # --------------------------------------------------------

    db.refresh(
        new_citizen
    )

    # --------------------------------------------------------
    # GENERATE VERIFICATION OTP
    # --------------------------------------------------------

    verification_code = generate_email_otp()

    # --------------------------------------------------------
    # STORE OTP IN REDIS
    # --------------------------------------------------------

    store_email_verification_otp(
        email=new_citizen.email,
        otp=verification_code,
    )

    # --------------------------------------------------------
    # SEND VERIFICATION EMAIL
    # --------------------------------------------------------

    try:

        send_email_verification_code(
            to_email=new_citizen.email,
            code=verification_code,
        )

    except Exception as e:

        # Remove temporary OTP state.
        delete_email_verification_otp(
            new_citizen.email
        )

        print(
            f"Email verification failed for "
            f"{new_citizen.email}: {e}",
            flush=True,
        )

        # Account remains created and can use resend verification.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Account created, but the verification email "
                "could not be sent. Please request a new verification code."
            ),
        )

    # --------------------------------------------------------
    # RETURN
    # --------------------------------------------------------

    return {
        "message": (
            "Registration successful. "
            "A verification code has been sent to your email."
        ),
        "verification_required": True,
        "email": new_citizen.email,
    }


# ============================================================
# VERIFY CITIZEN EMAIL
# POST /auth/citizen/verify-email
# ============================================================

@router.post(
    "/citizen/verify-email",
)
def verify_citizen_email(
    payload: VerifyEmailRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):

    email = str(
        payload.email
    ).strip().lower()

    # --------------------------------------------------------
    # FIND CITIZEN
    # --------------------------------------------------------

    citizen = db.execute(
        select(Citizen).where(
            Citizen.email == email
        )
    ).scalar_one_or_none()

    if citizen is None:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification request.",
        )

    # --------------------------------------------------------
    # ACCOUNT STATUS
    # --------------------------------------------------------

    if not citizen.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    # --------------------------------------------------------
    # ALREADY VERIFIED
    # --------------------------------------------------------

    if citizen.email_verified:

        # Rotate any existing browser session and issue a fresh one.
        # This also fixes the case where the browser has a stale or
        # invalid session cookie.
        existing_session_id = request.cookies.get(
            SESSION_COOKIE_NAME
        )

        if existing_session_id:
            delete_session(existing_session_id)

        session_id = create_session(
            account_id=citizen.id,
            role="citizen",
        )

        set_session_cookie(
            response=response,
            session_id=session_id,
        )

        return {
            "user": build_user_response(
                account_id=citizen.id,
                name=citizen.name,
                email=citizen.email,
                role="citizen",
            )
        }

    # --------------------------------------------------------
    # VERIFY OTP
    # --------------------------------------------------------

    valid = verify_email_otp(
        email=email,
        otp=payload.code,
    )

    if not valid:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code.",
        )

    # --------------------------------------------------------
    # MARK EMAIL VERIFIED
    # --------------------------------------------------------

    now = datetime.now(timezone.utc)

    citizen.email_verified = True
    citizen.email_verified_at = now
    citizen.updated_at = now

    try:

        db.commit()

    except Exception:

        db.rollback()

        # OTP has already been consumed. The citizen can request
        # another verification code if necessary.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to verify email. Please request a new code.",
        )

    # --------------------------------------------------------
    # CREATE SERVER-SIDE SESSION
    # --------------------------------------------------------

    old_session_id = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if old_session_id:
        delete_session(old_session_id)

    session_id = create_session(
        account_id=citizen.id,
        role="citizen",
    )

    set_session_cookie(
        response=response,
        session_id=session_id,
    )

    # --------------------------------------------------------
    # RETURN
    # --------------------------------------------------------

    return {
        "user": build_user_response(
            account_id=citizen.id,
            name=citizen.name,
            email=citizen.email,
            role="citizen",
        )
    }



# ============================================================
# RESEND CITIZEN VERIFICATION
# POST /auth/citizen/resend-verification
# ============================================================

@router.post(
    "/citizen/resend-verification",
)
def resend_citizen_verification(
    payload: ResendVerificationRequest,
    db: Session = Depends(get_db),
):

    email = str(
        payload.email
    ).strip().lower()

    # --------------------------------------------------------
    # FIND CITIZEN
    # --------------------------------------------------------

    citizen = db.execute(
        select(Citizen).where(
            Citizen.email == email
        )
    ).scalar_one_or_none()

    # --------------------------------------------------------
    # GENERIC RESPONSE
    # --------------------------------------------------------
    #
    # Don't reveal whether an email belongs to an account.
    # --------------------------------------------------------

    generic_response = {
        "message": (
            "If an unverified account with that email exists, "
            "a new verification code has been sent."
        )
    }

    if citizen is None:
        return generic_response

    if not citizen.is_active:
        return generic_response

    if citizen.email_verified:
        return {
            "message": "Email address is already verified."
        }

    # --------------------------------------------------------
    # RESEND COOLDOWN
    # --------------------------------------------------------

    if not can_resend_email_verification(email):

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Please wait before requesting another "
                "verification code."
            ),
        )

    # --------------------------------------------------------
    # GENERATE NEW OTP
    # --------------------------------------------------------

    verification_code = generate_email_otp()

    # --------------------------------------------------------
    # STORE NEW OTP
    # --------------------------------------------------------
    #
    # This replaces the previous OTP.
    # --------------------------------------------------------

    store_email_verification_otp(
        email=email,
        otp=verification_code,
    )

    # --------------------------------------------------------
    # SEND EMAIL
    # --------------------------------------------------------

    try:

        send_email_verification_code(
            to_email=email,
            code=verification_code,
        )

    except Exception as e:

        delete_email_verification_otp(
            email
        )

        print(
            f"Verification email resend failed for "
            f"{email}: {e}",
            flush=True,
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Unable to send verification email. "
                "Please try again later."
            ),
        )

    return generic_response


# ============================================================
# CITIZEN LOGIN
# POST /auth/citizen/login
# ============================================================

@router.post(
    "/citizen/login",
)
def login_citizen(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):

    email = str(
        payload.email
    ).strip().lower()

    citizen = db.execute(
        select(Citizen).where(
            Citizen.email == email
        )
    ).scalar_one_or_none()

    # --------------------------------------------------------
    # VERIFY PASSWORD
    # --------------------------------------------------------

    if (
        citizen is None
        or not verify_password(
            payload.password,
            citizen.password_hash,
        )
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # --------------------------------------------------------
    # ACCOUNT STATUS
    # --------------------------------------------------------

    if not citizen.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    # --------------------------------------------------------
    # EMAIL VERIFICATION
    # --------------------------------------------------------

    if not citizen.email_verified:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in.",
        )

    # --------------------------------------------------------
    # ROTATE EXISTING SESSION
    # --------------------------------------------------------

    old_session_id = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if old_session_id:
        delete_session(old_session_id)

    # --------------------------------------------------------
    # CREATE SERVER-SIDE SESSION
    # --------------------------------------------------------

    session_id = create_session(
        account_id=citizen.id,
        role="citizen",
    )

    set_session_cookie(
        response=response,
        session_id=session_id,
    )

    return {
        "user": build_user_response(
            account_id=citizen.id,
            name=citizen.name,
            email=citizen.email,
            role="citizen",
        )
    }


# ============================================================
# EMPLOYEE LOGIN
# POST /auth/employee/login
# ============================================================

@router.post(
    "/employee/login",
)
def login_employee(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):

    email = str(
        payload.email
    ).strip().lower()

    employee = db.execute(
        text(
            """
            SELECT
                id,
                name,
                email,
                password_hash,
                is_active
            FROM employees
            WHERE LOWER(email) = :email
            LIMIT 1
            """
        ),
        {
            "email": email
        },
    ).mappings().first()

    # --------------------------------------------------------
    # VERIFY PASSWORD
    # --------------------------------------------------------

    if (
        employee is None
        or not verify_password(
            payload.password,
            employee["password_hash"],
        )
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # --------------------------------------------------------
    # ACCOUNT STATUS
    # --------------------------------------------------------

    if not employee["is_active"]:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    # --------------------------------------------------------
    # ROTATE EXISTING SESSION
    # --------------------------------------------------------

    old_session_id = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if old_session_id:
        delete_session(old_session_id)

    # --------------------------------------------------------
    # CREATE SERVER-SIDE SESSION
    # --------------------------------------------------------

    session_id = create_session(
        account_id=employee["id"],
        role="employee",
    )

    set_session_cookie(
        response=response,
        session_id=session_id,
    )

    return {
        "user": build_user_response(
            account_id=employee["id"],
            name=employee["name"],
            email=employee["email"],
            role="employee",
        )
    }


# ============================================================
# LOGOUT
# POST /auth/logout
# ============================================================

@router.post(
    "/logout",
)
def logout(
    request: Request,
    response: Response,
):

    session_id = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    delete_session(session_id)
    clear_session_cookie(response)

    return {
        "message": "Logged out successfully."
    }


# ============================================================
# CURRENT USER
# GET /auth/me
# ============================================================

@router.get(
    "/me",
)
def get_me(
    current_user=Depends(get_current_identity),
):

    return {
        "user": build_user_response(
            account_id=current_user["id"],
            name=current_user["name"],
            email=current_user["email"],
            role=current_user["role"],
        )
    }



# ============================================================
# CHANGE PASSWORD
# POST /auth/change-password
# ============================================================

@router.post(
    "/change-password"
)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    current_user=Depends(get_current_identity),
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # VERIFY CURRENT PASSWORD
    # --------------------------------------------------------

    if not verify_password(
        payload.current_password,
        current_user["password_hash"],
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    # --------------------------------------------------------
    # VALIDATE NEW PASSWORD
    # --------------------------------------------------------

    if (
        not payload.new_password
        or len(payload.new_password) < 6
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters.",
        )

    if (
        payload.current_password
        == payload.new_password
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    new_password_hash = hash_password(
        payload.new_password
    )

    # --------------------------------------------------------
    # UPDATE PASSWORD
    # --------------------------------------------------------

    if current_user["role"] == "citizen":

        db.execute(
            text(
                """
                UPDATE citizens
                SET
                    password_hash = :password_hash,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :account_id
                """
            ),
            {
                "password_hash": new_password_hash,
                "account_id": current_user["id"],
            },
        )

    else:

        db.execute(
            text(
                """
                UPDATE employees
                SET
                    password_hash = :password_hash,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :account_id
                """
            ),
            {
                "password_hash": new_password_hash,
                "account_id": current_user["id"],
            },
        )

    db.commit()

    # --------------------------------------------------------
    # ROTATE CURRENT SESSION
    # --------------------------------------------------------

    old_session_id = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if old_session_id:
        delete_session(old_session_id)

    new_session_id = create_session(
        account_id=current_user["id"],
        role=current_user["role"],
    )

    set_session_cookie(
        response=response,
        session_id=new_session_id,
    )

    return {
        "message": "Password changed successfully."
    }


# ============================================================
# FORGOT PASSWORD
# POST /auth/forgot-password
# ============================================================

@router.post(
    "/forgot-password"
)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):

    email = str(
        payload.email
    ).strip().lower()

    # --------------------------------------------------------
    # FIND ACCOUNT
    # --------------------------------------------------------

    if payload.account_type == "citizen":

        citizen = db.execute(
            select(Citizen).where(
                Citizen.email == email
            )
        ).scalar_one_or_none()

        if (
            citizen is None
            or not citizen.is_active
        ):

            return {
                "message": (
                    "If an account with that email exists, "
                    "a password reset link has been sent."
                )
            }

        account_id = citizen.id

    else:

        employee = db.execute(
            text(
                """
                SELECT
                    id,
                    email,
                    is_active
                FROM employees
                WHERE LOWER(email) = :email
                LIMIT 1
                """
            ),
            {
                "email": email
            },
        ).mappings().first()

        if (
            employee is None
            or not employee["is_active"]
        ):

            return {
                "message": (
                    "If an account with that email exists, "
                    "a password reset link has been sent."
                )
            }

        account_id = employee["id"]

    # --------------------------------------------------------
    # GENERATE RESET TOKEN
    # --------------------------------------------------------

    raw_token = generate_password_reset_token()

    # --------------------------------------------------------
    # STORE TOKEN IN REDIS
    # --------------------------------------------------------

    store_password_reset_token(
        token=raw_token,
        account_type=payload.account_type,
        account_id=account_id,
    )

    # --------------------------------------------------------
    # CREATE RESET LINK
    # --------------------------------------------------------

    reset_link = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"/reset-password?token={raw_token}"
    )

    # --------------------------------------------------------
    # SEND EMAIL
    # --------------------------------------------------------

    try:

        send_password_reset_email(
            to_email=email,
            reset_link=reset_link,
        )

        print(
            f"Password reset email sent to {email}",
            flush=True,
        )

    except Exception as e:

        # Token must not remain usable when email delivery failed.
        consume_password_reset_token(
            raw_token
        )

        print(
            f"Password reset email failed for {email}: {e}",
            flush=True,
        )

    # --------------------------------------------------------
    # GENERIC RESPONSE
    # --------------------------------------------------------

    return {
        "message": (
            "If an account with that email exists, "
            "a password reset link has been sent."
        )
    }


# ============================================================
# RESET PASSWORD
# POST /auth/reset-password
# ============================================================

@router.post(
    "/reset-password"
)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # VALIDATE NEW PASSWORD
    # --------------------------------------------------------

    if (
        not payload.new_password
        or len(payload.new_password) < 6
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters.",
        )

    # --------------------------------------------------------
    # FIND TOKEN IN REDIS
    # --------------------------------------------------------

    reset_data = get_password_reset_account(
        payload.token
    )

    if reset_data is None:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    account_type = reset_data["account_type"]
    account_id = reset_data["account_id"]

    # --------------------------------------------------------
    # HASH NEW PASSWORD
    # --------------------------------------------------------

    new_password_hash = hash_password(
        payload.new_password
    )

    # --------------------------------------------------------
    # UPDATE ACCOUNT
    # --------------------------------------------------------

    if account_type == "citizen":

        result = db.execute(
            text(
                """
                UPDATE citizens
                SET
                    password_hash = :password_hash,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :account_id
                  AND is_active = TRUE
                """
            ),
            {
                "password_hash": new_password_hash,
                "account_id": account_id,
            },
        )

    elif account_type == "employee":

        result = db.execute(
            text(
                """
                UPDATE employees
                SET
                    password_hash = :password_hash,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :account_id
                  AND is_active = TRUE
                """
            ),
            {
                "password_hash": new_password_hash,
                "account_id": account_id,
            },
        )

    else:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token.",
        )

    # --------------------------------------------------------
    # ACCOUNT DOES NOT EXIST / INACTIVE
    # --------------------------------------------------------

    if result.rowcount != 1:

        db.rollback()

        consume_password_reset_token(
            payload.token
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to reset password for this account.",
        )

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    try:

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reset password.",
        )

    # --------------------------------------------------------
    # CONSUME TOKEN
    # --------------------------------------------------------

    consume_password_reset_token(
        payload.token
    )

    # --------------------------------------------------------
    # INVALIDATE CURRENT BROWSER SESSION
    # --------------------------------------------------------

    # A password reset should not leave the browser's old
    # authentication session active. Other sessions for the same
    # account require account-wide session invalidation support in
    # redis_auth.py and are handled separately.
    current_session_id = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if current_session_id:
        delete_session(current_session_id)
        clear_session_cookie(response)

    # --------------------------------------------------------
    # SUCCESS
    # --------------------------------------------------------

    return {
        "message": "Password reset successfully."
    }