import hashlib
import hmac
import secrets

from app.core.config import settings
from app.db.redis import redis_client


# -----------------------------
# Key helpers
# -----------------------------

def _hash_identifier(value: str) -> str:
    return hashlib.sha256(
        value.strip().lower().encode()
    ).hexdigest()


def _hash_value(value: str) -> str:
    return hmac.new(
        settings.AUTH_HASH_SECRET.encode(),
        value.encode(),
        hashlib.sha256
    ).hexdigest()


# -----------------------------
# Email Verification OTP
# -----------------------------

EMAIL_VERIFY_TTL = 60                 # 1 minute
EMAIL_VERIFY_RESEND_COOLDOWN = 25    # 30 seconds
EMAIL_VERIFY_MAX_ATTEMPTS = 5


def generate_email_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def store_email_verification_otp(
    email: str,
    otp: str
):
    identifier = _hash_identifier(email)

    otp_key = f"nagarseu:email_verify:{identifier}"
    attempts_key = f"nagarseu:email_verify_attempts:{identifier}"
    cooldown_key = f"nagarseu:email_verify_cooldown:{identifier}"

    otp_hash = _hash_value(f"{identifier}:{otp}")

    # Store OTP for exactly 60 seconds
    redis_client.setex(
        otp_key,
        EMAIL_VERIFY_TTL,
        otp_hash
    )

    # Reset attempts whenever a new OTP is generated
    redis_client.setex(
        attempts_key,
        EMAIL_VERIFY_TTL,
        "0"
    )

    # Prevent immediate resend
    redis_client.setex(
        cooldown_key,
        EMAIL_VERIFY_RESEND_COOLDOWN,
        "1"
    )


def verify_email_otp(
    email: str,
    otp: str
) -> bool:

    identifier = _hash_identifier(email)

    otp_key = f"nagarseu:email_verify:{identifier}"
    attempts_key = f"nagarseu:email_verify_attempts:{identifier}"

    stored_hash = redis_client.get(otp_key)

    # OTP expired or doesn't exist
    if not stored_hash:
        return False

    attempts = int(redis_client.get(attempts_key) or 0)

    if attempts >= EMAIL_VERIFY_MAX_ATTEMPTS:
        return False

    supplied_hash = _hash_value(
        f"{identifier}:{otp}"
    )

    if not hmac.compare_digest(
        stored_hash,
        supplied_hash
    ):
        redis_client.incr(attempts_key)
        return False

    # Correct OTP → remove temporary state
    redis_client.delete(
        otp_key,
        attempts_key,
        f"nagarseu:email_verify_cooldown:{identifier}"
    )

    return True


def can_resend_email_verification(email: str) -> bool:
    identifier = _hash_identifier(email)

    cooldown_key = (
        f"nagarseu:email_verify_cooldown:{identifier}"
    )

    return not bool(redis_client.exists(cooldown_key))


# -----------------------------
# Password Reset
# -----------------------------

PASSWORD_RESET_TTL = 15 * 60          # 15 minutes
PASSWORD_RESET_COOLDOWN = 60          # 1 minute


def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(32)


def store_password_reset_token(
    token: str,
    account_type: str,
    account_id: int
):
    token_hash = _hash_value(token)

    key = f"nagarseu:password_reset:{token_hash}"

    redis_client.setex(
        key,
        PASSWORD_RESET_TTL,
        f"{account_type}:{account_id}"
    )


def get_password_reset_account(
    token: str
):
    token_hash = _hash_value(token)

    key = f"nagarseu:password_reset:{token_hash}"

    value = redis_client.get(key)

    if not value:
        return None

    account_type, account_id = value.split(":", 1)

    return {
        "account_type": account_type,
        "account_id": int(account_id),
        "key": key
    }


def consume_password_reset_token(
    token: str
):
    token_hash = _hash_value(token)

    key = f"nagarseu:password_reset:{token_hash}"

    redis_client.delete(key)

