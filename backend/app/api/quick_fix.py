"""
LinuxAI — Terminal AI Quick Fix Endpoint
Provides instant, background AI diagnosis and VS Code-style quick fixes for failed shell commands.
"""

import asyncio
import json
import re
import shlex
import uuid
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user
from app.models.user import User
from app.schemas import QuickFixRequest, QuickFixResponse
from app.security.risk_engine import RiskEngine, RiskLevel
from app.config import get_settings
from app.ai.agent import agent

router = APIRouter()
logger = structlog.get_logger(__name__)
risk_engine = RiskEngine()

DANGEROUS_PATTERNS = [
    r"rm\s+-rf",
    r"mkfs",
    r"fdisk",
    r"dd\s+if=",
    r"lvremove",
    r"vgremove",
    r"pvremove",
    r"chmod\s+-R\s+777\s+/",
    r"chown\s+-R\s+.*\/",
    r"iptables\s+-F",
    r"ufw\s+reset",
    r"> /dev/sd",
]

QUICK_FIX_PROMPT_TEMPLATE = """You are an expert Red Hat Enterprise Linux (RHEL 9) system administrator and AI terminal assistant.
A user ran a shell command in their terminal, and it failed with exit code {exit_code}.

COMMAND EXECUTED:
{command}

STDOUT:
{stdout}

STDERR:
{stderr}

CONTEXT:
User: {user}
Host: {host}
OS: {os_info}

Your task: Provide a structured AI Quick Fix JSON response explaining why the command failed and providing the exact solution.

You MUST respond ONLY with a valid JSON object matching this schema:
{{
  "why_failed": "Concise 1-sentence explanation of why the command failed",
  "root_cause": "Technical explanation of the underlying system restriction, permission error, missing file/package, or syntax mistake",
  "recommended_fix": "Clear explanation of how to fix it",
  "fix_command": "The exact shell command to fix the issue (e.g., 'sudo useradd gta' or 'sudo systemctl start nginx')",
  "requires_sudo": true/false,
  "verification_command": "Command to verify if the fix worked (e.g., 'id gta' or 'systemctl status nginx')",
  "diagnostic_commands": ["list of diagnostic commands if context is insufficient or error is ambiguous"],
  "rhcsa_concept": "Short explanation of the Linux concept for RHCSA learning mode (e.g., root permissions, systemd service units, file ACLs)",
  "rhcsa_exam_tip": "Practical exam tip for the Red Hat Certified System Administrator (EX200) exam"
}}

CRITICAL INSTRUCTIONS:
- Keep answers accurate, direct, and actionable.
- If root privileges are missing, prefix fix_command with 'sudo' and set requires_sudo: true.
- If the error is ambiguous, include non-interactive diagnostic commands.
- Output strictly raw valid JSON without markdown fences.
"""


def _check_is_dangerous(cmd: str) -> bool:
    """Check if command contains high risk or destructive operations."""
    if not cmd:
        return False
    for pat in DANGEROUS_PATTERNS:
        if re.search(pat, cmd, re.IGNORECASE):
            return True
    
    try:
        args = shlex.split(cmd)
        assessment = risk_engine.assess(args)
        if assessment.risk_level in (RiskLevel.HIGH, RiskLevel.BLOCKED):
            return True
    except Exception:
        pass
    return False


