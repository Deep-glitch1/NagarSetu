"""
Security utilities for NagarSetu.

Two responsibilities:
  1. Password hashing / verification (bcrypt)
"""
import bcrypt

from app.core.config import settings


# ============================================================
# PASSWORD HASHING (bcrypt)
# ============================================================

def hash_password(plain_password: str) -> str:
    """
    Hash a plain-text password using bcrypt.
    Returns a string that includes the salt, safe to store in DB.
    """
    if not plain_password:
        raise ValueError("Password cannot be empty")

    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """
    Compare a plain-text password against a bcrypt hash.
    Returns True if they match, False otherwise.
    Never raises — returns False on any malformed input.
    """
    if not plain_password or not password_hash:
        return False

    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False

