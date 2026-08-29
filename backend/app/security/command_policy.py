"""
LinuxAI — Command Risk Policy
Defines risk levels and allowlists for safe command execution.

Risk Levels:
  LOW    — Read-only / diagnostic commands — auto-execute
  MEDIUM — Modifying commands — require user confirmation
  HIGH   — Destructive / dangerous commands — always require explicit confirmation
  BLOCKED — Never allowed regardless of context
"""

from enum import Enum
from typing import NamedTuple


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    BLOCKED = "BLOCKED"


class CommandPolicy(NamedTuple):
    risk: RiskLevel
    description: str
    requires_approval: bool
    requires_double_confirm: bool = False  # For destructive operations


# ─── LOW RISK ────────────────────────────────────────────────────────────────
# Read-only / diagnostic commands — auto-execute, no approval needed

LOW_RISK_COMMANDS: dict[str, CommandPolicy] = {
    "pwd":          CommandPolicy(RiskLevel.LOW, "Print working directory", False),
    "ls":           CommandPolicy(RiskLevel.LOW, "List directory contents", False),
    "id":           CommandPolicy(RiskLevel.LOW, "Show user identity", False),
    "whoami":       CommandPolicy(RiskLevel.LOW, "Show current user", False),
    "uptime":       CommandPolicy(RiskLevel.LOW, "System uptime", False),
    "date":         CommandPolicy(RiskLevel.LOW, "Current date/time", False),
    "hostname":     CommandPolicy(RiskLevel.LOW, "Show hostname", False),
    "hostnamectl":  CommandPolicy(RiskLevel.LOW, "Hostname and OS info", False),
    "uname":        CommandPolicy(RiskLevel.LOW, "Kernel information", False),
    "df":           CommandPolicy(RiskLevel.LOW, "Disk filesystem usage", False),
    "du":           CommandPolicy(RiskLevel.LOW, "Directory disk usage", False),
    "free":         CommandPolicy(RiskLevel.LOW, "Memory usage", False),
    "ip":           CommandPolicy(RiskLevel.LOW, "Network interface info", False),
    "ss":           CommandPolicy(RiskLevel.LOW, "Socket statistics", False),
    "ps":           CommandPolicy(RiskLevel.LOW, "Process status", False),
    "top":          CommandPolicy(RiskLevel.LOW, "Interactive process viewer (batch mode)", False),
    "pgrep":        CommandPolicy(RiskLevel.LOW, "Search processes by name", False),
    "pstree":       CommandPolicy(RiskLevel.LOW, "Process tree", False),
    "systemctl":    CommandPolicy(RiskLevel.LOW, "Systemd service control (status only)", False),
    "journalctl":   CommandPolicy(RiskLevel.LOW, "System journal logs", False),
    "lscpu":        CommandPolicy(RiskLevel.LOW, "CPU information", False),
    "lsblk":        CommandPolicy(RiskLevel.LOW, "Block device list", False),
    "lsof":         CommandPolicy(RiskLevel.LOW, "List open files", False),
    "blkid":        CommandPolicy(RiskLevel.LOW, "Block device identifiers", False),
    "findmnt":      CommandPolicy(RiskLevel.LOW, "Find mount points", False),
    "mount":        CommandPolicy(RiskLevel.LOW, "List mount points (read)", False),
    "cat":          CommandPolicy(RiskLevel.LOW, "Read file contents", False),
    "less":         CommandPolicy(RiskLevel.LOW, "Read file with pager", False),
    "head":         CommandPolicy(RiskLevel.LOW, "First lines of file", False),
    "tail":         CommandPolicy(RiskLevel.LOW, "Last lines of file", False),
    "grep":         CommandPolicy(RiskLevel.LOW, "Search file contents", False),
    "find":         CommandPolicy(RiskLevel.LOW, "Find files (read-only)", False),
    "stat":         CommandPolicy(RiskLevel.LOW, "File status information", False),
    "file":         CommandPolicy(RiskLevel.LOW, "Determine file type", False),
    "wc":           CommandPolicy(RiskLevel.LOW, "Word/line count", False),
    "sort":         CommandPolicy(RiskLevel.LOW, "Sort text", False),
    "awk":          CommandPolicy(RiskLevel.LOW, "Text processing", False),
    "sed":          CommandPolicy(RiskLevel.LOW, "Stream editor (read)", False),
    "curl":         CommandPolicy(RiskLevel.LOW, "HTTP request (read)", False),
    "ping":         CommandPolicy(RiskLevel.LOW, "Network connectivity test", False),
    "nslookup":     CommandPolicy(RiskLevel.LOW, "DNS lookup", False),
    "dig":          CommandPolicy(RiskLevel.LOW, "DNS query", False),
    "getent":       CommandPolicy(RiskLevel.LOW, "Query system databases", False),
    "resolvectl":   CommandPolicy(RiskLevel.LOW, "DNS resolver status", False),
    "nmcli":        CommandPolicy(RiskLevel.LOW, "NetworkManager CLI (read)", False),
    "getenforce":   CommandPolicy(RiskLevel.LOW, "SELinux enforcement mode", False),
    "sestatus":     CommandPolicy(RiskLevel.LOW, "SELinux detailed status", False),
    "pvs":          CommandPolicy(RiskLevel.LOW, "Physical volume info", False),
    "vgs":          CommandPolicy(RiskLevel.LOW, "Volume group info", False),
    "lvs":          CommandPolicy(RiskLevel.LOW, "Logical volume info", False),
    "rpm":          CommandPolicy(RiskLevel.LOW, "RPM package info (query only)", False),
    "dnf":          CommandPolicy(RiskLevel.LOW, "DNF package info (read: info/list/search)", False),
    "podman":       CommandPolicy(RiskLevel.LOW, "Podman container info (ps/inspect/stats/logs)", False),
    "who":          CommandPolicy(RiskLevel.LOW, "Show logged in users", False),
    "w":            CommandPolicy(RiskLevel.LOW, "Show who is logged in", False),
    "last":         CommandPolicy(RiskLevel.LOW, "Login history", False),
    "lastlog":      CommandPolicy(RiskLevel.LOW, "Last login info per user", False),
    "firewall-cmd": CommandPolicy(RiskLevel.LOW, "Firewall status (read)", False),
    "ausearch":     CommandPolicy(RiskLevel.LOW, "Audit log search", False),
    "getfacl":      CommandPolicy(RiskLevel.LOW, "Get file ACL", False),
    "env":          CommandPolicy(RiskLevel.LOW, "Show environment variables", False),
    "echo":         CommandPolicy(RiskLevel.LOW, "Print text", False),
    "which":        CommandPolicy(RiskLevel.LOW, "Locate command", False),
    "whereis":      CommandPolicy(RiskLevel.LOW, "Locate binary/source/manual", False),
    "timedatectl":  CommandPolicy(RiskLevel.LOW, "Time and date settings (read)", False),
    "localectl":    CommandPolicy(RiskLevel.LOW, "Locale settings (read)", False),
    "vim":          CommandPolicy(RiskLevel.LOW, "Interactive Vim text editor", False),
    "vi":           CommandPolicy(RiskLevel.LOW, "Interactive Vi text editor", False),
    "nano":         CommandPolicy(RiskLevel.LOW, "Interactive Nano text editor", False),
    "ed":           CommandPolicy(RiskLevel.LOW, "Standard text editor", False),
}

