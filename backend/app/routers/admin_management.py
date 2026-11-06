from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.routers.auth import get_current_identity, hash_password


router = APIRouter(
    prefix="/admin/management",
    tags=["admin management"],
)


# ============================================================
# SCHEMAS
# ============================================================


class DepartmentCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)


class DepartmentUpdate(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool


class DepartmentCategoriesPayload(BaseModel):
    categories: list[dict[str, Any]] = Field(default_factory=list)


class EmployeeCreate(BaseModel):
    employee_id: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=5, max_length=255)
    phone: str | None = Field(default=None, max_length=15)
    password: str = Field(min_length=6, max_length=128)
    department_id: int | None = Field(default=None, gt=0)
    administrative_unit_id: int | None = Field(default=None, gt=0)
    role_id: int = Field(gt=0)


class EmployeeUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=15)
    department_id: int | None = Field(default=None, gt=0)
    administrative_unit_id: int | None = Field(default=None, gt=0)
    role_id: int = Field(gt=0)
    is_active: bool


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=15)


# ============================================================
# AUTHORIZATION
# ============================================================


def _require_permission(
    current_user: dict,
    db: Session,
    permission: str,
) -> int:
    if current_user.get("role") != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employees can access this resource.",
        )

    employee_id = int(current_user["id"])

    allowed = db.execute(
        text("SELECT fn_has_permission(:employee_id, :permission)"),
        {
            "employee_id": employee_id,
            "permission": permission,
        },
    ).scalar_one()

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing permission: {permission}.",
        )

    return employee_id


def _validate_reference_ids(
    db: Session,
    department_id: int | None,
    administrative_unit_id: int | None,
    role_id: int,
) -> None:
    if department_id is not None:
        exists = db.execute(
            text("SELECT 1 FROM departments WHERE id = :id"),
            {"id": department_id},
        ).scalar_one_or_none()
        if exists is None:
            raise HTTPException(status_code=400, detail="Department not found.")

    if administrative_unit_id is not None:
        exists = db.execute(
            text(
                "SELECT 1 FROM administrative_units "
                "WHERE id = :id AND is_active = TRUE"
            ),
            {"id": administrative_unit_id},
        ).scalar_one_or_none()
        if exists is None:
            raise HTTPException(status_code=400, detail="Administrative unit not found.")

    role = db.execute(
        text("SELECT id, name FROM roles WHERE id = :id"),
        {"id": role_id},
    ).mappings().first()
    if role is None or role["name"] == "citizen":
        raise HTTPException(status_code=400, detail="Invalid employee role.")


# ============================================================
# DASHBOARD
# ============================================================


@router.get("/dashboard")
def admin_dashboard(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "REPORT_VIEW")

    stats = db.execute(
        text(
            """
            SELECT
                COUNT(*) AS total_complaints,
                COUNT(*) FILTER (
                    WHERE status NOT IN ('verified', 'closed', 'rejected')
                ) AS active_complaints,
                COUNT(*) FILTER (
                    WHERE status IN ('verified', 'closed')
                      AND updated_at >= date_trunc('month', CURRENT_TIMESTAMP)
                ) AS resolved_this_month,
                COUNT(*) FILTER (
                    WHERE status NOT IN ('verified', 'closed', 'rejected')
                      AND sla.target_hours IS NOT NULL
                      AND CURRENT_TIMESTAMP >
                          created_at + make_interval(hours => sla.target_hours)
                ) AS overdue_complaints
            FROM complaints c
            LEFT JOIN complaint_sla sla
                ON sla.category_id = c.category_id
            """
        )
    ).mappings().one()

    department_rows = db.execute(
        text(
            """
            SELECT
                d.id,
                d.name,
                d.code,
                COUNT(c.id) AS complaint_count,
                COUNT(c.id) FILTER (
                    WHERE c.status IN ('verified', 'closed')
                ) AS resolved_count
            FROM departments d
            LEFT JOIN complaints c
                ON c.department_id = d.id
            GROUP BY d.id, d.name, d.code
            ORDER BY complaint_count DESC, d.name
            LIMIT 8
            """
        )
    ).mappings().all()

    recent_rows = db.execute(
        text(
            """
            SELECT
                c.id,
                c.complaint_number,
                c.title,
                c.status,
                c.priority,
                c.created_at,
                cc.name AS category_name,
                d.name AS department_name
            FROM complaints c
            LEFT JOIN complaint_categories cc
                ON cc.id = c.category_id
            LEFT JOIN departments d
                ON d.id = c.department_id
            ORDER BY c.created_at DESC
            LIMIT 8
            """
        )
    ).mappings().all()

    return {
        "stats": {k: int(v or 0) for k, v in stats.items()},
        "departments": [
            {
                "id": int(row["id"]),
                "name": row["name"],
                "code": row["code"],
                "complaint_count": int(row["complaint_count"] or 0),
                "resolved_count": int(row["resolved_count"] or 0),
            }
            for row in department_rows
        ],
        "recent_complaints": [dict(row) for row in recent_rows],
    }


