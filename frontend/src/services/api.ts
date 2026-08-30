import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('linuxai_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      // Only clear token & redirect if the main auth check route fails
      if (err.config?.url?.includes('/api/auth/me')) {
        localStorage.removeItem('linuxai_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)


// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/api/auth/login', { username, password }),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
}

// ── System ───────────────────────────────────────────────────────────────────
export const systemApi = {
  overview: () => api.get('/api/system'),
  cpu: () => api.get('/api/system/cpu'),
  memory: () => api.get('/api/system/memory'),
  disk: () => api.get('/api/system/disk'),
  healthScore: () => api.get('/api/system/health-score'),
  cleanDisk: () => api.post('/api/system/maintenance/clean-disk'),
  optimize: () => api.post('/api/system/maintenance/optimize'),
  auditSecurity: () => api.get('/api/system/maintenance/audit-security'),
  rollback: (filepath?: string) => api.post('/api/system/maintenance/rollback', { filepath }),
}

// ── Chat ─────────────────────────────────────────────────────────────────────
export const chatApi = {
  send: (
    data: string | { message: string; conversation_id?: string; provider?: string; model?: string; api_key?: string; base_url?: string },
    conversation_id?: string
  ) => {
    const payload = typeof data === 'string' ? { message: data, conversation_id } : data
    return api.post('/api/chat', payload)
  },
  history: (conversation_id: string) =>
    api.get(`/api/chat/history/${conversation_id}`),
  conversations: () =>
    api.get('/api/chat/conversations'),
  deleteConversation: (conversation_id: string) =>
    api.delete(`/api/chat/conversations/${conversation_id}`),
  clearAllConversations: () =>
    api.delete('/api/chat/conversations'),
  testAiConnection: (data?: { provider?: string; model?: string; api_key?: string; base_url?: string; ollama_base_url?: string }) =>
    api.post('/api/chat/test-connection', data || {}),
  getAiStatus: () =>
    api.get('/api/chat/status'),
}

// ── User API Keys ─────────────────────────────────────────────────────────
export const apiKeysApi = {
  list: () => api.get('/api/keys'),

  save: (data: {
    provider: string
    api_key: string
  }) => api.post('/api/keys', data),

  delete: (provider: string) =>
    api.delete(`/api/keys/${encodeURIComponent(provider)}`),
}

// ── Services ─────────────────────────────────────────────────────────────────
export const servicesApi = {
  list: () => api.get('/api/services'),
  failed: () => api.get('/api/services/failed'),
  detail: (name: string) => api.get(`/api/services/${encodeURIComponent(name)}`),
  logs: (name: string, lines = 100) =>
    api.get(`/api/services/${encodeURIComponent(name)}/logs?lines=${lines}`),
  unitFile: (name: string) =>
    api.get(`/api/services/${encodeURIComponent(name)}/unit-file`),
  action: (name: string, action: 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable' | 'mask' | 'unmask') =>
    api.post(`/api/services/${encodeURIComponent(name)}/action`, { action }),
  start: (name: string) => api.post(`/api/services/${encodeURIComponent(name)}/start`),
  stop: (name: string) => api.post(`/api/services/${encodeURIComponent(name)}/stop`),
  restart: (name: string) => api.post(`/api/services/${encodeURIComponent(name)}/restart`),
  reload: (name: string) => api.post(`/api/services/${encodeURIComponent(name)}/reload`),
  enable: (name: string) => api.post(`/api/services/${encodeURIComponent(name)}/enable`),
  disable: (name: string) => api.post(`/api/services/${encodeURIComponent(name)}/disable`),
  mask: (name: string) => api.post(`/api/services/${encodeURIComponent(name)}/mask`),
  unmask: (name: string) => api.post(`/api/services/${encodeURIComponent(name)}/unmask`),
  diagnose: (name: string) => api.post(`/api/services/${encodeURIComponent(name)}/diagnose`),
  create: (data: {
    name: string
    description?: string
    exec_start: string
    working_directory?: string
    user?: string
    restart?: string
    restart_sec?: number
    environment_vars?: string[]
    enable_and_start?: boolean
  }) => api.post('/api/services/create', data),
}

// ── Processes ─────────────────────────────────────────────────────────────────
export const processesApi = {
  list: (n = 50, sortBy = 'cpu', target = 'auto') =>
    api.get(`/api/processes?n=${n}&sort_by=${sortBy}&target=${target}`),
  detail: (pid: number, target = 'auto') => api.get(`/api/processes/${pid}?target=${target}`),
  kill: (pid: number, signal = 15, target = 'auto') =>
    api.post('/api/processes/kill', { pid, signal, target }),
}

// ── Network ──────────────────────────────────────────────────────────────────
export const networkApi = {
  overview: () => api.get('/api/network'),
  interfaces: () => api.get('/api/network/interfaces'),
  ports: () => api.get('/api/network/ports'),
  firewall: () => api.get('/api/network/firewall'),
  ping: (host = '8.8.8.8') => api.get(`/api/network/ping?host=${host}`),
}

// ── Storage ───────────────────────────────────────────────────────────────────
export const storageApi = {
  overview: () => api.get('/api/storage'),
  largeFiles: (path = '/', sizeMb = 100) =>
    api.get(`/api/storage/large-files?path=${path}&size_mb=${sizeMb}`),
  journal: () => api.get('/api/storage/journal'),
}

// ── Logs ──────────────────────────────────────────────────────────────────────
export const logsApi = {
  recent: (lines = 100) => api.get(`/api/logs?lines=${lines}`),
  errors: (lines = 50) => api.get(`/api/logs/errors?lines=${lines}`),
  search: (query: string, service?: string, since = 'today') =>
    api.get(`/api/logs/search?query=${encodeURIComponent(query)}${service ? `&service=${service}` : ''}&since=${since}`),
}

// ── Commands (Audit & Execution) ─────────────────────────────────────────────
export const commandsApi = {
  execute: (command: string) => api.post('/api/commands/execute', { command }),
  history: (limit = 50) => api.get(`/api/commands/history?limit=${limit}`),
  pendingApprovals: () => api.get('/api/commands/approvals/pending'),
  decide: (approvalId: string, approved: boolean, confirmationText?: string) =>
    api.post(`/api/commands/approvals/${approvalId}/decide`, { approved, confirmation_text: confirmationText }),
  quickFix: (payload: { command: string; stdout?: string; stderr?: string; exit_code?: number; user?: string; host?: string; os_info?: string }) =>
    api.post('/api/commands/quick-fix', payload),
}


// ── Alerts ────────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: (status = 'active') => api.get(`/api/alerts?status=${status}`),
  update: (id: string, status: string) => api.put(`/api/alerts/${id}`, { status }),
}

// ── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: () => api.get('/api/tasks'),
  create: (data: object) => api.post('/api/tasks', data),
  update: (id: string, data: object) => api.put(`/api/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/api/tasks/${id}`),
}

// ── SSH Remote Lab ─────────────────────────────────────────────────────────────
export const sshApi = {
  getConfig: () => api.get('/api/ssh/config'),
  saveConfig: (data: { enabled: boolean; host: string; port: number; user: string; password?: string; key_path?: string }) =>
    api.post('/api/ssh/config', data),
  testConnection: (data: { host: string; port: number; user: string; password?: string; key_path?: string }) =>
    api.post('/api/ssh/test', data),
  disconnect: () => api.post('/api/ssh/disconnect'),
  getSavedProfiles: () => api.get('/api/ssh/saved'),
  saveProfile: (data: { id?: string; name: string; description?: string; host: string; port: number; user: string; password?: string; key_path?: string; is_fixed?: boolean }) =>
    api.post('/api/ssh/saved', data),
  deleteProfile: (profileId: string) => api.delete(`/api/ssh/saved/${profileId}`),
  connectProfile: (profileId: string) => api.post(`/api/ssh/saved/${profileId}/connect`),
}

// ── Files (Vim Editor API) ───────────────────────────────────────────────────
export const filesApi = {
  read: (path: string) => api.get(`/api/files/read?path=${encodeURIComponent(path)}`),
  write: (path: string, content: string) => api.post('/api/files/write', { path, content }),
}

// ── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/api/users'),
  groups: () => api.get('/api/users/groups'),
  loggedIn: () => api.get('/api/users/logged-in'),
  sudo: () => api.get('/api/users/sudo'),
  detail: (username: string) => api.get(`/api/users/${username}`),
}

// ── Packages ─────────────────────────────────────────────────────────────────
export const packagesApi = {
  installed: () => api.get('/api/packages'),
  updates: () => api.get('/api/packages/updates'),
  search: (query: string) => api.get(`/api/packages/search?query=${encodeURIComponent(query)}`),
  info: (packageName: string) => api.get(`/api/packages/info/${encodeURIComponent(packageName)}`),
}

export default api
