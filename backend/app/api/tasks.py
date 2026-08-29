"""LinuxAI — Tasks API (Scheduled Tasks)"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.auth import get_current_user, require_role
from app.database.session import get_db
from app.models.user import User
from app.models.task import Task
from app.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter()

@router.get("")
async def list_tasks(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).order_by(Task.created_at))
    return [TaskOut.model_validate(t) for t in result.scalars().all()]

@router.post("", response_model=TaskOut, dependencies=[Depends(require_role("ADMIN", "OPERATOR"))])
async def create_task(data: TaskCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    task = Task(**data.model_dump(), created_by=user.id)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)

@router.put("/{task_id}", response_model=TaskOut, dependencies=[Depends(require_role("ADMIN", "OPERATOR"))])
async def update_task(task_id: str, data: TaskUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(task, k, v)
    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)

@router.delete("/{task_id}", dependencies=[Depends(require_role("ADMIN"))])
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
    return {"deleted": task_id}
