"""
LinuxAI — AI Memory
Manages conversation context, previous commands, errors, and system identity.
"""

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class MemoryEntry:
    role: str  # user | assistant | tool
    content: str
    tool_name: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ConversationMemory:
    """
    Maintains context for an AI conversation session.
    Stores the last N messages + important state.
    """
    conversation_id: str
    max_messages: int = 50

    messages: list[dict] = field(default_factory=list)
    system_identity: dict = field(default_factory=dict)
    recent_commands: deque = field(default_factory=lambda: deque(maxlen=10))
    recent_errors: deque = field(default_factory=lambda: deque(maxlen=5))
    active_issues: list[str] = field(default_factory=list)

    def add_user_message(self, content: str):
        self.messages.append({"role": "user", "content": content})
        self._trim()

    def add_assistant_message(self, content: str):
        self.messages.append({"role": "assistant", "content": content})
        self._trim()

    def add_tool_call(self, tool_call_id: str, tool_name: str, args: dict):
        """Record AI's tool call request."""
        # Already in messages via the API response object — recorded by agent

    def add_tool_result(self, tool_call_id: str, tool_name: str, result: str):
        """Add a tool execution result to memory."""
        self.messages.append({
            "role": "tool",
            "tool_call_id": tool_call_id,
            "content": result[:4096],  # limit size
        })
        self.recent_commands.append({"tool": tool_name, "at": datetime.now(timezone.utc).isoformat()})
        self._trim()

    def record_error(self, error: str, context: str = ""):
        self.recent_errors.append({"error": error, "context": context})

    def set_system_identity(self, info: dict):
        """Cache system info to include in context."""
        mem = info.get("memory", {})
        cpu = info.get("cpu", {})
        self.system_identity = {
            "hostname": info.get("hostname", "unknown"),
            "os_name": info.get("os_name", info.get("os", "unknown")),
            "kernel": info.get("kernel", "unknown"),
            "ssh_target": info.get("ssh_target", ""),
            "cpu_percent": cpu.get("percent") if isinstance(cpu, dict) else info.get("cpu_percent", ""),
            "memory_used_gb": mem.get("used_gb") if isinstance(mem, dict) else info.get("memory_used_gb", ""),
            "memory_total_gb": mem.get("total_gb") if isinstance(mem, dict) else info.get("memory_total_gb", ""),
        }

    def get_openai_messages(self) -> list[dict]:
        """Return message history in OpenAI API format."""
        return self.messages.copy()

    def get_context_summary(self) -> str:
        """Build a context summary string for the system prompt."""
        parts = []
        if self.system_identity:
            parts.append(
                f"System: {self.system_identity.get('hostname')} | "
                f"{self.system_identity.get('os')} | "
                f"Kernel: {self.system_identity.get('kernel')}"
            )
        if self.recent_errors:
            errors = [e["error"][:100] for e in list(self.recent_errors)[-3:]]
            parts.append(f"Recent errors: {'; '.join(errors)}")
        if self.active_issues:
            parts.append(f"Active issues: {'; '.join(self.active_issues[-3:])}")
        return "\n".join(parts)

    def _trim(self):
        """Keep message history within limits."""
        if len(self.messages) > self.max_messages:
            # Always keep system messages, trim middle
            keep_start = 2  # keep first few for context
            excess = len(self.messages) - self.max_messages
            del self.messages[keep_start:keep_start + excess]


class MemoryStore:
    """In-memory store for conversation sessions."""

    def __init__(self):
        self._sessions: dict[str, ConversationMemory] = {}

    def get_or_create(self, conversation_id: str) -> ConversationMemory:
        if conversation_id not in self._sessions:
            self._sessions[conversation_id] = ConversationMemory(conversation_id=conversation_id)
        return self._sessions[conversation_id]

    def get(self, conversation_id: str) -> Optional[ConversationMemory]:
        return self._sessions.get(conversation_id)

    def clear(self, conversation_id: str):
        self._sessions.pop(conversation_id, None)


# Singleton memory store
memory_store = MemoryStore()