# ─── MEDIUM RISK ─────────────────────────────────────────────────────────────
# Modifying commands — require confirmation before execution

MEDIUM_RISK_COMMANDS: dict[str, CommandPolicy] = {
    "systemctl start":   CommandPolicy(RiskLevel.MEDIUM, "Start a systemd service", True),
    "systemctl stop":    CommandPolicy(RiskLevel.MEDIUM, "Stop a systemd service", True),
    "systemctl restart": CommandPolicy(RiskLevel.MEDIUM, "Restart a systemd service", True),
    "systemctl reload":  CommandPolicy(RiskLevel.MEDIUM, "Reload a systemd service", True),
    "systemctl enable":  CommandPolicy(RiskLevel.MEDIUM, "Enable service at boot", True),
    "systemctl disable": CommandPolicy(RiskLevel.MEDIUM, "Disable service at boot", True),
    "dnf install":       CommandPolicy(RiskLevel.MEDIUM, "Install a package", True),
    "dnf update":        CommandPolicy(RiskLevel.MEDIUM, "Update packages", True),
    "dnf upgrade":       CommandPolicy(RiskLevel.MEDIUM, "Upgrade packages", True),
    "dnf remove":        CommandPolicy(RiskLevel.MEDIUM, "Remove a package", True),
    "useradd":           CommandPolicy(RiskLevel.MEDIUM, "Create a new user", True),
    "usermod":           CommandPolicy(RiskLevel.MEDIUM, "Modify user account", True),
    "groupadd":          CommandPolicy(RiskLevel.MEDIUM, "Create a new group", True),
    "gpasswd":           CommandPolicy(RiskLevel.MEDIUM, "Modify group membership", True),
    "passwd":            CommandPolicy(RiskLevel.MEDIUM, "Change user password", True),
    "chmod":             CommandPolicy(RiskLevel.MEDIUM, "Change file permissions", True),
    "chown":             CommandPolicy(RiskLevel.MEDIUM, "Change file ownership", True),
    "setfacl":           CommandPolicy(RiskLevel.MEDIUM, "Set file ACL", True),
    "mkdir":             CommandPolicy(RiskLevel.MEDIUM, "Create directory", True),
    "cp":                CommandPolicy(RiskLevel.MEDIUM, "Copy files", True),
    "mv":                CommandPolicy(RiskLevel.MEDIUM, "Move/rename files", True),
    "touch":             CommandPolicy(RiskLevel.MEDIUM, "Create/update file", True),
    "tee":               CommandPolicy(RiskLevel.MEDIUM, "Write to file", True),
    "journalctl --rotate": CommandPolicy(RiskLevel.MEDIUM, "Rotate journal logs", True),
    "journalctl --vacuum-size": CommandPolicy(RiskLevel.MEDIUM, "Vacuum journal by size", True),
    "podman start":      CommandPolicy(RiskLevel.MEDIUM, "Start a container", True),
    "podman stop":       CommandPolicy(RiskLevel.MEDIUM, "Stop a container", True),
    "podman restart":    CommandPolicy(RiskLevel.MEDIUM, "Restart a container", True),
    "nmcli connection":  CommandPolicy(RiskLevel.MEDIUM, "Modify network connection", True),
    "timedatectl set":   CommandPolicy(RiskLevel.MEDIUM, "Set time/date", True),
    "hostnamectl set":   CommandPolicy(RiskLevel.MEDIUM, "Set hostname", True),
    "setenforce":        CommandPolicy(RiskLevel.MEDIUM, "Change SELinux enforcement", True),
    "firewall-cmd --add":    CommandPolicy(RiskLevel.MEDIUM, "Add firewall rule", True),
    "firewall-cmd --remove": CommandPolicy(RiskLevel.MEDIUM, "Remove firewall rule", True),
    "su":                CommandPolicy(RiskLevel.MEDIUM, "Switch user identity", True),
    "sudo":              CommandPolicy(RiskLevel.MEDIUM, "Execute command as superuser", True),
}

