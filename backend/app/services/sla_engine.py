"""
NagarSetu SLA + dynamic priority engine.

Runs periodically, ideally every hour.

Responsibilities:

1. Refresh spatial clusters.
2. Recalculate priority for every open master complaint.
3. Recalculate SLA age/state.
4. Record SLA escalation levels.
5. Keep duplicate complaints out of independent
   cluster/SLA escalation processing.
"""

from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.complaint_clustering import (
    refresh_category_clusters,
)

from app.services.priority import (
    calculate_priority,
)


# ============================================================
# STATUS
# ============================================================

OPEN_STATUSES = (
    "received",
    "assigned",
    "in_progress",
    "pending_verification",
    "pending_citizen_response",
    "reopened",
)


# ============================================================
# ESCALATION TARGET
# ============================================================

def get_escalation_target(
    *,
    db: Session,
    complaint_id: int,
    department_id: int | None,
    level: int,
) -> int | None:
    """
    Determine who receives the escalation.

    Level 1:
        assigned officer

    Level 2:
        supervisor

    Level 3:
        supervisor

    Level 4:
        department head
    """

    # --------------------------------------------------------
    # LEVEL 1 -> ASSIGNED OFFICER
    # --------------------------------------------------------

    if level == 1:

        officer_id = db.execute(
            text(
                """
                SELECT ca.officer_id
                FROM complaint_assignments ca

                JOIN employees e
                    ON e.id = ca.officer_id

                WHERE ca.complaint_id = :complaint_id

                  AND ca.unassigned_at IS NULL

                  AND e.is_active = TRUE

                LIMIT 1
                """
            ),
            {
                "complaint_id": complaint_id,
            },
        ).scalar_one_or_none()

        return (
            int(officer_id)
            if officer_id is not None
            else None
        )

    # --------------------------------------------------------
    # LEVEL 2 / 3 -> SUPERVISOR
    # --------------------------------------------------------

    if level in (2, 3):

        if department_id is None:
            return None

        supervisor_id = db.execute(
            text(
                """
                SELECT e.id

                FROM employees e

                JOIN employee_roles er
                    ON er.employee_id = e.id

                JOIN roles r
                    ON r.id = er.role_id

                WHERE e.department_id = :department_id

                  AND e.is_active = TRUE

                  AND r.name = 'supervisor'

                ORDER BY e.id

                LIMIT 1
                """
            ),
            {
                "department_id": department_id,
            },
        ).scalar_one_or_none()

        return (
            int(supervisor_id)
            if supervisor_id is not None
            else None
        )

    # --------------------------------------------------------
    # LEVEL 4 -> DEPARTMENT HEAD
    # --------------------------------------------------------

    if level == 4:

        if department_id is None:
            return None

        department_head_id = db.execute(
            text(
                """
                SELECT e.id

                FROM employees e

                JOIN employee_roles er
                    ON er.employee_id = e.id

                JOIN roles r
                    ON r.id = er.role_id

                WHERE e.department_id = :department_id

                  AND e.is_active = TRUE

                  AND r.name = 'department_head'

                ORDER BY e.id

                LIMIT 1
                """
            ),
            {
                "department_id": department_id,
            },
        ).scalar_one_or_none()

        return (
            int(department_head_id)
            if department_head_id is not None
            else None
        )

    return None


# ============================================================
# INSERT ESCALATION
# ============================================================

def record_escalation(
    *,
    db: Session,
    complaint_id: int,
    department_id: int | None,
    level: int,
    percentage: int,
    reason: str,
) -> bool:
    """
    Insert one escalation record.

    UNIQUE(complaint_id, escalation_level) guarantees
    that the same escalation is not created twice.
    """

    target_id = get_escalation_target(
        db=db,
        complaint_id=complaint_id,
        department_id=department_id,
        level=level,
    )

    result = db.execute(
        text(
            """
            INSERT INTO complaint_escalations (
                complaint_id,
                escalation_level,
                escalation_percentage,
                escalated_to,
                reason,
                escalated_at
            )
            VALUES (
                :complaint_id,
                :level,
                :percentage,
                :target_id,
                :reason,
                CURRENT_TIMESTAMP
            )

            ON CONFLICT (
                complaint_id,
                escalation_level
            )
            DO NOTHING

            RETURNING id
            """
        ),
        {
            "complaint_id": complaint_id,
            "level": level,
            "percentage": percentage,
            "target_id": target_id,
            "reason": reason,
        },
    ).scalar_one_or_none()

    return result is not None


# ============================================================
# HIGHEST SLA LEVEL
# ============================================================

def get_highest_escalation_level(
    elapsed_percentage: float,
) -> int:

    if elapsed_percentage >= 300:
        return 4

    if elapsed_percentage >= 100:
        return 3

    if elapsed_percentage >= 80:
        return 2

    if elapsed_percentage >= 50:
        return 1

    return 0


# ============================================================
# MAIN SLA ENGINE
# ============================================================

