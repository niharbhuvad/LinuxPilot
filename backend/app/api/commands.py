"""LinuxAI — Commands API (Audit History + Approvals)"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone

from pydantic import BaseModel
from app.api.auth import get_current_user, require_role
from app.database.session import get_db
from app.models.user import User
from app.models.command import Command, Approval
from app.schemas import CommandOut, ApprovalOut, ApprovalDecision, QuickFixRequest, QuickFixResponse
from app.api.quick_fix import get_quick_fix

router = APIRouter()


class ExecuteCommandRequest(BaseModel):
    command: str


@router.post("/execute", dependencies=[Depends(require_role("ADMIN", "OPERATOR"))])
async def execute_command(
    data: ExecuteCommandRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute shell command dynamically via CommandRunner (supports remote SSH execution)."""
    cmd_str = data.command.strip()
    if not cmd_str:
        raise HTTPException(status_code=400, detail="Command string is required")

    import shlex
    try:
        args = shlex.split(cmd_str)
    except Exception:
        args = cmd_str.split()

    from app.executor.runner import CommandRunner
    runner = CommandRunner()
    res = await runner.run(args, user_id=user.id, approved=True)

    return {
        "command": cmd_str,
        "exit_code": res.exit_code,
        "stdout": res.stdout,
        "stderr": res.stderr,
        "status": res.status.value if hasattr(res.status, 'value') else str(res.status),
        "duration_ms": res.duration_ms,
    }


@router.get("/history")
async def command_history(
    limit: int = 50, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Command).order_by(desc(Command.created_at)).limit(min(limit, 200))
    )
    commands = result.scalars().all()
    return [CommandOut.model_validate(c) for c in commands]

@router.get("/approvals/pending")
async def pending_approvals(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Approval).where(Approval.status == "pending").order_by(Approval.created_at)
    )
    approvals = result.scalars().all()
    return [ApprovalOut.model_validate(a) for a in approvals]

@router.post("/approvals/{approval_id}/decide")
async def decide_approval(
    approval_id: str,
    decision: ApprovalDecision,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != "pending":
        raise HTTPException(status_code=409, detail=f"Approval is already {approval.status}")

    # Validate double-confirm for HIGH risk
    if approval.requires_double_confirm and decision.approved:
        if not decision.confirmation_text or "CONFIRM DELETE" not in decision.confirmation_text.upper():
            raise HTTPException(
                status_code=400,
                detail="HIGH risk operation requires typing 'CONFIRM DELETE' to proceed"
            )

    approval.status = "approved" if decision.approved else "rejected"
    approval.decided_by = user.id
    approval.decided_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": approval.status, "approval_id": approval_id}


@router.post("/quick-fix", response_model=QuickFixResponse)
@router.post("/quick-fix/", response_model=QuickFixResponse)
async def quick_fix_endpoint(
    request: QuickFixRequest,
    user: User = Depends(get_current_user),
):
    return await get_quick_fix(request, user)

