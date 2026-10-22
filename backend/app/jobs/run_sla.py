"""
NagarSetu SLA scheduler entry point.

Run this script periodically, preferably every hour.
"""

from app.db.database import SessionLocal
from app.services.complaint_intelligence import (
    run_sla_engine,
)


def main() -> None:
    db = SessionLocal()

    try:

        result = run_sla_engine(db)

        print(
            "NagarSetu SLA engine completed:"
        )

        print(result)

    except Exception as exc:

        db.rollback()

        print(
            "NagarSetu SLA engine failed:",
            exc,
        )

        raise

    finally:

        db.close()


if __name__ == "__main__":
    main()