// LinuxAI — Tool Execution Step Component
// Shows each AI tool call inline in the chat

import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, ShieldAlert, Clock } from 'lucide-react'
import clsx from 'clsx'
import type { ToolExecutionStep } from '../types'

interface StepProps {
  step: ToolExecutionStep
  index: number
}

const riskBadge: Record<string, string> = {
  LOW:     'risk-low',
  MEDIUM:  'risk-medium',
  HIGH:    'risk-high',
  BLOCKED: 'risk-blocked',
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'success':          return <CheckCircle2 className="w-4 h-4 text-terminal-green" />
    case 'failure':          return <XCircle className="w-4 h-4 text-terminal-red" />
    case 'running':          return <Loader2 className="w-4 h-4 text-terminal-blue animate-spin" />
    case 'blocked':          return <ShieldAlert className="w-4 h-4 text-terminal-red" />
    case 'pending_approval': return <Clock className="w-4 h-4 text-terminal-yellow" />
    default:                 return <Loader2 className="w-4 h-4 text-terminal-muted" />
  }
}

export default function ToolExecutionStepComp({ step, index }: StepProps) {
  const [expanded, setExpanded] = useState(false)

  const resultStr = step.result
    ? JSON.stringify(step.result, null, 2).slice(0, 4096)
    : ''

  // Pull meaningful output from result
  const outputStr = step.result?.output as string
    || step.result?.raw as string
    || step.result?.log as string
    || resultStr

  return (
    <div className="border border-terminal-border rounded-lg overflow-hidden animate-fade-in">
      {/* Header Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-terminal-border/30 transition-colors text-left"
      >
        <StatusIcon status={step.status} />
        <span className="flex-1 font-mono text-xs text-terminal-text">
          {step.tool_name}
          {Object.keys(step.args).length > 0 && (
            <span className="text-terminal-muted ml-1">
              ({Object.entries(step.args).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(', ')})
            </span>
          )}
        </span>
        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-mono', riskBadge[step.risk_level] || 'risk-low')}>
          {step.risk_level}
        </span>
        {step.duration_ms && (
          <span className="text-[10px] text-terminal-muted font-mono">{Math.round(step.duration_ms)}ms</span>
        )}
        {expanded ? <ChevronDown className="w-3 h-3 text-terminal-muted" /> : <ChevronRight className="w-3 h-3 text-terminal-muted" />}
      </button>

      {/* Expanded Output */}
      {expanded && outputStr && (
        <div className="border-t border-terminal-border bg-terminal-bg">
          <pre className="px-3 py-2.5 text-xs text-terminal-text font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto leading-relaxed">
            {outputStr}
          </pre>
        </div>
      )}
    </div>
  )
}
