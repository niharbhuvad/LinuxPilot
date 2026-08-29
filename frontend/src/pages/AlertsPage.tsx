// LinuxAI — Alerts Page
import { useEffect, useState } from 'react'
import { alertsApi } from '../services/api'
import { Bell, RefreshCw, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'all'>('active')

  const fetch = async () => {
    setLoading(true)
    try { const res = await alertsApi.list(tab); setAlerts(res.data || []) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [tab])

  const resolve = async (id: string) => {
    await alertsApi.update(id, 'resolved')
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="p-6 h-full flex flex-col gap-4 overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alerts</h1>
        <button onClick={fetch} className="btn-ghost"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex gap-2">
        {(['active', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={clsx('px-3 py-1.5 text-sm rounded-lg border capitalize transition-all', tab === t ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue' : 'border-terminal-border text-terminal-muted')}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="spinner" /></div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-terminal-muted">
            <Bell className="w-10 h-10 opacity-30" />
            <p>No {tab} alerts</p>
          </div>
        ) : alerts.map(alert => (
          <div key={alert.id} className={clsx('glass-card p-4', {
            'border-red-700/40':    alert.severity === 'CRITICAL',
            'border-yellow-700/40': alert.severity === 'WARNING',
            'border-terminal-border': alert.severity === 'INFO',
          })}>
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">
                {alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'WARNING' ? '⚠️' : 'ℹ️'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-terminal-text">{alert.title}</h3>
                  <span className={clsx('text-xs font-mono px-1.5 py-0.5 rounded', {
                    'bg-red-900/40 text-terminal-red': alert.severity === 'CRITICAL',
                    'bg-yellow-900/40 text-terminal-yellow': alert.severity === 'WARNING',
                    'bg-blue-900/40 text-terminal-blue': alert.severity === 'INFO',
                  })}>{alert.severity}</span>
                  <span className="text-xs text-terminal-muted ml-auto">{new Date(alert.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-terminal-muted">{alert.message}</p>
                {alert.recommendation && (
                  <p className="text-xs text-terminal-blue mt-1.5">💡 {alert.recommendation}</p>
                )}
              </div>
              {alert.status === 'active' && (
                <button onClick={() => resolve(alert.id)} className="shrink-0 btn-ghost text-xs gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
