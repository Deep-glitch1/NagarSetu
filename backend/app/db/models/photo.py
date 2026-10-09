"""
SQLAlchemy model for the complaint_photos table.

Maps 1:1 to the table created by nagarseu_schema.sql.
Each complaint can have multiple photos:
    - 'initial'     — citizen's original photo
    - 'resolution'  — officer's completion photo (for verification)
    - 'evidence'    — any additional supporting photo
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, String, Text, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ComplaintPhoto(Base):
    __tablename__ = "complaint_photos"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    complaint_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
    )

    photo_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    photo_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    uploaded_by: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    def __repr__(self) -> str:
        return (
            f"<ComplaintPhoto id={self.id} "
            f"complaint_id={self.complaint_id} "
            f"type={self.photo_type!r}>"
        )