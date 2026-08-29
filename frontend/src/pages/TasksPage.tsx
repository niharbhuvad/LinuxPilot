// LinuxAI — Scheduled Tasks & Jobs Page
import React, { useEffect, useState } from 'react'
import { tasksApi, commandsApi } from '../services/api'
import {
  Calendar, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2,
  Play, Clock, CheckCircle2, AlertCircle, X, Sparkles, Terminal
} from 'lucide-react'

interface TaskItem {
  id: string
  name: string
  description?: string
  schedule: string
  actions?: string[]
  enabled: boolean
  last_run?: string
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [systemCronOutput, setSystemCronOutput] = useState<string>('')

  // Create Task Modal State
  const [showModal, setShowModal] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskSchedule, setTaskSchedule] = useState('0 * * * *')
  const [taskAction, setTaskAction] = useState('df -h')
  const [submitting, setSubmitting] = useState(false)

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await tasksApi.list()
      setTasks(res.data || [])
    } catch (err) {
      console.error('Failed to load tasks', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSystemCron = async () => {
    try {
      const res = await commandsApi.execute('crontab -l')
      setSystemCronOutput(res.data.stdout || 'No system crontab entries configured.')
    } catch (err) {
      setSystemCronOutput('No crontab entries found for current user.')
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchSystemCron()
  }, [])

  const handleToggle = async (task: TaskItem) => {
    try {
      await tasksApi.update(task.id, { enabled: !task.enabled })
      fetchTasks()
    } catch (err) {
      console.error('Failed to toggle task', err)
    }
  }

  const handleRemove = async (id: string) => {
    if (confirm('Are you sure you want to delete this scheduled task?')) {
      try {
        await tasksApi.delete(id)
        fetchTasks()
      } catch (err) {
        console.error('Failed to delete task', err)
      }
    }
  }

  const handleRunNow = async (task: TaskItem) => {
    setRunningTaskId(task.id)
    try {
      const cmdToRun = task.actions && task.actions.length > 0 ? task.actions[0] : 'uptime'
      await commandsApi.execute(cmdToRun)
      await tasksApi.update(task.id, { last_run: new Date().toISOString() })
      fetchTasks()
    } catch (err) {
      console.error('Failed to run task now', err)
    } finally {
      setRunningTaskId(null)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskName || !taskSchedule || !taskAction) return
    setSubmitting(true)
    try {
      await tasksApi.create({
        name: taskName,
        description: taskDesc,
        schedule: taskSchedule,
        actions: [taskAction],
        enabled: true,
      })
      setShowModal(false)
      setTaskName('')
      setTaskDesc('')
      fetchTasks()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  const applyPreset = (preset: { name: string; desc: string; sched: string; action: string }) => {
    setTaskName(preset.name)
    setTaskDesc(preset.desc)
    setTaskSchedule(preset.sched)
    setTaskAction(preset.action)
    setShowModal(true)
  }

  const presets = [
    { name: 'Hourly Disk Check', desc: 'Check storage usage every hour', sched: '0 * * * *', action: 'df -h' },
    { name: 'Daily /tmp Cleanup', desc: 'Remove old temporary log files', sched: '0 2 * * *', action: 'find /tmp -type f -mtime +7 -delete' },
    { name: 'Service Health Check', desc: 'Verify Nginx service status every 6 hours', sched: '0 */6 * * *', action: 'systemctl status nginx' },
    { name: 'Weekly Journal Vacuum', desc: 'Trim systemd journal logs to 7 days', sched: '0 3 * * 0', action: 'journalctl --vacuum-time=7d' },
  ]

  return (
    <div className="p-6 h-full flex flex-col space-y-5 overflow-hidden animate-fade-in font-mono relative">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-5 border border-terminal-border rounded-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-terminal-green/10 border border-terminal-green/30 text-terminal-green">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-terminal-text flex items-center gap-2">
              Scheduled Tasks & Cron Jobs
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-terminal-green/20 text-terminal-green border border-terminal-green/30 font-semibold">
                {tasks.length} Active
              </span>
            </h1>
            <p className="text-xs text-terminal-muted mt-0.5">
              Manage recurring AI system checks, cron jobs, disk cleanup scripts, and health monitors.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-terminal-green text-black hover:bg-terminal-green/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Scheduled Task
          </button>

          <button
            onClick={() => { fetchTasks(); fetchSystemCron(); }}
            disabled={loading}
            className="p-2 rounded-lg bg-terminal-surface hover:bg-terminal-border border border-terminal-border text-terminal-muted hover:text-terminal-text transition-colors"
            title="Refresh Tasks"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Preset Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs shrink-0">
        <span className="text-terminal-muted text-[11px] shrink-0 font-sans font-medium uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-terminal-blue" /> Quick Templates:
        </span>
        {presets.map(p => (
          <button
            key={p.name}
            onClick={() => applyPreset(p)}
            className="px-3 py-1.5 rounded-lg bg-terminal-surface hover:bg-terminal-border border border-terminal-border text-terminal-text hover:text-terminal-green transition-all shrink-0 text-xs flex items-center gap-1.5 font-mono"
          >
            <Plus className="w-3 h-3 text-terminal-green" />
            {p.name}
          </button>
        ))}
      </div>

      {/* Main Viewport Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        {/* Tasks List Column */}
        <div className="lg:col-span-2 glass-card border border-terminal-border rounded-xl p-4 overflow-y-auto bg-black/40 space-y-3">
          <h3 className="text-xs font-bold text-terminal-muted uppercase tracking-wider mb-2">
            Active LinuxAI Scheduled Daemon Tasks
          </h3>

          {loading ? (
            <div className="flex items-center justify-center h-48 text-terminal-muted gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-terminal-green" />
              <span>Loading scheduled jobs...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-terminal-muted">
              <Calendar className="w-10 h-10 opacity-30" />
              <p className="text-sm font-semibold">No scheduled tasks created yet.</p>
              <p className="text-xs max-w-sm text-center">
                Click <span className="text-terminal-green font-bold">Create Scheduled Task</span> above or pick a quick template to start automated server maintenance!
              </p>
            </div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="p-4 rounded-xl bg-terminal-surface/60 border border-terminal-border hover:border-terminal-border/80 transition-all space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-terminal-text text-sm truncate">{task.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${task.enabled ? 'text-terminal-green bg-terminal-green/15 border border-terminal-green/30' : 'text-terminal-muted bg-terminal-border/30'}`}>
                        {task.enabled ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </div>
                    {task.description && <p className="text-xs text-terminal-muted leading-relaxed">{task.description}</p>}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRunNow(task)}
                      disabled={runningTaskId === task.id}
                      className="px-2.5 py-1 text-xs rounded bg-terminal-green/20 hover:bg-terminal-green/30 text-terminal-green border border-terminal-green/40 font-mono transition-colors flex items-center gap-1"
                      title="Run Command Now"
                    >
                      <Play className={`w-3 h-3 ${runningTaskId === task.id ? 'animate-spin' : ''}`} />
                      <span>{runningTaskId === task.id ? 'Running...' : 'Run Now'}</span>
                    </button>

                    <button
                      onClick={() => handleToggle(task)}
                      className="p-1.5 rounded hover:bg-terminal-border text-terminal-muted hover:text-terminal-text transition-colors"
                      title={task.enabled ? 'Disable Task' : 'Enable Task'}
                    >
                      {task.enabled ? <ToggleRight className="w-5 h-5 text-terminal-green" /> : <ToggleLeft className="w-5 h-5 text-terminal-muted" />}
                    </button>

                    <button
                      onClick={() => handleRemove(task.id)}
                      className="p-1.5 rounded hover:bg-red-950/40 text-terminal-muted hover:text-red-400 transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-2 border-t border-terminal-border/40 text-terminal-muted">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-terminal-blue" />
                    <span>Cron: <code className="text-terminal-blue font-bold">{task.schedule}</code></span>
                  </div>
                  {task.actions && task.actions.length > 0 && (
                    <div className="flex items-center gap-1.5 truncate max-w-xs">
                      <Terminal className="w-3.5 h-3.5 text-terminal-green" />
                      <span className="truncate">Action: <code className="text-terminal-text">{task.actions.join(', ')}</code></span>
                    </div>
                  )}
                  {task.last_run && (
                    <span className="ml-auto text-[11px] text-terminal-muted/70">
                      Last executed: {new Date(task.last_run).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Live System Crontab Column */}
        <div className="glass-card border border-terminal-border rounded-xl p-4 flex flex-col space-y-3 bg-black/40">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-terminal-muted uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-terminal-blue" />
              Live Host System Crontab (`crontab -l`)
            </h3>
            <button onClick={fetchSystemCron} className="text-terminal-muted hover:text-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <pre className="flex-1 p-3 rounded-lg bg-terminal-bg border border-terminal-border text-xs text-terminal-green font-mono whitespace-pre-wrap leading-relaxed overflow-y-auto">
            {systemCronOutput}
          </pre>
        </div>
      </div>

      {/* Modal for Creating Scheduled Task */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-terminal-bg border border-terminal-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-terminal-border pb-3">
              <h3 className="text-base font-bold text-terminal-text flex items-center gap-2">
                <Calendar className="w-5 h-5 text-terminal-green" />
                Create New Scheduled Task
              </h3>
              <button onClick={() => setShowModal(false)} className="text-terminal-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-terminal-muted mb-1">TASK NAME *</label>
                <input
                  type="text"
                  required
                  value={taskName}
                  onChange={e => setTaskName(e.target.value)}
                  placeholder="e.g. Check storage space hourly"
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-green"
                />
              </div>

              <div>
                <label className="block text-terminal-muted mb-1">DESCRIPTION (OPTIONAL)</label>
                <input
                  type="text"
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  placeholder="e.g. Automated maintenance job"
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-green"
                />
              </div>

              <div>
                <label className="block text-terminal-muted mb-1">CRON SCHEDULE EXPRESSION *</label>
                <input
                  type="text"
                  required
                  value={taskSchedule}
                  onChange={e => setTaskSchedule(e.target.value)}
                  placeholder="e.g. 0 * * * * (Every hour) or 0 2 * * * (Daily at 2AM)"
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-green text-terminal-blue font-bold"
                />
                <p className="text-[10px] text-terminal-muted mt-1">Format: min hour day month day-of-week</p>
              </div>

              <div>
                <label className="block text-terminal-muted mb-1">COMMAND / ACTION TO EXECUTE *</label>
                <input
                  type="text"
                  required
                  value={taskAction}
                  onChange={e => setTaskAction(e.target.value)}
                  placeholder="e.g. df -h or systemctl status nginx"
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-green"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-terminal-green text-black font-bold hover:bg-terminal-green/90 transition-colors flex items-center gap-2"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
