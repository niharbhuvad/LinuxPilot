# LinuxAI — Deployment Guide

## Production Deployment options

### Option 1: Docker Compose
```bash
docker-compose up -d --build
```

### Option 2: RHEL 9 Native Service
Run the setup script:
```bash
sudo bash scripts/rhel-setup.sh
```

Configure Systemd unit for backend (`/etc/systemd/system/linuxai.service`):
```ini
[Unit]
Description=LinuxAI Agent Backend Service
After=network.target

[Service]
User=linuxai
WorkingDirectory=/opt/linuxai
ExecStart=/opt/linuxai/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```
