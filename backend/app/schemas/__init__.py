"""
LinuxAI — Pydantic Schemas for Auth, Users, Commands, Chat, Alerts, Tasks
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field, EmailStr


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-\.]+$")
    password: str = Field(min_length=8)
    email: Optional[str] = None
    role: str = Field(default="OPERATOR")


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4096)
    conversation_id: Optional[str] = None
    provider: Optional[str] = Field(default=None, description="gemini | groq | openai | ollama | anthropic | custom")
    model: Optional[str] = Field(default=None, description="Model override")
    api_key: Optional[str] = Field(default=None, description="API key override")
    base_url: Optional[str] = Field(default=None, description="Base URL override")


class ToolExecutionStep(BaseModel):
    tool_name: str
    args: dict = {}
    status: str  # running | success | failure | pending_approval | blocked
    result: Optional[dict] = None
    risk_level: str = "LOW"
    duration_ms: Optional[float] = None


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    content: str
    tool_steps: list[ToolExecutionStep] = []
    pending_approvals: list["ApprovalOut"] = []
    created_at: datetime


class AITestRequest(BaseModel):
    provider: Optional[str] = Field(default=None, description="gemini | groq | openai | ollama | anthropic | custom")
    model: Optional[str] = Field(default=None, description="Model identifier")
    api_key: Optional[str] = Field(default=None, description="API key override")
    base_url: Optional[str] = Field(default=None, description="Base URL override")
    ollama_base_url: Optional[str] = Field(default=None, description="Ollama endpoint URL")


class AITestResponse(BaseModel):
    status: str = Field(description="ok | fallback | error")
    provider: str
    model: str
    key_configured: bool
    data_received: bool
    latency_ms: float
    response_sample: str
    timestamp: datetime
    message: str
    diagnostics: dict[str, Any] = {}


class QuickFixRequest(BaseModel):
    command: str = Field(min_length=1)
    stdout: str = ""
    stderr: str = ""
    exit_code: int = 1
    user: str = "user"
    host: str = "localhost"
    os_info: Optional[str] = "RHEL 9"


class QuickFixResponse(BaseModel):
    id: str
    command: str
    why_failed: str
    root_cause: str
    recommended_fix: str
    fix_command: str
    risk_level: str = "LOW"
    requires_sudo: bool = False
    is_dangerous: bool = False
    verification_command: str = ""
    diagnostic_commands: list[str] = []
    rhcsa_concept: str = ""
    rhcsa_exam_tip: str = ""


# ─── Commands ─────────────────────────────────────────────────────────────────

class CommandOut(BaseModel):
    id: str
    command: str
    risk_level: str
    approval_status: str
    status: str
    exit_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    duration_ms: float = 0.0
    tool_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalOut(BaseModel):
    id: str
    command_id: str
    risk_level: str
    requires_double_confirm: bool
    action_description: str
    command: str
    reason: str
    expected_effect: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalDecision(BaseModel):
    approved: bool
    confirmation_text: Optional[str] = None  # Required for double-confirm


# ─── System Metrics ───────────────────────────────────────────────────────────

class CPUMetric(BaseModel):
    percent: float
    count: int
    count_logical: int
    frequency_mhz: Optional[float] = None


class MemoryMetric(BaseModel):
    total_gb: float
    used_gb: float
    available_gb: float
    percent: float
    swap_total_gb: float
    swap_used_gb: float
    swap_percent: float


class DiskMetric(BaseModel):
    filesystem: str
    size_gb: float
    used_gb: float
    available_gb: float
    percent: float
    mountpoint: str


class NetworkInterface(BaseModel):
    name: str
    addresses: list[str]
    status: str


class SystemInfo(BaseModel):
    hostname: str
    os_name: str
    os_version: str
    kernel: str
    architecture: str
    uptime_seconds: float
    cpu: CPUMetric
    memory: MemoryMetric
    disks: list[DiskMetric]
    load_average: list[float]


class HealthScore(BaseModel):
    score: int = Field(ge=0, le=100)
    grade: str  # A | B | C | D | F
    components: dict[str, Any]
    alerts: list[str] = []


# ─── Processes ────────────────────────────────────────────────────────────────

class ProcessInfo(BaseModel):
    pid: int
    name: str
    username: str
    cpu_percent: float
    memory_percent: float
    memory_mb: float
    status: str
    command: str


# ─── Services ─────────────────────────────────────────────────────────────────

class ServiceInfo(BaseModel):
    name: str
    status: str  # active | inactive | failed | unknown
    enabled: bool
    description: str = ""
    pid: Optional[int] = None
    since: Optional[str] = None
    memory: Optional[str] = None


class ServiceActionRequest(BaseModel):
    service: str = Field(min_length=1, max_length=128)


# ─── Alerts ───────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: str
    severity: str
    category: str
    title: str
    message: str
    recommendation: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AlertUpdate(BaseModel):
    status: str = Field(pattern=r"^(reviewed|resolved|ignored)$")


# ─── Tasks ────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    description: str = ""
    schedule: str = Field(min_length=1, description="Cron expression")
    actions: list[str] = Field(min_length=1, description="List of tool names")
    enabled: bool = True


class TaskOut(BaseModel):
    id: str
    name: str
    description: str
    schedule: str
    actions: list[str]
    enabled: bool
    created_at: datetime
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[str] = None
    actions: Optional[list[str]] = None
    enabled: Optional[bool] = None