# ─── HIGH RISK ───────────────────────────────────────────────────────────────
# Destructive operations — always require explicit confirmation with danger acknowledgement

HIGH_RISK_COMMANDS: dict[str, CommandPolicy] = {
    "rm":        CommandPolicy(RiskLevel.HIGH, "Delete files/directories", True, True),
    "rmdir":     CommandPolicy(RiskLevel.HIGH, "Remove directory", True, True),
    "shred":     CommandPolicy(RiskLevel.HIGH, "Securely delete files", True, True),
    "mkfs":      CommandPolicy(RiskLevel.HIGH, "Format filesystem", True, True),
    "fdisk":     CommandPolicy(RiskLevel.HIGH, "Partition disk", True, True),
    "parted":    CommandPolicy(RiskLevel.HIGH, "Partition disk", True, True),
    "gdisk":     CommandPolicy(RiskLevel.HIGH, "Partition disk (GPT)", True, True),
    "dd":        CommandPolicy(RiskLevel.HIGH, "Low-level data copy/overwrite", True, True),
    "wipefs":    CommandPolicy(RiskLevel.HIGH, "Wipe filesystem signatures", True, True),
    "lvremove":  CommandPolicy(RiskLevel.HIGH, "Remove logical volume", True, True),
    "vgremove":  CommandPolicy(RiskLevel.HIGH, "Remove volume group", True, True),
    "pvremove":  CommandPolicy(RiskLevel.HIGH, "Remove physical volume", True, True),
    "userdel":   CommandPolicy(RiskLevel.HIGH, "Delete user account", True, True),
    "groupdel":  CommandPolicy(RiskLevel.HIGH, "Delete group", True, True),
    "iptables -F": CommandPolicy(RiskLevel.HIGH, "Flush iptables rules", True, True),
    "iptables":  CommandPolicy(RiskLevel.HIGH, "Modify iptables rules", True, True),
    "firewall-cmd --permanent --remove-service": CommandPolicy(RiskLevel.HIGH, "Permanently remove firewall service", True, True),
    "reboot":    CommandPolicy(RiskLevel.HIGH, "Reboot the system", True, True),
    "shutdown":  CommandPolicy(RiskLevel.HIGH, "Shutdown the system", True, True),
    "init":      CommandPolicy(RiskLevel.HIGH, "Change system runlevel", True, True),
    "halt":      CommandPolicy(RiskLevel.HIGH, "Halt the system", True, True),
    "poweroff":  CommandPolicy(RiskLevel.HIGH, "Power off the system", True, True),
    "podman rm": CommandPolicy(RiskLevel.HIGH, "Remove container", True, True),
    "podman rmi": CommandPolicy(RiskLevel.HIGH, "Remove container image", True, True),
    "truncate":  CommandPolicy(RiskLevel.HIGH, "Truncate file to size", True, True),
}

