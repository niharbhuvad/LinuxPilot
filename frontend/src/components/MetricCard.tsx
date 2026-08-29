// LinuxAI — Metric Card Component
import clsx from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  percent?: number
  icon?: React.ReactNode
  status?: 'ok' | 'warning' | 'critical' | 'unknown'
  subtitle?: string
  trend?: 'up' | 'down' | 'stable'
}

const statusColors = {
  ok:       'text-terminal-green',
  warning:  'text-terminal-yellow',
  critical: 'text-terminal-red',
  unknown:  'text-terminal-muted',
}

const progressColors = {
  ok:       'bg-terminal-green',
  warning:  'bg-terminal-yellow',
  critical: 'bg-terminal-red',
  unknown:  'bg-terminal-muted',
}

function getStatus(percent?: number): 'ok' | 'warning' | 'critical' | 'unknown' {
  if (percent === undefined) return 'unknown'
  if (percent >= 90) return 'critical'
  if (percent >= 75) return 'warning'
  return 'ok'
}

export default function MetricCard({
  title, value, unit, percent, icon, status, subtitle, trend,
}: MetricCardProps) {
  const computedStatus = status ?? getStatus(percent)
  const colorClass = statusColors[computedStatus]
  const progressColor = progressColors[computedStatus]

  return (
    <div className="metric-card animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs text-terminal-muted uppercase tracking-wider font-mono">{title}</span>
        <div className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-terminal-red" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-terminal-green" />}
          {trend === 'stable' && <Minus className="w-3 h-3 text-terminal-muted" />}
          {icon && <span className={clsx('text-lg', colorClass)}>{icon}</span>}
        </div>
      </div>

      <div className="flex items-end gap-1.5">
        <span className={clsx('text-3xl font-bold font-mono', colorClass)}>{value}</span>
        {unit && <span className="text-terminal-muted text-sm mb-1">{unit}</span>}
      </div>

      {percent !== undefined && (
        <div className="progress-bar">
          <div
            className={clsx('progress-bar-fill', progressColor)}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}

      {subtitle && (
        <p className="text-xs text-terminal-muted mt-1">{subtitle}</p>
      )}
    </div>
  )
}
