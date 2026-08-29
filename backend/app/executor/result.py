"""
LinuxAI — CommandResult
Structured result object returned by every command execution.
"""

from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field


class ExecutionStatus(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    BLOCKED = "blocked"
    PENDING_APPROVAL = "pending_approval"
    REJECTED = "rejected"


class CommandResult(BaseModel):
    """Structured result of a command execution."""

    # Identity
    command_id: str = Field(description="Unique identifier for this execution")
    command: str = Field(description="The full command as a string")
    args: list[str] = Field(description="Command as argument list")

    # Risk metadata
    risk_level: str = Field(description="LOW | MEDIUM | HIGH | BLOCKED")
    approved: bool = Field(default=False, description="Whether human approval was granted")

    # Execution results
    status: ExecutionStatus = Field(default=ExecutionStatus.PENDING_APPROVAL)
    exit_code: int | None = Field(default=None)
    stdout: str = Field(default="")
    stderr: str = Field(default="")
    duration_ms: float = Field(default=0.0, description="Execution duration in milliseconds")

    # Context
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str | None = Field(default=None)
    conversation_id: str | None = Field(default=None)
    tool_name: str | None = Field(default=None, description="AI tool that triggered this command")

    # Error info
    error_message: str | None = Field(default=None)

    @property
    def succeeded(self) -> bool:
        return self.status == ExecutionStatus.SUCCESS and self.exit_code == 0

    @property
    def output(self) -> str:
        """Combined stdout + stderr for display."""
        parts = []
        if self.stdout:
            parts.append(self.stdout)
        if self.stderr:
            parts.append(f"[stderr] {self.stderr}")
        return "\n".join(parts)

    def to_ai_summary(self) -> dict:
        """Compact summary sent to the AI — no full logs, no secrets."""
        return {
            "command": self.command,
            "status": self.status.value,
            "exit_code": self.exit_code,
            "stdout": self.stdout[:4096] if self.stdout else "",
            "stderr": self.stderr[:2048] if self.stderr else "",
            "duration_ms": round(self.duration_ms, 1),
            "risk_level": self.risk_level,
        }

    class Config:
        use_enum_values = True
