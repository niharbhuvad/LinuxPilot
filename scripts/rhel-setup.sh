#!/usr/bin/env bash
# LinuxAI — RHEL 9 Machine Setup Script
set -e

echo "=== LinuxAI Setup for Red Hat Enterprise Linux 9 ==="

# 1. Update system & install dependencies
echo "[1/4] Installing system dependencies (Python 3.11, Node.js, system tools)..."
sudo dnf install -y python3.11 python3.11-pip nodejs npm git systemd-journal-remote firewalld lm_sensors

# 2. Configure dedicated service user & sudoers policy for controlled command execution
echo "[2/4] Setting up linuxai system service account..."
if ! id -u linuxai >/dev/null 2>&1; then
    sudo useradd -r -m -s /sbin/nologin linuxai
fi

# Add sudoers rules for allowed commands
echo "[3/4] Configuring restricted sudoers policy..."
sudo cat << 'EOF' | sudo tee /etc/sudoers.d/linuxai > /dev/null
# LinuxAI restricted command privileges
linuxai ALL=(ALL) NOPASSWD: /usr/bin/systemctl status *, /usr/bin/systemctl is-active *, /usr/bin/journalctl *, /usr/sbin/ss, /usr/bin/ip *, /usr/bin/df, /usr/bin/dnf check-update
EOF
sudo chmod 0440 /etc/sudoers.d/linuxai

# 3. Setup Python venv
echo "[4/4] Setting up Python virtual environment..."
cd "$(dirname "$0")/.."
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Initializing database & admin user
python scripts/create_admin.py

echo "=== Setup Complete! ==="
echo "To run backend: source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo "To run frontend: cd frontend && npm install && npm run dev"
