// LinuxAI — Approval Modal
// Shows for MEDIUM and HIGH risk commands requiring user confirmation

import { useState } from 'react'
import { AlertTriangle, ShieldAlert, X, Check } from 'lucide-react'
import clsx from 'clsx'
import type { ApprovalOut } from '../types'

interface ApprovalModalProps {
  approval: ApprovalOut
  onApprove: (confirmText?: string) => void
  onReject: () => void
}

export default function ApprovalModal({ approval, onApprove, onReject }: ApprovalModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const isHigh = approval.risk_level === 'HIGH'
  const isDoubleConfirm = approval.requires_double_confirm
  const canApprove = !isDoubleConfirm || confirmText.toUpperCase().includes('CONFIRM DELETE')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={clsx(
        'w-full max-w-lg mx-4 rounded-xl border p-6 shadow-2xl animate-slide-up',
        isHigh
          ? 'bg-red-950/90 border-red-700/60 glow-red'
          : 'bg-yellow-950/80 border-yellow-700/60 glow-yellow'
      )}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          {isHigh
            ? <ShieldAlert className="w-7 h-7 text-terminal-red" />
            : <AlertTriangle className="w-7 h-7 text-terminal-yellow" />
          }
          <div>
            <h2 className={clsx('font-bold text-lg', isHigh ? 'text-terminal-red' : 'text-terminal-yellow')}>
              {isHigh ? '⚠ DANGER — High Risk Operation' : 'Confirmation Required'}
            </h2>
            <p className="text-xs text-terminal-muted">{approval.action_description}</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-5">
          <div className="bg-terminal-bg rounded-lg p-3 space-y-2">
            <Row label="Reason" value={approval.reason} />
            <Row label="Risk Level" value={approval.risk_level} />
            {approval.expected_effect && <Row label="Expected Effect" value={approval.expected_effect} />}
          </div>

          <div className="bg-terminal-bg rounded-lg p-3">
            <p className="text-xs text-terminal-muted mb-1.5">Command to execute:</p>
            <code className="text-xs font-mono text-terminal-green">{approval.command}</code>
          </div>
        </div>

        {/* Double confirm */}
        {isDoubleConfirm && (
          <div className="mb-5">
            <p className="text-xs text-terminal-red mb-2">
              This is a destructive operation. Type <strong className="font-mono">CONFIRM DELETE</strong> to proceed:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="CONFIRM DELETE"
              className="w-full bg-terminal-bg border border-red-700/50 rounded-lg px-3 py-2 text-sm font-mono text-terminal-text focus:outline-none focus:border-terminal-red"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onReject} className="btn-ghost flex-1">
            <X className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={() => onApprove(confirmText || undefined)}
            disabled={!canApprove}
            className={clsx(
              'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-150',
              isHigh
                ? 'bg-red-600 hover:bg-red-500 text-white disabled:opacity-40'
                : 'bg-yellow-500 hover:bg-yellow-400 text-black disabled:opacity-40',
              !canApprove && 'cursor-not-allowed'
            )}
          >
            <Check className="w-4 h-4" />
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-terminal-muted w-28 shrink-0">{label}:</span>
      <span className="text-terminal-text">{value}</span>
    </div>
  )
}
