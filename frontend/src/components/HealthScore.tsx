// LinuxAI — Health Score Ring Component
import clsx from 'clsx'
import type { HealthScore } from '../types'

interface HealthScoreProps {
  data: HealthScore
}

const gradeColors: Record<string, string> = {
  A: '#00ff9f',
  B: '#4d9fff',
  C: '#ffd666',
  D: '#ff9940',
  F: '#ff4d4f',
}

export default function HealthScoreRing({ data }: HealthScoreProps) {
  const { score, grade, components, alerts } = data
  const color = gradeColors[grade] || '#8b949e'
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="glass-card p-6 flex flex-col items-center gap-4">
      <h3 className="text-xs text-terminal-muted uppercase tracking-wider self-start">System Health</h3>

      {/* Ring */}
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#30363d" strokeWidth="10" />
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="health-ring"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-3xl" style={{ color }}>{score}</span>
          <span className="text-terminal-muted text-xs">/ 100</span>
          <span className="font-bold text-sm mt-0.5" style={{ color }}>Grade {grade}</span>
        </div>
      </div>

      {/* Components */}
      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2">
        {Object.entries(components).map(([key, comp]) => (
          <div key={key} className="flex items-center justify-between text-xs min-w-0">
            <span className="text-terminal-muted capitalize shrink-0">{key}</span>
            <span
              className="font-mono font-medium truncate ml-2 text-right"
              style={{ color: comp.score === comp.max ? '#00ff9f' : comp.score >= comp.max * 0.5 ? '#ffd666' : '#ff4d4f' }}
              title={String(comp.value)}
            >
              {String(comp.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="w-full space-y-1">
          {alerts.slice(0, 3).map((alert, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-terminal-yellow">
              <span>⚠</span>
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
