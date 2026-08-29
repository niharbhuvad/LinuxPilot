// LinuxAI — Enhanced System Logs Page
import React, { useState, useEffect } from 'react'
import { logsApi, servicesApi } from '../services/api'
import {
  Search, AlertCircle, FileText, Loader2, RefreshCw, Copy, Check,
  Download, Filter, Play, Pause, Terminal, ShieldAlert
} from 'lucide-react'

export default function LogsPage() {
  const [logs, setLogs] = useState('')
  const [query, setQuery] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [servicesList, setServicesList] = useState<string[]>([])
  const [linesLimit, setLinesLimit] = useState<number>(200)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'recent' | 'errors' | 'search'>('recent')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch list of services for dropdown filter
  useEffect(() => {
    servicesApi.list().then(res => {
      if (Array.isArray(res.data.services)) {
        setServicesList(res.data.services.map((s: any) => s.name || s))
      }
    }).catch(err => console.error('Failed to load services list', err))
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let res
      if (mode === 'errors') {
        res = await logsApi.errors(linesLimit)
      } else if (mode === 'search' && query) {
        res = await logsApi.search(query, selectedService || undefined, 'today')
      } else if (selectedService) {
        res = await servicesApi.logs(selectedService, linesLimit)
      } else {
        res = await logsApi.recent(linesLimit)
      }
      setLogs(res?.data?.output || res?.data?.log || JSON.stringify(res?.data, null, 2))
    } catch (e: any) {
      setLogs(`Error retrieving journalctl logs: ${e.response?.data?.detail || e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [mode, selectedService, linesLimit])

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      fetchLogs()
    }, 5000)
    return () => clearInterval(timer)
  }, [autoRefresh, mode, selectedService, linesLimit])

  const handleCopy = () => {
    navigator.clipboard.writeText(logs)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system_logs_${new Date().toISOString().slice(0, 10)}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 overflow-hidden animate-fade-in font-mono">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-5 border border-terminal-border rounded-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-terminal-blue/10 border border-terminal-blue/30 text-terminal-blue">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-terminal-text flex items-center gap-2">
              System & Journal Logs Explorer
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-terminal-blue/20 text-terminal-blue border border-terminal-blue/30 font-semibold">
                journalctl
              </span>
            </h1>
            <p className="text-xs text-terminal-muted mt-0.5">
              Inspect real-time systemd journal log streams, audit security events, and diagnose service failures.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border font-mono transition-colors ${
              autoRefresh
                ? 'bg-terminal-green/20 text-terminal-green border-terminal-green/40'
                : 'bg-terminal-surface border-terminal-border text-terminal-muted hover:text-terminal-text'
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5 animate-pulse text-terminal-green" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRefresh ? 'Live Auto-Stream (5s)' : 'Auto Refresh'}</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-lg bg-terminal-blue text-black font-bold hover:bg-terminal-blue/90 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Fetch Logs
          </button>
        </div>
      </div>

      {/* Filter Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Mode Selector */}
          <div className="flex items-center gap-1 bg-terminal-surface p-1 rounded-xl border border-terminal-border text-xs">
            <button
              onClick={() => setMode('recent')}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 ${
                mode === 'recent'
                  ? 'bg-terminal-blue text-black font-bold shadow'
                  : 'text-terminal-muted hover:text-terminal-text'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              All System Logs
            </button>

            <button
              onClick={() => setMode('errors')}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 ${
                mode === 'errors'
                  ? 'bg-red-500 text-white font-bold shadow'
                  : 'text-terminal-muted hover:text-terminal-text'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              Errors & Critical
            </button>

            <button
              onClick={() => setMode('search')}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium flex items-center gap-1.5 ${
                mode === 'search'
                  ? 'bg-terminal-blue text-black font-bold shadow'
                  : 'text-terminal-muted hover:text-terminal-text'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Search Logs
            </button>
          </div>

          {/* Service Dropdown */}
          <select
            value={selectedService}
            onChange={e => setSelectedService(e.target.value)}
            className="bg-terminal-surface border border-terminal-border rounded-lg px-3 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-blue"
          >
            <option value="">All Services (System-wide)</option>
            {servicesList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Lines Limit Dropdown */}
          <select
            value={linesLimit}
            onChange={e => setLinesLimit(Number(e.target.value))}
            className="bg-terminal-surface border border-terminal-border rounded-lg px-3 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-blue"
          >
            <option value={50}>50 Lines</option>
            <option value={100}>100 Lines</option>
            <option value={200}>200 Lines</option>
            <option value={500}>500 Lines</option>
          </select>
        </div>

        {/* Search Query Input if Search Mode */}
        {mode === 'search' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogs()}
              placeholder="Search keyword (e.g. ssh, error, failed, nginx)..."
              className="w-72 bg-terminal-surface border border-terminal-border rounded-lg px-3 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-blue"
            />
          </div>
        )}
      </div>

      {/* Main Terminal Logs Output Box */}
      <div className="flex-1 glass-card border border-terminal-border rounded-xl overflow-hidden flex flex-col bg-black/60 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2 bg-terminal-surface border-b border-terminal-border shrink-0 select-none">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${mode === 'errors' ? 'bg-red-500 animate-pulse' : 'bg-terminal-green'}`} />
            <span className="text-terminal-muted font-mono font-bold">
              {mode === 'errors'
                ? 'journalctl -p err..emerg -n ' + linesLimit
                : mode === 'search'
                ? `journalctl --grep "${query}"`
                : selectedService
                ? `journalctl -u ${selectedService} -n ${linesLimit}`
                : `journalctl -n ${linesLimit}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-terminal-border/40 hover:bg-terminal-border text-terminal-muted hover:text-terminal-text transition-colors"
              title="Copy Logs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-terminal-border/40 hover:bg-terminal-border text-terminal-muted hover:text-terminal-text transition-colors"
              title="Download Log File"
            >
              <Download className="w-3.5 h-3.5 text-terminal-blue" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Console Log Area */}
        <pre className="flex-1 p-4 overflow-y-auto text-xs font-mono text-terminal-text whitespace-pre-wrap break-words leading-relaxed selection:bg-terminal-blue/30">
          {loading ? (
            <div className="flex items-center justify-center h-full text-terminal-muted gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-terminal-blue" />
              <span>Fetching system log journal entries...</span>
            </div>
          ) : logs ? (
            logs
          ) : (
            <span className="text-terminal-muted italic">No log entries returned.</span>
          )}
        </pre>
      </div>
    </div>
  )
}
