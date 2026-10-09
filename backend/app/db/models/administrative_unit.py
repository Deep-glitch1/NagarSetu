from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, String, TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AdministrativeUnit(Base):
    __tablename__ = "administrative_units"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    unit_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    parent_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey(
            "administrative_units.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("TRUE"),
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    def __repr__(self) -> str:
        return f"<AdministrativeUnit id={self.id} code={self.code!r}>"