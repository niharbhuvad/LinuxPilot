# LinuxAI — Development Guide

## Environment Setup
1. Clone repository.
2. Setup Python environment and install `requirements.txt`.
3. Create `.env` file with `OPENAI_API_KEY`.
4. Run `python scripts/create_admin.py`.
5. Launch FastAPI backend: `uvicorn app.main:app --reload`.
6. Launch React frontend: `cd frontend && npm run dev`.

## Simulation Mode
When running on Windows or non-Linux OS, `CommandRunner` automatically provides realistic simulated outputs for commands like `df`, `free`, `systemctl`, `journalctl`, and `ss`, enabling rapid local development.
