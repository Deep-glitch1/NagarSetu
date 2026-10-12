"""
NagarSetu employee complaint routes.

This router is intentionally separate from the citizen complaint router.
It handles employee task visibility, supervisor assignment, and task detail.
"""

from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    status,
)

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models.category import ComplaintCategory
from app.db.models.complaint import Complaint
from app.db.models.photo import ComplaintPhoto
from app.db.models.status_history import StatusHistory
from app.routers.auth import get_current_identity
from app.services.complaint_service import (
    assign_complaint,
    get_available_officers,
    require_employee_permission,
)

employee_router = APIRouter(
    prefix="/employee/complaints",
    tags=["employee complaints"],
)


def require_employee(current_user: dict) -> None:
    if current_user.get("role") != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employees can access this resource.",
        )


# ============================================================
# GET MY TASKS
# GET /employee/complaints/tasks
# ============================================================

@employee_router.get("/tasks")
def get_my_tasks(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Return only complaints currently assigned to the logged-in employee."""

    require_employee(current_user)

    require_employee_permission(
        db=db,
        employee_id=int(current_user["id"]),
        permission_code="COMPLAINT_UPDATE_STATUS",
    )

    rows = db.execute(
        text(
            """
            SELECT
                c.id,
                c.complaint_number,
                cc.code AS category,
                cc.name AS category_name,
                c.title,
                c.description,
                c.latitude,
                c.longitude,
                c.status,
                c.priority,
                c.department_id,
                d.name AS department_name,
                c.master_complaint_id,
                c.created_at,
                c.updated_at,
                ca.assigned_at,
                ca.officer_id,
                officer.employee_id AS officer_employee_id,
                officer.name AS officer_name
            FROM complaint_assignments ca
            JOIN complaints c
                ON c.id = ca.complaint_id
            JOIN complaint_categories cc
                ON cc.id = c.category_id
            LEFT JOIN departments d
                ON d.id = c.department_id
            JOIN employees officer
                ON officer.id = ca.officer_id
            WHERE ca.officer_id = :employee_id
              AND ca.unassigned_at IS NULL
              AND officer.is_active = TRUE
            ORDER BY
                CASE c.priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    ELSE 4
                END,
                c.created_at DESC
            """
        ),
        {"employee_id": int(current_user["id"])},
    ).mappings().all()

    complaints = [
        {
            "id": int(row["id"]),
            "complaint_number": row["complaint_number"],
            "category": row["category"],
            "category_name": row["category_name"],
            "title": row["title"],
            "description": row["description"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "status": row["status"],
            "priority": row["priority"],
            "department_id": row["department_id"],
            "department_name": row["department_name"],
            "master_complaint_id": row["master_complaint_id"],
            "is_duplicate": row["master_complaint_id"] is not None,
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "assignment": {
                "officer_id": int(row["officer_id"]),
                "employee_id": row["officer_employee_id"],
                "name": row["officer_name"],
                "assigned_at": row["assigned_at"],
            },
        }
        for row in rows
    ]

    return {
        "success": True,
        "count": len(complaints),
        "complaints": complaints,
    }



# ============================================================
# GET EMPLOYEE COMPLAINT QUEUE
# GET /employee/complaints
# ============================================================

@employee_router.get("")
def get_employee_complaints(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Return complaints visible to the authenticated employee by RBAC scope."""

    require_employee(current_user)

    employee = db.execute(
        text(
            """
            SELECT id, department_id
            FROM employees
            WHERE id = :employee_id
              AND is_active = TRUE
            """
        ),
        {"employee_id": int(current_user["id"])},
    ).mappings().first()

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee account is not active or does not exist.",
        )

    can_view_jurisdiction = db.execute(
        text(
            """
            SELECT fn_has_permission(
                :employee_id,
                'COMPLAINT_VIEW_JURISDICTION'
            )
            """
        ),
        {"employee_id": int(current_user["id"])},
    ).scalar_one()

    can_view_department = db.execute(
        text(
            """
            SELECT fn_has_permission(
                :employee_id,
                'COMPLAINT_VIEW_DEPARTMENT'
            )
            """
        ),
        {"employee_id": int(current_user["id"])},
    ).scalar_one()

    if not can_view_jurisdiction and not can_view_department:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view complaints.",
        )

    conditions = []
    params = {}

    if not can_view_jurisdiction:
        if employee["department_id"] is None:
            return {
                "success": True,
                "count": 0,
                "complaints": [],
            }

        conditions.append("c.department_id = :department_id")
        params["department_id"] = int(employee["department_id"])

    where_clause = (
        "WHERE " + " AND ".join(conditions)
        if conditions
        else ""
    )

    rows = db.execute(
        text(
            f"""
            SELECT
                c.id,
                c.complaint_number,
                cc.code AS category,
                cc.name AS category_name,
                c.title,
                c.description,
                c.latitude,
                c.longitude,
                c.status,
                c.priority,
                c.department_id,
                d.name AS department_name,
                c.master_complaint_id,
                c.created_at,
                c.updated_at,
                ca.officer_id,
                officer.employee_id AS officer_employee_id,
                officer.name AS officer_name
            FROM complaints c
            JOIN complaint_categories cc
                ON cc.id = c.category_id
            LEFT JOIN departments d
                ON d.id = c.department_id
            LEFT JOIN complaint_assignments ca
                ON ca.complaint_id = c.id
               AND ca.unassigned_at IS NULL
            LEFT JOIN employees officer
                ON officer.id = ca.officer_id
            {where_clause}
            ORDER BY
                CASE c.priority
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    ELSE 4
                END,
                c.created_at DESC
            """
        ),
        params,
    ).mappings().all()

    complaints = [
        {
            "id": int(row["id"]),
            "complaint_number": row["complaint_number"],
            "category": row["category"],
            "category_name": row["category_name"],
            "title": row["title"],
            "description": row["description"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "status": row["status"],
            "priority": row["priority"],
            "department_id": row["department_id"],
            "department_name": row["department_name"],
            "master_complaint_id": row["master_complaint_id"],
            "is_duplicate": row["master_complaint_id"] is not None,
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "assignment": (
                {
                    "officer_id": int(row["officer_id"]),
                    "employee_id": row["officer_employee_id"],
                    "name": row["officer_name"],
                }
                if row["officer_id"] is not None
                else None
            ),
        }
        for row in rows
    ]

    return {
        "success": True,
        "count": len(complaints),
        "complaints": complaints,
    }


# ============================================================
# GET MY TASK DETAILS
# GET /employee/complaints/{complaint_id}/task
# ============================================================

@employee_router.get("/{complaint_id}/task")
def get_my_task_details(
    complaint_id: int,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """
    Return complete details for a complaint currently assigned
    to the authenticated employee.

    Access is restricted by the active assignment, not merely
    by department or jurisdiction visibility.
    """

    if current_user.get("role") != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employees can view task details.",
        )

    employee_id = int(current_user["id"])

    row = db.execute(
        text(
            """
            SELECT
                c.id,
                c.complaint_number,
                cc.id AS category_id,
                cc.code AS category,
                cc.name AS category_name,
                c.title,
                c.description,
                c.latitude,
                c.longitude,
                c.status,
                c.priority,
                c.department_id,
                d.name AS department_name,
                c.master_complaint_id,
                c.created_at,
                c.updated_at,

                ca.id AS assignment_id,
                ca.officer_id,
                ca.assigned_at,
                ca.assigned_by,
                officer.employee_id AS officer_employee_id,
                officer.name AS officer_name,
                officer.email AS officer_email,

                assigner.name AS assigned_by_name,

                sla.target_hours,
                sla.warning_percentage,
                sla.supervisor_percentage,
                sla.overdue_percentage,
                sla.critical_backlog_percentage

            FROM complaint_assignments ca

            JOIN complaints c
                ON c.id = ca.complaint_id

            JOIN complaint_categories cc
                ON cc.id = c.category_id

            LEFT JOIN departments d
                ON d.id = c.department_id

            JOIN employees officer
                ON officer.id = ca.officer_id

            LEFT JOIN employees assigner
                ON assigner.id = ca.assigned_by

            LEFT JOIN complaint_sla sla
                ON sla.category_id = c.category_id

            WHERE ca.complaint_id = :complaint_id
              AND ca.officer_id = :employee_id
              AND ca.unassigned_at IS NULL

            LIMIT 1
            """
        ),
        {
            "complaint_id": complaint_id,
            "employee_id": employee_id,
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or is not assigned to you.",
        )

    # --------------------------------------------------------
    # PHOTOS
    # --------------------------------------------------------

    photos = db.execute(
        text(
            """
            SELECT
                id,
                photo_url,
                photo_type,
                uploaded_by,
                uploaded_at
            FROM complaint_photos
            WHERE complaint_id = :complaint_id
            ORDER BY uploaded_at ASC
            """
        ),
        {
            "complaint_id": complaint_id,
        },
    ).mappings().all()

    # --------------------------------------------------------
    # STATUS HISTORY
    # --------------------------------------------------------

    history = db.execute(
        text(
            """
            SELECT
                sh.id,
                sh.old_status,
                sh.new_status,
                sh.remarks,
                sh.changed_by,
                e.name AS changed_by_name,
                sh.changed_at
            FROM status_history sh
            LEFT JOIN employees e
                ON e.id = sh.changed_by
            WHERE sh.complaint_id = :complaint_id
            ORDER BY sh.changed_at ASC
            """
        ),
        {
            "complaint_id": complaint_id,
        },
    ).mappings().all()

    # --------------------------------------------------------
    # SLA
    # --------------------------------------------------------

    elapsed_hours = None
    elapsed_percentage = None
    sla_state = None

    if row["created_at"] is not None:
        created_at = row["created_at"]

        if created_at.tzinfo is None:
            from datetime import timezone
            created_at = created_at.replace(tzinfo=timezone.utc)

        from datetime import datetime, timezone
        elapsed_hours = max(
            0.0,
            (
                datetime.now(timezone.utc) - created_at
            ).total_seconds() / 3600.0,
        )

    target_hours = row["target_hours"]

    if target_hours is not None and float(target_hours) > 0:
        elapsed_percentage = (
            elapsed_hours / float(target_hours)
        ) * 100.0

        warning_percentage = float(
            row["warning_percentage"] or 50
        )
        supervisor_percentage = float(
            row["supervisor_percentage"] or 80
        )
        overdue_percentage = float(
            row["overdue_percentage"] or 100
        )
        critical_percentage = float(
            row["critical_backlog_percentage"] or 300
        )

        if elapsed_percentage >= critical_percentage:
            sla_state = "critical"
        elif elapsed_percentage >= overdue_percentage:
            sla_state = "overdue"
        elif elapsed_percentage >= supervisor_percentage:
            sla_state = "supervisor_escalation"
        elif elapsed_percentage >= warning_percentage:
            sla_state = "warning"
        else:
            sla_state = "on_track"

    return {
        "success": True,
        "task": {
            "id": int(row["id"]),
            "complaint_number": row["complaint_number"],
            "category_id": (
                int(row["category_id"])
                if row["category_id"] is not None
                else None
            ),
            "category": row["category"],
            "category_name": row["category_name"],
            "title": row["title"],
            "description": row["description"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "status": row["status"],
            "priority": row["priority"],
            "department_id": row["department_id"],
            "department_name": row["department_name"],
            "master_complaint_id": row["master_complaint_id"],
            "is_duplicate": row["master_complaint_id"] is not None,
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],

            "assignment": {
                "assignment_id": int(row["assignment_id"]),
                "officer_id": int(row["officer_id"]),
                "employee_id": row["officer_employee_id"],
                "officer_name": row["officer_name"],
                "officer_email": row["officer_email"],
                "assigned_by": row["assigned_by"],
                "assigned_by_name": row["assigned_by_name"],
                "assigned_at": row["assigned_at"],
            },

            "photos": [
                {
                    "id": int(photo["id"]),
                    "photo_url": photo["photo_url"],
                    "photo_type": photo["photo_type"],
                    "uploaded_by": (
                        int(photo["uploaded_by"])
                        if photo["uploaded_by"] is not None
                        else None
                    ),
                    "uploaded_at": photo["uploaded_at"],
                }
                for photo in photos
            ],

            "status_history": [
                {
                    "id": int(item["id"]),
                    "old_status": item["old_status"],
                    "new_status": item["new_status"],
                    "remarks": item["remarks"],
                    "changed_by": (
                        int(item["changed_by"])
                        if item["changed_by"] is not None
                        else None
                    ),
                    "changed_by_name": item["changed_by_name"],
                    "changed_at": item["changed_at"],
                }
                for item in history
            ],

            "sla": {
                "target_hours": (
                    float(target_hours)
                    if target_hours is not None
                    else None
                ),
                "elapsed_hours": elapsed_hours,
                "elapsed_percentage": elapsed_percentage,
                "state": sla_state,
            },
        },
    }


# ============================================================
# GET AVAILABLE OFFICERS
# GET /employee/complaints/{complaint_id}/officers
# ============================================================

@employee_router.get("/{complaint_id}/officers")
def get_officers_for_complaint(
    complaint_id: int,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    require_employee(current_user)

    require_employee_permission(
        db=db,
        employee_id=int(current_user["id"]),
        permission_code="COMPLAINT_ASSIGN",
    )

    officers = get_available_officers(
        db=db,
        complaint_id=complaint_id,
    )

    return {
        "success": True,
        "complaint_id": complaint_id,
        "officers": officers,
    }


# ============================================================
# ASSIGN COMPLAINT
# POST /employee/complaints/{complaint_id}/assign
# ============================================================

@employee_router.post("/{complaint_id}/assign")
def assign_complaint_to_officer(
    complaint_id: int,
    officer_id: int = Form(...),
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    require_employee(current_user)

    require_employee_permission(
        db=db,
        employee_id=int(current_user["id"]),
        permission_code="COMPLAINT_ASSIGN",
    )

    return assign_complaint(
        db=db,
        complaint_id=complaint_id,
        officer_id=officer_id,
        assigned_by=int(current_user["id"]),
    )
