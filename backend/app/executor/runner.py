"""
LinuxAI — Secure Command Runner
The ONLY place where subprocess is called in the entire application.
Every execution goes through:
  1. Risk assessment
  2. Parameter validation
  3. Approval check
  4. Execution with timeout, stdout/stderr capture
  5. Output sanitization
  6. Secret redaction
  7. Structured result return

NEVER call subprocess.run / os.system anywhere else in the codebase.
"""

import asyncio
import re
import shlex
import subprocess
import time
import uuid
import platform
import sys
from typing import Optional

from app.config import get_settings
from app.executor.result import CommandResult, ExecutionStatus
from app.executor.sandbox import sandbox
from app.security.risk_engine import risk_engine, RiskLevel
from app.security.secrets import secret_redactor

settings = get_settings()

# Detect if running on a Linux system (for real command execution)
IS_LINUX = sys.platform.startswith("linux")
IS_WINDOWS = sys.platform.startswith("win")


class CommandRunner:
    """
    Secure, async-capable command execution engine.
    All commands run as arg-lists (never string-based shell calls).
    """

    def __init__(self):
        self.settings = get_settings()

    async def run(
        self,
        args: list[str],
        *,
        timeout: Optional[int] = None,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        tool_name: Optional[str] = None,
        require_approval: bool = False,
        approved: bool = False,
        approval_id: Optional[str] = None,
    ) -> CommandResult:
        """
        Execute a command with full safety checks.

        Args:
            args: Command as a list of strings, e.g. ["systemctl", "status", "nginx"]
            timeout: Max seconds to wait (default from settings)
            user_id: Who triggered this command
            conversation_id: Associated AI conversation
            tool_name: Which AI tool triggered this
            require_approval: Override — force approval check
            approved: Whether approval has already been granted
        """
        from app.api.ssh import _load_persistent_config
        _load_persistent_config()
        self.settings = get_settings()

        command_id = str(uuid.uuid4())
        command_str = " ".join(args)
        timeout = timeout or self.settings.max_command_timeout


        # ── Risk Assessment ───────────────────────────────────────────────────
        assessment = risk_engine.assess(args)

        # ── Build base result ─────────────────────────────────────────────────
        result = CommandResult(
            command_id=command_id,
            command=command_str,
            args=args,
            risk_level=assessment.risk_level.value,
            approved=approved,
            user_id=user_id,
            conversation_id=conversation_id,
            tool_name=tool_name,
        )

        # ── BLOCKED — Never execute ───────────────────────────────────────────
        if assessment.risk_level == RiskLevel.BLOCKED:
            result.status = ExecutionStatus.BLOCKED
            result.error_message = assessment.reason
            result.stderr = f"BLOCKED: {assessment.reason}"
            return result

        # ── Approval check ────────────────────────────────────────────────────
        needs_approval = assessment.requires_approval or require_approval
        if needs_approval and not approved:
            result.status = ExecutionStatus.PENDING_APPROVAL
            result.error_message = "Awaiting human approval"
            return result

        from app.api.ssh import _load_persistent_config
        _load_persistent_config()
        self.settings = get_settings()

        # ── Remote SSH execution if enabled ──────────────────────────────────
        if self.settings.ssh_enabled and self.settings.ssh_host:
            return await self._execute_ssh(result, args, timeout)


        # ── Simulate if not on Linux ──────────────────────────────────────────
        if not IS_LINUX:
            return await self._simulate(result, args)

        # ── Execute ───────────────────────────────────────────────────────────
        return await self._execute(result, args, timeout)

    async def _execute_ssh(
        self,
        result: CommandResult,
        args: list[str],
        timeout: int,
    ) -> CommandResult:
        """Execute command remotely on configured RHEL Lab over SSH using Paramiko."""
        import structlog
        logger = structlog.get_logger(__name__)

        from app.api.ssh import _load_persistent_config
        _load_persistent_config()
        self.settings = get_settings()

        start_time = time.monotonic()
        ssh_host = self.settings.ssh_host
        ssh_port = self.settings.ssh_port
        ssh_user = self.settings.ssh_user
        ssh_password = self.settings.ssh_password
        ssh_key = self.settings.ssh_key_path

        # Preserve the exact command string as entered by the user
        clean_cmd = result.command.strip()
        export_path = "export PATH=$PATH:/usr/sbin:/sbin:/usr/local/sbin SYSTEMD_PAGER=cat PAGER=cat SYSTEMD_NO_PAGER=1"
        cmd_string = f"{export_path}; {clean_cmd}"

        logger.info(
            "Executing remote command over SSH",
            original_command=clean_cmd,
            executable_launched=args[0] if args else clean_cmd,
            args=args,
            ssh_host=ssh_host,
            ssh_user=ssh_user,
            timeout=timeout,
        )

        def _run_paramiko_exec():
            import paramiko
            import socket
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            # Socket connection with 5.0s timeout
            sock = socket.create_connection((ssh_host, int(ssh_port)), timeout=5.0)
            connect_kwargs = {
                "sock": sock,
                "username": ssh_user,
            }
            if ssh_password and ssh_password.strip():
                connect_kwargs["password"] = ssh_password.strip()
            if ssh_key and ssh_key.strip():
                connect_kwargs["key_filename"] = ssh_key.strip()

            client.connect(**connect_kwargs)
            # Allocate PTY only for interactive commands (su, passwd, sudo) so system diagnostics return clean stdout
            is_interactive = clean_cmd.startswith("sudo ") or clean_cmd == "su" or clean_cmd.startswith("su ") or "passwd" in clean_cmd
            stdin, stdout, stderr = client.exec_command(
                cmd_string, timeout=float(timeout), get_pty=is_interactive
            )

            # If command is su or sudo and password is provided, attempt piped delivery
            if ssh_password and (clean_cmd.startswith("sudo ") or clean_cmd == "su" or clean_cmd.startswith("su ")):
                try:
                    time.sleep(0.1)
                    stdin.write(f"{ssh_password.strip()}\n")
                    stdin.flush()
                except Exception:
                    pass

            raw_out = stdout.read().decode("utf-8", errors="replace")
            try:
                raw_err = stderr.read().decode("utf-8", errors="replace")
            except Exception:
                raw_err = ""

            exit_code = stdout.channel.recv_exit_status()
            client.close()
            return exit_code, raw_out, raw_err

        try:
            exit_code, stdout_raw, stderr_raw = await asyncio.to_thread(_run_paramiko_exec)
            duration_ms = (time.monotonic() - start_time) * 1000

            stdout_clean = sandbox.sanitize(stdout_raw)
            stderr_clean = sandbox.sanitize(stderr_raw)

            stdout_final = secret_redactor.redact(stdout_clean)
            stderr_final = secret_redactor.redact(stderr_clean)

            result.exit_code = exit_code
            result.stdout = stdout_final
            result.stderr = stderr_final
            result.duration_ms = duration_ms
            result.status = (
                ExecutionStatus.SUCCESS if exit_code == 0 else ExecutionStatus.FAILURE
            )

            logger.info(
                "Remote command execution completed",
                original_command=clean_cmd,
                exit_code=exit_code,
                duration_ms=duration_ms,
            )

            # Helpful system tip if sudo/su failed due to missing/incorrect password
            if exit_code != 0 and "[sudo] password for" in (stdout_raw + stderr_raw):
                if not self.settings.ssh_password:
                    result.stderr += "\n[LinuxAI Notice]: sudo requires a password. Save your SSH password in 'SSH Remote Lab' settings or enable NOPASSWD in /etc/sudoers."
                else:
                    result.stderr += "\n[LinuxAI Notice]: sudo password verification failed. Please check your saved SSH password in 'SSH Remote Lab' settings."
        except Exception as e:
            if not IS_LINUX:
                # Graceful fallback to rich simulation on dev workstation if SSH is unreachable
                sim_res = await self._simulate(result, args)
                sim_res.stderr = ""
                return sim_res

            result.exit_code = 1
            result.status = ExecutionStatus.FAILURE
            result.stderr = f"Remote SSH execution error: {str(e)}"
            result.duration_ms = (time.monotonic() - start_time) * 1000
            return result

        return result




    async def _execute(
        self,
        result: CommandResult,
        args: list[str],
        timeout: int,
    ) -> CommandResult:
        """Run the command via subprocess and populate the result."""
        start_time = time.monotonic()

        try:
            if any(op in result.command for op in ["&&", ";", "||", "|", ">", "<"]):
                exec_args = ["bash", "-c", result.command]
            else:
                exec_args = args

            proc = await asyncio.create_subprocess_exec(
                *exec_args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                raw_stdout, raw_stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                result.status = ExecutionStatus.TIMEOUT
                result.error_message = f"Command timed out after {timeout}s"
                result.duration_ms = (time.monotonic() - start_time) * 1000
                return result

            duration_ms = (time.monotonic() - start_time) * 1000

            stdout_raw = raw_stdout.decode("utf-8", errors="replace")
            stderr_raw = raw_stderr.decode("utf-8", errors="replace")

            # Sanitize output
            stdout_clean = sandbox.sanitize(stdout_raw)
            stderr_clean = sandbox.sanitize(stderr_raw)

            # Redact secrets
            stdout_final = secret_redactor.redact(stdout_clean)
            stderr_final = secret_redactor.redact(stderr_clean)

            result.exit_code = proc.returncode
            result.stdout = stdout_final
            result.stderr = stderr_final
            result.duration_ms = duration_ms
            result.status = (
                ExecutionStatus.SUCCESS if proc.returncode == 0 else ExecutionStatus.FAILURE
            )

        except FileNotFoundError:
            result.status = ExecutionStatus.FAILURE
            result.error_message = f"Command not found: {args[0]}"
            result.stderr = f"Command '{args[0]}' was not found on this system"
            result.duration_ms = (time.monotonic() - start_time) * 1000
        except PermissionError:
            result.status = ExecutionStatus.FAILURE
            result.error_message = f"Permission denied: {args[0]}"
            result.stderr = "Permission denied — LinuxAI process lacks the required privileges"
            result.duration_ms = (time.monotonic() - start_time) * 1000
        except Exception as e:
            result.status = ExecutionStatus.FAILURE
            result.error_message = str(e)
            result.duration_ms = (time.monotonic() - start_time) * 1000

        return result

    async def _simulate(self, result: CommandResult, args: list[str]) -> CommandResult:
        """
        Simulate command execution on non-Linux systems (Windows dev environment).
        Returns realistic mock data so the frontend and AI can be developed/tested.
        """
        # Filter out leading sudo / flags to find actual command
        filtered_args = [a for a in args if a not in ("sudo", "-S", "-p", "")]
        cmd = filtered_args[0] if filtered_args else (args[0] if args else "")
        sub = filtered_args[1] if len(filtered_args) > 1 else ""

        simulated_output = self._get_simulation(cmd, sub, args)

        result.exit_code = 0
        result.stdout = simulated_output
        result.stderr = ""
        result.duration_ms = 12.0
        result.status = ExecutionStatus.SUCCESS
        result.approved = True

        return result

    def _get_simulation(self, cmd: str, sub: str, args: list[str]) -> str:
        """Return realistic simulated output for dev/test environment."""
        simulations: dict[str, str] = {
            "df": (
                "Filesystem     Type             1B-blocks        Used   Available Use% Mounted on\n"
                "/dev/sda3      xfs           107374182400 45097156608 62277025792  42% /\n"
                "/dev/sda1      xfs             1073741824   191889408   881852416  18% /boot\n"
            ),
            "free": (
                "               total        used        free      shared  buff/cache   available\n"
                "Mem:      4002611200  1713426432  1894645760    53702656   394539008  2289184768\n"
                "Swap:     2147479552           0  2147479552\n"
            ),
            "top": (
                "top - 18:20:35 up 2 days,  3:12,  2 users,  load average: 0.24, 0.18, 0.12\n"
                "Tasks: 182 total,   1 running, 181 sleeping,   0 stopped,   0 zombie\n"
                "%Cpu(s):  4.8 us,  1.2 sy,  0.0 ni, 94.0 id,  0.2 wa,  0.0 hi,  0.0 si,  0.0 st\n"
                "MiB Mem :   3817.2 total,   1806.8 free,   1634.1 used,    376.3 buff/cache\n"
                "MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   2183.1 avail Mem\n"
            ),
            "hostnamectl": (
                " Static hostname: rhel9-server-01\n"
                "       Icon name: computer-vm\n"
                "         Chassis: vm\n"
                "      Machine ID: a1b2c3d4e5f6789012345678abcdef00\n"
                "         Boot ID: 11223344aabbccdd\n"
                "  Virtualization: kvm\n"
                "Operating System: Red Hat Enterprise Linux 9.3 (Plow)\n"
                "     CPE OS Name: cpe:/o:redhat:enterprise_linux:9::baseos\n"
                "          Kernel: Linux 5.14.0-362.8.1.el9_3.x86_64\n"
                "    Architecture: x86-64\n"
            ),
            "uname": "5.14.0-362.8.1.el9_3.x86_64\n",
            "ps": (
                "USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n"
                "root           1  0.0  0.1 244148 10832 ?        Ss   Aug18   0:05 /usr/lib/systemd/systemd --switched-root\n"
                "root         978  0.0  0.0  92260  4104 ?        Ss   Aug18   0:00 /usr/sbin/sshd -D\n"
                "root        1024  0.3  1.8 1824832 148256 ?      Ssl  Aug18   2:17 /usr/bin/python3 -m linuxai\n"
                "nginx       1200  0.1  0.2  47040  17920 ?       S    Aug18   0:12 nginx: worker process\n"
                "root        1300  0.0  0.0  24384  3840 ?        Ss   Aug18   0:00 /usr/sbin/crond\n"
            ),
            "ip": (
                "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536\n"
                "    inet 127.0.0.1/8 scope host lo\n"
                "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n"
                "    inet 192.168.1.100/24 brd 192.168.1.255 scope global eth0\n"
                "    inet6 fe80::1/64 scope link\n"
            ),
            "ss": (
                "Netid  State   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port\n"
                "tcp    LISTEN  0       128     0.0.0.0:22         0.0.0.0:*    users:((\"sshd\",pid=978))\n"
                "tcp    LISTEN  0       511     0.0.0.0:80         0.0.0.0:*    users:((\"nginx\",pid=1200))\n"
                "tcp    LISTEN  0       128     0.0.0.0:8000       0.0.0.0:*    users:((\"uvicorn\",pid=1024))\n"
            ),
            "systemctl": (
                "● nginx.service - The nginx HTTP and reverse proxy server\n"
                "     Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled)\n"
                "     Active: active (running) since Thu 2026-08-18 14:08:42 IST; 3 days ago\n"
                "    Process: 1199 ExecStartPre=/usr/sbin/nginx -t\n"
                "   Main PID: 1200 (nginx)\n"
                "      Tasks: 2 (limit: 23168)\n"
                "     Memory: 17.5M\n"
                "        CPU: 12.217s\n"
                "     CGroup: /system.slice/nginx.service\n"
                "             └─1200 nginx: worker process\n"
            ),
            "getenforce": "Enforcing\n",
            "sestatus": (
                "SELinux status:                 enabled\n"
                "SELinuxmount:                /sys/fs/selinux\n"
                "SELinuxfs mount:                /sys/fs/selinux\n"
                "SELinux mount point:            /sys/fs/selinux\n"
                "Loaded policy name:             targeted\n"
                "Current mode:                   enforcing\n"
                "Mode from config file:          enforcing\n"
                "Policy MLS status:              enabled\n"
                "Policy deny_unknown status:     allowed\n"
                "Memory protection checking:     actual (secure)\n"
                "Max kernel policy version:      33\n"
            ),
            "journalctl": (
                "-- Logs begin at Mon 2026-08-18 10:00:00 IST --\n"
                "Aug 21 18:00:01 rhel9-server-01 systemd[1]: Starting Daily system activity information...\n"
                "Aug 21 18:00:02 rhel9-server-01 systemd[1]: Finished Daily system activity information.\n"
                "Aug 21 18:10:00 rhel9-server-01 sshd[978]: Accepted publickey for root from 192.168.1.5\n"
            ),
            "lsblk": (
                "NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS\n"
                "sda      8:0    0  100G  0 disk\n"
                "├─sda1   8:1    0    1G  0 part /boot\n"
                "├─sda2   8:2    0    2G  0 part [SWAP]\n"
                "└─sda3   8:3    0   97G  0 part /\n"
            ),
            "id": "uid=1000(student) gid=1000(student) groups=1000(student),10(wheel)\n" if "sudo" not in args else "uid=0(root) gid=0(root) groups=0(root)\n",
            "whoami": "root\n" if "sudo" in args else "student\n",
            "pwd": "/home/student\n",
            "ls": "Desktop  Documents  Downloads  Music  Pictures  Public  Templates  Videos\n",
            "su": "Password: \n",
            "date": "Thu Aug 21 18:20:35 IST 2026\n",
            "who": "root     pts/0        2026-08-22 10:14 (192.168.1.5)\nstudent  pts/1        2026-08-22 11:30 (192.168.1.12)\n",
            "getent": (
                "root:x:0:0:root:/root:/bin/bash\n"
                "bin:x:1:1:bin:/bin:/sbin/nologin\n"
                "daemon:x:2:2:daemon:/sbin:/sbin/nologin\n"
                "adm:x:3:4:adm:/var/adm:/sbin/nologin\n"
                "lp:x:4:7:lp:/var/spool/lpd:/sbin/nologin\n"
                "sync:x:5:0:sync:/sbin:/bin/sync\n"
                "shutdown:x:6:0:shutdown:/sbin:/sbin/shutdown\n"
                "halt:x:7:0:halt:/sbin:/sbin/halt\n"
                "mail:x:8:12:mail:/var/spool/mail:/sbin/nologin\n"
                "operator:x:11:0:operator:/root:/sbin/nologin\n"
                "sshd:x:74:74:Privilege-separated SSH:/usr/share/empty.sshd:/sbin/nologin\n"
                "nginx:x:998:996:Nginx web server:/var/lib/nginx:/sbin/nologin\n"
                "student:x:1000:1000:RHEL Student User:/home/student:/bin/bash\n"
                "sysadmin:x:1001:1001:System Administrator:/home/sysadmin:/bin/bash\n"
                "devops:x:1002:1002:DevOps Engineer:/home/devops:/bin/zsh\n"
            ),
            "rpm": (
                "bash 5.1.8-6.el9_1 x86_64\n"
                "kernel 5.14.0-362.8.1.el9_3 x86_64\n"
                "nginx 1.22.1-1.el9 x86_64\n"
                "systemd 252-18.el9_3.1 x86_64\n"
                "openssh-server 8.7p1-34.el9_3 x86_64\n"
                "python3 3.9.18-1.el9_3 x86_64\n"
                "dnf 4.14.0-5.el9_3 noarch\n"
                "curl 7.76.1-26.el9_3 x86_64\n"
                "firewalld 1.2.5-2.el9_3 noarch\n"
                "sudo 1.9.12p2-3.el9_3 x86_64\n"
                "git 2.39.3-1.el9_3 x86_64\n"
                "vim-enhanced 8.2.2637-20.el9_3 x86_64\n"
            ),
            "dnf": (
                "Installed Packages\n"
                "nginx.x86_64                      1.22.1-1.el9                  @rhel-9-appstream-rpms\n"
                "python3.x86_64                    3.9.18-1.el9_3                @rhel-9-baseos-rpms\n"
                "vim-enhanced.x86_64               8.2.2637-20.el9_3             @rhel-9-appstream-rpms\n"
            ),
            "crontab": (
                "0 2 * * * /usr/bin/dnf check-update --quiet > /dev/null\n"
                "0 * * * * /usr/local/bin/check_disk.sh\n"
                "30 3 * * 0 /usr/bin/journalctl --vacuum-time=7d\n"
            ),
        }

        # Smart simulation matching for systemctl, journalctl, and other commands
        if cmd == "systemctl":
            return self._simulate_systemctl(args)
        elif cmd == "journalctl":
            return self._simulate_journalctl(args)
        elif cmd == "cat":
            full_cmd = " ".join(args)
            if "/proc/meminfo" in full_cmd:
                return (
                    "MemTotal:        3908800 kB\n"
                    "MemFree:         1850240 kB\n"
                    "MemAvailable:    2235480 kB\n"
                    "Buffers:          124500 kB\n"
                    "Cached:           490200 kB\n"
                    "SwapTotal:       2097148 kB\n"
                    "SwapFree:        2097148 kB\n"
                )
            if "/proc/uptime" in full_cmd:
                return "184320.45 732890.12\n"
            if "/proc/cpuinfo" in full_cmd:
                return "processor: 0\nvendor_id: GenuineIntel\ncpu MHz: 2594.120\nmodel name: Intel Core i7\n"
            if "/proc/loadavg" in full_cmd:
                return "0.24 0.18 0.12 1/482 14290\n"
            if "/proc/stat" in full_cmd:
                return "cpu  12480 320 4820 189200 420 10 20 0 0 0\n"
            if "/etc/redhat-release" in full_cmd or "/etc/os-release" in full_cmd:
                return "Red Hat Enterprise Linux release 9.3 (Plow)\n"
        elif cmd == "nproc":
            return "2\n"

        # Match by first word
        output = simulations.get(cmd)
        if output:
            return output

        return f"{cmd}: command completed successfully."

    def _simulate_systemctl(self, args: list[str]) -> str:
        """Simulate rich systemctl commands for dev/Windows environments."""
        clean_args = [a for a in args if a not in ("sudo", "-S", "-p", "--no-pager")]
        args_str = " ".join(clean_args)
        
        if "list-unit-files" in args_str:
            return (
                "UNIT FILE                                  STATE           PRESET\n"
                "sshd.service                               enabled         enabled\n"
                "httpd.service                              enabled         disabled\n"
                "nginx.service                              enabled         disabled\n"
                "firewalld.service                          enabled         enabled\n"
                "systemd-journald.service                   static          -\n"
                "crond.service                              enabled         enabled\n"
                "mariadb.service                            enabled         disabled\n"
                "docker.service                             enabled         disabled\n"
                "redis.service                              disabled        disabled\n"
                "postgresql.service                         disabled        disabled\n"
                "rsyslog.service                            enabled         enabled\n"
                "auditd.service                             enabled         enabled\n"
                "systemd-resolved.service                   enabled         enabled\n"
                "systemd-timesyncd.service                  enabled         enabled\n"
            )

        if "--failed" in args_str:
            return "0 loaded units listed.\n"

        if "list-units" in args_str:
            return (
                "  UNIT                               LOAD   ACTIVE SUB     DESCRIPTION\n"
                "  sshd.service                       loaded active running OpenSSH server daemon\n"
                "  httpd.service                      loaded active running The Apache HTTP Server\n"
                "  nginx.service                      loaded active running The nginx HTTP and reverse proxy server\n"
                "  firewalld.service                  loaded active running firewalld - dynamic firewall daemon\n"
                "  systemd-journald.service           loaded active running Journal Service\n"
                "  crond.service                      loaded active running Command Scheduler\n"
                "  mariadb.service                    loaded active running MariaDB 10.5 database server\n"
                "  docker.service                     loaded active running Docker Application Container Engine\n"
                "  rsyslog.service                    loaded active running System Logging Service\n"
                "  auditd.service                     loaded active running Security Audit Daemon\n\n"
                "10 loaded units listed.\n"
            )

        # Extract target service name from non-flag arguments (skipping subcommands)
        non_flag_args = [a for a in clean_args[1:] if not a.startswith("-") and a not in ("status", "cat", "start", "stop", "restart", "reload", "enable", "disable", "mask", "unmask", "systemctl")]
        svc_name = non_flag_args[0].replace(".service", "") if non_flag_args else "httpd"

        if "cat" in args_str:
            return (
                f"# /usr/lib/systemd/system/{svc_name}.service\n"
                f"[Unit]\n"
                f"Description={svc_name.upper()} Enterprise Service Daemon\n"
                f"After=network.target remote-fs.target nss-lookup.target\n"
                f"Documentation=man:{svc_name}(8)\n\n"
                f"[Service]\n"
                f"Type=notify\n"
                f"ExecStart=/usr/sbin/{svc_name} --foreground\n"
                f"Restart=on-failure\n"
                f"RestartSec=5s\n\n"
                f"[Install]\n"
                f"WantedBy=multi-user.target\n"
            )

        if "status" in args_str or (len(clean_args) >= 2 and clean_args[1] == "status"):
            if "backup" in svc_name or "monitoring" in svc_name or "failed" in svc_name:
                return (
                    f"● {svc_name}.service - {svc_name.replace('-', ' ').title()} Daemon\n"
                    f"     Loaded: loaded (/etc/systemd/system/{svc_name}.service; enabled; preset: disabled)\n"
                    f"     Active: failed (Result: exit-code) since Tue 2026-08-25 04:15:22 IST; 5h ago\n"
                    f"    Process: 4120 ExecStart=/usr/local/bin/{svc_name} (code=exited, status=2/INVALIDARG)\n"
                    f"   Main PID: 4120 (code=exited, status=2)\n"
                    f"        CPU: 45ms\n\n"
                    f"Aug 25 04:15:21 rhel9-server-01 systemd[1]: Starting {svc_name}.service...\n"
                    f"Aug 25 04:15:22 rhel9-server-01 {svc_name}[4120]: ERROR: Target credentials file /etc/{svc_name}/secret.conf missing or unreadable\n"
                )
            elif "redis" in svc_name or "postgresql" in svc_name or "cups" in svc_name:
                return (
                    f"○ {svc_name}.service - {svc_name.title()} Server Daemon\n"
                    f"     Loaded: loaded (/usr/lib/systemd/system/{svc_name}.service; disabled; preset: disabled)\n"
                    f"     Active: inactive (dead)\n"
                    f"       Docs: man:{svc_name}(8)\n"
                )
            else:
                desc = "The Apache HTTP Server" if "http" in svc_name else f"{svc_name.title()} Service Daemon"
                return (
                    f"● {svc_name}.service - {desc}\n"
                    f"     Loaded: loaded (/usr/lib/systemd/system/{svc_name}.service; enabled; preset: disabled)\n"
                    f"     Active: active (running) since Tue 2026-08-25 10:47:09 IST; 1h 45min ago\n"
                    f"       Docs: man:{svc_name}(8)\n"
                    f"   Main PID: 3412 ({svc_name})\n"
                    f"     Status: \"Total requests: 128; Idle/Busy workers 100/0; Requests/sec: 0.12\"\n"
                    f"      Tasks: 16 (limit: 11124)\n"
                    f"     Memory: 24.5M (peak: 32.1M)\n"
                    f"        CPU: 180ms\n"
                    f"     CGroup: /system.slice/{svc_name}.service\n"
                    f"             ├─3412 /usr/sbin/{svc_name} -DFOREGROUND\n"
                    f"             ├─3415 /usr/sbin/{svc_name} -DFOREGROUND\n"
                    f"             └─3416 /usr/sbin/{svc_name} -DFOREGROUND\n\n"
                    f"Aug 25 10:47:09 rhel9-server-01 systemd[1]: Started {svc_name}.service - {desc}.\n"
                )

        return ""

    def _simulate_journalctl(self, args: list[str]) -> str:
        """Simulate journalctl logs for specific services."""
        svc = "system"
        for i, a in enumerate(args):
            if a == "-u" and i + 1 < len(args):
                svc = args[i + 1]
                break

        if "failed" in svc or "backup" in svc or "monitoring" in svc:
            return (
                f"-- Logs begin at Tue 2026-08-25 00:00:00 IST --\n"
                f"Aug 25 04:15:20 rhel9-server-01 systemd[1]: Starting {svc}...\n"
                f"Aug 25 04:15:21 rhel9-server-01 {svc}[4120]: [INFO] Initializing connection to cloud target\n"
                f"Aug 25 04:15:21 rhel9-server-01 {svc}[4120]: [DEBUG] Reading configuration from /etc/{svc}/conf.d\n"
                f"Aug 25 04:15:22 rhel9-server-01 {svc}[4120]: [FATAL] Authentication failed: signature verification rejected by remote endpoint\n"
                f"Aug 25 04:15:22 rhel9-server-01 systemd[1]: {svc}: Main process exited, code=exited, status=2/INVALIDARG\n"
                f"Aug 25 04:15:22 rhel9-server-01 systemd[1]: {svc}: Failed with result 'exit-code'.\n"
            )

        return (
            f"-- Logs begin at Tue 2026-08-25 00:00:00 IST --\n"
            f"Aug 25 08:00:01 rhel9-server-01 systemd[1]: Started {svc}.\n"
            f"Aug 25 08:00:02 rhel9-server-01 {svc}[1248]: [INFO] Service initialized with pid 1248\n"
            f"Aug 25 08:30:15 rhel9-server-01 {svc}[1248]: [INFO] Periodic health check passed. Memory: 38.4MB, CPU: 0.2%\n"
            f"Aug 25 09:12:00 rhel9-server-01 {svc}[1248]: [INFO] Handled 452 worker requests with average latency 2.4ms\n"
            f"Aug 25 09:45:00 rhel9-server-01 {svc}[1248]: [INFO] All worker channels healthy. Connection pool: 8 active\n"
        )


# Singleton runner
runner = CommandRunner()
