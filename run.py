#!/usr/bin/env python3
"""
LinuxAI — Unified Cross-Platform Self-Bootstrapping Launcher
============================================================
Runs on any machine (Windows, macOS, Linux).
Automatically sets up virtual environment, installs dependencies,
initializes config/database, and launches both Backend and Frontend.
"""

import os
import sys
import time
import shutil
import signal
import subprocess
import threading
import webbrowser
from pathlib import Path

# Fix console encoding on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Terminal ANSI styling
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
SCRIPTS_DIR = ROOT_DIR / "scripts"


def print_banner():
    os.system("")  # Enable ANSI in Windows terminal
    print(f"\n{CYAN}{BOLD}=============================================================={RESET}")
    print(f"{GREEN}{BOLD}               🚀 LinuxAI Full-Stack Launcher                 {RESET}")
    print(f"{CYAN}{BOLD}=============================================================={RESET}\n")


def check_node_installed():
    """Verify Node.js and npm are available in PATH."""
    npm_cmd = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm_cmd:
        print(f"{RED}[ERROR] Node.js / npm not found!{RESET}")
        print("Please install Node.js (v18+) from: https://nodejs.org/")
        sys.exit(1)
    return npm_cmd


def ensure_env_file():
    """Ensure .env exists by copying from .env.example if missing."""
    root_env = ROOT_DIR / ".env"
    example_env = ROOT_DIR / ".env.example"
    
    if not root_env.exists() and example_env.exists():
        print(f"{YELLOW}[SETUP] Creating .env from .env.example...{RESET}")
        shutil.copy(example_env, root_env)
        print(f"{GREEN}[OK] .env created successfully.{RESET}")


def get_or_create_venv():
    """Ensure python virtual environment exists and is ready."""
    venv_dir = BACKEND_DIR / ".venv"
    
    if sys.platform == "win32":
        python_bin = venv_dir / "Scripts" / "python.exe"
        pip_bin = venv_dir / "Scripts" / "pip.exe"
    else:
        python_bin = venv_dir / "bin" / "python"
        pip_bin = venv_dir / "bin" / "pip"

    if not python_bin.exists():
        print(f"{YELLOW}[SETUP] Creating Python virtual environment in backend/.venv...{RESET}")
        subprocess.check_call([sys.executable, "-m", "venv", str(venv_dir)])
        print(f"{GREEN}[OK] Virtual environment created.{RESET}")

    # Check if dependencies need installation
    req_file = BACKEND_DIR / "requirements.txt"
    if req_file.exists():
        # Quick check if uvicorn is installed in this venv
        check_proc = subprocess.run(
            [str(python_bin), "-c", "import fastapi, uvicorn"],
            capture_output=True,
            text=True
        )
        if check_proc.returncode != 0:
            print(f"{YELLOW}[SETUP] Installing Python dependencies (backend/requirements.txt)...{RESET}")
            subprocess.check_call([str(pip_bin), "install", "-r", str(req_file)])
            print(f"{GREEN}[OK] Python dependencies installed.{RESET}")

    return str(python_bin)


def ensure_frontend_deps(npm_cmd):
    """Ensure frontend node_modules exist."""
    node_modules = FRONTEND_DIR / "node_modules"
    if not node_modules.exists():
        print(f"{YELLOW}[SETUP] Installing Frontend dependencies (npm install)...{RESET}")
        subprocess.check_call([npm_cmd, "install"], cwd=str(FRONTEND_DIR), shell=(sys.platform == "win32"))
        print(f"{GREEN}[OK] Frontend dependencies installed.{RESET}")


def ensure_admin_user(python_bin):
    """Run create_admin script once if database doesn't exist yet."""
    create_admin_script = SCRIPTS_DIR / "create_admin.py"
    if create_admin_script.exists():
        try:
            subprocess.run([python_bin, str(create_admin_script)], cwd=str(ROOT_DIR), capture_output=True, text=True)
        except Exception:
            pass


def stream_output(process, prefix, color):
    try:
        for line in iter(process.stdout.readline, b''):
            if not line:
                break
            text = line.decode('utf-8', errors='replace').rstrip()
            if text:
                print(f"{color}{prefix}{RESET} {text}", flush=True)
    except Exception:
        pass


def open_browser_delayed(url, delay=2.5):
    time.sleep(delay)
    try:
        webbrowser.open(url)
    except Exception:
        pass


def main():
    print_banner()

    # 1. Check prerequisites & auto-setup
    npm_cmd = check_node_installed()
    ensure_env_file()
    python_bin = get_or_create_venv()
    ensure_frontend_deps(npm_cmd)
    ensure_admin_user(python_bin)

    print(f"\n{BOLD}Starting services:{RESET}")
    print(f"  • Frontend: {BOLD}{GREEN}http://localhost:5173{RESET} (Login: {CYAN}admin{RESET} / {CYAN}admin123{RESET})")
    print(f"  • Backend : {BOLD}{CYAN}http://localhost:8000/docs{RESET}")
    print(f"\n{YELLOW}Press Ctrl+C anytime to stop all servers cleanly.{RESET}\n", flush=True)

    # 2. Launch Backend (FastAPI / Uvicorn)
    backend_cmd = [python_bin, "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
    )

    # 3. Launch Frontend (Vite)
    frontend_cmd = [npm_cmd, "run", "dev"]
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        shell=(sys.platform == "win32"),
    )

    # 4. Stream colorized logs
    threading.Thread(target=stream_output, args=(backend_proc, "[Backend ]", CYAN), daemon=True).start()
    threading.Thread(target=stream_output, args=(frontend_proc, "[Frontend]", GREEN), daemon=True).start()

    # 5. Open browser automatically
    threading.Thread(target=open_browser_delayed, args=("http://localhost:5173", 2.0), daemon=True).start()

    # 6. Process lifecycle management
    def cleanup_and_exit(sig=None, frame=None):
        print(f"\n{RED}🛑 Stopping all LinuxAI services...{RESET}", flush=True)
        try:
            frontend_proc.terminate()
            backend_proc.terminate()
            frontend_proc.wait(timeout=2)
            backend_proc.wait(timeout=2)
        except Exception:
            try:
                frontend_proc.kill()
                backend_proc.kill()
            except Exception:
                pass
        print(f"{GREEN}✔ All services stopped.{RESET}", flush=True)
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup_and_exit)
    signal.signal(signal.SIGTERM, cleanup_and_exit)

    try:
        while True:
            time.sleep(0.5)
            if backend_proc.poll() is not None:
                print(f"{RED}[Backend exited with code {backend_proc.returncode}]{RESET}", flush=True)
                break
            if frontend_proc.poll() is not None:
                print(f"{RED}[Frontend exited with code {frontend_proc.returncode}]{RESET}", flush=True)
                break
    except KeyboardInterrupt:
        cleanup_and_exit()


if __name__ == "__main__":
    main()
