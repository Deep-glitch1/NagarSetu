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
# GET MY TASK DETAIL
# GET /employee/complaints/{complaint_id}/task
# ============================================================

@employee_router.get("/{complaint_id}/task")
def get_my_task_detail(
    complaint_id: int,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Return a complaint only when it is actively assigned to this employee."""

    require_employee(current_user)

    require_employee_permission(
        db=db,
        employee_id=int(current_user["id"]),
        permission_code="COMPLAINT_UPDATE_STATUS",
    )

    assignment = db.execute(
        text(
            """
            SELECT
                ca.officer_id,
                ca.assigned_at,
                e.employee_id AS officer_employee_id,
                e.name AS officer_name
            FROM complaint_assignments ca
            JOIN employees e
                ON e.id = ca.officer_id
            WHERE ca.complaint_id = :complaint_id
              AND ca.officer_id = :employee_id
              AND ca.unassigned_at IS NULL
              AND e.is_active = TRUE
            LIMIT 1
            """
        ),
        {
            "complaint_id": complaint_id,
            "employee_id": int(current_user["id"]),
        },
    ).mappings().first()

    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or it is not assigned to you.",
        )

    result = db.execute(
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
                c.updated_at
            FROM complaints c
            JOIN complaint_categories cc
                ON cc.id = c.category_id
            LEFT JOIN departments d
                ON d.id = c.department_id
            WHERE c.id = :complaint_id
            LIMIT 1
            """
        ),
        {"complaint_id": complaint_id},
    ).mappings().first()

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found.",
        )

    photos = db.execute(
        text(
            """
            SELECT
                id,
                photo_url,
                photo_type,
                uploaded_at
            FROM complaint_photos
            WHERE complaint_id = :complaint_id
            ORDER BY uploaded_at ASC
            """
        ),
        {"complaint_id": complaint_id},
    ).mappings().all()

    history = db.execute(
        text(
            """
            SELECT
                id,
                old_status,
                new_status,
                remarks,
                changed_at
            FROM status_history
            WHERE complaint_id = :complaint_id
            ORDER BY changed_at ASC
            """
        ),
        {"complaint_id": complaint_id},
    ).mappings().all()

    complaint = {
        "id": int(result["id"]),
        "complaint_number": result["complaint_number"],
        "category": result["category"],
        "category_name": result["category_name"],
        "title": result["title"],
        "description": result["description"],
        "latitude": result["latitude"],
        "longitude": result["longitude"],
        "status": result["status"],
        "priority": result["priority"],
        "department_id": result["department_id"],
        "department_name": result["department_name"],
        "master_complaint_id": result["master_complaint_id"],
        "is_duplicate": result["master_complaint_id"] is not None,
        "created_at": result["created_at"],
        "updated_at": result["updated_at"],
        "assignment": {
            "officer_id": int(assignment["officer_id"]),
            "employee_id": assignment["officer_employee_id"],
            "name": assignment["officer_name"],
            "assigned_at": assignment["assigned_at"],
        },
        "photos": [
            {
                "id": int(photo["id"]),
                "photo_url": photo["photo_url"],
                "photo_type": photo["photo_type"],
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
                "changed_at": item["changed_at"],
            }
            for item in history
        ],
    }

    return {
        "success": True,
        "complaint": complaint,
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
