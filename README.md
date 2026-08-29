# 🚀 LinuxAI — AI Brain for Linux System Administration

> **Tagline**: *"An AI Brain for Linux System Administration & RHCSA Lab Ops"*

LinuxAI is a modern, production-grade AI agent designed to understand natural-language system administration requests, inspect Linux systems (RHEL 9, CentOS, Ubuntu, Debian), safely execute commands, troubleshoot problems, and provide real-time terminal explanations.

---

## 🌟 Quick Start (Run on Any PC)

### Prerequisites
- **Python 3.11+**: [Download Python](https://www.python.org/downloads/) *(make sure to check "Add to PATH")*
- **Node.js 18+**: [Download Node.js](https://nodejs.org/)

---

### ⚡ 1-Click Launch

Clone or copy the repository to any machine, open the folder, and run:

#### Windows
```cmd
run.bat
```
*Or run in PowerShell:*
```powershell
.\run.ps1
```

#### Linux / macOS
```bash
chmod +x run.sh
./run.sh
```

#### Universal (Python)
```bash
python run.py
```

> **Note**: The launcher automatically creates `.venv`, installs dependencies (`pip` & `npm`), configures `.env`, and launches both the backend and frontend at once!

---

### 🔑 Default Credentials

- **Frontend URL**: [http://localhost:5173](http://localhost:5173)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Username**: `admin`
- **Password**: `admin123`

---

## 📁 Repository Structure

```
AILinux/
├── backend/                  # FastAPI Python Backend
│   ├── app/                  # Application code (API routes, services, models)
│   ├── tests/                # Automated backend test suite
│   ├── Dockerfile            # Container build for backend
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React 19 + Vite + Tailwind CSS Frontend
│   ├── src/                  # Components, pages, hooks, state
│   ├── public/               # Static web assets
│   ├── package.json          # Node dependencies & build scripts
│   └── vite.config.ts        # Vite dev proxy configuration
├── scripts/                  # Management & utility scripts
│   ├── create_admin.py       # Seed initial admin user
│   ├── reset_admin.py        # Reset admin credentials
│   ├── test_auth.py          # Authentication sanity checker
│   ├── linuxai_cli.py        # Standalone CLI mode
│   └── rhel-setup.sh         # RHEL server provisioning script
├── docs/                     # Technical documentation
│   ├── architecture.md       # Full architecture diagram & security flow
│   ├── development.md        # Developer setup guide
│   ├── deployment.md         # Production deployment guide
│   ├── security.md           # Command risk engine & redaction model
│   └── tools.md              # AI tool definitions & schemas
├── knowledge/                # AI diagnostic knowledge base
│   ├── commands/             # Standard command definitions & cheat sheets
│   ├── rhel/                 # RHEL 9 system admin recipes
│   └── troubleshooting/      # Error diagnosis guides
├── .env.example              # Sample environment configuration
├── .gitignore                # Comprehensive Git ignore rules
├── docker-compose.yml        # Multi-container Docker deployment
├── run.bat                   # 1-Click Windows Batch launcher
├── run.ps1                   # 1-Click PowerShell launcher
├── run.sh                    # 1-Click Linux/macOS launcher
└── run.py                    # Cross-platform auto-bootstrap runner
```

---

## 🐳 Docker Deployment

To run with Docker & Docker Compose:

```bash
cp .env.example .env
docker-compose up -d --build
```

Access the web dashboard at `http://localhost:80`.