def delete_email_verification_otp(email: str):
    identifier = _hash_identifier(email)

    redis_client.delete(
        f"nagarseu:email_verify:{identifier}",
        f"nagarseu:email_verify_attempts:{identifier}",
        f"nagarseu:email_verify_cooldown:{identifier}",
    )
# ============================================================
# REDIS SERVER-SIDE SESSIONS
# ============================================================

import json
import secrets
import time


# Maximum lifetime of a session from the time it is created.
SESSION_ABSOLUTE_TTL = 60 * 60 * 24 * 7  # 7 days

# Maximum time a session can remain inactive.
SESSION_IDLE_TTL = 60 * 60 * 24  # 24 hours

SESSION_COOKIE_NAME = "nagarsetu_session"


def _hash_session_id(session_id: str) -> str:
    """
    Hash the raw session ID before using it as a Redis key.
    """

    return hashlib.sha256(
        session_id.encode("utf-8")
    ).hexdigest()


def _session_key(session_id: str) -> str:
    """
    Return the Redis key for a session.
    """

    return (
        f"auth:session:{_hash_session_id(session_id)}"
    )


def _apply_session_expiration(
    session_key: str,
    created_at: int,
) -> bool:
    """
    Apply the correct Redis TTL.

    The session has two limits:

    1. Idle timeout:
       Session expires after 24 hours without activity.

    2. Absolute lifetime:
       Session can never live longer than 7 days
       from its original creation time.
    """

    now = int(time.time())

    elapsed = now - created_at

    # Absolute lifetime already exceeded.
    if elapsed >= SESSION_ABSOLUTE_TTL:
        redis_client.delete(session_key)
        return False

    remaining_absolute = (
        SESSION_ABSOLUTE_TTL - elapsed
    )

    # Session should expire at whichever limit
    # happens first.
    new_ttl = min(
        SESSION_IDLE_TTL,
        remaining_absolute,
    )

    return bool(
        redis_client.expire(
            session_key,
            new_ttl,
        )
    )


def create_session(
    account_id: int,
    role: str,
) -> str:
    """
    Create a server-side authentication session.

    Redis stores the session data.
    The raw session ID is returned to FastAPI,
    which places it inside an HttpOnly cookie.
    """

    session_id = secrets.token_urlsafe(32)

    session_key = _session_key(session_id)

    session_data = {
        "account_id": account_id,
        "role": role,
        "created_at": int(time.time()),
    }

    redis_client.setex(
        session_key,
        SESSION_IDLE_TTL,
        json.dumps(session_data),
    )

    return session_id


def get_session(
    session_id: str | None,
):
    """
    Retrieve a session from Redis.

    Every successful request refreshes the
    idle timeout, but the absolute 7-day
    lifetime cannot be extended.
    """

    if not session_id:
        return None

    session_key = _session_key(session_id)

    raw_session = redis_client.get(session_key)

    if raw_session is None:
        return None

    try:
        session_data = json.loads(raw_session)

    except (TypeError, ValueError):
        redis_client.delete(session_key)
        return None

    created_at = session_data.get("created_at")

    if not isinstance(created_at, int):
        redis_client.delete(session_key)
        return None

    # Refresh idle timeout while respecting
    # the absolute 7-day lifetime.
    if not _apply_session_expiration(
        session_key,
        created_at,
    ):
        return None

    return session_data


def delete_session(
    session_id: str | None,
) -> None:
    """
    Delete a session from Redis.
    """

    if not session_id:
        return

    session_key = _session_key(session_id)

    redis_client.delete(session_key)


def refresh_session(
    session_id: str,
) -> bool:
    """
    Refresh the session idle timeout.

    The absolute 7-day lifetime is never extended.
    """

    if not session_id:
        return False

    session_key = _session_key(session_id)

    raw_session = redis_client.get(session_key)

    if raw_session is None:
        return False

    try:
        session_data = json.loads(raw_session)

    except (TypeError, ValueError):
        redis_client.delete(session_key)
        return False

    created_at = session_data.get("created_at")

    if not isinstance(created_at, int):
        redis_client.delete(session_key)
        return False

    return _apply_session_expiration(
        session_key,
        created_at,
    )