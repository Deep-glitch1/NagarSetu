"""Administrative/manual controls for complaint SLA escalation."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.routers.auth import get_current_identity
from app.services.complaint_service import require_employee_permission
from app.services.sla_escalation_service import run_sla_escalation_job


router = APIRouter(
    prefix="/admin/complaints/sla",
    tags=["complaint SLA"],
)


@router.post("/escalate")
def trigger_sla_escalation(
    current_user: dict = Depends(get_current_identity),
    db: Session = Depends(get_db),
):
    """Run the SLA escalation pass immediately for testing or operations."""

    if current_user.get("role") != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee access required.",
        )

    require_employee_permission(
        db=db,
        employee_id=int(current_user["id"]),
        permission_code="COMPLAINT_ESCALATE",
    )

    result = run_sla_escalation_job(db)

    return {
        "success": True,
        "message": (
            "SLA escalation pass completed."
            if not result.skipped_locked
            else "Another SLA escalation pass is already running."
        ),
        **result.as_dict(),
    }
