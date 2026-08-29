// LinuxAI — Shared TypeScript Types

export interface User {
  id: string
  username: string
  email?: string
  role: 'ADMIN' | 'OPERATOR' | 'READ_ONLY'
  is_active: boolean
  created_at: string
  last_login?: string
}

export interface CPUMetric {
  percent: number
  count: number
  count_logical: number
  frequency_mhz?: number
}

export interface MemoryMetric {
  total_gb: number
  used_gb: number
  available_gb: number
  percent: number
  swap_total_gb: number
  swap_used_gb: number
  swap_percent: number
}

export interface DiskMetric {
  filesystem: string
  fstype?: string
  mountpoint: string
  size_gb: number
  used_gb: number
  available_gb: number
  percent: number
}

export interface SystemInfo {
  hostname: string
  os_name: string
  os_version: string
  kernel: string
  architecture: string
  uptime_seconds: number
  cpu: CPUMetric
  memory: MemoryMetric
  disks: DiskMetric[]
  load_average: number[]
  timestamp: string
}

export interface HealthScore {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  components: Record<string, { score: number; max: number; value: string }>
  alerts: string[]
}

export interface ProcessInfo {
  pid: number
  ppid?: number
  name: string
  username: string
  cpu_percent: number
  memory_percent: number
  memory_mb: number
  status: string
  command: string
}

export interface ServiceInfo {
  unit: string
  name?: string
  load?: string
  status?: string
  active?: string
  sub?: string
  description?: string
  unit_file_state?: string
  category?: string
  is_running?: boolean
  is_failed?: boolean
  is_enabled?: boolean
}

export interface ServiceStats {
  total: number
  running: number
  stopped: number
  failed: number
  enabled: number
  disabled: number
}

export interface ServiceDetail {
  service: string
  status: string
  sub_status?: string
  main_pid?: number | null
  memory?: string | null
  cpu?: string | null
  tasks?: string | null
  cgroup?: string
  uptime?: string
  unit_file_path?: string
  unit_file_state?: string
  exec_start?: string
  raw_output?: string
}

export interface ServiceDiagnosis {
  service: string
  status: string
  sub_status?: string
  issues: string[]
  recommendations: string[]
  quick_fix_command?: string
  main_pid?: number | null
  memory?: string | null
  cpu?: string | null
  uptime?: string | null
  recent_logs?: string
}

export interface ToolExecutionStep {
  tool_name: string
  args: Record<string, unknown>
  status: 'running' | 'success' | 'failure' | 'blocked' | 'pending_approval'
  result?: Record<string, unknown>
  risk_level: string
  duration_ms?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_steps?: ToolExecutionStep[]
  created_at: string
}

export interface ChatResponse {
  conversation_id: string
  message_id: string
  content: string
  tool_steps: ToolExecutionStep[]
  pending_approvals: ApprovalOut[]
  created_at: string
}

export interface ApprovalOut {
  id: string
  command_id: string
  risk_level: string
  requires_double_confirm: boolean
  action_description: string
  command: string
  reason: string
  expected_effect: string
  status: string
  created_at: string
}

export interface CommandOut {
  id: string
  command: string
  risk_level: string
  approval_status: string
  status: string
  exit_code?: number
  stdout: string
  stderr: string
  duration_ms: number
  tool_name?: string
  created_at: string
}

export interface AlertOut {
  id: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  category: string
  title: string
  message: string
  recommendation: string
  status: string
  created_at: string
}

export interface NetworkInterface {
  name: string
  is_up: boolean
  speed_mbps: number
  mtu: number
  addresses: { type: string; address: string; netmask?: string }[]
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED'