def run_sla_engine(
    db: Session,
) -> dict:
    """
    Process all currently open master complaints.

    Returns execution statistics.
    """

    now = datetime.now(timezone.utc)

    # --------------------------------------------------------
    # Get categories that currently have open master complaints
    # --------------------------------------------------------

    categories = db.execute(
        text(
            """
            SELECT DISTINCT c.category_id
            FROM complaints c

            WHERE c.master_complaint_id IS NULL

              AND c.status NOT IN (
                  'verified',
                  'closed',
                  'rejected'
              )

            ORDER BY c.category_id
            """
        )
    ).scalars().all()

    processed = 0
    escalations_created = 0

    # --------------------------------------------------------
    # Process category by category
    # --------------------------------------------------------

    for category_id in categories:

        # ====================================================
        # REFRESH CLUSTERS
        # ====================================================

        cluster_sizes = (
            refresh_category_clusters(
                db=db,
                category_id=int(category_id),
            )
        )

        # ====================================================
        # FETCH COMPLAINTS + SLA
        # ====================================================

        complaints = db.execute(
            text(
                """
                SELECT
                    c.id,
                    c.category_id,
                    c.department_id,
                    c.created_at,

                    cc.code AS category_code,
                    cc.is_emergency,

                    sla.target_hours

                FROM complaints c

                JOIN complaint_categories cc
                    ON cc.id = c.category_id

                LEFT JOIN complaint_sla sla
                    ON sla.category_id = c.category_id

                WHERE c.category_id = :category_id

                  AND c.master_complaint_id IS NULL

                  AND c.status NOT IN (
                      'verified',
                      'closed',
                      'rejected'
                  )

                ORDER BY c.created_at ASC
                """
            ),
            {
                "category_id": int(category_id),
            },
        ).mappings().all()

        # ====================================================
        # PROCESS COMPLAINTS
        # ====================================================

        for complaint in complaints:

            complaint_id = int(
                complaint["id"]
            )

            department_id = (
                int(complaint["department_id"])
                if complaint["department_id"]
                is not None
                else None
            )

            target_hours = complaint[
                "target_hours"
            ]

            # No SLA configured -> priority can still
            # be calculated using a safe fallback.
            if target_hours is None:
                target_hours = 72

            cluster_size = (
                cluster_sizes.get(
                    complaint_id,
                    1,
                )
            )

            priority_data = (
                calculate_priority(
                    category_code=(
                        complaint["category_code"]
                    ),

                    cluster_size=cluster_size,

                    created_at=(
                        complaint["created_at"]
                    ),

                    target_hours=int(
                        target_hours
                    ),

                    is_emergency=bool(
                        complaint["is_emergency"]
                    ),

                    now=now,
                )
            )

            # ------------------------------------------------
            # UPDATE PRIORITY
            # ------------------------------------------------

            db.execute(
                text(
                    """
                    UPDATE complaints

                    SET priority = :priority,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = :complaint_id
                    """
                ),
                {
                    "priority": (
                        priority_data["priority"]
                    ),

                    "complaint_id": complaint_id,
                },
            )

            processed += 1

            # ------------------------------------------------
            # SLA ESCALATION
            # ------------------------------------------------

            highest_level = (
                get_highest_escalation_level(
                    priority_data[
                        "elapsed_percentage"
                    ]
                )
            )

            if highest_level == 0:
                continue

            escalation_levels = {
                1: (
                    50,
                    "SLA reached 50% warning threshold."
                ),
                2: (
                    80,
                    "SLA reached 80% supervisor threshold."
                ),
                3: (
                    100,
                    "Complaint is overdue at 100% of SLA."
                ),
                4: (
                    300,
                    "Complaint reached 300% SLA critical backlog."
                ),
            }

            # If scheduler missed an earlier hour,
            # create all previously triggered levels too.
            for level in range(
                1,
                highest_level + 1,
            ):

                percentage, reason = (
                    escalation_levels[level]
                )

                created = record_escalation(
                    db=db,

                    complaint_id=complaint_id,

                    department_id=department_id,

                    level=level,

                    percentage=percentage,

                    reason=(
                        f"{reason} "
                        f"Elapsed: "
                        f"{priority_data['elapsed_percentage']:.2f}%."
                    ),
                )

                if created:
                    escalations_created += 1

        # ----------------------------------------------------
        # Make duplicate tickets follow their master priority
        # ----------------------------------------------------

        db.execute(
            text(
                """
                UPDATE complaints duplicate

                SET priority = master.priority,
                    updated_at = CURRENT_TIMESTAMP

                FROM complaints master

                WHERE duplicate.master_complaint_id
                    = master.id

                  AND duplicate.category_id
                    = :category_id

                  AND duplicate.status NOT IN (
                      'verified',
                      'closed',
                      'rejected'
                  )
                """
            ),
            {
                "category_id": int(category_id),
            },
        )

    # ========================================================
    # COMMIT
    # ========================================================

    db.commit()

    return {
        "processed_complaints": processed,
        "new_escalations": escalations_created,
    }