# LinuxAI — Security Model

LinuxAI prioritizes system integrity and administrative safety.

## Command Risk Classification

- **LOW Risk**: Diagnostic and read-only commands (`df`, `free`, `uptime`, `systemctl status`). Auto-executed.
- **MEDIUM Risk**: State-modifying operations (`systemctl restart`, `dnf install`). Requires single-click approval.
- **HIGH Risk**: Destructive operations (`rm -rf`, `lvremove`, `userdel`). Requires explicit typing of `CONFIRM DELETE`.
- **BLOCKED**: Shell injection vectors (`bash`, `sh`, `eval`, pipe bombs). Always rejected.

## Secret Protection

Outputs from commands are run through regex filters to mask secrets such as:
- Passwords (`password=***`)
- OpenAI API Keys (`sk-***`)
- Private SSH Keys (`-----BEGIN RSA PRIVATE KEY-----`)
- Database Connection Strings (`postgresql://user:pass@host`)
