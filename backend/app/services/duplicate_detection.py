from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session


DUPLICATE_RADIUS_METERS = 50
DUPLICATE_WINDOW_DAYS = 14


def find_duplicate_master(
    *,
    db: Session,
    category_id: int,
    citizen_id: int,
    latitude: float,
    longitude: float,
) -> int | None:
    """
    A complaint is considered a duplicate only when:

    - same citizen
    - same complaint category
    - within 50 meters
    - within the last 14 days
    - existing complaint is still active

    A complaint from another citizen is NOT treated as
    a duplicate. It can instead contribute to clustering.
    """

    cutoff = (
        datetime.now(timezone.utc)
        - timedelta(
            days=DUPLICATE_WINDOW_DAYS
        )
    )

    duplicate_id = db.execute(
        text(
            """
            SELECT c.id
            FROM complaints c
            WHERE c.category_id = :category_id
              AND c.reported_by = :citizen_id
              AND c.created_at >= :cutoff
              AND c.status NOT IN (
                    'closed',
                    'rejected'
              )
              AND ST_DWithin(
                    c.location,
                    ST_SetSRID(
                        ST_MakePoint(
                            :longitude,
                            :latitude
                        ),
                        4326
                    )::geography,
                    :radius
              )
            ORDER BY c.created_at ASC
            LIMIT 1
            """
        ),
        {
            "category_id": category_id,
            "citizen_id": citizen_id,
            "cutoff": cutoff,
            "longitude": longitude,
            "latitude": latitude,
            "radius": DUPLICATE_RADIUS_METERS,
        },
    ).scalar_one_or_none()

    if duplicate_id is None:
        return None

    return int(duplicate_id)