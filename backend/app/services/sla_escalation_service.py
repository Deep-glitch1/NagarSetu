"""
NagarSetu automatic complaint SLA escalation service.

Escalation levels are driven entirely by complaint_sla percentages:
    level 1 -> warning_percentage           (default 50%) -> assigned officer
    level 2 -> supervisor_percentage        (default 80%) -> supervisor
    level 3 -> overdue_percentage            (default 100%) -> supervisor
    level 4 -> critical_backlog_percentage  (default 300%) -> department head

The job is idempotent because complaint_escalations has a UNIQUE
(complaint_id, escalation_level) constraint.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.services.notification_service import (
    safe_send_sla_escalation_notification,
)


SLA_ESCALATION_LOCK_KEY = 48276193
SLA_ESCALATION_INTERVAL_SECONDS = 300


@dataclass
class EscalationResult:
    processed_complaints: int = 0
    new_escalations: int = 0
    notifications_sent: int = 0
    notification_failures: int = 0
    skipped_locked: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "processed_complaints": self.processed_complaints,
            "new_escalations": self.new_escalations,
            "notifications_sent": self.notifications_sent,
            "notification_failures": self.notification_failures,
            "skipped_locked": self.skipped_locked,
        }


def _get_escalation_target(
    db: Session,
    *,
    level: int,
    department_id: int | None,
    administrative_unit_id: int | None,
    complaint_id: int,
) -> dict[str, object] | None:
    """Pick the best active employee for an escalation level."""

    if level == 1:
        # 50% warning goes to the currently assigned officer.
        officer = db.execute(
            text(
                """
                SELECT
                    e.id,
                    e.name,
                    e.email
                FROM complaint_assignments ca
                JOIN employees e
                    ON e.id = ca.officer_id
                WHERE ca.complaint_id = :complaint_id
                  AND ca.unassigned_at IS NULL
                  AND e.is_active = TRUE
                LIMIT 1
                """
            ),
            {"complaint_id": complaint_id},
        ).mappings().first()

        if officer is None:
            return None

        return {
            "id": int(officer["id"]),
            "name": officer["name"],
            "email": officer["email"],
            "role": "officer",
        }

    if level in (2, 3):
        role_names = ("supervisor",)
    else:
        role_names = ("department_head",)

    row = db.execute(
        text(
            """
            SELECT
                e.id,
                e.name,
                e.email,
                r.name AS role
            FROM employees e
            JOIN employee_roles er
                ON er.employee_id = e.id
            JOIN roles r
                ON r.id = er.role_id
            WHERE e.is_active = TRUE
              AND r.name IN :role_names
            ORDER BY
                CASE
                    WHEN :department_id IS NOT NULL
                     AND e.department_id = :department_id
                     AND :administrative_unit_id IS NOT NULL
                     AND e.administrative_unit_id = :administrative_unit_id
                    THEN 0
                    WHEN :administrative_unit_id IS NOT NULL
                     AND e.administrative_unit_id = :administrative_unit_id
                    THEN 1
                    WHEN :department_id IS NOT NULL
                     AND e.department_id = :department_id
                    THEN 2
                    ELSE 3
                END,
                e.id
            LIMIT 1
            """
        ).bindparams(
            bindparam("role_names", expanding=True)
        ),
        {
            "role_names": list(role_names),
            "department_id": department_id,
            "administrative_unit_id": administrative_unit_id,
        },
    ).mappings().first()

    if row is None:
        return None

    return {
        "id": int(row["id"]),
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
    }


def _get_assigned_officer(
    db: Session,
    *,
    complaint_id: int,
) -> dict[str, object] | None:
    """Return the current active officer assignment for a complaint."""

    row = db.execute(
        text(
            """
            SELECT
                e.id,
                e.name,
                e.email
            FROM complaint_assignments ca
            JOIN employees e
                ON e.id = ca.officer_id
            WHERE ca.complaint_id = :complaint_id
              AND ca.unassigned_at IS NULL
              AND e.is_active = TRUE
            LIMIT 1
            """
        ),
        {"complaint_id": complaint_id},
    ).mappings().first()

    if row is None:
        return None

    return {
        "id": int(row["id"]),
        "name": row["name"],
        "email": row["email"],
    }


def run_sla_escalation_job(db: Session) -> EscalationResult:
    """
    Evaluate every active complaint and create any missing SLA escalations.

    The PostgreSQL advisory lock guarantees that multiple API workers do not
    execute the same escalation pass concurrently.
    """

    result = EscalationResult()
    notifications: list[dict[str, object]] = []

    lock_row = db.execute(
        text(
            "SELECT pg_try_advisory_lock(:lock_key) AS locked"
        ),
        {"lock_key": SLA_ESCALATION_LOCK_KEY},
    ).mappings().first()

    if not lock_row or not lock_row["locked"]:
        db.rollback()
        result.skipped_locked = True
        return result

    try:
        complaints = db.execute(
            text(
                """
                SELECT
                    c.id,
                    c.complaint_number,
                    c.department_id,
                    c.administrative_unit_id,
                    c.status,
                    c.created_at,
                    sla.target_hours,
                    sla.warning_percentage,
                    sla.supervisor_percentage,
                    sla.overdue_percentage,
                    sla.critical_backlog_percentage
                FROM complaints c
                JOIN complaint_sla sla
                    ON sla.category_id = c.category_id
                WHERE c.master_complaint_id IS NULL
                  AND c.status NOT IN (
                    'verified',
                    'closed',
                    'rejected'
                  )
                  AND sla.target_hours > 0
                ORDER BY c.created_at ASC
                """
            )
        ).mappings().all()

        result.processed_complaints = len(complaints)

        for complaint in complaints:
            created_at = complaint["created_at"]
            if created_at is None:
                continue

            elapsed_hours_row = db.execute(
                text(
                    """
                    SELECT EXTRACT(
                        EPOCH FROM (CURRENT_TIMESTAMP - :created_at)
                    ) / 3600.0 AS elapsed_hours
                    """
                ),
                {"created_at": created_at},
            ).mappings().first()

            elapsed_hours = max(
                0.0,
                float(elapsed_hours_row["elapsed_hours"] or 0.0),
            )
            elapsed_percentage = (
                elapsed_hours / float(complaint["target_hours"])
            ) * 100.0

            thresholds = (
                (
                    1,
                    int(complaint["warning_percentage"] or 50),
                    "SLA reached warning threshold.",
                ),
                (
                    2,
                    int(complaint["supervisor_percentage"] or 80),
                    "SLA reached supervisor escalation threshold.",
                ),
                (
                    3,
                    int(complaint["overdue_percentage"] or 100),
                    "SLA reached overdue escalation threshold.",
                ),
                (
                    4,
                    int(complaint["critical_backlog_percentage"] or 300),
                    "SLA reached critical backlog escalation threshold.",
                ),
            )

            for level, threshold, base_reason in thresholds:
                if elapsed_percentage < threshold:
                    continue

                reason = (
                    f"{base_reason} "
                    f"Current SLA usage: {elapsed_percentage:.1f}%. "
                    f"Target: {threshold}%."
                )

                target = _get_escalation_target(
                    db,
                    complaint_id=int(complaint["id"]),
                    level=level,
                    department_id=complaint["department_id"],
                    administrative_unit_id=complaint["administrative_unit_id"],
                )

                target_employee_id = target["id"] if target else None

                inserted_id = db.execute(
                    text(
                        """
                        INSERT INTO complaint_escalations (
                            complaint_id,
                            escalation_level,
                            escalation_percentage,
                            escalated_to,
                            reason
                        )
                        VALUES (
                            :complaint_id,
                            :escalation_level,
                            :escalation_percentage,
                            :escalated_to,
                            :reason
                        )
                        ON CONFLICT (complaint_id, escalation_level)
                        DO NOTHING
                        RETURNING id
                        """
                    ),
                    {
                        "complaint_id": complaint["id"],
                        "escalation_level": level,
                        "escalation_percentage": int(
                            round(elapsed_percentage)
                        ),
                        "escalated_to": target_employee_id,
                        "reason": reason,
                    },
                ).scalar_one_or_none()

                if inserted_id is not None:
                    result.new_escalations += 1

                    notification_targets: list[dict[str, object]] = []

                    if level == 2:
                        # At 80%, notify both the assigned officer and supervisor.
                        officer = _get_assigned_officer(
                            db,
                            complaint_id=int(complaint["id"]),
                        )
                        if officer and officer.get("email"):
                            notification_targets.append(officer)

                    if target and target.get("email"):
                        notification_targets.append(target)

                    # Prevent duplicate emails if the same employee has multiple roles.
                    seen_emails: set[str] = set()
                    for recipient in notification_targets:
                        email = str(recipient["email"]).strip().lower()
                        if not email or email in seen_emails:
                            continue
                        seen_emails.add(email)
                        notifications.append(
                            {
                                "to_email": recipient["email"],
                                "recipient_name": recipient.get("name"),
                                "complaint_number": complaint["complaint_number"],
                                "escalation_level": level,
                                "escalation_percentage": int(round(elapsed_percentage)),
                                "reason": reason,
                            }
                        )

        db.commit()

        for notification in notifications:
            if safe_send_sla_escalation_notification(**notification):
                result.notifications_sent += 1
            else:
                result.notification_failures += 1

        return result

    except SQLAlchemyError:
        db.rollback()
        raise
    finally:
        try:
            db.execute(
                text(
                    "SELECT pg_advisory_unlock(:lock_key)"
                ),
                {"lock_key": SLA_ESCALATION_LOCK_KEY},
            )
            db.commit()
        except SQLAlchemyError:
            db.rollback()
