// LinuxAI — Command History Page
import { useEffect, useState } from 'react'
import { commandsApi } from '../services/api'
import { RefreshCw, Check, X, Clock } from 'lucide-react'
import clsx from 'clsx'

export default function HistoryPage() {
  const [commands, setCommands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    try { const res = await commandsApi.history(100); setCommands(res.data || []) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  return (
    <div className="p-6 h-full flex flex-col gap-4 overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Command History</h1>
        <button onClick={fetch} className="btn-ghost"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto glass-card divide-y divide-terminal-border">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="spinner" /></div>
        ) : commands.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-terminal-muted">No command history yet</div>
        ) : commands.map((cmd: any) => (
          <div key={cmd.id} className="px-4 py-3 hover:bg-terminal-border/10 transition-colors">
            <div className="flex items-center gap-3 flex-wrap">
              {cmd.status === 'success'
                ? <Check className="w-4 h-4 text-terminal-green shrink-0" />
                : cmd.status === 'failure' ? <X className="w-4 h-4 text-terminal-red shrink-0" />
                : <Clock className="w-4 h-4 text-terminal-yellow shrink-0" />
              }
              <code className="font-mono text-sm text-terminal-text flex-1 truncate">{cmd.command}</code>
              <span className={clsx('text-xs font-mono px-1.5 py-0.5 rounded', {
                'risk-low': cmd.risk_level === 'LOW',
                'risk-medium': cmd.risk_level === 'MEDIUM',
                'risk-high': cmd.risk_level === 'HIGH',
              })}>{cmd.risk_level}</span>
              <span className="text-xs text-terminal-muted font-mono">{Math.round(cmd.duration_ms)}ms</span>
              <span className="text-xs text-terminal-muted">{new Date(cmd.created_at).toLocaleString()}</span>
            </div>
            {cmd.tool_name && <p className="text-xs text-terminal-muted mt-1 pl-7">Tool: {cmd.tool_name}</p>}
            {cmd.stderr && <p className="text-xs text-terminal-red mt-1 pl-7 font-mono truncate">{cmd.stderr.slice(0, 120)}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
