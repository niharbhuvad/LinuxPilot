// LinuxAI — Advanced Systemd Services & Daemon Management Suite
import { useEffect, useState, useMemo, type FormEvent, type ReactNode } from 'react'
import {
  Server, RefreshCw, Search, Play, Square, RotateCw, FileText,
  AlertTriangle, CheckCircle2, ShieldAlert, Terminal,
  PlusCircle, X, Download, Copy, Check, Eye, Sparkles,
  Layers, Shield, Globe, Database, Network, Clock, Activity, Box, Filter, SlidersHorizontal
} from 'lucide-react'
import clsx from 'clsx'
import { servicesApi, sshApi, commandsApi } from '../services/api'
import type { ServiceInfo, ServiceStats, ServiceDetail, ServiceDiagnosis } from '../types'

type ViewMode = 'table' | 'grid'
type FilterTab = 'all' | 'running' | 'stopped' | 'failed' | 'enabled' | 'disabled'

const CATEGORY_ICONS: Record<string, ReactNode> = {
  'Web & Proxy': <Globe className="w-3.5 h-3.5 text-blue-400" />,
  'Database & Cache': <Database className="w-3.5 h-3.5 text-amber-400" />,
  'Security & Auth': <Shield className="w-3.5 h-3.5 text-emerald-400" />,
  'Network & Time': <Network className="w-3.5 h-3.5 text-purple-400" />,
  'Containers & Virtualization': <Box className="w-3.5 h-3.5 text-cyan-400" />,
  'Monitoring & Logs': <Activity className="w-3.5 h-3.5 text-rose-400" />,
  'System Core': <Server className="w-3.5 h-3.5 text-slate-400" />,
  'Application & Other': <Layers className="w-3.5 h-3.5 text-indigo-400" />,
}

