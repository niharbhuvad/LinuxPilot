// LinuxAI — Real-Time Process Monitor & Manager (top)
import { useEffect, useState } from 'react'
import { processesApi, sshApi } from '../services/api'
import {
  RefreshCw, Search, SortAsc, Activity, Cpu, HardDrive, AlertTriangle,
  Server, Monitor, Trash2, Eye, ShieldAlert, X, CheckCircle2, Play, Pause, AlertCircle
} from 'lucide-react'
import clsx from 'clsx'

type ProcessTarget = 'remote' | 'local'

export default function ProcessesPage() {
  const [target, setTarget] = useState<ProcessTarget>('remote')
  const [procs, setProcs] = useState<any[]>([])
  const [stats, setStats] = useState<{ total: number; running: number; sleeping: number; stopped: number; zombies: number }>({
    total: 0, running: 0, sleeping: 0, stopped: 0, zombies: 0
  })
  const [targetName, setTargetName] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'cpu' | 'memory'>('cpu')
  const [filter, setFilter] = useState('')
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(5) // 0 = off, 3, 5, 10
  const [sshConnected, setSshConnected] = useState(false)
  const [sshHost, setSshHost] = useState('')

  // Modals state
  const [inspectProc, setInspectProc] = useState<any | null>(null)
  const [killProcTarget, setKillProcTarget] = useState<any | null>(null)
  const [killSignal, setKillSignal] = useState<number>(15)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Check SSH status on load
  const checkSsh = async () => {
    try {
      const res = await sshApi.getConfig()
      const isConnected = res.data.status === 'CONNECTED'
      setSshConnected(isConnected)
      setSshHost(res.data.host || '')
      if (!isConnected) {
        setTarget('local')
      }
    } catch {
      setSshConnected(false)
      setTarget('local')
    }
  }

  const fetchProcesses = async () => {
    setLoading(true)
    try {
      const res = await processesApi.list(60, sortBy, target)
      const data = res.data
      setProcs(data.processes || [])
      setStats(data.stats || { total: 0, running: 0, sleeping: 0, stopped: 0, zombies: 0 })
      setTargetName(data.target_name || (target === 'remote' ? 'Connected Linux Target' : 'My PC Workstation'))
    } catch (err) {
      console.error('Failed to fetch processes', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkSsh()
  }, [])

  useEffect(() => {
    fetchProcesses()
  }, [target, sortBy])

  useEffect(() => {
    if (autoRefreshSec <= 0) return
    const timer = setInterval(fetchProcesses, autoRefreshSec * 1000)
    return () => clearInterval(timer)
  }, [target, sortBy, autoRefreshSec])

  const handleKillProc = async () => {
    if (!killProcTarget) return
    setActionLoading(true)
    setActionMessage(null)
    try {
      const res = await processesApi.kill(killProcTarget.pid, killSignal, target)
      setActionMessage(res.data.message)
      setTimeout(() => {
        setKillProcTarget(null)
        setActionMessage(null)
        fetchProcesses()
      }, 1200)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to kill process')
    } finally {
      setActionLoading(false)
    }
  }

  const filtered = procs.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    String(p.pid).includes(filter) ||
    (p.username && p.username.toLowerCase().includes(filter.toLowerCase())) ||
    (p.command && p.command.toLowerCase().includes(filter.toLowerCase()))
  )

  const topCpuProc = procs.length > 0 ? [...procs].sort((a, b) => b.cpu_percent - a.cpu_percent)[0] : null
  const topMemProc = procs.length > 0 ? [...procs].sort((a, b) => b.memory_percent - a.memory_percent)[0] : null

  return (
    <div className="p-6 h-full flex flex-col gap-5 overflow-hidden animate-fade-in font-mono">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-terminal-text flex items-center gap-2">
            <Activity className="w-6 h-6 text-terminal-green" />
            System Process Monitor (top)
          </h1>
          <p className="text-xs text-terminal-muted mt-0.5">
            Real-time process inspection, CPU/memory usage, and task management for remote Linux and local PC.
          </p>
        </div>

        {/* Target Switcher Tabs */}
        <div className="flex items-center bg-terminal-surface border border-terminal-border rounded-xl p-1 gap-1">
          <button
            onClick={() => setTarget('remote')}
            disabled={!sshConnected}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
              target === 'remote'
                ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/40 shadow'
                : 'text-terminal-muted hover:text-terminal-text disabled:opacity-40'
            )}
            title={sshConnected ? `Remote SSH Linux System (${sshHost})` : 'Remote SSH disconnected. Connect in Settings.'}
          >
            <Server className="w-4 h-4" />
            <span>Connected Linux System (SSH)</span>
            {sshConnected && <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />}
          </button>

          <button
            onClick={() => setTarget('local')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
              target === 'local'
                ? 'bg-terminal-blue/20 text-terminal-blue border border-terminal-blue/40 shadow'
                : 'text-terminal-muted hover:text-terminal-text'
            )}
          >
            <Monitor className="w-4 h-4" />
            <span>My PC Processes (Local Workstation)</span>
          </button>
        </div>
      </div>

      {/* Target & Summary Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass-card p-3 flex flex-col justify-between border-terminal-border">
          <span className="text-[10px] text-terminal-muted uppercase">ACTIVE TARGET</span>
          <span className="text-xs font-bold text-terminal-green truncate">{targetName}</span>
        </div>

        <div className="glass-card p-3 flex flex-col justify-between border-terminal-border">
          <span className="text-[10px] text-terminal-muted uppercase">TOTAL TASKS</span>
          <span className="text-lg font-bold text-terminal-text">{stats.total} <span className="text-xs text-terminal-muted">procs</span></span>
        </div>

        <div className="glass-card p-3 flex flex-col justify-between border-terminal-border">
          <span className="text-[10px] text-terminal-muted uppercase">RUNNING / SLEEPING</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-terminal-green">{stats.running} R</span>
            <span className="text-xs text-terminal-muted">{stats.sleeping} S</span>
          </div>
        </div>

        <div className="glass-card p-3 flex flex-col justify-between border-terminal-border">
          <span className="text-[10px] text-terminal-muted uppercase">TOP CPU CONSUMER</span>
          <span className="text-xs font-bold text-terminal-yellow truncate">{topCpuProc ? `${topCpuProc.name} (${topCpuProc.cpu_percent}%)` : '-'}</span>
        </div>

        <div className="glass-card p-3 flex flex-col justify-between border-terminal-border">
          <span className="text-[10px] text-terminal-muted uppercase">TOP MEM CONSUMER</span>
          <span className="text-xs font-bold text-terminal-blue truncate">{topMemProc ? `${topMemProc.name} (${topMemProc.memory_percent}%)` : '-'}</span>
        </div>
      </div>

      {/* Controls & Filter Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search by PID, Name, User, Command..."
              className="bg-terminal-bg border border-terminal-border rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-terminal-text focus:outline-none focus:border-terminal-blue w-64"
            />
          </div>

          {/* Sort Switcher */}
          <button
            onClick={() => setSortBy(s => (s === 'cpu' ? 'memory' : 'cpu'))}
            className="px-3 py-1.5 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text text-xs font-mono flex items-center gap-1.5"
          >
            <SortAsc className="w-3.5 h-3.5 text-terminal-blue" />
            <span>Sort: <strong className="text-terminal-text">{sortBy.toUpperCase()}</strong></span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-1.5 text-xs text-terminal-muted">
            <span>Auto Refresh:</span>
            <select
              value={autoRefreshSec}
              onChange={e => setAutoRefreshSec(Number(e.target.value))}
              className="bg-terminal-bg border border-terminal-border rounded-lg px-2 py-1 text-xs text-terminal-text focus:outline-none focus:border-terminal-blue"
            >
              <option value={0}>OFF</option>
              <option value={3}>Every 3s</option>
              <option value={5}>Every 5s</option>
              <option value={10}>Every 10s</option>
            </select>
          </div>

          <button
            onClick={fetchProcesses}
            disabled={loading}
            className="p-2 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text transition-colors"
            title="Refresh Processes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Processes Table */}
      <div className="flex-1 overflow-y-auto glass-card border border-terminal-border rounded-xl">
        {loading && procs.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-terminal-muted text-xs gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-terminal-green" />
            <span>Retrieving live process list from {target === 'remote' ? 'connected Linux target' : 'local PC'}...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-terminal-muted text-xs">
            No processes match query "{filter}"
          </div>
        ) : (
          <table className="w-full text-xs text-left font-mono">
            <thead className="sticky top-0 bg-terminal-surface border-b border-terminal-border text-terminal-muted uppercase text-[10px] tracking-wider z-10">
              <tr>
                <th className="px-3 py-2.5 w-16 text-right">PID</th>
                <th className="px-3 py-2.5">PROCESS NAME</th>
                <th className="px-3 py-2.5">USER</th>
                <th className="px-3 py-2.5 w-20 text-right">CPU %</th>
                <th className="px-3 py-2.5 w-20 text-right">MEM %</th>
                <th className="px-3 py-2.5 w-24 text-right">MEM (MB)</th>
                <th className="px-3 py-2.5 w-24">STATUS</th>
                <th className="px-3 py-2.5">COMMAND LINE</th>
                <th className="px-3 py-2.5 w-28 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border/50">
              {filtered.map((p: any) => (
                <tr key={p.pid} className="hover:bg-terminal-border/30 transition-colors group">
                  <td className="px-3 py-2 text-right text-terminal-muted font-bold">{p.pid}</td>
                  <td className="px-3 py-2 font-bold text-terminal-text truncate max-w-[160px]" title={p.name}>
                    {p.name}
                  </td>
                  <td className="px-3 py-2 text-terminal-muted">{p.username}</td>
                  <td className={clsx('px-3 py-2 text-right font-bold', p.cpu_percent > 50 ? 'text-terminal-red' : p.cpu_percent > 20 ? 'text-terminal-yellow' : 'text-terminal-green')}>
                    {p.cpu_percent.toFixed(1)}%
                  </td>
                  <td className={clsx('px-3 py-2 text-right font-bold', p.memory_percent > 20 ? 'text-terminal-red' : p.memory_percent > 10 ? 'text-terminal-yellow' : 'text-terminal-text')}>
                    {p.memory_percent.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-terminal-muted">{p.memory_mb.toFixed(0)} MB</td>
                  <td className="px-3 py-2">
                    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', p.status === 'running' || p.status === 'run' ? 'bg-terminal-green/20 text-terminal-green' : p.status === 'zombie' ? 'bg-red-950 text-red-400' : 'bg-terminal-border/40 text-terminal-muted')}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-terminal-muted text-[11px] truncate max-w-[260px]" title={p.command}>
                    {p.command}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        onClick={() => setInspectProc(p)}
                        className="p-1 rounded hover:bg-terminal-border text-terminal-muted hover:text-terminal-blue transition-colors"
                        title="Inspect Process Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setKillProcTarget(p)}
                        className="p-1 rounded hover:bg-red-950 text-terminal-muted hover:text-red-400 transition-colors"
                        title="Terminate / Kill Process"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Inspect Process Modal */}
      {inspectProc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-terminal-bg border border-terminal-border rounded-xl p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-terminal-border pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-terminal-blue" />
                <h3 className="text-sm font-bold text-terminal-text">Process Details — PID {inspectProc.pid}</h3>
              </div>
              <button onClick={() => setInspectProc(null)} className="text-terminal-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-terminal-surface/60 border border-terminal-border">
                <div>
                  <span className="text-terminal-muted text-[10px] block uppercase">PROCESS NAME</span>
                  <span className="font-bold text-terminal-green text-sm">{inspectProc.name}</span>
                </div>
                <div>
                  <span className="text-terminal-muted text-[10px] block uppercase">PROCESS ID (PID)</span>
                  <span className="font-bold text-terminal-text">{inspectProc.pid} (PPID: {inspectProc.ppid})</span>
                </div>
                <div>
                  <span className="text-terminal-muted text-[10px] block uppercase">CPU USAGE</span>
                  <span className="font-bold text-terminal-yellow">{inspectProc.cpu_percent}%</span>
                </div>
                <div>
                  <span className="text-terminal-muted text-[10px] block uppercase">MEMORY USAGE</span>
                  <span className="font-bold text-terminal-blue">{inspectProc.memory_mb} MB ({inspectProc.memory_percent}%)</span>
                </div>
                <div>
                  <span className="text-terminal-muted text-[10px] block uppercase">USER / OWNER</span>
                  <span className="text-terminal-text">{inspectProc.username}</span>
                </div>
                <div>
                  <span className="text-terminal-muted text-[10px] block uppercase">STATUS</span>
                  <span className="text-terminal-green uppercase font-bold">{inspectProc.status}</span>
                </div>
              </div>

              <div>
                <span className="text-terminal-muted text-[10px] block uppercase mb-1">COMMAND LINE</span>
                <div className="p-3 rounded-lg bg-terminal-bg border border-terminal-border text-terminal-green break-all text-xs font-mono">
                  {inspectProc.command}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-terminal-border flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setKillProcTarget(inspectProc)
                  setInspectProc(null)
                }}
                className="px-3.5 py-1.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 hover:bg-red-900/40 text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Kill Process
              </button>

              <button
                type="button"
                onClick={() => setInspectProc(null)}
                className="px-4 py-1.5 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kill Process Confirmation Modal */}
      {killProcTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-terminal-bg border border-red-800/60 rounded-xl p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-terminal-border pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold">Terminate Process PID {killProcTarget.pid}</h3>
              </div>
              <button onClick={() => setKillProcTarget(null)} className="text-terminal-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionMessage ? (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-terminal-green/40 text-terminal-green text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{actionMessage}</span>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-terminal-muted">
                  Are you sure you want to terminate <strong className="text-terminal-text">{killProcTarget.name}</strong> (PID: {killProcTarget.pid}) on <strong className="text-terminal-green">{targetName}</strong>?
                </p>

                <div className="p-3 rounded-lg bg-terminal-surface border border-terminal-border space-y-2">
                  <label className="block text-[10px] text-terminal-muted uppercase">SELECT KILL SIGNAL</label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-terminal-text">
                      <input
                        type="radio"
                        name="signal"
                        value={15}
                        checked={killSignal === 15}
                        onChange={() => setKillSignal(15)}
                        className="accent-terminal-blue"
                      />
                      <span>SIGTERM (15) — Graceful Termination</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-red-400">
                      <input
                        type="radio"
                        name="signal"
                        value={9}
                        checked={killSignal === 9}
                        onChange={() => setKillSignal(9)}
                        className="accent-red-500"
                      />
                      <span>SIGKILL (9) — Immediate Force Kill</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setKillProcTarget(null)}
                    className="px-4 py-2 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleKillProc}
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>{killSignal === 9 ? 'Force Kill (9)' : 'Terminate (15)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