def _heuristic_quick_fix(cmd: str, stdout: str, stderr: str, exit_code: int, user: str, host: str) -> QuickFixResponse:
    """Generate high-precision, instant diagnostic solutions for common Linux errors."""
    low_cmd = cmd.lower().strip()
    low_err = (stderr or "").lower()
    low_out = (stdout or "").lower()

    # 1. Permission Denied / Sudo Password Required / Root operations
    if (
        "permission denied" in low_err
        or "must be root" in low_err
        or "cannot lock /etc/passwd" in low_err
        or "password for" in low_err
        or "password for" in low_out
        or "password is required" in low_err
        or "operation not permitted" in low_err
        or "are you root?" in low_err
    ):
        fix_cmd = f"sudo {cmd}" if not cmd.startswith("sudo ") else cmd
        return QuickFixResponse(
            id=str(uuid.uuid4()),
            command=cmd,
            why_failed=f"Command '{cmd}' requires elevated root/administrator privileges.",
            root_cause="The executing user lacks root privileges or sudo credentials for this administrative operation.",
            recommended_fix="Prepend 'sudo' to execute with administrative authority.",
            fix_command=fix_cmd,
            risk_level="MEDIUM",
            requires_sudo=True,
            is_dangerous=False,
            verification_command="whoami",
            diagnostic_commands=["sudo -l", "id"],
            rhcsa_concept="Privilege Escalation & sudoers in RHEL 9",
            rhcsa_exam_tip="Administrative commands modifying /etc, systemctl, or package managers always require sudo elevation.",
        )

    # 2. Systemctl service not found / failed / inactive
    if "systemctl" in low_cmd:
        svc = cmd.split()[-1] if len(cmd.split()) > 1 and not cmd.split()[-1].startswith("-") else "nginx"
        if "not found" in low_err or "unit" in low_err:
            fix_cmd = f"sudo dnf install -y {svc}"
            return QuickFixResponse(
                id=str(uuid.uuid4()),
                command=cmd,
                why_failed=f"Service unit '{svc}' is not installed or not registered in systemd.",
                root_cause=f"No unit file found in /etc/systemd/system or /usr/lib/systemd/system for {svc}.",
                recommended_fix=f"Install the package providing {svc} using DNF or check the exact unit name.",
                fix_command=fix_cmd,
                risk_level="MEDIUM",
                requires_sudo=True,
                is_dangerous=False,
                verification_command=f"systemctl status {svc} --no-pager",
                diagnostic_commands=[f"systemctl list-unit-files | grep -i {svc}", f"dnf search {svc}"],
                rhcsa_concept="Systemd Unit Files & Service Management",
                rhcsa_exam_tip="Use 'systemctl list-unit-files --type=service' to confirm the exact unit name on RHCSA.",
            )
        else:
            fix_cmd = f"sudo systemctl restart {svc}"
            return QuickFixResponse(
                id=str(uuid.uuid4()),
                command=cmd,
                why_failed=f"Failed to control systemd service '{svc}'.",
                root_cause=stderr or "Service process encountered an error or failed to start.",
                recommended_fix=f"Inspect journal logs and restart the {svc} service unit.",
                fix_command=fix_cmd,
                risk_level="MEDIUM",
                requires_sudo=True,
                is_dangerous=False,
                verification_command=f"systemctl is-active {svc}",
                diagnostic_commands=[f"systemctl status {svc} --no-pager", f"journalctl -u {svc} -xe --no-pager -n 30"],
                rhcsa_concept="Systemd Service Lifecycle & Journald Diagnostics",
                rhcsa_exam_tip="Always inspect 'journalctl -u <service> -xe' when a service fails to start during RHCSA exams.",
            )

    # 3. Command not found
    if "command not found" in low_err or "not found" in low_err:
        prog = cmd.split()[0] if cmd.split() else "package"
        fix_cmd = f"sudo dnf install -y {prog}"
        return QuickFixResponse(
            id=str(uuid.uuid4()),
            command=cmd,
            why_failed=f"Command executable '{prog}' was not found in system $PATH.",
            root_cause=f"Binary is either not installed or not located in standard PATH directories.",
            recommended_fix=f"Install the package via DNF or verify the binary path.",
            fix_command=fix_cmd,
            risk_level="MEDIUM",
            requires_sudo=True,
            is_dangerous=False,
            verification_command=f"which {prog}",
            diagnostic_commands=[f"dnf provides */{prog}", "echo $PATH"],
            rhcsa_concept="Linux Environment PATH & Package Management (DNF/RPM)",
            rhcsa_exam_tip="Use 'dnf provides */<command>' to find which RPM package provides a missing binary.",
        )

    # 4. Port / Address Already in Use
    if "address already in use" in low_err or "bind" in low_err:
        return QuickFixResponse(
            id=str(uuid.uuid4()),
            command=cmd,
            why_failed="Network port binding conflict detected.",
            root_cause="Another process is currently listening on the required network port.",
            recommended_fix="Identify the conflicting process with 'ss -tulpn' and stop it.",
            fix_command="sudo ss -tulpn",
            risk_level="LOW",
            requires_sudo=True,
            is_dangerous=False,
            verification_command="ss -tulpn",
            diagnostic_commands=["ss -tulpn", "lsof -i"],
            rhcsa_concept="Network Sockets & Port Conflict Troubleshooting",
            rhcsa_exam_tip="On RHCSA, use 'ss -tulpn' or 'lsof -i :<port>' to troubleshoot listening socket conflicts.",
        )

    # 5. Generic fallback
    fix_cmd = f"sudo {cmd}" if not cmd.startswith("sudo ") else cmd
    is_dang = _check_is_dangerous(fix_cmd)
    return QuickFixResponse(
        id=str(uuid.uuid4()),
        command=cmd,
        why_failed=f"Command '{cmd}' exited with return code {exit_code}.",
        root_cause=stderr or stdout or "Process terminated with a non-zero exit status.",
        recommended_fix="Inspect error output or retry with elevated permissions.",
        fix_command=fix_cmd,
        risk_level="DANGEROUS" if is_dang else "MEDIUM",
        requires_sudo=fix_cmd.startswith("sudo "),
        is_dangerous=is_dang,
        verification_command="",
        diagnostic_commands=["dmesg | tail -n 20", "journalctl -n 20 --no-pager"],
        rhcsa_concept="RHEL 9 Process Exit Codes & Troubleshooting",
        rhcsa_exam_tip="Always check exit code '$?' and standard error stream to diagnose failures.",
    )


