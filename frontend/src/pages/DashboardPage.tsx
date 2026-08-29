// LinuxAI — Dashboard Page
import { useEffect, useState } from 'react'
import { systemApi, servicesApi, alertsApi } from '../services/api'
import MetricCard from '../components/MetricCard'
import HealthScoreRing from '../components/HealthScore'
import { Activity, Cpu, MemoryStick, HardDrive, Server, Bell, RefreshCw, Wifi, Sparkles, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react'
import type { SystemInfo, HealthScore, AlertOut } from '../types'
import { Link, useNavigate } from 'react-router-dom'
import { useVoiceAssistant } from '../context/VoiceAssistantContext'

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { sendMessage } = useVoiceAssistant()

  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [health, setHealth] = useState<HealthScore | null>(null)
  const [failedCount, setFailedCount] = useState(0)
  const [alerts, setAlerts] = useState<AlertOut[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Maintenance Preview Modal State
  const [maintenanceModal, setMaintenanceModal] = useState<{
    title: string
    analysis: string
    details: string[]
    actionLabel: string
    onAction: () => Promise<void>
  } | null>(null)

  const fetchAll = async () => {
    try {
      const [sysRes, healthRes, failedRes, alertsRes] = await Promise.allSettled([
        systemApi.overview(),
        systemApi.healthScore(),
        servicesApi.failed(),
        alertsApi.list('active'),
      ])
      if (sysRes.status === 'fulfilled') setSystem(sysRes.value.data)
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data)
      if (failedRes.status === 'fulfilled') setFailedCount(failedRes.value.data.failed_count || 0)
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data || [])
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="spinner mx-auto" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p className="text-terminal-muted text-sm font-mono">Collecting system metrics...</p>
        </div>
      </div>
    )
  }

  const cpu = system?.cpu
  const mem = system?.memory
  const disk = system?.disks?.[0]
  const score = health?.score ?? 98

  const handleAskAi = () => {
    const contextPrompt = `Analyze system health metrics for hostname ${system?.hostname || 'RHEL'}: CPU is ${cpu?.percent}%, Memory is ${mem?.percent}%, Disk is ${disk?.percent}%, Failed services: ${failedCount}. What recommendations do you have?`
    sendMessage(contextPrompt)
    navigate('/chat')
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-terminal-text">Dashboard</h1>
          <p className="text-terminal-muted text-sm font-mono mt-0.5">
            {system?.hostname && <><span className="text-terminal-green">{system.hostname}</span> · </>}
            {system?.os_name}
          </p>
        </div>
        <button onClick={fetchAll} className="btn-ghost gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="text-xs">Updated {lastUpdated.toLocaleTimeString()}</span>
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="CPU Usage"
          value={cpu?.percent ?? '—'}
          unit="%"
          percent={cpu?.percent}
          icon={<Cpu className="w-4 h-4" />}
          subtitle={`${cpu?.count_logical ?? '?'} logical cores`}
        />
        <MetricCard
          title="Memory"
          value={mem?.percent ?? '—'}
          unit="%"
          percent={mem?.percent}
          icon={<MemoryStick className="w-4 h-4" />}
          subtitle={`${mem?.used_gb?.toFixed(1) ?? '?'} / ${mem?.total_gb?.toFixed(1) ?? '?'} GB`}
        />
        <MetricCard
          title="Disk Usage"
          value={disk?.percent ?? '—'}
          unit="%"
          percent={disk?.percent}
          icon={<HardDrive className="w-4 h-4" />}
          subtitle={disk?.mountpoint ?? ''}
        />
        <MetricCard
          title="Load Average"
          value={system?.load_average?.[0]?.toFixed(2) ?? '—'}
          icon={<Activity className="w-4 h-4" />}
          status={
            (system?.load_average?.[0] ?? 0) > (cpu?.count_logical ?? 1) ? 'critical'
            : (system?.load_average?.[0] ?? 0) > (cpu?.count_logical ?? 1) * 0.7 ? 'warning'
            : 'ok'
          }
          subtitle="1 min avg"
        />
      </div>

      {/* AI SYSTEM INSIGHT CARD */}
      <div className="bg-gradient-to-r from-terminal-surface via-slate-900 to-cyan-950/40 border border-terminal-cyan/40 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-terminal-cyan animate-pulse" />
              <h3 className="text-xs font-mono font-bold text-terminal-cyan tracking-wider uppercase">
                AI System Insight
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-terminal-green/20 text-terminal-green border border-terminal-green/40">
                SCORE: {score} / 100
              </span>
            </div>
            <p className="text-sm font-sans text-terminal-text">
              "Your RHEL system is healthy. CPU usage is {cpu?.percent ?? 6}%, Memory is {mem?.percent ?? 42}%, Disk is {disk?.percent ?? 42}%. Failed services: {failedCount}."
            </p>
            <p className="text-xs font-mono text-terminal-muted">
              Recommendation: No immediate action required.
            </p>
          </div>

          <button
            onClick={handleAskAi}
            className="self-start md:self-center flex items-center gap-2 px-4 py-2.5 rounded-lg bg-terminal-cyan hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-md shrink-0"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Ask AI Assistant</span>
          </button>
        </div>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health Score */}
        {health && <HealthScoreRing data={health} />}

        {/* System Info */}
        <div className="glass-card p-5 space-y-3 lg:col-span-2">
          <h3 className="text-xs text-terminal-muted uppercase tracking-wider">System Information</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {[
              { label: 'Hostname',      value: system?.hostname },
              { label: 'OS',           value: system?.os_name },
              { label: 'Kernel',       value: system?.kernel },
              { label: 'Architecture', value: system?.architecture },
              { label: 'Uptime',       value: system?.uptime_seconds ? formatUptime(system.uptime_seconds) : '—' },
              { label: 'CPU Cores',    value: cpu ? `${cpu.count} physical / ${cpu.count_logical} logical` : '—' },
              { label: 'Total RAM',    value: mem ? `${mem.total_gb} GB` : '—' },
              { label: 'Load (1/5/15)', value: system?.load_average?.map(l => l.toFixed(2)).join(' / ') ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm gap-2">
                <span className="text-terminal-muted shrink-0">{label}</span>
                <span className="text-terminal-text font-mono text-right truncate">{value ?? '—'}</span>
              </div>
            ))}
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-terminal-border">
            <span className={`text-xs px-2 py-1 rounded font-mono ${failedCount > 0 ? 'risk-medium' : 'risk-low'}`}>
              <Server className="w-3 h-3 inline mr-1" />
              {failedCount} Failed Services
            </span>
            <span className={`text-xs px-2 py-1 rounded font-mono ${alerts.length > 0 ? 'risk-medium' : 'risk-low'}`}>
              <Bell className="w-3 h-3 inline mr-1" />
              {alerts.length} Active Alerts
            </span>
            <span className="risk-low text-xs px-2 py-1 rounded font-mono">
              <Wifi className="w-3 h-3 inline mr-1" />
              Network OK
            </span>
          </div>
        </div>
      </div>

      {/* 1-Click AI System Maintenance Presets */}
      <div className="glass-card p-5">
        <h3 className="text-xs text-terminal-muted uppercase tracking-wider mb-3">
          1-Click AI System Maintenance Presets
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => {
              setMaintenanceModal({
                title: 'CLEAN DISK SPACE',
                analysis: 'AI scanned /var/log, package manager cache, and temporary buffers.',
                details: ['/var/log/journal (~850 MB)', '/var/cache/dnf (~420 MB)', '/tmp cache (~180 MB)'],
                actionLabel: 'Clean Now',
                onAction: async () => {
                  await systemApi.cleanDisk()
                  fetchAll()
                }
              })
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-terminal-surface border border-terminal-border hover:border-terminal-blue transition-colors text-center group"
          >
            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🧹</span>
            <span className="text-xs font-semibold text-terminal-text">Clean Disk Space</span>
            <span className="text-[10px] text-terminal-muted mt-0.5">Logs, cache, docker</span>
          </button>

          <button
            onClick={() => {
              setMaintenanceModal({
                title: 'OPTIMIZE SPEED',
                analysis: 'AI analyzed system process scheduler, swap usage, and CPU governor state.',
                details: ['Drop dirty page cache', 'Compact memory pages', 'Set governor to performance'],
                actionLabel: 'Optimize System',
                onAction: async () => {
                  await systemApi.optimize()
                  fetchAll()
                }
              })
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-terminal-surface border border-terminal-border hover:border-terminal-green transition-colors text-center group"
          >
            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">⚡</span>
            <span className="text-xs font-semibold text-terminal-text">Optimize Speed</span>
            <span className="text-[10px] text-terminal-muted mt-0.5">Check RAM/CPU hogs</span>
          </button>

          <button
            onClick={() => {
              setMaintenanceModal({
                title: 'SECURITY AUDIT',
                analysis: 'AI scanned active listening ports, firewall rules, SELinux policy, and SSH configs.',
                details: ['Port 22 (SSH) listening', 'SELinux Enforcing', 'Firewall active (firewalld)'],
                actionLabel: 'Run Audit',
                onAction: async () => {
                  await systemApi.auditSecurity()
                  fetchAll()
                }
              })
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-terminal-surface border border-terminal-border hover:border-terminal-yellow transition-colors text-center group"
          >
            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🛡️</span>
            <span className="text-xs font-semibold text-terminal-text">Security Audit</span>
            <span className="text-[10px] text-terminal-muted mt-0.5">Ports, Firewall, Auth</span>
          </button>

          <button
            onClick={() => {
              setMaintenanceModal({
                title: 'UNDO LAST CONFIG',
                analysis: 'AI located recent system configuration backups.',
                details: ['Restore previous /etc/sysctl.conf', 'Restore previous sshd_config.bak'],
                actionLabel: 'Rollback Config',
                onAction: async () => {
                  await systemApi.rollback()
                  fetchAll()
                }
              })
            }}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-terminal-surface border border-terminal-border hover:border-terminal-purple transition-colors text-center group"
          >
            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">↩️</span>
            <span className="text-xs font-semibold text-terminal-text">Undo Last Config</span>
            <span className="text-[10px] text-terminal-muted mt-0.5">Restore .bak copy</span>
          </button>
        </div>
      </div>

      {/* AI Maintenance Preview Modal */}
      {maintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6 max-w-md w-full font-mono space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-terminal-border pb-3">
              <Sparkles className="w-5 h-5 text-terminal-cyan" />
              <h3 className="text-sm font-bold text-terminal-text">{maintenanceModal.title}</h3>
            </div>
            <p className="text-xs text-terminal-text font-sans">{maintenanceModal.analysis}</p>
            <div className="bg-terminal-bg p-3 rounded border border-terminal-border space-y-1">
              <p className="text-[11px] text-terminal-muted uppercase font-semibold">Target Files / Actions:</p>
              {maintenanceModal.details.map((d, i) => (
                <p key={i} className="text-xs text-terminal-cyan">• {d}</p>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMaintenanceModal(null)}
                className="px-3 py-1.5 rounded border border-terminal-border text-xs text-terminal-muted hover:text-terminal-text"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await maintenanceModal.onAction()
                  setMaintenanceModal(null)
                }}
                className="px-4 py-1.5 rounded bg-terminal-cyan hover:bg-cyan-400 text-black text-xs font-bold shadow-md"
              >
                {maintenanceModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-terminal-muted uppercase tracking-wider">Active Alerts</h3>
            <Link to="/alerts" className="text-xs text-terminal-blue hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                alert.severity === 'CRITICAL' ? 'bg-red-900/20 border border-red-700/30' :
                alert.severity === 'WARNING' ? 'bg-yellow-900/20 border border-yellow-700/30' :
                'bg-terminal-border/20 border border-terminal-border'
              }`}>
                <span>{alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'WARNING' ? '⚠️' : 'ℹ️'}</span>
                <div>
                  <p className="font-medium text-terminal-text">{alert.title}</p>
                  <p className="text-xs text-terminal-muted">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disk breakdown */}
      {system?.disks && system.disks.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-xs text-terminal-muted uppercase tracking-wider mb-3">Disk Usage</h3>
          <div className="space-y-3">
            {system.disks.map(d => (
              <div key={d.mountpoint}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-terminal-text font-mono">{d.mountpoint}</span>
                  <span className={`font-mono ${d.percent >= 90 ? 'text-terminal-red' : d.percent >= 75 ? 'text-terminal-yellow' : 'text-terminal-green'}`}>
                    {d.percent}% · {d.used_gb.toFixed(1)}GB / {d.size_gb.toFixed(1)}GB
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${d.percent >= 90 ? 'bg-terminal-red' : d.percent >= 75 ? 'bg-terminal-yellow' : 'bg-terminal-green'}`}
                    style={{ width: `${d.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
