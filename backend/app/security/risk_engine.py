"""
LinuxAI — Risk Engine
Classifies every command execution request against the policy tables.
"""

import shlex
from dataclasses import dataclass

from app.security.command_policy import (
    BLOCKED_COMMANDS,
    DANGEROUS_ARG_PATTERNS,
    HIGH_RISK_COMMANDS,
    LOW_RISK_COMMANDS,
    MEDIUM_RISK_COMMANDS,
    CommandPolicy,
    RiskLevel,
)


@dataclass
class RiskAssessment:
    risk_level: RiskLevel
    requires_approval: bool
    requires_double_confirm: bool
    reason: str
    command_base: str
    policy: CommandPolicy | None = None

    @property
    def is_blocked(self) -> bool:
        return self.risk_level == RiskLevel.BLOCKED

    @property
    def is_auto_executable(self) -> bool:
        return self.risk_level == RiskLevel.LOW and not self.requires_approval

    def to_dict(self) -> dict:
        return {
            "risk_level": self.risk_level.value,
            "requires_approval": self.requires_approval,
            "requires_double_confirm": self.requires_double_confirm,
            "reason": self.reason,
            "command_base": self.command_base,
        }


class RiskEngine:
    """
    Classifies command risk before execution.

    Priority order (highest to lowest):
      1. BLOCKED — command is in the blocked set
      2. DANGEROUS_ARG_PATTERNS — argument patterns that elevate risk
      3. HIGH_RISK_COMMANDS — explicit high-risk commands
      4. MEDIUM_RISK_COMMANDS — explicit medium-risk commands
      5. LOW_RISK_COMMANDS — explicit low-risk commands
      6. Unknown — treat as HIGH by default
    """

    def assess(self, args: list[str]) -> RiskAssessment:
        """
        Assess the risk of a command given as an argument list.
        args[0] is the executable, args[1:] are the arguments.
        """
        if not args:
            return RiskAssessment(
                risk_level=RiskLevel.BLOCKED,
                requires_approval=True,
                requires_double_confirm=True,
                reason="Empty command",
                command_base="",
            )

        command_base = args[0].strip()
        full_command = " ".join(args)

        # ── Step 1: Check if base command is completely blocked ───────────────
        if command_base in BLOCKED_COMMANDS:
            return RiskAssessment(
                risk_level=RiskLevel.BLOCKED,
                requires_approval=True,
                requires_double_confirm=True,
                reason=f"Command '{command_base}' is blocked by LinuxAI policy",
                command_base=command_base,
            )

        # ── Step 2: Check for dangerous argument patterns ─────────────────────
        for pattern, elevated_risk in DANGEROUS_ARG_PATTERNS:
            if pattern in full_command:
                if elevated_risk == RiskLevel.BLOCKED:
                    return RiskAssessment(
                        risk_level=RiskLevel.BLOCKED,
                        requires_approval=True,
                        requires_double_confirm=True,
                        reason=f"Dangerous pattern '{pattern}' detected — possible injection",
                        command_base=command_base,
                    )
                # For HIGH elevation patterns
                return RiskAssessment(
                    risk_level=RiskLevel.HIGH,
                    requires_approval=True,
                    requires_double_confirm=True,
                    reason=f"Dangerous argument pattern '{pattern}' detected",
                    command_base=command_base,
                )

        # ── Step 3: Check HIGH risk commands ──────────────────────────────────
        for key, policy in HIGH_RISK_COMMANDS.items():
            if self._matches_command(key, command_base, args):
                return RiskAssessment(
                    risk_level=RiskLevel.HIGH,
                    requires_approval=True,
                    requires_double_confirm=policy.requires_double_confirm,
                    reason=policy.description,
                    command_base=command_base,
                    policy=policy,
                )

        # ── Step 4: Check MEDIUM risk commands ────────────────────────────────
        for key, policy in MEDIUM_RISK_COMMANDS.items():
            if self._matches_command(key, command_base, args):
                return RiskAssessment(
                    risk_level=RiskLevel.MEDIUM,
                    requires_approval=True,
                    requires_double_confirm=False,
                    reason=policy.description,
                    command_base=command_base,
                    policy=policy,
                )

        # ── Step 5: Check LOW risk commands ───────────────────────────────────
        if command_base in LOW_RISK_COMMANDS:
            policy = LOW_RISK_COMMANDS[command_base]
            # Re-check systemctl — status is LOW but start/stop/restart is MEDIUM
            if command_base == "systemctl" and len(args) > 1:
                subcommand = args[1].lower()
                if subcommand in {"start", "stop", "restart", "reload", "enable", "disable"}:
                    return RiskAssessment(
                        risk_level=RiskLevel.MEDIUM,
                        requires_approval=True,
                        requires_double_confirm=False,
                        reason=f"systemctl {subcommand} modifies service state",
                        command_base=command_base,
                    )
            # dnf — install/remove/update is MEDIUM, info/list/search is LOW
            if command_base == "dnf" and len(args) > 1:
                subcommand = args[1].lower()
                if subcommand in {"install", "remove", "update", "upgrade", "erase", "autoremove"}:
                    return RiskAssessment(
                        risk_level=RiskLevel.MEDIUM,
                        requires_approval=True,
                        requires_double_confirm=False,
                        reason=f"dnf {subcommand} modifies system packages",
                        command_base=command_base,
                    )
            # podman — ps/logs/inspect/stats is LOW, start/stop/rm is MEDIUM+
            if command_base == "podman" and len(args) > 1:
                subcommand = args[1].lower()
                if subcommand in {"start", "stop", "restart"}:
                    return RiskAssessment(
                        risk_level=RiskLevel.MEDIUM,
                        requires_approval=True,
                        requires_double_confirm=False,
                        reason=f"podman {subcommand} modifies container state",
                        command_base=command_base,
                    )
                if subcommand in {"rm", "rmi", "kill"}:
                    return RiskAssessment(
                        risk_level=RiskLevel.HIGH,
                        requires_approval=True,
                        requires_double_confirm=True,
                        reason=f"podman {subcommand} is a destructive operation",
                        command_base=command_base,
                    )

            return RiskAssessment(
                risk_level=RiskLevel.LOW,
                requires_approval=False,
                requires_double_confirm=False,
                reason=policy.description,
                command_base=command_base,
                policy=policy,
            )

        # ── Step 6: Unknown command — default to HIGH ─────────────────────────
        return RiskAssessment(
            risk_level=RiskLevel.HIGH,
            requires_approval=True,
            requires_double_confirm=False,
            reason=f"Unknown command '{command_base}' — defaulting to HIGH risk",
            command_base=command_base,
        )

    def _matches_command(self, key: str, command_base: str, args: list[str]) -> bool:
        """Check if command+args match a policy key (handles multi-word keys like 'systemctl restart')."""
        key_parts = key.split()
        if len(key_parts) == 1:
            return command_base == key_parts[0]
        # Multi-word: check command and first arg
        if command_base != key_parts[0]:
            return False
        if len(args) < 2:
            return False
        return args[1].lower() == key_parts[1].lower()

    def assess_from_string(self, command_string: str) -> RiskAssessment:
        """Parse a command string and assess its risk."""
        try:
            args = shlex.split(command_string)
        except ValueError:
            return RiskAssessment(
                risk_level=RiskLevel.BLOCKED,
                requires_approval=True,
                requires_double_confirm=True,
                reason="Malformed command string — cannot be parsed safely",
                command_base="",
            )
        return self.assess(args)


# Singleton instance
risk_engine = RiskEngine()
