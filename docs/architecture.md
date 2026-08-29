# LinuxAI — System Architecture

LinuxAI is designed around a tool-calling AI agent model. The AI agent acts as an orchestrator, while explicit diagnostic and task modules handle interactions with the Linux operating system.

## Subsystems

1. **AI Brain & Agent Loop (`app/ai/`)**
   - Receives prompt and conversation context.
   - Evaluates system state through structured function calling.
   - Generates multi-step troubleshooting workflows.

2. **Security & Validation Engine (`app/security/`)**
   - **Risk Engine**: Categorizes commands into `LOW`, `MEDIUM`, `HIGH`, `BLOCKED`.
   - **Validator**: Sanitizes parameters against injection patterns.
   - **Secret Redactor**: Scrubs sensitive patterns before AI consumption.

3. **Command Execution Engine (`app/executor/`)**
   - Wraps `subprocess.run` with argument lists (never shell strings).
   - Enforces timeouts and captures stdout/stderr.
   - Provides non-Linux simulation mode for cross-platform development.

4. **Diagnostic Modules (`app/diagnostics/`)**
   - System, Disk, Memory, CPU, Processes, Services, Network, Security (SELinux), Storage (LVM), Logs, Packages.

5. **REST API & Web UI (`app/api/` & `frontend/`)**
   - FastAPI endpoints with JWT Auth.
   - React + TypeScript dashboard with live metrics, terminal view, and approval modals.
