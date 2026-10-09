"""
SQLAlchemy model for the status_history table.

Maps 1:1 to the table created by nagarseu_schema.sql.
This is the audit trail — every complaint status change is logged here
by the trigger `fn_log_complaint_status`.

NOTE: Rows are inserted by the DB trigger, NOT by Python code.
This model exists for READ access (e.g. complaint detail page).
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, String, Text, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class StatusHistory(Base):
    __tablename__ = "status_history"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    complaint_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
    )

    old_status: Mapped[Optional[str]] = mapped_column(
        String(40),
        nullable=True,
    )

    new_status: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    changed_by: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )

    remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    changed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    def __repr__(self) -> str:
        return (
            f"<StatusHistory id={self.id} "
            f"complaint_id={self.complaint_id} "
            f"{self.old_status!r} -> {self.new_status!r}>"
        )