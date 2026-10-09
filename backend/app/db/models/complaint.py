"""
SQLAlchemy model for the complaints table.

Maps 1:1 to the table created by nagarseu_schema.sql.
This is the core entity of NagarSetu — every civic issue is a row here.

NOTE: The `location` column (GEOGRAPHY) is populated automatically
by the database trigger `fn_set_complaint_location` from the
latitude/longitude values. Do NOT set it from Python.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Float,
    ForeignKey,
    String,
    Text,
    TIMESTAMP,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    complaint_number: Mapped[Optional[str]] = mapped_column(
        String(30),
        unique=True,
        nullable=True,
        # Populated by DB trigger `fn_generate_complaint_number`.
    )

    reported_by: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("citizens.id", ondelete="RESTRICT"),
        nullable=False,
    )

    category_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("complaint_categories.id", ondelete="RESTRICT"),
        nullable=False,
    )

    administrative_unit_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("administrative_units.id", ondelete="SET NULL"),
        nullable=True,
    )

    department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    latitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    longitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    # `location` (GEOGRAPHY) is intentionally NOT mapped here.
    # It is populated by the DB trigger from lat/lon.

    status: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        server_default=text("'received'"),
        default="received",
    )

    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'medium'"),
        default="medium",
    )

    master_complaint_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("complaints.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    __table_args__ = (
        CheckConstraint(
            "master_complaint_id IS NULL OR master_complaint_id <> id",
            name="ck_complaint_no_self_master",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Complaint id={self.id} "
            f"number={self.complaint_number!r} "
            f"status={self.status!r}>"
        )