const TEMPLATES: Record<string, { desc: string; exec: string; workdir: string; user: string; restart: string; env: string[] }> = {
  'node': {
    desc: 'Node.js Production Application',
    exec: '/usr/bin/node /opt/myapp/server.js',
    workdir: '/opt/myapp',
    user: 'root',
    restart: 'always',
    env: ['NODE_ENV=production', 'PORT=3000'],
  },
  'python': {
    desc: 'Python FastAPI / Flask Backend Daemon',
    exec: '/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000',
    workdir: '/opt/pyapp',
    user: 'root',
    restart: 'on-failure',
    env: ['PYTHONUNBUFFERED=1', 'APP_ENV=production'],
  },
  'worker': {
    desc: 'Background Queue Processing Worker',
    exec: '/usr/local/bin/worker.sh',
    workdir: '/opt/worker',
    user: 'root',
    restart: 'on-failure',
    env: ['WORKER_CONCURRENCY=4'],
  },
  'go': {
    desc: 'Go Compiled High-Performance Binary',
    exec: '/usr/local/bin/go-service --config /etc/go-service.json',
    workdir: '/var/log/go-service',
    user: 'root',
    restart: 'always',
    env: ['GIN_MODE=release'],
  },
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [stats, setStats] = useState<ServiceStats>({
    total: 0, running: 0, stopped: 0, failed: 0, enabled: 0, disabled: 0
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [targetHost, setTargetHost] = useState<string>('Local Host')
  const [sshConnected, setSshConnected] = useState<boolean>(false)

  // Filters & Display
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'boot'>('name')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0) // 0=off

  // Selection for bulk actions
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set())

  // Modal states
  const [inspectModalOpen, setInspectModalOpen] = useState(false)
  const [inspectUnit, setInspectUnit] = useState<string | null>(null)
  const [inspectTab, setInspectTab] = useState<'overview' | 'logs' | 'unitfile' | 'ai'>('overview')
  const [inspectDetail, setInspectDetail] = useState<ServiceDetail | null>(null)
  const [inspectLogs, setInspectLogs] = useState<string>('')
  const [inspectUnitFile, setInspectUnitFile] = useState<string>('')
  const [inspectDiagnosis, setInspectDiagnosis] = useState<ServiceDiagnosis | null>(null)
  const [inspectLoading, setInspectLoading] = useState(false)
  const [logsLines, setLogsLines] = useState<number>(100)
  const [logsFilter, setLogsFilter] = useState<string>('')

  // Create Service Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createTemplate, setCreateTemplate] = useState<string>('custom')
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createExec, setCreateExec] = useState('')
  const [createWorkdir, setCreateWorkdir] = useState('')
  const [createUser, setCreateUser] = useState('root')
  const [createRestart, setCreateRestart] = useState('on-failure')
  const [createEnv, setCreateEnv] = useState('')
  const [createEnableStart, setCreateEnableStart] = useState(true)
  const [createLoading, setCreateLoading] = useState(false)

  // Action status toast
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [actionInProgress, setActionInProgress] = useState<Record<string, string>>({})
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Quick fix executing state
  const [fixingCommand, setFixingCommand] = useState(false)
  const [fixOutput, setFixOutput] = useState<string | null>(null)

  // Initial fetch & host checking
  const checkSshAndFetch = async () => {
    try {
      const sshRes = await sshApi.getConfig()
      const isConn = sshRes.data.status === 'CONNECTED'
      setSshConnected(isConn)
      setTargetHost(isConn ? `${sshRes.data.user || 'root'}@${sshRes.data.host}` : 'Local System')
    } catch {
      setSshConnected(false)
      setTargetHost('Local System')
    }
    fetchServices()
  }

  const fetchServices = async (silent = false) => {
    if (!silent) setLoading(true)
    setRefreshing(true)
    try {
      const res = await servicesApi.list()
      const data = res.data
      const svcList: ServiceInfo[] = data.services || (Array.isArray(data) ? data : [])
      setServices(svcList)

      if (data.stats) {
        setStats(data.stats)
      } else {
        // Compute stats locally if backend didn't format stats
        const running = svcList.filter(s => s.active === 'active').length
        const stopped = svcList.filter(s => s.active === 'inactive').length
        const failed = svcList.filter(s => s.is_failed || s.active === 'failed').length
        const enabled = svcList.filter(s => s.unit_file_state === 'enabled').length
        const disabled = svcList.filter(s => s.unit_file_state === 'disabled' || s.unit_file_state === 'masked').length
        setStats({
          total: svcList.length,
          running,
          stopped,
          failed,
          enabled,
          disabled
        })
      }
    } catch (err: any) {
      console.error('Failed to load services:', err)
      showAlert('error', err.response?.data?.detail || 'Failed to fetch services')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    checkSshAndFetch()
  }, [])

  // Auto refresh interval timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return
    const timer = setInterval(() => {
      fetchServices(true)
    }, autoRefreshInterval * 1000)
    return () => clearInterval(timer)
  }, [autoRefreshInterval])

  const showAlert = (type: 'success' | 'error', message: string) => {
    setActionAlert({ type, message })
    setTimeout(() => {
      setActionAlert(null)
    }, 4500)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(id)
    setTimeout(() => setCopiedText(null), 2000)
  }

  // Lifecycle control action handler
  const handleServiceAction = async (unitName: string, action: 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable' | 'mask' | 'unmask') => {
    setActionInProgress(prev => ({ ...prev, [unitName]: action }))
    try {
      const res = await servicesApi.action(unitName, action)
      if (res.data.success) {
        showAlert('success', res.data.message || `Successfully executed ${action} on ${unitName}`)
        fetchServices(true)
        if (inspectModalOpen && inspectUnit === unitName) {
          loadInspectionData(unitName, inspectTab)
        }
      } else {
        showAlert('error', res.data.message || `Failed to ${action} ${unitName}`)
      }
    } catch (err: any) {
      showAlert('error', err.response?.data?.detail || err.message || `Action ${action} failed`)
    } finally {
      setActionInProgress(prev => {
        const copy = { ...prev }
        delete copy[unitName]
        return copy
      })
    }
  }

  // Bulk action handler
  const handleBulkAction = async (action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') => {
    if (selectedUnits.size === 0) return
    const units = Array.from(selectedUnits)
    setRefreshing(true)
    let successCount = 0
    let failureCount = 0

    for (const unit of units) {
      try {
        const res = await servicesApi.action(unit, action)
        if (res.data.success) successCount++
        else failureCount++
      } catch {
        failureCount++
      }
    }

    setRefreshing(false)
    setSelectedUnits(new Set())
    fetchServices(true)
    if (failureCount === 0) {
      showAlert('success', `Bulk ${action} applied to all ${successCount} selected services.`)
    } else {
      showAlert('error', `Bulk ${action} completed: ${successCount} succeeded, ${failureCount} failed.`)
    }
  }

  // Inspect Modal data loader
  const openInspectModal = (unitName: string, initialTab: 'overview' | 'logs' | 'unitfile' | 'ai' = 'overview') => {
    setInspectUnit(unitName)
    setInspectTab(initialTab)
    setInspectModalOpen(true)
    setFixOutput(null)
    loadInspectionData(unitName, initialTab)
  }

  const loadInspectionData = async (unitName: string, tabName: string) => {
    setInspectLoading(true)
    try {
      if (tabName === 'overview') {
        const res = await servicesApi.detail(unitName)
        setInspectDetail(res.data)
      } else if (tabName === 'logs') {
        const res = await servicesApi.logs(unitName, logsLines)
        setInspectLogs(res.data.log || 'No logs available for this service.')
      } else if (tabName === 'unitfile') {
        const res = await servicesApi.unitFile(unitName)
        setInspectUnitFile(res.data.unit_file || 'Unit file not found.')
      } else if (tabName === 'ai') {
        const res = await servicesApi.diagnose(unitName)
        setInspectDiagnosis(res.data)
      }
    } catch (err: any) {
      console.error(`Failed to load ${tabName} data:`, err)
    } finally {
      setInspectLoading(false)
    }
  }

  // Execute AI Quick Fix command directly
  const handleExecuteFix = async (command: string) => {
    if (!command) return
    setFixingCommand(true)
    setFixOutput(null)
    try {
      const res = await commandsApi.execute(command)
      setFixOutput(res.data.stdout || res.data.stderr || 'Command executed successfully.')
      showAlert('success', `Executed: ${command}`)
      // Reload inspection
      if (inspectUnit) {
        setTimeout(() => loadInspectionData(inspectUnit, 'ai'), 1000)
        fetchServices(true)
      }
    } catch (err: any) {
      setFixOutput(err.response?.data?.detail || err.message || 'Execution failed.')
      showAlert('error', 'Failed to execute remediation command')
    } finally {
      setFixingCommand(false)
    }
  }

  // Apply template in Create Service Modal
  const handleSelectTemplate = (templateKey: string) => {
    setCreateTemplate(templateKey)
    if (templateKey !== 'custom' && TEMPLATES[templateKey]) {
      const t = TEMPLATES[templateKey]
      setCreateDesc(t.desc)
      setCreateExec(t.exec)
      setCreateWorkdir(t.workdir)
      setCreateUser(t.user)
      setCreateRestart(t.restart)
      setCreateEnv(t.env.join('\n'))
    }
  }

  // Create Service Handler
  const handleCreateService = async (e: FormEvent) => {
    e.preventDefault()
    if (!createName || !createExec) {
      showAlert('error', 'Please provide a service name and ExecStart command.')
      return
    }
    setCreateLoading(true)
    try {
      const envArray = createEnv
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)

      const res = await servicesApi.create({
        name: createName,
        description: createDesc,
        exec_start: createExec,
        working_directory: createWorkdir || undefined,
        user: createUser || 'root',
        restart: createRestart,
        environment_vars: envArray,
        enable_and_start: createEnableStart,
      })

      if (res.data.success) {
        showAlert('success', res.data.message || `Service ${createName} created successfully.`)
        setCreateModalOpen(false)
        // Reset form
        setCreateName('')
        setCreateDesc('')
        setCreateExec('')
        setCreateWorkdir('')
        setCreateEnv('')
        fetchServices(true)
      } else {
        showAlert('error', res.data.message || 'Failed to create service')
      }
    } catch (err: any) {
      showAlert('error', err.response?.data?.detail || err.message || 'Failed to create service')
    } finally {
      setCreateLoading(false)
    }
  }

  // Export inventory to JSON / CSV
  const handleExport = (format: 'json' | 'csv') => {
    let content = ''
    let filename = `services-${new Date().toISOString().slice(0, 10)}.${format}`
    let mimeType = 'text/plain'

    if (format === 'json') {
      content = JSON.stringify(services, null, 2)
      mimeType = 'application/json'
    } else {
      const headers = ['Unit', 'Name', 'Active', 'Sub', 'UnitFileState', 'Category', 'Description']
      const rows = services.map(s => [
        `"${s.unit}"`,
        `"${s.name || ''}"`,
        `"${s.active || ''}"`,
        `"${s.sub || ''}"`,
        `"${s.unit_file_state || ''}"`,
        `"${s.category || ''}"`,
        `"${(s.description || '').replace(/"/g, '""')}"`
      ])
      content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      mimeType = 'text/csv'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter and sort items
  const filteredServices = useMemo(() => {
    return services.filter(s => {
      // Tab state filter
      if (tab === 'running' && s.active !== 'active') return false
      if (tab === 'stopped' && s.active !== 'inactive') return false
      if (tab === 'failed' && !s.is_failed && s.active !== 'failed' && s.sub !== 'failed') return false
      if (tab === 'enabled' && s.unit_file_state !== 'enabled') return false
      if (tab === 'disabled' && s.unit_file_state !== 'disabled' && s.unit_file_state !== 'masked') return false

      // Category filter
      if (selectedCategory !== 'All' && s.category !== selectedCategory) return false

      // Text search
      if (filter.trim()) {
        const q = filter.toLowerCase()
        const matchUnit = s.unit.toLowerCase().includes(q)
        const matchDesc = (s.description || '').toLowerCase().includes(q)
        const matchActive = (s.active || '').toLowerCase().includes(q)
        const matchSub = (s.sub || '').toLowerCase().includes(q)
        const matchCat = (s.category || '').toLowerCase().includes(q)
        return matchUnit || matchDesc || matchActive || matchSub || matchCat
      }

      return true
    }).sort((a, b) => {
      if (sortBy === 'name') {
        return a.unit.localeCompare(b.unit)
      } else if (sortBy === 'status') {
        const order = (s: ServiceInfo) => s.is_failed ? 0 : s.active === 'active' ? 1 : 2
        return order(a) - order(b)
      } else if (sortBy === 'boot') {
        return (a.unit_file_state || '').localeCompare(b.unit_file_state || '')
      }
      return 0
    })
  }, [services, tab, selectedCategory, filter, sortBy])

  const categories = useMemo(() => {
    const set = new Set<string>()
    services.forEach(s => {
      if (s.category) set.add(s.category)
    })
    return ['All', ...Array.from(set).sort()]
  }, [services])

  // Bulk selection helpers
  const handleToggleSelectUnit = (unit: string) => {
    const next = new Set(selectedUnits)
    if (next.has(unit)) next.delete(unit)
    else next.add(unit)
    setSelectedUnits(next)
  }

  const handleSelectAllVisible = () => {
    if (selectedUnits.size === filteredServices.length && filteredServices.length > 0) {
      setSelectedUnits(new Set())
    } else {
      setSelectedUnits(new Set(filteredServices.map(s => s.unit)))
    }
  }

  return (
    <div className="p-6 h-full flex flex-col gap-5 overflow-hidden animate-fade-in bg-terminal-bg text-terminal-text">
      
      {/* ── Top Header & Host Badge ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-terminal-border/60 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-terminal-blue/15 border border-terminal-blue/30 text-terminal-blue">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight">Services & Daemons</h1>
                <span className={clsx(
                  'px-2.5 py-0.5 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 border',
                  sshConnected 
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60' 
                    : 'bg-terminal-surface text-terminal-muted border-terminal-border'
                )}>
                  <span className={clsx('w-1.5 h-1.5 rounded-full', sshConnected ? 'bg-emerald-400 animate-pulse' : 'bg-terminal-muted')} />
                  {targetHost}
                </span>
              </div>
              <p className="text-xs text-terminal-muted mt-0.5">
                Inspect, control lifecycle, read live journal logs, analyze root causes, and deploy systemd units.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Auto refresh dropdown */}
          <div className="flex items-center gap-1 bg-terminal-surface border border-terminal-border rounded-lg px-2.5 py-1.5 text-xs text-terminal-muted">
            <Clock className="w-3.5 h-3.5 text-terminal-muted" />
            <span>Auto:</span>
            <select
              value={autoRefreshInterval}
              onChange={e => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-terminal-text text-xs focus:outline-none cursor-pointer"
            >
              <option value={0} className="bg-terminal-surface">Off</option>
              <option value={3} className="bg-terminal-surface">3s</option>
              <option value={5} className="bg-terminal-surface">5s</option>
              <option value={10} className="bg-terminal-surface">10s</option>
              <option value={30} className="bg-terminal-surface">30s</option>
            </select>
          </div>

          <button
            onClick={() => fetchServices(false)}
            disabled={refreshing}
            className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5 border border-terminal-border rounded-lg hover:border-terminal-blue/50"
            title="Refresh Services"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin text-terminal-blue')} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="btn-primary flex items-center gap-1.5 text-xs px-3.5 py-1.5 shadow-md shadow-blue-500/10"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Service</span>
          </button>
        </div>
      </div>

      {/* ── Action Alert Toast ── */}
      {actionAlert && (
        <div className={clsx(
          'px-4 py-2.5 rounded-lg border text-sm flex items-center justify-between shadow-lg animate-fade-in',
          actionAlert.type === 'success'
            ? 'bg-emerald-950/50 border-emerald-600/50 text-emerald-300'
            : 'bg-rose-950/50 border-rose-600/50 text-rose-300'
        )}>
          <div className="flex items-center gap-2">
            {actionAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{actionAlert.message}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-terminal-muted hover:text-terminal-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Summary Statistics KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {/* Total Services */}
        <div 
          onClick={() => setTab('all')}
          className={clsx(
            'glass-card p-3 cursor-pointer transition-all border flex flex-col justify-between hover:scale-[1.02]',
            tab === 'all' ? 'border-terminal-blue ring-1 ring-terminal-blue/40 bg-terminal-blue/5' : 'border-terminal-border'
          )}
        >
          <div className="flex items-center justify-between text-xs text-terminal-muted">
            <span className="font-mono uppercase tracking-wider text-[10px]">Total Units</span>
            <Server className="w-3.5 h-3.5 text-terminal-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-terminal-text">{stats.total}</span>
            <span className="text-[11px] text-terminal-muted">systemd</span>
          </div>
        </div>

        {/* Running / Active */}
        <div 
          onClick={() => setTab('running')}
          className={clsx(
            'glass-card p-3 cursor-pointer transition-all border flex flex-col justify-between hover:scale-[1.02]',
            tab === 'running' ? 'border-emerald-500 ring-1 ring-emerald-500/40 bg-emerald-950/10' : 'border-terminal-border'
          )}
        >
          <div className="flex items-center justify-between text-xs text-terminal-muted">
            <span className="font-mono uppercase tracking-wider text-[10px] text-emerald-400">Running / Active</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-emerald-400">{stats.running}</span>
            <span className="text-[11px] text-terminal-muted">
              {stats.total > 0 ? `${Math.round((stats.running / stats.total) * 100)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Stopped / Inactive */}
        <div 
          onClick={() => setTab('stopped')}
          className={clsx(
            'glass-card p-3 cursor-pointer transition-all border flex flex-col justify-between hover:scale-[1.02]',
            tab === 'stopped' ? 'border-slate-400 ring-1 ring-slate-400/40 bg-slate-800/10' : 'border-terminal-border'
          )}
        >
          <div className="flex items-center justify-between text-xs text-terminal-muted">
            <span className="font-mono uppercase tracking-wider text-[10px]">Stopped / Dead</span>
            <Square className="w-3.5 h-3.5 text-terminal-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-300">{stats.stopped}</span>
            <span className="text-[11px] text-terminal-muted">inactive</span>
          </div>
        </div>

        {/* Failed Services */}
        <div 
          onClick={() => setTab('failed')}
          className={clsx(
            'glass-card p-3 cursor-pointer transition-all border flex flex-col justify-between hover:scale-[1.02]',
            stats.failed > 0 
              ? 'border-rose-600/70 bg-rose-950/20 text-rose-300 ring-1 ring-rose-500/40' 
              : tab === 'failed' ? 'border-rose-500 bg-rose-950/10' : 'border-terminal-border'
          )}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase tracking-wider text-[10px] text-rose-400 font-semibold">Failed Alert</span>
            {stats.failed > 0 && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />}
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-rose-400">{stats.failed}</span>
            <span className="text-[11px] text-rose-400/80">needs fix</span>
          </div>
        </div>

        {/* Enabled on Boot */}
        <div 
          onClick={() => setTab('enabled')}
          className={clsx(
            'glass-card p-3 cursor-pointer transition-all border flex flex-col justify-between hover:scale-[1.02]',
            tab === 'enabled' ? 'border-indigo-500 ring-1 ring-indigo-500/40 bg-indigo-950/10' : 'border-terminal-border'
          )}
        >
          <div className="flex items-center justify-between text-xs text-terminal-muted">
            <span className="font-mono uppercase tracking-wider text-[10px] text-indigo-300">Autostart Boot</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-indigo-300">{stats.enabled}</span>
            <span className="text-[11px] text-terminal-muted">enabled</span>
          </div>
        </div>

        {/* Disabled / Masked */}
        <div 
          onClick={() => setTab('disabled')}
          className={clsx(
            'glass-card p-3 cursor-pointer transition-all border flex flex-col justify-between hover:scale-[1.02]',
            tab === 'disabled' ? 'border-amber-500 ring-1 ring-amber-500/40 bg-amber-950/10' : 'border-terminal-border'
          )}
        >
          <div className="flex items-center justify-between text-xs text-terminal-muted">
            <span className="font-mono uppercase tracking-wider text-[10px] text-amber-400">Disabled / Mask</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-amber-400">{stats.disabled}</span>
            <span className="text-[11px] text-terminal-muted">manual</span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar, Search, and Category Selector ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          {/* Primary State Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-terminal-surface p-1 rounded-lg border border-terminal-border overflow-x-auto max-w-full">
            <button
              onClick={() => setTab('all')}
              className={clsx('px-3 py-1 text-xs rounded-md font-medium transition-all', tab === 'all' ? 'bg-terminal-blue/20 text-terminal-blue shadow-sm' : 'text-terminal-muted hover:text-terminal-text')}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setTab('running')}
              className={clsx('px-3 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1.5', tab === 'running' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-700/50' : 'text-terminal-muted hover:text-terminal-text')}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Running ({stats.running})
            </button>
            <button
              onClick={() => setTab('stopped')}
              className={clsx('px-3 py-1 text-xs rounded-md font-medium transition-all', tab === 'stopped' ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'text-terminal-muted hover:text-terminal-text')}
            >
              Stopped ({stats.stopped})
            </button>
            <button
              onClick={() => setTab('failed')}
              className={clsx('px-3 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1.5', tab === 'failed' ? 'bg-rose-950/50 text-rose-400 border border-rose-600/50 font-semibold' : 'text-terminal-muted hover:text-rose-400')}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Failed ({stats.failed})
            </button>
            <button
              onClick={() => setTab('enabled')}
              className={clsx('px-3 py-1 text-xs rounded-md font-medium transition-all', tab === 'enabled' ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-700/50' : 'text-terminal-muted hover:text-terminal-text')}
            >
              Enabled ({stats.enabled})
            </button>
          </div>

          {/* Search, Sort, View Mode, and Export buttons */}
          <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" />
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Search unit, description, category..."
                className="w-full bg-terminal-surface border border-terminal-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-terminal-text placeholder-terminal-muted focus:outline-none focus:border-terminal-blue transition-colors"
              />
              {filter && (
                <button onClick={() => setFilter('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-terminal-muted hover:text-terminal-text">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort selection */}
            <div className="flex items-center gap-1 bg-terminal-surface border border-terminal-border rounded-lg px-2.5 py-1.5 text-xs text-terminal-muted">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-terminal-text text-xs focus:outline-none cursor-pointer"
              >
                <option value="name" className="bg-terminal-surface">Sort: Name (A-Z)</option>
                <option value="status" className="bg-terminal-surface">Sort: Status</option>
                <option value="boot" className="bg-terminal-surface">Sort: Boot State</option>
              </select>
            </div>

            {/* Export Dropdown */}
            <div className="flex items-center border border-terminal-border rounded-lg overflow-hidden bg-terminal-surface">
              <button
                onClick={() => handleExport('json')}
                className="px-2.5 py-1.5 text-xs text-terminal-muted hover:text-terminal-text hover:bg-terminal-border/40 border-r border-terminal-border flex items-center gap-1"
                title="Export as JSON"
              >
                <Download className="w-3 h-3" /> JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="px-2.5 py-1.5 text-xs text-terminal-muted hover:text-terminal-text hover:bg-terminal-border/40 flex items-center gap-1"
                title="Export as CSV"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-terminal-surface border border-terminal-border rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={clsx('p-1 rounded text-xs', viewMode === 'table' ? 'bg-terminal-blue/20 text-terminal-blue' : 'text-terminal-muted hover:text-terminal-text')}
                title="Dense Table View"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={clsx('p-1 rounded text-xs', viewMode === 'grid' ? 'bg-terminal-blue/20 text-terminal-blue' : 'text-terminal-muted hover:text-terminal-text')}
                title="Grid Cards View"
              >
                <Box className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-terminal-muted text-[11px] uppercase tracking-wider font-mono flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Category:
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-xs transition-all whitespace-nowrap flex items-center gap-1.5 border',
                selectedCategory === cat
                  ? 'bg-terminal-blue/15 border-terminal-blue text-terminal-blue font-medium'
                  : 'bg-terminal-surface/60 border-terminal-border/60 text-terminal-muted hover:text-terminal-text hover:border-terminal-border'
              )}
            >
              {cat !== 'All' && CATEGORY_ICONS[cat]}
              <span>{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk Actions Floating / Sub Bar ── */}
      {selectedUnits.size > 0 && (
        <div className="bg-terminal-blue/10 border border-terminal-blue/40 rounded-xl px-4 py-2 flex items-center justify-between flex-wrap gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5 text-xs text-terminal-blue font-medium">
            <span className="px-2 py-0.5 rounded-full bg-terminal-blue text-terminal-bg font-bold font-mono">
              {selectedUnits.size}
            </span>
            <span>services selected</span>
            <button
              onClick={() => setSelectedUnits(new Set())}
              className="text-xs text-terminal-muted hover:text-terminal-text underline ml-2"
            >
              Deselect all
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('start')}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs flex items-center gap-1 font-medium"
            >
              <Play className="w-3 h-3" /> Bulk Start
            </button>
            <button
              onClick={() => handleBulkAction('restart')}
              className="px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-xs flex items-center gap-1 font-medium"
            >
              <RotateCw className="w-3 h-3" /> Bulk Restart
            </button>
            <button
              onClick={() => handleBulkAction('stop')}
              className="px-2.5 py-1 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 text-xs flex items-center gap-1 font-medium"
            >
              <Square className="w-3 h-3" /> Bulk Stop
            </button>
            <button
              onClick={() => handleBulkAction('enable')}
              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 text-xs flex items-center gap-1 font-medium"
            >
              <CheckCircle2 className="w-3 h-3" /> Bulk Enable
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content Area: Table or Grid View ── */}
      <div className="flex-1 overflow-y-auto glass-card border border-terminal-border/80 rounded-xl relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="spinner w-8 h-8 border-2 border-terminal-blue/20 border-t-terminal-blue" />
            <span className="text-xs text-terminal-muted font-mono">Querying systemd daemon status...</span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-terminal-muted">
            <Server className="w-8 h-8 text-terminal-muted/40" />
            <p className="text-sm font-medium">No matching services found</p>
            <p className="text-xs text-terminal-muted">Try clearing your filters or search keywords.</p>
            {(filter || tab !== 'all' || selectedCategory !== 'All') && (
              <button
                onClick={() => { setFilter(''); setTab('all'); setSelectedCategory('All'); }}
                className="mt-2 text-xs text-terminal-blue hover:underline"
              >
                Reset all filters
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* ── Table View ── */
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-terminal-surface/95 backdrop-blur-md border-b border-terminal-border z-10">
              <tr className="text-terminal-muted text-[11px] uppercase tracking-wider font-mono">
                <th className="w-10 px-4 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedUnits.size === filteredServices.length && filteredServices.length > 0}
                    onChange={handleSelectAllVisible}
                    className="rounded border-terminal-border bg-terminal-bg text-terminal-blue focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-2.5">Service Unit</th>
                <th className="text-left px-4 py-2.5">Active State</th>
                <th className="text-left px-4 py-2.5">Boot Preset</th>
                <th className="text-left px-4 py-2.5">Category</th>
                <th className="text-left px-4 py-2.5">Description</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border/50 font-sans">
              {filteredServices.map((s) => {
                const isSelected = selectedUnits.has(s.unit)
                const inProgressAction = actionInProgress[s.unit]
                const isRunning = s.active === 'active'
                const isFailed = s.is_failed || s.active === 'failed' || s.sub === 'failed'

                return (
                  <tr
                    key={s.unit}
                    className={clsx(
                      'transition-colors group',
                      isSelected ? 'bg-terminal-blue/10' : 'hover:bg-terminal-surface/60',
                      isFailed && !isSelected && 'bg-rose-950/10'
                    )}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectUnit(s.unit)}
                        className="rounded border-terminal-border bg-terminal-bg text-terminal-blue focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Unit Name */}
                    <td className="px-4 py-3 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          isRunning ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' :
                          isFailed ? 'bg-rose-500 animate-ping' :
                          'bg-terminal-muted/60'
                        )} />
                        <span className="font-semibold text-terminal-text group-hover:text-terminal-blue transition-colors">
                          {s.unit}
                        </span>
                      </div>
                    </td>

                    {/* Active / Sub status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx(
                          'px-2 py-0.5 rounded text-[11px] font-mono font-medium border flex items-center gap-1',
                          isRunning ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60' :
                          isFailed ? 'bg-rose-950/60 text-rose-300 border-rose-700/80 font-bold animate-pulse' :
                          s.active === 'inactive' ? 'bg-slate-900/60 text-slate-400 border-slate-700/60' :
                          'bg-amber-950/40 text-amber-300 border-amber-700/60'
                        )}>
                          {s.active || 'unknown'}
                        </span>
                        {s.sub && (
                          <span className="text-[11px] text-terminal-muted font-mono">
                            ({s.sub})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Boot State */}
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border',
                        s.unit_file_state === 'enabled' ? 'bg-indigo-950/40 text-indigo-300 border-indigo-700/50' :
                        s.unit_file_state === 'disabled' ? 'bg-slate-900/50 text-terminal-muted border-terminal-border' :
                        s.unit_file_state === 'masked' ? 'bg-rose-950/40 text-rose-300 border-rose-800/50' :
                        'bg-purple-950/30 text-purple-300 border-purple-800/40'
                      )}>
                        {s.unit_file_state || 'static'}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-terminal-muted">
                        {CATEGORY_ICONS[s.category || ''] || <Layers className="w-3.5 h-3.5" />}
                        <span className="truncate max-w-[130px]">{s.category || 'System'}</span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-xs text-terminal-muted truncate max-w-xs" title={s.description}>
                      {s.description || '—'}
                    </td>

                    {/* Action buttons */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Start / Stop Toggle */}
                        {isRunning ? (
                          <button
                            onClick={() => handleServiceAction(s.unit, 'stop')}
                            disabled={!!inProgressAction}
                            className="p-1.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 hover:bg-rose-900/50 transition-colors"
                            title="Stop Service"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleServiceAction(s.unit, 'start')}
                            disabled={!!inProgressAction}
                            className="p-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/50 transition-colors"
                            title="Start Service"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}

                        {/* Restart */}
                        <button
                          onClick={() => handleServiceAction(s.unit, 'restart')}
                          disabled={!!inProgressAction}
                          className="p-1.5 rounded-lg bg-blue-950/30 border border-blue-800/40 text-blue-300 hover:bg-blue-900/50 transition-colors"
                          title="Restart Service"
                        >
                          <RotateCw className={clsx('w-3.5 h-3.5', inProgressAction === 'restart' && 'animate-spin')} />
                        </button>

                        {/* Inspect Details */}
                        <button
                          onClick={() => openInspectModal(s.unit, 'overview')}
                          className="p-1.5 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text hover:border-terminal-blue/50 transition-colors"
                          title="Inspect Properties & Logs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* AI Troubleshoot (highlighted on failed) */}
                        {isFailed && (
                          <button
                            onClick={() => openInspectModal(s.unit, 'ai')}
                            className="p-1.5 rounded-lg bg-rose-600/30 border border-rose-500 text-rose-200 hover:bg-rose-600/50 transition-all animate-bounce"
                            title="AI Diagnose & Fix"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          /* ── Grid Cards View ── */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map(s => {
              const isSelected = selectedUnits.has(s.unit)
              const inProgressAction = actionInProgress[s.unit]
              const isRunning = s.active === 'active'
              const isFailed = s.is_failed || s.active === 'failed' || s.sub === 'failed'

              return (
                <div
                  key={s.unit}
                  className={clsx(
                    'glass-card p-4 rounded-xl border flex flex-col justify-between transition-all group relative',
                    isSelected ? 'border-terminal-blue bg-terminal-blue/5 ring-1 ring-terminal-blue/40' : 'border-terminal-border hover:border-terminal-blue/50',
                    isFailed && 'border-rose-700/60 bg-rose-950/15'
                  )}
                >
                  <div>
                    {/* Header: Checkbox + Name + Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectUnit(s.unit)}
                          className="rounded border-terminal-border bg-terminal-bg text-terminal-blue focus:ring-0 cursor-pointer"
                        />
                        <span className="font-mono text-sm font-bold text-terminal-text truncate max-w-[190px]">
                          {s.unit}
                        </span>
                      </div>
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-[11px] font-mono font-medium border flex items-center gap-1',
                        isRunning ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60' :
                        isFailed ? 'bg-rose-950/60 text-rose-300 border-rose-700/80 font-bold' :
                        'bg-slate-900/60 text-slate-400 border-slate-700/60'
                      )}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', isRunning ? 'bg-emerald-400' : isFailed ? 'bg-rose-500' : 'bg-slate-400')} />
                        {s.active}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-terminal-muted line-clamp-2 min-h-[32px] mb-3">
                      {s.description || 'No description provided.'}
                    </p>

                    {/* Meta info tags */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-terminal-muted mb-4 font-mono">
                      <span className="flex items-center gap-1 bg-terminal-bg px-2 py-0.5 rounded border border-terminal-border/60">
                        {CATEGORY_ICONS[s.category || ''] || <Layers className="w-3 h-3" />}
                        <span className="text-[10px]">{s.category || 'System'}</span>
                      </span>
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-[10px] uppercase border',
                        s.unit_file_state === 'enabled' ? 'bg-indigo-950/40 text-indigo-300 border-indigo-700/40' :
                        s.unit_file_state === 'masked' ? 'bg-rose-950/40 text-rose-300 border-rose-800/40' :
                        'bg-terminal-bg text-terminal-muted border-terminal-border/60'
                      )}>
                        {s.unit_file_state || 'static'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="border-t border-terminal-border/60 pt-3 flex items-center justify-between">
                    <button
                      onClick={() => openInspectModal(s.unit, isFailed ? 'ai' : 'overview')}
                      className="text-xs text-terminal-blue hover:underline flex items-center gap-1 font-medium"
                    >
                      {isFailed ? <Sparkles className="w-3.5 h-3.5 text-amber-300" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{isFailed ? 'Diagnose' : 'Details'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {isRunning ? (
                        <button
                          onClick={() => handleServiceAction(s.unit, 'stop')}
                          disabled={!!inProgressAction}
                          className="px-2 py-1 rounded bg-rose-950/30 border border-rose-800/50 text-rose-300 hover:bg-rose-900/50 text-xs flex items-center gap-1"
                        >
                          <Square className="w-3 h-3 fill-current" /> Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => handleServiceAction(s.unit, 'start')}
                          disabled={!!inProgressAction}
                          className="px-2 py-1 rounded bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50 text-xs flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" /> Start
                        </button>
                      )}

                      <button
                        onClick={() => handleServiceAction(s.unit, 'restart')}
                        disabled={!!inProgressAction}
                        className="p-1 rounded bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text hover:border-terminal-blue/40"
                        title="Restart"
                      >
                        <RotateCw className={clsx('w-3.5 h-3.5', inProgressAction === 'restart' && 'animate-spin')} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Inspect & Manage Service ── */}
      {inspectModalOpen && inspectUnit && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card bg-terminal-bg border border-terminal-border/90 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-terminal-border flex items-center justify-between bg-terminal-surface/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-terminal-blue/15 border border-terminal-blue/30 text-terminal-blue">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-mono text-terminal-text">{inspectUnit}</h2>
                  <p className="text-xs text-terminal-muted">Systemd Unit Inspection & Live Management</p>
                </div>
              </div>

              <button
                onClick={() => setInspectModalOpen(false)}
                className="p-1.5 rounded-lg text-terminal-muted hover:text-terminal-text hover:bg-terminal-border/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 px-4 pt-3 border-b border-terminal-border bg-terminal-surface/30">
              <button
                onClick={() => { setInspectTab('overview'); loadInspectionData(inspectUnit, 'overview'); }}
                className={clsx('px-3.5 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5', inspectTab === 'overview' ? 'border-terminal-blue text-terminal-blue' : 'border-transparent text-terminal-muted hover:text-terminal-text')}
              >
                <Activity className="w-3.5 h-3.5" /> Overview & Status
              </button>
              <button
                onClick={() => { setInspectTab('logs'); loadInspectionData(inspectUnit, 'logs'); }}
                className={clsx('px-3.5 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5', inspectTab === 'logs' ? 'border-terminal-blue text-terminal-blue' : 'border-transparent text-terminal-muted hover:text-terminal-text')}
              >
                <FileText className="w-3.5 h-3.5" /> Live Journal Logs
              </button>
              <button
                onClick={() => { setInspectTab('unitfile'); loadInspectionData(inspectUnit, 'unitfile'); }}
                className={clsx('px-3.5 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5', inspectTab === 'unitfile' ? 'border-terminal-blue text-terminal-blue' : 'border-transparent text-terminal-muted hover:text-terminal-text')}
              >
                <Layers className="w-3.5 h-3.5" /> Unit File Config
              </button>
              <button
                onClick={() => { setInspectTab('ai'); loadInspectionData(inspectUnit, 'ai'); }}
                className={clsx('px-3.5 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5', inspectTab === 'ai' ? 'border-purple-400 text-purple-400 font-semibold' : 'border-transparent text-terminal-muted hover:text-purple-300')}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> AI Troubleshooting
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto">
              {inspectLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="spinner w-6 h-6 border-2 border-terminal-blue/20 border-t-terminal-blue" />
                  <span className="text-xs text-terminal-muted font-mono">Fetching unit data...</span>
                </div>
              ) : inspectTab === 'overview' ? (
                /* ── Overview Tab ── */
                <div className="space-y-4">
                  {/* Status Badges Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-terminal-surface p-3 rounded-xl border border-terminal-border">
                      <span className="text-[10px] text-terminal-muted uppercase font-mono">Active State</span>
                      <p className="text-base font-bold font-mono mt-1 text-terminal-text">
                        {inspectDetail?.status || 'Unknown'}
                      </p>
                    </div>
                    <div className="bg-terminal-surface p-3 rounded-xl border border-terminal-border">
                      <span className="text-[10px] text-terminal-muted uppercase font-mono">Main PID</span>
                      <p className="text-base font-bold font-mono mt-1 text-terminal-blue">
                        {inspectDetail?.main_pid || '—'}
                      </p>
                    </div>
                    <div className="bg-terminal-surface p-3 rounded-xl border border-terminal-border">
                      <span className="text-[10px] text-terminal-muted uppercase font-mono">Memory Footprint</span>
                      <p className="text-base font-bold font-mono mt-1 text-emerald-400">
                        {inspectDetail?.memory || '—'}
                      </p>
                    </div>
                    <div className="bg-terminal-surface p-3 rounded-xl border border-terminal-border">
                      <span className="text-[10px] text-terminal-muted uppercase font-mono">CPU Execution Time</span>
                      <p className="text-base font-bold font-mono mt-1 text-indigo-300">
                        {inspectDetail?.cpu || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Properties table */}
                  <div className="bg-terminal-surface rounded-xl border border-terminal-border p-4 text-xs font-mono space-y-2.5">
                    <div className="flex items-center justify-between border-b border-terminal-border/60 pb-2">
                      <span className="text-terminal-muted">Uptime / Since:</span>
                      <span className="text-terminal-text">{inspectDetail?.uptime || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-terminal-border/60 pb-2">
                      <span className="text-terminal-muted">Unit File Path:</span>
                      <span className="text-terminal-text truncate max-w-md">{inspectDetail?.unit_file_path || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-terminal-border/60 pb-2">
                      <span className="text-terminal-muted">Startup Preset:</span>
                      <span className="text-terminal-text uppercase">{inspectDetail?.unit_file_state || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-terminal-border/60 pb-2">
                      <span className="text-terminal-muted">CGroup Slice:</span>
                      <span className="text-terminal-text truncate max-w-md">{inspectDetail?.cgroup || '—'}</span>
                    </div>
                    {inspectDetail?.tasks && (
                      <div className="flex items-center justify-between">
                        <span className="text-terminal-muted">Tasks / Limit:</span>
                        <span className="text-terminal-text">{inspectDetail.tasks}</span>
                      </div>
                    )}
                  </div>

                  {/* Raw Output Block */}
                  {inspectDetail?.raw_output && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-terminal-muted font-mono">Raw systemctl status output</span>
                        <button
                          onClick={() => copyToClipboard(inspectDetail.raw_output || '', 'raw')}
                          className="text-xs text-terminal-blue hover:underline flex items-center gap-1"
                        >
                          {copiedText === 'raw' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedText === 'raw' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-3 bg-terminal-bg border border-terminal-border rounded-lg text-xs font-mono text-terminal-muted overflow-x-auto whitespace-pre-wrap max-h-44">
                        {inspectDetail.raw_output}
                      </pre>
                    </div>
                  )}
                </div>
              ) : inspectTab === 'logs' ? (
                /* ── Logs Tab ── */
                <div className="flex flex-col h-full gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-terminal-muted font-mono">Lines:</span>
                      <select
                        value={logsLines}
                        onChange={e => {
                          setLogsLines(Number(e.target.value))
                          loadInspectionData(inspectUnit, 'logs')
                        }}
                        className="bg-terminal-surface border border-terminal-border rounded px-2 py-1 text-xs text-terminal-text"
                      >
                        <option value={50}>50 lines</option>
                        <option value={100}>100 lines</option>
                        <option value={250}>250 lines</option>
                        <option value={500}>500 lines</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        value={logsFilter}
                        onChange={e => setLogsFilter(e.target.value)}
                        placeholder="Filter log lines..."
                        className="bg-terminal-surface border border-terminal-border rounded px-2.5 py-1 text-xs text-terminal-text w-44 focus:outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard(inspectLogs, 'logs')}
                        className="btn-ghost text-xs px-2.5 py-1 flex items-center gap-1 border border-terminal-border rounded"
                      >
                        {copiedText === 'logs' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>Copy Logs</span>
                      </button>
                    </div>
                  </div>

                  <pre className="flex-1 p-3 bg-terminal-bg border border-terminal-border rounded-xl font-mono text-xs text-terminal-text overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
                    {logsFilter
                      ? inspectLogs
                          .split('\n')
                          .filter(line => line.toLowerCase().includes(logsFilter.toLowerCase()))
                          .join('\n') || 'No matching log entries found.'
                      : inspectLogs}
                  </pre>
                </div>
              ) : inspectTab === 'unitfile' ? (
                /* ── Unit File Tab ── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-terminal-muted font-mono">Systemd Service Unit Specification</span>
                    <button
                      onClick={() => copyToClipboard(inspectUnitFile, 'unitfile')}
                      className="btn-ghost text-xs px-2.5 py-1 flex items-center gap-1 border border-terminal-border rounded"
                    >
                      {copiedText === 'unitfile' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>Copy Unit File</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-terminal-bg border border-terminal-border rounded-xl font-mono text-xs text-blue-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
                    {inspectUnitFile}
                  </pre>
                </div>
              ) : (
                /* ── AI Troubleshooting Tab ── */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40">
                    <div className="flex items-center gap-2 text-purple-300 font-bold text-sm mb-2">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>AI Diagnostic Summary for {inspectUnit}</span>
                    </div>

                    {/* Detected Issues */}
                    <div className="space-y-1.5 mb-3">
                      <span className="text-xs uppercase font-mono font-semibold text-rose-400">Detected Issues:</span>
                      {inspectDiagnosis?.issues.map((iss, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-terminal-text">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                          <span>{iss}</span>
                        </div>
                      ))}
                    </div>

                    {/* Recommendations */}
                    <div className="space-y-1.5">
                      <span className="text-xs uppercase font-mono font-semibold text-emerald-400">Recommendations:</span>
                      {inspectDiagnosis?.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-terminal-muted">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 1-Click Fix Command */}
                  {inspectDiagnosis?.quick_fix_command && (
                    <div className="p-4 rounded-xl bg-terminal-surface border border-terminal-border space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-terminal-blue flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5" /> Recommended Remediation Command
                        </span>
                        <button
                          onClick={() => handleExecuteFix(inspectDiagnosis.quick_fix_command || '')}
                          disabled={fixingCommand}
                          className="btn-primary text-xs px-3 py-1 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{fixingCommand ? 'Running Fix...' : 'Run 1-Click Fix'}</span>
                        </button>
                      </div>

                      <div className="p-2.5 bg-terminal-bg rounded-lg font-mono text-xs text-terminal-text border border-terminal-border flex items-center justify-between">
                        <code>{inspectDiagnosis.quick_fix_command}</code>
                        <button
                          onClick={() => copyToClipboard(inspectDiagnosis.quick_fix_command || '', 'cmd')}
                          className="text-terminal-muted hover:text-terminal-text p-1"
                        >
                          {copiedText === 'cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>

                      {/* Fix execution terminal output */}
                      {fixOutput && (
                        <div className="mt-3">
                          <span className="text-[11px] text-terminal-muted font-mono">Execution Result:</span>
                          <pre className="p-3 bg-terminal-bg border border-terminal-border rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-36 mt-1">
                            {fixOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-terminal-border flex items-center justify-between bg-terminal-surface/50 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleServiceAction(inspectUnit, 'start')}
                  className="btn-ghost text-xs px-3 py-1.5 bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50 rounded-lg flex items-center gap-1"
                >
                  <Play className="w-3 h-3" /> Start
                </button>
                <button
                  onClick={() => handleServiceAction(inspectUnit, 'restart')}
                  className="btn-ghost text-xs px-3 py-1.5 bg-blue-950/30 border border-blue-800/50 text-blue-300 hover:bg-blue-900/50 rounded-lg flex items-center gap-1"
                >
                  <RotateCw className="w-3 h-3" /> Restart
                </button>
                <button
                  onClick={() => handleServiceAction(inspectUnit, 'reload')}
                  className="btn-ghost text-xs px-3 py-1.5 border border-terminal-border rounded-lg"
                >
                  Reload Config
                </button>
                <button
                  onClick={() => handleServiceAction(inspectUnit, 'stop')}
                  className="btn-ghost text-xs px-3 py-1.5 bg-rose-950/30 border border-rose-800/50 text-rose-300 hover:bg-rose-900/50 rounded-lg flex items-center gap-1"
                >
                  <Square className="w-3 h-3" /> Stop
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleServiceAction(inspectUnit, 'enable')}
                  className="btn-ghost text-xs px-3 py-1.5 border border-indigo-700/50 text-indigo-300 hover:bg-indigo-950/40 rounded-lg"
                >
                  Enable Boot
                </button>
                <button
                  onClick={() => handleServiceAction(inspectUnit, 'disable')}
                  className="btn-ghost text-xs px-3 py-1.5 border border-terminal-border text-terminal-muted hover:text-terminal-text rounded-lg"
                >
                  Disable Boot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create New Systemd Service Unit ── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card bg-terminal-bg border border-terminal-border/90 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="p-4 border-b border-terminal-border flex items-center justify-between bg-terminal-surface/70">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-terminal-blue/15 border border-terminal-blue/30 text-terminal-blue">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-terminal-text">Deploy Custom Systemd Service</h2>
                  <p className="text-xs text-terminal-muted">Generate and register a Linux daemon unit in /etc/systemd/system/</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-terminal-muted hover:text-terminal-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* Quick Template Selector */}
              <div>
                <label className="block text-xs font-mono uppercase text-terminal-muted mb-1.5">Preset Template</label>
                <select
                  value={createTemplate}
                  onChange={e => handleSelectTemplate(e.target.value)}
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text focus:outline-none focus:border-terminal-blue"
                >
                  <option value="custom">Custom Blank Service</option>
                  <option value="node">Node.js Production Application</option>
                  <option value="python">Python FastAPI / Flask Backend</option>
                  <option value="worker">Background Queue Worker (Shell)</option>
                  <option value="go">Go High-Performance Binary</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-terminal-muted mb-1.5">Service Name *</label>
                  <input
                    required
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder="e.g. my-api"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-xs font-mono text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                  <span className="text-[10px] text-terminal-muted mt-1 block">Will be saved as {createName ? `${createName}.service` : 'unit.service'}</span>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-terminal-muted mb-1.5">Description</label>
                  <input
                    value={createDesc}
                    onChange={e => setCreateDesc(e.target.value)}
                    placeholder="Human readable service description"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-terminal-muted mb-1.5">ExecStart Command *</label>
                <input
                  required
                  value={createExec}
                  onChange={e => setCreateExec(e.target.value)}
                  placeholder="/usr/bin/node /opt/myapp/index.js"
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-xs font-mono text-terminal-text focus:outline-none focus:border-terminal-blue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-terminal-muted mb-1.5">Working Directory</label>
                  <input
                    value={createWorkdir}
                    onChange={e => setCreateWorkdir(e.target.value)}
                    placeholder="/opt/myapp"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-xs font-mono text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-terminal-muted mb-1.5">User</label>
                  <input
                    value={createUser}
                    onChange={e => setCreateUser(e.target.value)}
                    placeholder="root"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-xs font-mono text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-terminal-muted mb-1.5">Restart Policy</label>
                  <select
                    value={createRestart}
                    onChange={e => setCreateRestart(e.target.value)}
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text focus:outline-none focus:border-terminal-blue"
                  >
                    <option value="on-failure">on-failure (Recommended)</option>
                    <option value="always">always</option>
                    <option value="no">no</option>
                    <option value="on-abnormal">on-abnormal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-terminal-muted mb-1.5">Environment Variables (1 per line)</label>
                <textarea
                  rows={2}
                  value={createEnv}
                  onChange={e => setCreateEnv(e.target.value)}
                  placeholder="PORT=8080&#10;NODE_ENV=production"
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg p-2.5 text-xs font-mono text-terminal-text focus:outline-none focus:border-terminal-blue resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enable_start_check"
                  checked={createEnableStart}
                  onChange={e => setCreateEnableStart(e.target.checked)}
                  className="rounded border-terminal-border bg-terminal-bg text-terminal-blue focus:ring-0 cursor-pointer"
                />
                <label htmlFor="enable_start_check" className="text-xs text-terminal-text cursor-pointer">
                  Enable on boot and start service immediately after creation
                </label>
              </div>

              {/* Live Unit File Preview */}
              <div className="pt-2">
                <span className="text-[11px] font-mono text-terminal-muted block mb-1">Generated /etc/systemd/system/{createName || 'my-service'}.service preview:</span>
                <pre className="p-3 bg-terminal-bg border border-terminal-border rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
{`[Unit]
Description=${createDesc || createName || 'Custom Service'}
After=network.target remote-fs.target

[Service]
Type=simple
User=${createUser || 'root'}
${createWorkdir ? `WorkingDirectory=${createWorkdir}` : ''}
ExecStart=${createExec || '/usr/bin/echo "running"'}
Restart=${createRestart}
RestartSec=5s
${createEnv.split('\n').filter(Boolean).map(e => `Environment="${e.trim()}"`).join('\n')}

[Install]
WantedBy=multi-user.target`}
                </pre>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-terminal-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-ghost text-xs px-4 py-2 border border-terminal-border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>{createLoading ? 'Deploying...' : 'Deploy & Reload'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
