"""
LinuxAI Backend — Application Configuration
Reads all settings from environment variables / .env file.
Never hardcode secrets. Never commit .env.
"""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, PrivateAttr, field_validator

# Project root directory (linuxai/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = (PROJECT_ROOT / "linuxai.db").as_posix()


class Settings(BaseSettings):
    _ssh_target_info: dict | None = PrivateAttr(default=None)

    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ─────────────────────────────────────────────────────────
    app_name: str = "LinuxAI"
    app_version: str = "1.0.0"
    app_env: str = Field(default="development", description="development | production")
    secret_key: str = Field(
        default="change-me-in-production-use-64-char-random-string",
        description="JWT signing secret — MUST be changed in production",
    )
    log_level: str = Field(default="INFO")
    debug: bool = Field(default=False)

    # ── OpenAI ──────────────────────────────────────────────────────────────
    openai_api_key: str = Field(default="", description="OpenAI API key")
    openai_model: str = Field(default="gpt-4o")

    # ── Gemini / Google AI Studio ──────────────────────────────────────────────
    gemini_api_key: str = Field(default="", description="Google Gemini API key")
    gemini_model: str = Field(default="gemini-2.5-flash", description="Google Gemini model name")

    # ── Groq (Ultra-Fast LPU) ───────────────────────────────────────────────
    groq_api_key: str = Field(default="", description="Groq API key")
    groq_model: str = Field(default="openai/gpt-oss-120b", description="Groq model name")

    # ── Ollama Local LLM Provider ───────────────────────────────────────────
    llm_provider: str = Field(default="gemini", description="Active provider: gemini | groq | openai | ollama | custom")
    ollama_base_url: str = Field(default="http://localhost:11434/v1", description="Local Ollama OpenAI-compatible base URL")
    ollama_model: str = Field(default="qwen2.5-coder:7b", description="Ollama model name")

    openai_max_tokens: int = Field(default=4096)
    openai_temperature: float = Field(default=0.1)

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = Field(default=f"sqlite+aiosqlite:///{DEFAULT_DB_PATH}")

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if v.startswith("sqlite:///"):
            return v.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        return v

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    # ── Command Execution ────────────────────────────────────────────────────
    max_command_timeout: int = Field(default=30, description="Max command timeout in seconds")
    max_output_size: int = Field(default=65536, description="Max bytes of command output")
    enable_autonomous_mode: bool = Field(default=False)

    # ── Remote SSH Lab Connection ─────────────────────────────────────────────
    ssh_enabled: bool = Field(default=True, description="Enable SSH remote execution mode")
    ssh_host: str = Field(default="172.25.250.9", description="Remote RHEL server IP or hostname")

    ssh_port: int = Field(default=22, description="SSH port (default 22)")
    ssh_user: str = Field(default="student", description="SSH username")


    ssh_password: str = Field(default="", description="SSH password (optional)")
    ssh_key_path: str = Field(default="", description="Path to SSH private key file (optional)")


    # ── Monitoring Thresholds ─────────────────────────────────────────────────
    disk_warning_threshold: int = Field(default=85)
    disk_critical_threshold: int = Field(default=90)
    cpu_warning_threshold: int = Field(default=80)
    memory_warning_threshold: int = Field(default=85)

    # ── JWT ──────────────────────────────────────────────────────────────────
    jwt_algorithm: str = Field(default="HS256")
    jwt_access_token_expire_minutes: int = Field(default=60 * 8)  # 8 hours

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache()
def get_settings() -> Settings:
    """Dynamic settings instance — reads environment configuration."""
    return Settings()