# ─── BLOCKED ─────────────────────────────────────────────────────────────────
# Commands that LinuxAI will never execute regardless of context

BLOCKED_COMMANDS: set[str] = {
    # Direct kernel/hardware manipulation
    "insmod", "rmmod", "modprobe",
    # Network attack tools
    "nmap", "netcat", "nc", "socat",
    # Fork bombs / resource exhaustion
    ":(){ :|:& };:",
    # Package manager in pipe (injection risk)
    "rpm -e", "rpm --erase",
}

# ─── DANGEROUS ARGUMENT PATTERNS ─────────────────────────────────────────────
# These argument patterns elevate command risk level
DANGEROUS_ARG_PATTERNS: list[tuple[str, RiskLevel]] = [
    # Shell metacharacters elevate to MEDIUM risk instead of BLOCKED
    ("`",  RiskLevel.MEDIUM),
    ("$(", RiskLevel.MEDIUM),
    ("${", RiskLevel.MEDIUM),
    # Dangerous flags
    ("-rf", RiskLevel.HIGH),
    ("--no-preserve-root", RiskLevel.HIGH),
    # Path traversal
    ("../", RiskLevel.HIGH),
    ("..\\", RiskLevel.HIGH),
    # Writing to critical system paths
    ("/etc/passwd", RiskLevel.HIGH),
    ("/etc/shadow", RiskLevel.HIGH),
    ("/etc/sudoers", RiskLevel.HIGH),
    ("/boot/", RiskLevel.HIGH),
    ("/dev/", RiskLevel.HIGH),
]