# ============================================================
# DEPARTMENTS
# ============================================================


@router.get("/departments")
def list_departments(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "DEPARTMENT_MANAGE")

    rows = db.execute(
        text(
            """
            SELECT
                d.id,
                d.code,
                d.name,
                d.description,
                d.is_active,
                d.created_at,
                (
                    SELECT COUNT(*)
                    FROM department_categories dc
                    WHERE dc.department_id = d.id
                ) AS category_count,
                (
                    SELECT COUNT(*)
                    FROM employees e
                    WHERE e.department_id = d.id
                      AND e.is_active = TRUE
                ) AS employee_count,
                (
                    SELECT COUNT(*)
                    FROM complaints c
                    WHERE c.department_id = d.id
                ) AS complaint_count,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', cc.id,
                                'code', cc.code,
                                'name', cc.name,
                                'priority_weight', dc.priority_weight
                            )
                            ORDER BY cc.name
                        )
                        FROM department_categories dc
                        JOIN complaint_categories cc
                          ON cc.id = dc.category_id
                        WHERE dc.department_id = d.id
                    ),
                    '[]'::json
                ) AS categories
            FROM departments d
            ORDER BY d.name
            """
        )
    ).mappings().all()

    return {
        "departments": [
            {
                **dict(row),
                "id": int(row["id"]),
                "category_count": int(row["category_count"] or 0),
                "employee_count": int(row["employee_count"] or 0),
                "complaint_count": int(row["complaint_count"] or 0),
            }
            for row in rows
        ]
    }


@router.get("/categories")
def list_categories(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "CATEGORY_MANAGE")

    rows = db.execute(
        text(
            """
            SELECT id, code, name, description, is_emergency, is_active
            FROM complaint_categories
            ORDER BY name
            """
        )
    ).mappings().all()

    return {"categories": [dict(row) for row in rows]}


@router.post("/departments", status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "DEPARTMENT_MANAGE")

    try:
        row = db.execute(
            text(
                """
                INSERT INTO departments (code, name, description)
                VALUES (:code, :name, :description)
                RETURNING id, code, name, description, is_active, created_at
                """
            ),
            {
                "code": payload.code.strip().upper(),
                "name": payload.name.strip(),
                "description": payload.description.strip() if payload.description else None,
            },
        ).mappings().one()
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Department code or name already exists.",
        )

    return {"department": dict(row)}


@router.patch("/departments/{department_id}")
def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "DEPARTMENT_MANAGE")

    try:
        row = db.execute(
            text(
                """
                UPDATE departments
                SET
                    code = :code,
                    name = :name,
                    description = :description,
                    is_active = :is_active
                WHERE id = :id
                RETURNING id, code, name, description, is_active, created_at
                """
            ),
            {
                "id": department_id,
                "code": payload.code.strip().upper(),
                "name": payload.name.strip(),
                "description": payload.description.strip() if payload.description else None,
                "is_active": payload.is_active,
            },
        ).mappings().first()
        if row is None:
            db.rollback()
            raise HTTPException(status_code=404, detail="Department not found.")
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Department code or name already exists.",
        )

    return {"department": dict(row)}


