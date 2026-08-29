"""
Test suite evaluating AI Quick Fix across 10 distinct Linux failure scenarios.
"""
import pytest
import asyncio
from app.api.quick_fix import _heuristic_quick_fix, get_quick_fix
from app.schemas import QuickFixRequest
from app.models.user import User

TEST_SCENARIOS = [
    {
        "id": 1,
        "name": "Permission Denied: useradd without sudo",
        "command": "useradd devops_user",
        "stdout": "",
        "stderr": "useradd: cannot lock /etc/passwd; try again later.",
        "exit_code": 1,
        "expected_keyword": "sudo useradd",
    },
    {
        "id": 2,
        "name": "Permission Denied: Reading protected /etc/shadow file",
        "command": "cat /etc/shadow",
        "stdout": "",
        "stderr": "cat: /etc/shadow: Permission denied",
        "exit_code": 1,
        "expected_keyword": "sudo",
    },
    {
        "id": 3,
        "name": "Systemd Unit Not Found: nonexistent service",
        "command": "systemctl restart mycustomapp",
        "stdout": "",
        "stderr": "Failed to restart mycustomapp.service: Unit mycustomapp.service not found.",
        "exit_code": 5,
        "expected_keyword": "mycustomapp",
    },
    {
        "id": 4,
        "name": "Missing Binary: command not found for htop",
        "command": "htop",
        "stdout": "",
        "stderr": "bash: htop: command not found...",
        "exit_code": 127,
        "expected_keyword": "dnf install",
    },
    {
        "id": 5,
        "name": "Firewall Control: Unauthorized firewall-cmd",
        "command": "firewall-cmd --list-all",
        "stdout": "",
        "stderr": "Authorization failed. Are you root?",
        "exit_code": 2,
        "expected_keyword": "sudo",
    },
    {
        "id": 6,
        "name": "Directory Access: cd /root forbidden",
        "command": "cd /root",
        "stdout": "",
        "stderr": "bash: cd: /root: Permission denied",
        "exit_code": 1,
        "expected_keyword": "sudo",
    },
    {
        "id": 7,
        "name": "Filesystem Write: touch in /etc directory",
        "command": "touch /etc/custom_config.conf",
        "stdout": "",
        "stderr": "touch: cannot touch '/etc/custom_config.conf': Permission denied",
        "exit_code": 1,
        "expected_keyword": "sudo touch",
    },
    {
        "id": 8,
        "name": "Package Management: DNF install as unprivileged user",
        "command": "dnf install -y tree",
        "stdout": "",
        "stderr": "Error: This command has to be run with superuser privileges (under the root user on most systems).",
        "exit_code": 1,
        "expected_keyword": "sudo dnf install",
    },
    {
        "id": 9,
        "name": "Socket Conflict: Address already in use",
        "command": "python3 -m http.server 80",
        "stdout": "",
        "stderr": "OSError: [Errno 98] Address already in use",
        "exit_code": 1,
        "expected_keyword": "ss -tulpn",
    },
    {
        "id": 10,
        "name": "Systemd Service Status Inspection on Failure",
        "command": "systemctl start postgresql",
        "stdout": "",
        "stderr": "Job for postgresql.service failed because the control process exited with error code.",
        "exit_code": 1,
        "expected_keyword": "journalctl",
    },
]


def test_10_quick_fix_scenarios():
    """Verify all 10 Linux failure scenarios produce accurate Quick Fixes."""
    for s in TEST_SCENARIOS:
        res = _heuristic_quick_fix(
            cmd=s["command"],
            stdout=s["stdout"],
            stderr=s["stderr"],
            exit_code=s["exit_code"],
            user="mahesh",
            host="192.168.232.129",
        )
        assert res is not None
        assert res.why_failed, f"Scenario {s['id']} missing why_failed"
        assert res.root_cause, f"Scenario {s['id']} missing root_cause"
        assert res.fix_command, f"Scenario {s['id']} missing fix_command"
        assert (
            s["expected_keyword"].lower() in res.fix_command.lower()
            or any(s["expected_keyword"].lower() in d.lower() for d in res.diagnostic_commands)
            or s["expected_keyword"].lower() in res.recommended_fix.lower()
        ), f"Scenario {s['id']} expected '{s['expected_keyword']}' in fix ({res.fix_command})"
        print(f"  [PASS] Scenario {s['id']}: [{s['name']}] -> Fix: {res.fix_command}")
