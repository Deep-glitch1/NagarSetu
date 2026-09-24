"""
SQLAlchemy model for the nagarsetu.citizens table.

Maps 1:1 to the table created by nagarseu_schema.sql.
Contains the fields required for authentication and citizen management.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import BigInteger, Boolean, Numeric, String, Text, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Citizen(Base):
    __tablename__ = "citizens"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
    )

    phone: Mapped[Optional[str]] = mapped_column(
        String(15),
        unique=True,
        nullable=True,
    )

    password_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    trust_score: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    email_verified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Citizen id={self.id} email={self.email!r}>"