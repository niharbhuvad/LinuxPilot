// LinuxAI — Terminal Block Component
// Displays command output in a styled terminal-like block

import { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface TerminalBlockProps {
  command?: string
  output: string
  status?: 'success' | 'failure' | 'running' | 'pending'
  label?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export default function TerminalBlock({
  command, output, status = 'success', label, collapsible = false, defaultCollapsed = false
}: TerminalBlockProps) {
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const copy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusDot = {
    success: 'bg-terminal-green',
    failure: 'bg-terminal-red',
    running: 'bg-terminal-blue animate-pulse',
    pending: 'bg-terminal-yellow animate-pulse',
  }

  return (
    <div className="terminal-block animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-terminal-border">
        <span className={clsx('w-2 h-2 rounded-full shrink-0', statusDot[status])} />
        {collapsible && (
          <button onClick={() => setCollapsed(!collapsed)} className="text-terminal-muted hover:text-terminal-text">
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          {command && (
            <span className="text-terminal-green text-xs">
              <span className="text-terminal-muted">$ </span>{command}
            </span>
          )}
          {label && <span className="text-terminal-muted text-xs">{label}</span>}
        </div>
        <button
          onClick={copy}
          className="shrink-0 text-terminal-muted hover:text-terminal-text p-1 rounded transition-colors"
          title="Copy output"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Output */}
      {!collapsed && (
        <pre className="px-3 py-3 text-xs text-terminal-text overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto leading-relaxed">
          {output || <span className="text-terminal-muted italic">(no output)</span>}
        </pre>
      )}
    </div>
  )
}
