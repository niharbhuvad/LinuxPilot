# LinuxAI — Tool Definitions

All AI tools are exposed via OpenAI's function calling schema.

## Available Tools

- `get_system_info`: CPU, Memory, Disk, Uptime overview.
- `get_service_status`: Status of a systemd unit.
- `get_service_logs`: Recent journal entries for a service.
- `get_failed_services`: List of currently failed systemd units.
- `find_large_files`: Searches for files exceeding a specific size.
- `get_top_processes`: Top CPU or Memory consuming processes.
- `get_network_interfaces`: Active interfaces and assigned IPs.
- `get_open_ports`: Listening TCP/UDP sockets (`ss -tulpn`).
- `get_selinux_status`: SELinux enforcement mode and details.
- `search_logs`: Search journalctl by query string.
