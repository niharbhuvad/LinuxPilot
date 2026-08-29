"""
LinuxAI — Command & Approval ORM Models (Audit trail)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Float, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.user import utcnow


class Command(Base):
    """Full audit log of every command execution."""
    __tablename__ = "commands"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    conversation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    tool_name: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Command details
    command: Mapped[str] = mapped_column(Text, nullable=False)
    args: Mapped[list] = mapped_column(JSON, default=list)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)  # LOW|MEDIUM|HIGH|BLOCKED

    # Approval
    approval_required: Mapped[bool] = mapped_column(Boolean, default=False)
    approval_status: Mapped[str] = mapped_column(String(20), default="not_required")  # approved|rejected|pending|not_required
    approved_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Execution results
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # success|failure|timeout|blocked|pending_approval
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stdout: Mapped[str] = mapped_column(Text, default="")
    stderr: Mapped[str] = mapped_column(Text, default="")
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Approval(Base):
    """Human approval requests for MEDIUM/HIGH risk operations."""
    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    command_id: Mapped[str] = mapped_column(String(36), ForeignKey("commands.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    requires_double_confirm: Mapped[bool] = mapped_column(Boolean, default=False)

    # The full approval context shown to the user
    action_description: Mapped[str] = mapped_column(Text, nullable=False)
    command: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    expected_effect: Mapped[str] = mapped_column(Text, default="")

    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|approved|rejected
    decided_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