@router.post("", response_model=QuickFixResponse)
@router.post("/", response_model=QuickFixResponse)
async def get_quick_fix(
    request: QuickFixRequest,
    user: User = Depends(get_current_user),
):
    """
    Analyze a failed terminal command and return an AI Quick Fix solution.
    Fast response guaranteed: tries AI with a 3.0s timeout and falls back to intelligent heuristics.
    """
    cmd = request.command.strip()
    stderr = request.stderr.strip()
    stdout = request.stdout.strip()
    exit_code = request.exit_code

    logger.info(
        "Quick fix requested",
        command=cmd,
        exit_code=exit_code,
        user=user.username,
    )

    # Try LLM query with a strict 3.0s timeout
    try:
        client, model_name, provider_name, is_configured = agent._resolve_client_and_model()
        if is_configured:
            prompt = QUICK_FIX_PROMPT_TEMPLATE.format(
                command=cmd,
                stdout=stdout or "(empty)",
                stderr=stderr or "(empty)",
                exit_code=exit_code,
                user=request.user,
                host=request.host,
                os_info=request.os_info or "RHEL 9",
            )
            llm_task = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=600,
            )
            # Timeout after 3.0 seconds to guarantee snappy UI
            res = await asyncio.wait_for(llm_task, timeout=3.0)
            raw_text = res.choices[0].message.content or ""
            raw_text = raw_text.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(raw_text)

            fix_c = parsed.get("fix_command", f"sudo {cmd}")
            is_dang = _check_is_dangerous(fix_c)
            requires_sudo = bool(parsed.get("requires_sudo", fix_c.startswith("sudo ")))

            return QuickFixResponse(
                id=str(uuid.uuid4()),
                command=cmd,
                why_failed=parsed.get("why_failed", f"Command exited with status {exit_code}"),
                root_cause=parsed.get("root_cause", stderr or "Command execution failed."),
                recommended_fix=parsed.get("recommended_fix", "Review parameters and permissions."),
                fix_command=fix_c,
                risk_level="DANGEROUS" if is_dang else ("HIGH" if requires_sudo else "LOW"),
                requires_sudo=requires_sudo,
                is_dangerous=is_dang,
                verification_command=parsed.get("verification_command", ""),
                diagnostic_commands=parsed.get("diagnostic_commands", []),
                rhcsa_concept=parsed.get("rhcsa_concept", "Linux Command Execution"),
                rhcsa_exam_tip=parsed.get("rhcsa_exam_tip", "Always check stderr and exit codes ($?) on RHCSA."),
            )
    except Exception as e:
        logger.debug("Using fast heuristic for quick fix", reason=str(e))

    # Fast, high-accuracy heuristic fallback
    return _heuristic_quick_fix(
        cmd=cmd,
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        user=request.user,
        host=request.host,
    )
