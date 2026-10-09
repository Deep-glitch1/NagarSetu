from sqlalchemy import BigInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class RoadSegment(Base):
    __tablename__ = "road_segments"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    def __repr__(self) -> str:
        return f"<RoadSegment id={self.id}>"