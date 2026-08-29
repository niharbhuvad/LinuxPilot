import React from 'react'
import { History, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { useVoiceAssistant, AiActivityLog } from '../context/VoiceAssistantContext'
import clsx from 'clsx'

export default function AiActivityPage() {
  const { aiActivities } = useVoiceAssistant()

  return (
    <div className="h-full flex flex-col bg-terminal-bg overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-terminal-border pb-4">
        <div>
          <h1 className="text-xl font-mono font-bold text-terminal-text flex items-center gap-2">
            <History className="w-5 h-5 text-terminal-cyan" />
            AI Command & Activity Audit Log
          </h1>
          <p className="text-xs font-mono text-terminal-muted mt-1">
            Complete transparent security audit trail of all natural language requests, generated commands, risk levels, and execution outcomes
          </p>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-terminal-bg border-b border-terminal-border text-terminal-muted uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">User Request</th>
                <th className="py-3 px-4">Generated Linux Command</th>
                <th className="py-3 px-4">Risk Tier</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border/50 text-terminal-text">
              {aiActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-terminal-muted">
                    No AI activity logged yet.
                  </td>
                </tr>
              ) : (
                aiActivities.map((log: AiActivityLog) => (
                  <tr key={log.id} className="hover:bg-terminal-border/20 transition-colors">
                    <td className="py-3 px-4 text-terminal-muted flex items-center gap-1.5 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 text-terminal-cyan" />
                      <span>{log.time}</span>
                    </td>
                    <td className="py-3 px-4 font-sans font-medium max-w-xs truncate">
                      {log.userRequest}
                    </td>
                    <td className="py-3 px-4 font-mono text-terminal-cyan bg-black/40">
                      <code>{log.command || 'N/A'}</code>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-[10px] font-bold border',
                          log.risk === 'SAFE' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                          log.risk === 'WARNING' && 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                          log.risk === 'DANGEROUS' && 'bg-red-500/10 text-red-400 border-red-500/30'
                        )}
                      >
                        {log.risk}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        {log.status === 'Executed' || log.status === 'Approved' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-terminal-muted truncate max-w-xs">
                      {log.result}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