@router.put("/departments/{department_id}/categories")
def replace_department_categories(
    department_id: int,
    payload: DepartmentCategoriesPayload,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "CATEGORY_MANAGE")

    department_exists = db.execute(
        text("SELECT 1 FROM departments WHERE id = :id"),
        {"id": department_id},
    ).scalar_one_or_none()
    if department_exists is None:
        raise HTTPException(status_code=404, detail="Department not found.")

    db.execute(
        text("DELETE FROM department_categories WHERE department_id = :department_id"),
        {"department_id": department_id},
    )

    for item in payload.categories:
        category_id = int(item.get("category_id"))
        priority_weight = float(item.get("priority_weight", 1))
        if priority_weight <= 0:
            raise HTTPException(status_code=400, detail="Priority weight must be greater than 0.")

        exists = db.execute(
            text(
                "SELECT 1 FROM complaint_categories "
                "WHERE id = :id AND is_active = TRUE"
            ),
            {"id": category_id},
        ).scalar_one_or_none()
        if exists is None:
            raise HTTPException(status_code=400, detail=f"Category {category_id} not found or inactive.")

        db.execute(
            text(
                """
                INSERT INTO department_categories (
                    department_id,
                    category_id,
                    priority_weight
                )
                VALUES (:department_id, :category_id, :priority_weight)
                """
            ),
            {
                "department_id": department_id,
                "category_id": category_id,
                "priority_weight": priority_weight,
            },
        )

    db.commit()

    return {"message": "Department categories updated successfully."}


# ============================================================
# USERS / EMPLOYEES
# ============================================================


@router.get("/roles")
def list_employee_roles(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "USER_MANAGE")

    rows = db.execute(
        text(
            """
            SELECT id, name, description
            FROM roles
            WHERE name <> 'citizen'
            ORDER BY name
            """
        )
    ).mappings().all()

    return {"roles": [dict(row) for row in rows]}


@router.get("/areas")
def list_admin_areas(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "USER_MANAGE")

    rows = db.execute(
        text(
            """
            SELECT id, name, code, unit_type, parent_id
            FROM administrative_units
            WHERE is_active = TRUE
            ORDER BY unit_type, name
            """
        )
    ).mappings().all()

    return {"areas": [dict(row) for row in rows]}


@router.get("/employees")
def list_employees(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "USER_MANAGE")

    rows = db.execute(
        text(
            """
            SELECT
                e.id,
                e.employee_id,
                e.name,
                e.email,
                e.phone,
                e.department_id,
                d.name AS department_name,
                e.administrative_unit_id,
                au.name AS area_name,
                e.is_active,
                e.created_at,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object('id', r.id, 'name', r.name)
                            ORDER BY r.name
                        )
                        FROM employee_roles er
                        JOIN roles r ON r.id = er.role_id
                        WHERE er.employee_id = e.id
                    ),
                    '[]'::json
                ) AS roles
            FROM employees e
            LEFT JOIN departments d
                ON d.id = e.department_id
            LEFT JOIN administrative_units au
                ON au.id = e.administrative_unit_id
            ORDER BY e.name
            """
        )
    ).mappings().all()

    return {
        "employees": [
            {
                **dict(row),
                "id": int(row["id"]),
            }
            for row in rows
        ]
    }


