"""Admin complaint analytics powered directly from NagarSetu complaint data."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.routers.auth import get_current_identity
from app.services.complaint_service import require_employee_permission


router = APIRouter(
    prefix="/admin/analytics",
    tags=["admin analytics"],
)


FINAL_STATUSES = ("verified", "closed")
EXCLUDED_ACTIVE_STATUSES = ("verified", "closed", "rejected")


@router.get("")
def get_admin_analytics(
    days: int = Query(default=30, ge=7, le=90),
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Return complaint/SLA analytics for the admin portal."""

    if current_user.get("role") != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee access required.",
        )

    require_employee_permission(
        db=db,
        employee_id=int(current_user["id"]),
        permission_code="REPORT_VIEW",
    )

    overview = db.execute(
        text(
            """
            WITH resolved AS (
                SELECT
                    c.id,
                    c.created_at,
                    sla.target_hours,
                    MAX(sh.changed_at) FILTER (
                        WHERE sh.new_status IN ('verified', 'closed')
                    ) AS resolved_at
                FROM complaints c
                LEFT JOIN complaint_sla sla
                    ON sla.category_id = c.category_id
                LEFT JOIN status_history sh
                    ON sh.complaint_id = c.id
                GROUP BY c.id, c.created_at, sla.target_hours
            )
            SELECT
                COUNT(*) AS total_complaints,
                COUNT(*) FILTER (
                    WHERE c.status NOT IN ('verified', 'closed', 'rejected')
                ) AS active_complaints,
                COUNT(*) FILTER (
                    WHERE c.status IN ('verified', 'closed')
                ) AS resolved_complaints,
                COUNT(*) FILTER (
                    WHERE c.status = 'rejected'
                ) AS rejected_complaints,
                COUNT(*) FILTER (
                    WHERE c.status = 'reopened'
                ) AS reopened_complaints,
                COUNT(*) FILTER (
                    WHERE c.status = 'pending_verification'
                ) AS pending_verification,
                COUNT(*) FILTER (
                    WHERE c.status NOT IN ('verified', 'closed', 'rejected')
                      AND sla.target_hours IS NOT NULL
                      AND CURRENT_TIMESTAMP > c.created_at
                            + make_interval(hours => sla.target_hours)
                ) AS overdue_complaints,
                COUNT(*) FILTER (
                    WHERE c.priority = 'critical'
                      AND c.status NOT IN ('verified', 'closed', 'rejected')
                ) AS critical_backlog,
                ROUND(
                    AVG(
                        EXTRACT(EPOCH FROM (r.resolved_at - r.created_at)) / 3600.0
                    ) FILTER (
                        WHERE r.resolved_at IS NOT NULL
                    )::numeric,
                    2
                ) AS avg_resolution_hours,
                COUNT(*) FILTER (
                    WHERE r.resolved_at IS NOT NULL
                      AND r.target_hours IS NOT NULL
                      AND r.resolved_at <= r.created_at
                            + make_interval(hours => r.target_hours)
                ) AS resolved_within_sla,
                COUNT(*) FILTER (
                    WHERE r.resolved_at IS NOT NULL
                      AND r.target_hours IS NOT NULL
                ) AS resolved_with_sla_target
            FROM complaints c
            LEFT JOIN complaint_sla sla
                ON sla.category_id = c.category_id
            LEFT JOIN resolved r
                ON r.id = c.id
            """
        )
    ).mappings().one()

    total_sla_resolved = int(overview["resolved_with_sla_target"] or 0)
    resolved_within_sla = int(overview["resolved_within_sla"] or 0)
    sla_compliance = (
        round((resolved_within_sla / total_sla_resolved) * 100.0, 2)
        if total_sla_resolved
        else 0.0
    )

    status_rows = db.execute(
        text(
            """
            SELECT
                status,
                COUNT(*) AS count
            FROM complaints
            GROUP BY status
            ORDER BY count DESC, status
            """
        )
    ).mappings().all()

    priority_rows = db.execute(
        text(
            """
            SELECT
                priority,
                COUNT(*) AS count
            FROM complaints
            GROUP BY priority
            ORDER BY
                CASE priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                    ELSE 5
                END
            """
        )
    ).mappings().all()

    category_rows = db.execute(
        text(
            """
            SELECT
                cc.code,
                cc.name,
                COUNT(c.id) AS total,
                COUNT(c.id) FILTER (
                    WHERE c.status IN ('verified', 'closed')
                ) AS resolved,
                COUNT(c.id) FILTER (
                    WHERE c.status NOT IN ('verified', 'closed', 'rejected')
                      AND sla.target_hours IS NOT NULL
                      AND CURRENT_TIMESTAMP > c.created_at
                            + make_interval(hours => sla.target_hours)
                ) AS overdue
            FROM complaint_categories cc
            LEFT JOIN complaints c
                ON c.category_id = cc.id
            LEFT JOIN complaint_sla sla
                ON sla.category_id = c.category_id
            GROUP BY cc.id, cc.code, cc.name
            HAVING COUNT(c.id) > 0
            ORDER BY total DESC, cc.name
            """
        )
    ).mappings().all()

    department_rows = db.execute(
        text(
            """
            SELECT
                d.id,
                d.code,
                d.name,
                COUNT(c.id) AS total,
                COUNT(c.id) FILTER (
                    WHERE c.status IN ('verified', 'closed')
                ) AS resolved,
                COUNT(c.id) FILTER (
                    WHERE c.status NOT IN ('verified', 'closed', 'rejected')
                      AND sla.target_hours IS NOT NULL
                      AND CURRENT_TIMESTAMP > c.created_at
                            + make_interval(hours => sla.target_hours)
                ) AS overdue,
                COUNT(c.id) FILTER (
                    WHERE c.priority = 'critical'
                      AND c.status NOT IN ('verified', 'closed', 'rejected')
                ) AS critical
            FROM departments d
            LEFT JOIN complaints c
                ON c.department_id = d.id
            LEFT JOIN complaint_sla sla
                ON sla.category_id = c.category_id
            GROUP BY d.id, d.code, d.name
            ORDER BY total DESC, d.name
            """
        )
    ).mappings().all()

    area_rows = db.execute(
        text(
            """
            SELECT
                au.id,
                au.code,
                au.name,
                au.unit_type,
                COUNT(c.id) AS total,
                COUNT(c.id) FILTER (
                    WHERE c.status IN ('verified', 'closed')
                ) AS resolved,
                COUNT(c.id) FILTER (
                    WHERE c.status NOT IN ('verified', 'closed', 'rejected')
                      AND sla.target_hours IS NOT NULL
                      AND CURRENT_TIMESTAMP > c.created_at
                            + make_interval(hours => sla.target_hours)
                ) AS overdue
            FROM administrative_units au
            LEFT JOIN complaints c
                ON c.administrative_unit_id = au.id
            LEFT JOIN complaint_sla sla
                ON sla.category_id = c.category_id
            GROUP BY au.id, au.code, au.name, au.unit_type
            HAVING COUNT(c.id) > 0
            ORDER BY total DESC, au.name
            LIMIT 15
            """
        )
    ).mappings().all()

    trend_rows = db.execute(
        text(
            """
            WITH days AS (
                SELECT generate_series(
                    CURRENT_DATE - (:days - 1) * INTERVAL '1 day',
                    CURRENT_DATE,
                    INTERVAL '1 day'
                )::date AS day
            ),
            incoming AS (
                SELECT DATE(created_at) AS day, COUNT(*) AS count
                FROM complaints
                WHERE created_at >= CURRENT_DATE - (:days - 1) * INTERVAL '1 day'
                GROUP BY DATE(created_at)
            ),
            resolved AS (
                SELECT DATE(sh.changed_at) AS day, COUNT(DISTINCT sh.complaint_id) AS count
                FROM status_history sh
                JOIN complaints c
                    ON c.id = sh.complaint_id
                WHERE sh.new_status IN ('verified', 'closed')
                  AND sh.changed_at >= CURRENT_DATE - (:days - 1) * INTERVAL '1 day'
                GROUP BY DATE(sh.changed_at)
            ),
            overdue AS (
                SELECT
                    DATE(c.created_at) AS day,
                    COUNT(*) AS count
                FROM complaints c
                JOIN complaint_sla sla
                    ON sla.category_id = c.category_id
                WHERE c.created_at >= CURRENT_DATE - (:days - 1) * INTERVAL '1 day'
                  AND c.status NOT IN ('verified', 'closed', 'rejected')
                  AND CURRENT_TIMESTAMP > c.created_at
                        + make_interval(hours => sla.target_hours)
                GROUP BY DATE(c.created_at)
            )
            SELECT
                d.day,
                COALESCE(i.count, 0) AS incoming,
                COALESCE(r.count, 0) AS resolved,
                COALESCE(o.count, 0) AS overdue
            FROM days d
            LEFT JOIN incoming i ON i.day = d.day
            LEFT JOIN resolved r ON r.day = d.day
            LEFT JOIN overdue o ON o.day = d.day
            ORDER BY d.day
            """
        ),
        {"days": days},
    ).mappings().all()

    escalation_rows = db.execute(
        text(
            """
            SELECT
                escalation_level,
                COUNT(*) AS count
            FROM complaint_escalations
            WHERE escalated_at >= CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')
            GROUP BY escalation_level
            ORDER BY escalation_level
            """
        ),
        {"days": days},
    ).mappings().all()

    escalation_total = sum(int(row["count"] or 0) for row in escalation_rows)

    return {
        "success": True,
        "window_days": days,
        "overview": {
            "total_complaints": int(overview["total_complaints"] or 0),
            "active_complaints": int(overview["active_complaints"] or 0),
            "resolved_complaints": int(overview["resolved_complaints"] or 0),
            "rejected_complaints": int(overview["rejected_complaints"] or 0),
            "reopened_complaints": int(overview["reopened_complaints"] or 0),
            "pending_verification": int(overview["pending_verification"] or 0),
            "overdue_complaints": int(overview["overdue_complaints"] or 0),
            "critical_backlog": int(overview["critical_backlog"] or 0),
            "avg_resolution_hours": float(overview["avg_resolution_hours"] or 0.0),
            "sla_compliance_percentage": sla_compliance,
            "escalation_count": escalation_total,
        },
        "status_breakdown": [
            {"status": row["status"], "count": int(row["count"])}
            for row in status_rows
        ],
        "priority_breakdown": [
            {"priority": row["priority"], "count": int(row["count"])}
            for row in priority_rows
        ],
        "categories": [
            {
                "code": row["code"],
                "name": row["name"],
                "total": int(row["total"] or 0),
                "resolved": int(row["resolved"] or 0),
                "overdue": int(row["overdue"] or 0),
            }
            for row in category_rows
        ],
        "departments": [
            {
                "id": int(row["id"]),
                "code": row["code"],
                "name": row["name"],
                "total": int(row["total"] or 0),
                "resolved": int(row["resolved"] or 0),
                "overdue": int(row["overdue"] or 0),
                "critical": int(row["critical"] or 0),
                "resolution_rate": (
                    round(
                        (int(row["resolved"] or 0) / int(row["total"] or 1)) * 100,
                        1,
                    )
                    if int(row["total"] or 0)
                    else 0.0
                ),
            }
            for row in department_rows
        ],
        "areas": [
            {
                "id": int(row["id"]),
                "code": row["code"],
                "name": row["name"],
                "unit_type": row["unit_type"],
                "total": int(row["total"] or 0),
                "resolved": int(row["resolved"] or 0),
                "overdue": int(row["overdue"] or 0),
            }
            for row in area_rows
        ],
        "trend": [
            {
                "date": row["day"].isoformat(),
                "incoming": int(row["incoming"] or 0),
                "resolved": int(row["resolved"] or 0),
                "overdue": int(row["overdue"] or 0),
            }
            for row in trend_rows
        ],
        "escalations": [
            {
                "level": int(row["escalation_level"]),
                "count": int(row["count"] or 0),
            }
            for row in escalation_rows
        ],
    }
