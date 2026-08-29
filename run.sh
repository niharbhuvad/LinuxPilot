#!/usr/bin/env bash
# LinuxAI 1-Click Launcher for Linux & macOS
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f "backend/.venv/bin/python" ]; then
    backend/.venv/bin/python run.py
elif command -v python3 &> /dev/null; then
    python3 run.py
elif command -v python &> /dev/null; then
    python run.py
else
    echo "Error: Python 3 is not installed or not in PATH."
    echo "Please install Python 3.11+ using your package manager (e.g. apt, dnf, brew)."
    exit 1
fi