@router.post("/employees", status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    _require_permission(current_user, db, "USER_MANAGE")
    _validate_reference_ids(
        db,
        payload.department_id,
        payload.administrative_unit_id,
        payload.role_id,
    )

    try:
        row = db.execute(
            text(
                """
                INSERT INTO employees (
                    employee_id,
                    name,
                    email,
                    phone,
                    password_hash,
                    department_id,
                    administrative_unit_id,
                    is_active
                )
                VALUES (
                    :employee_id,
                    :name,
                    :email,
                    :phone,
                    :password_hash,
                    :department_id,
                    :administrative_unit_id,
                    TRUE
                )
                RETURNING id, employee_id, name, email, phone,
                          department_id, administrative_unit_id, is_active
                """
            ),
            {
                "employee_id": payload.employee_id.strip(),
                "name": payload.name.strip(),
                "email": payload.email.strip().lower(),
                "phone": payload.phone.strip() if payload.phone else None,
                "password_hash": hash_password(payload.password),
                "department_id": payload.department_id,
                "administrative_unit_id": payload.administrative_unit_id,
            },
        ).mappings().one()

        db.execute(
            text(
                "INSERT INTO employee_roles (employee_id, role_id) "
                "VALUES (:employee_id, :role_id)"
            ),
            {
                "employee_id": row["id"],
                "role_id": payload.role_id,
            },
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Employee ID, email, or phone already exists.",
        )

    return {"employee": dict(row)}


@router.patch("/employees/{employee_id}")
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    acting_employee_id = _require_permission(current_user, db, "USER_MANAGE")

    if employee_id == acting_employee_id and not payload.is_active:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account.",
        )

    _validate_reference_ids(
        db,
        payload.department_id,
        payload.administrative_unit_id,
        payload.role_id,
    )

    existing_role = db.execute(
        text("""
            SELECT r.name
            FROM employee_roles er
            JOIN roles r ON r.id = er.role_id
            WHERE er.employee_id = :employee_id
            ORDER BY r.id
            LIMIT 1
        """),
        {"employee_id": employee_id},
    ).scalar_one_or_none()
    target_role = db.execute(
        text("SELECT name FROM roles WHERE id = :role_id"),
        {"role_id": payload.role_id},
    ).scalar_one()
    if employee_id == acting_employee_id and existing_role != target_role:
        raise HTTPException(
            status_code=400,
            detail="You cannot change your own administrator role.",
        )

    existing = db.execute(
        text("SELECT 1 FROM employees WHERE id = :id"),
        {"id": employee_id},
    ).scalar_one_or_none()
    if existing is None:
        raise HTTPException(status_code=404, detail="Employee not found.")

    try:
        row = db.execute(
            text(
                """
                UPDATE employees
                SET
                    name = :name,
                    phone = :phone,
                    department_id = :department_id,
                    administrative_unit_id = :administrative_unit_id,
                    is_active = :is_active,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
                RETURNING id, employee_id, name, email, phone,
                          department_id, administrative_unit_id, is_active
                """
            ),
            {
                "id": employee_id,
                "name": payload.name.strip(),
                "phone": payload.phone.strip() if payload.phone else None,
                "department_id": payload.department_id,
                "administrative_unit_id": payload.administrative_unit_id,
                "is_active": payload.is_active,
            },
        ).mappings().one()

        db.execute(
            text("DELETE FROM employee_roles WHERE employee_id = :employee_id"),
            {"employee_id": employee_id},
        )
        db.execute(
            text(
                "INSERT INTO employee_roles (employee_id, role_id) "
                "VALUES (:employee_id, :role_id)"
            ),
            {
                "employee_id": employee_id,
                "role_id": payload.role_id,
            },
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Employee update conflicts with existing data.")

    return {"employee": dict(row)}


# ============================================================
# ADMIN PROFILE / SETTINGS
# ============================================================


@router.get("/settings/profile")
def get_admin_profile(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "employee":
        raise HTTPException(status_code=403, detail="Only employees can access this resource.")

    employee_id = int(current_user["id"])
    row = db.execute(
        text(
            """
            SELECT
                e.id,
                e.employee_id,
                e.name,
                e.email,
                e.phone,
                e.is_active,
                d.id AS department_id,
                d.name AS department_name,
                au.id AS area_id,
                au.name AS area_name,
                COALESCE(
                    (
                        SELECT string_agg(r.name, ', ' ORDER BY r.name)
                        FROM employee_roles er
                        JOIN roles r ON r.id = er.role_id
                        WHERE er.employee_id = e.id
                    ),
                    'Unassigned'
                ) AS roles
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            LEFT JOIN administrative_units au ON au.id = e.administrative_unit_id
            WHERE e.id = :employee_id
            """
        ),
        {"employee_id": employee_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="Employee profile not found.")

    return dict(row)


@router.patch("/settings/profile")
def update_admin_profile(
    payload: ProfileUpdate,
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    if current_user.get("role") != "employee":
        raise HTTPException(status_code=403, detail="Only employees can access this resource.")

    row = db.execute(
        text(
            """
            UPDATE employees
            SET
                name = :name,
                phone = :phone,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
            RETURNING id, employee_id, name, email, phone, is_active
            """
        ),
        {
            "id": int(current_user["id"]),
            "name": payload.name.strip(),
            "phone": payload.phone.strip() if payload.phone else None,
        },
    ).mappings().first()

    if row is None:
        db.rollback()
        raise HTTPException(status_code=404, detail="Employee profile not found.")

    db.commit()
    return dict(row)
