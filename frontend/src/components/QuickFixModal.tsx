// LinuxAI — VS Code-Style AI Quick Fix Modal Component
import React, { useState, useEffect } from 'react'
import {
  Lightbulb,
  X,
  Play,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  GraduationCap,
  Terminal,
  ExternalLink,
  Info,
  HelpCircle,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react'

export interface QuickFixData {
  id: string
  command: string
  why_failed: string
  root_cause: string
  recommended_fix: string
  fix_command: string
  risk_level: string // LOW | MEDIUM | HIGH | DANGEROUS
  requires_sudo: boolean
  is_dangerous: boolean
  verification_command?: string
  diagnostic_commands?: string[]
  rhcsa_concept?: string
  rhcsa_exam_tip?: string
}

interface QuickFixModalProps {
  isOpen: boolean
  data: QuickFixData | null
  loading?: boolean
  error?: string | null
  onClose: () => void
  onRunFix: (command: string) => void
  onAskAI?: (command: string, stderr: string) => void
}

export default function QuickFixModal({
  isOpen,
  data,
  loading = false,
  error = null,
  onClose,
  onRunFix,
  onAskAI,
}: QuickFixModalProps) {
  const [copied, setCopied] = useState(false)
  const [showRhcsaMode, setShowRhcsaMode] = useState(true)
  const [confirmDangerous, setConfirmDangerous] = useState(false)

  // Listen for Esc key to close popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Reset dangerous confirmation state when data changes
  useEffect(() => {
    setConfirmDangerous(false)
    setCopied(false)
  }, [data])

  if (!isOpen) return null

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExecute = (cmdToRun: string) => {
    if ((data?.is_dangerous || data?.risk_level === 'HIGH' || data?.risk_level === 'DANGEROUS') && !confirmDangerous) {
      setConfirmDangerous(true)
      return
    }
    onRunFix(cmdToRun)
    onClose()
  }

  const getRiskBadge = (risk: string, dangerous: boolean) => {
    if (dangerous || risk === 'DANGEROUS') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1 animate-pulse">
          <ShieldAlert className="w-3 h-3" /> DANGEROUS
        </span>
      )
    }
    if (risk === 'HIGH') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> HIGH RISK
        </span>
      )
    }
    if (risk === 'MEDIUM') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 flex items-center gap-1">
          <Info className="w-3 h-3" /> MEDIUM RISK
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" /> LOW RISK
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-mono">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-terminal-border rounded-2xl shadow-2xl overflow-hidden text-terminal-text flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border/80 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm animate-bounce-subtle">
              <Lightbulb className="w-5 h-5 fill-amber-400/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AI Quick Fix
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-terminal-blue/20 text-terminal-blue border border-terminal-blue/30 font-sans">
                  Ctrl + .
                </span>
              </div>
              {data && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 truncate max-w-md">
                  Failed command:{' '}
                  <span className="text-amber-300 font-semibold truncate">
                    {data.command}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRhcsaMode(!showRhcsaMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-sans transition-all border ${
                showRhcsaMode
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-semibold'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Toggle RHCSA Exam Learning Mode"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              RHCSA Mode
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <span className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-amber-300 text-xs font-sans animate-pulse">
                Analyzing stderr, system logs & privileges...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 space-y-2">
              <p className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Quick Fix Analysis Error
              </p>
              <p className="text-xs text-red-400/90">{error}</p>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Cause & Root Cause Box */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-amber-400/90 font-sans font-bold flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" /> Why it failed
                    </span>
                    <p className="text-sm font-semibold text-slate-100 leading-snug">
                      {data.why_failed}
                    </p>
                  </div>
                  {getRiskBadge(data.risk_level, data.is_dangerous)}
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-slate-300 leading-relaxed text-[11px]">
                  <span className="text-slate-400 font-semibold font-sans">
                    Root Cause:{' '}
                  </span>
                  {data.root_cause}
                </div>
              </div>

              {/* Recommended Fix Command Box */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Terminal className="w-3.5 h-3.5" /> Recommended Fix
                  </span>

                  {data.requires_sudo && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-sans font-semibold">
                      Sudo Required
                    </span>
                  )}
                </div>

                <div className="relative group">
                  <pre className="p-3 rounded-lg bg-black/60 border border-slate-800 text-amber-200 text-sm font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {data.fix_command}
                  </pre>
                </div>

                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  {data.recommended_fix}
                </p>
              </div>

              {/* Safety Warning Confirmation if Dangerous */}
              {confirmDangerous && (
                <div className="p-3.5 rounded-xl bg-red-950/60 border-2 border-red-500/80 text-red-200 space-y-2 animate-shake">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs font-sans">
                    <ShieldAlert className="w-4 h-4" />
                    High Risk / Destructive Operation Warning
                  </div>
                  <p className="text-[11px] text-red-300/90 font-sans">
                    This command performs a high-risk system modification (e.g. destructive storage, privilege alteration, or network disruption). Verify your intent before proceeding.
                  </p>
                  <div className="flex items-center gap-2 pt-1 font-sans">
                    <button
                      onClick={() => handleExecute(data.fix_command)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors shadow-md"
                    >
                      I Understand, Run Command
                    </button>
                    <button
                      onClick={() => setConfirmDangerous(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Verification & Diagnostics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
                {data.verification_command && (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1 font-mono">
                    <span className="text-[10px] font-sans uppercase font-bold text-slate-400 tracking-wider">
                      Verification Command
                    </span>
                    <div className="flex items-center justify-between text-xs text-emerald-400 bg-black/40 px-2.5 py-1.5 rounded border border-slate-800">
                      <span className="truncate">{data.verification_command}</span>
                      <button
                        onClick={() => onRunFix(data.verification_command!)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors ml-2 shrink-0 font-sans"
                      >
                        Run
                      </button>
                    </div>
                  </div>
                )}

                {data.diagnostic_commands && data.diagnostic_commands.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1 font-mono">
                    <span className="text-[10px] font-sans uppercase font-bold text-slate-400 tracking-wider">
                      Suggested Diagnostics
                    </span>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {data.diagnostic_commands.map((dcmd, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] text-cyan-300 bg-black/40 px-2 py-1 rounded border border-slate-800/80"
                        >
                          <span className="truncate">{dcmd}</span>
                          <button
                            onClick={() => onRunFix(dcmd)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors ml-2 shrink-0 font-sans"
                          >
                            Run
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RHCSA Learning Mode Card */}
              {showRhcsaMode && (data.rhcsa_concept || data.rhcsa_exam_tip) && (
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 font-sans space-y-2">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                    RHCSA Exam Learning Mode
                  </div>
                  {data.rhcsa_concept && (
                    <p className="text-xs text-purple-200/90 leading-relaxed">
                      <span className="font-semibold text-purple-300">
                        Concept:{' '}
                      </span>
                      {data.rhcsa_concept}
                    </p>
                  )}
                  {data.rhcsa_exam_tip && (
                    <div className="p-2.5 rounded-lg bg-purple-900/30 border border-purple-500/20 text-xs text-purple-300 font-medium">
                      💡 <span className="font-bold">Exam Tip: </span>
                      {data.rhcsa_exam_tip}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        {data && !loading && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-terminal-border/80 bg-slate-900/90 font-sans">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(data.fix_command)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" /> Copy Command
                  </>
                )}
              </button>

              {onAskAI && (
                <button
                  onClick={() => {
                    onAskAI(data.command, data.why_failed)
                    onClose()
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors border border-slate-700"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-terminal-blue" />
                  Ask AI Chat
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExecute(data.fix_command)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md hover:shadow-amber-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                Run Fix
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
