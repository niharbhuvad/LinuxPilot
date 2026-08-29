// LinuxAI — Interactive Web Vim Editor Modal Component
import React, { useState, useEffect, useRef } from 'react'
import {
  FileCode, X, Save, LogOut, CheckCircle2, AlertCircle,
  HelpCircle, Eye, EyeOff, Copy, Check, RefreshCw, Terminal, Code2
} from 'lucide-react'
import { filesApi } from '../services/api'

interface VimEditorModalProps {
  isOpen: boolean
  filePath: string
  onClose: () => void
  onSaveSuccess?: (path: string, lines: number, sizeBytes: number) => void
}

type VimMode = 'NORMAL' | 'INSERT' | 'VISUAL' | 'COMMAND'

export default function VimEditorModal({
  isOpen,
  filePath,
  onClose,
  onSaveSuccess,
}: VimEditorModalProps) {
  const [content, setContent] = useState('')
  const [initialContent, setInitialContent] = useState('')
  const [mode, setMode] = useState<VimMode>('NORMAL')
  const [commandInput, setCommandInput] = useState('')
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [copied, setCopied] = useState(false)
  const [showCheatSheet, setShowCheatSheet] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const commandInputRef = useRef<HTMLInputElement>(null)

  const isModified = content !== initialContent

  // Read file on open
  useEffect(() => {
    if (isOpen && filePath) {
      loadFile(filePath)
    }
  }, [isOpen, filePath])

  const loadFile = async (path: string) => {
    setLoading(true)
    setError('')
    setStatusMessage(`Opening "${path}"...`)
    try {
      const res = await filesApi.read(path)
      const data = res.data
      setContent(data.content || '')
      setInitialContent(data.content || '')
      setMode('NORMAL')
      setStatusMessage(data.message || `Loaded "${path}"`)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load file')
      setStatusMessage('Error reading file')
    } finally {
      setLoading(false)
    }
  }

  // Handle Vim Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mode === 'NORMAL') {
      if (e.key === 'i' || e.key === 'a') {
        e.preventDefault()
        setMode('INSERT')
        setStatusMessage('-- INSERT --')
      } else if (e.key === ':') {
        e.preventDefault()
        setMode('COMMAND')
        setCommandInput(':')
        setTimeout(() => commandInputRef.current?.focus(), 20)
      } else if (e.key === 'v') {
        e.preventDefault()
        setMode('VISUAL')
        setStatusMessage('-- VISUAL --')
      }
    } else if (mode === 'INSERT' || mode === 'VISUAL') {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMode('NORMAL')
        setStatusMessage('')
      }
    }
    updateCursorPos()
  }

  const updateCursorPos = () => {
    if (!textareaRef.current) return
    const selStart = textareaRef.current.selectionStart
    const valBefore = textareaRef.current.value.substring(0, selStart)
    const lines = valBefore.split('\n')
    const currentLine = lines.length
    const currentCol = lines[lines.length - 1].length + 1
    setCursorPos({ line: currentLine, col: currentCol })
  }

  // Execute Vim Command line
  const handleRunVimCommand = async (cmdStr?: string) => {
    const rawCmd = (cmdStr || commandInput).trim()
    const cmd = rawCmd.startsWith(':') ? rawCmd.substring(1).trim() : rawCmd.trim()

    if (!cmd) {
      setMode('NORMAL')
      return
    }

    if (cmd === 'w') {
      await saveFile()
      setMode('NORMAL')
    } else if (cmd === 'q') {
      if (isModified) {
        setError('No write since last change (add ! to override with :q!)')
        setStatusMessage('E37: No write since last change')
      } else {
        onClose()
      }
      setMode('NORMAL')
    } else if (cmd === 'wq' || cmd === 'x') {
      const success = await saveFile()
      if (success) onClose()
      setMode('NORMAL')
    } else if (cmd === 'q!') {
      onClose()
    } else if (cmd === 'set nu' || cmd === 'set number') {
      setShowLineNumbers(true)
      setStatusMessage('Line numbers enabled')
      setMode('NORMAL')
    } else if (cmd === 'set nonu' || cmd === 'set nonumber') {
      setShowLineNumbers(false)
      setStatusMessage('Line numbers disabled')
      setMode('NORMAL')
    } else if (cmd === 'revert' || cmd === 'e!') {
      await loadFile(filePath)
    } else if (cmd === 'help') {
      setShowCheatSheet(prev => !prev)
      setMode('NORMAL')
    } else {
      setStatusMessage(`E492: Not an editor command: :${cmd}`)
      setMode('NORMAL')
    }
    setCommandInput('')
  }

  const saveFile = async (): Promise<boolean> => {
    setSaving(true)
    setError('')
    try {
      const res = await filesApi.write(filePath, content)
      const data = res.data
      setInitialContent(content)
      setStatusMessage(data.message || `"${filePath}" written`)
      if (onSaveSuccess) {
        onSaveSuccess(filePath, data.lines, data.size_bytes)
      }
      return true
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to save file'
      setError(msg)
      setStatusMessage(`Error saving: ${msg}`)
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  const lineCount = content.split('\n').length
  const byteCount = new Blob([content]).size

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-mono">
      <div className="w-full max-w-5xl h-[85vh] bg-terminal-bg border border-terminal-border rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-terminal-surface border-b border-terminal-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-terminal-blue/10 border border-terminal-blue/30 text-terminal-blue">
              <FileCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-terminal-text truncate">{filePath}</h3>
                {isModified && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    [+] Modified
                  </span>
                )}
              </div>
              <p className="text-[11px] text-terminal-muted flex items-center gap-2">
                <span>Vim Editor v8.2</span>
                <span>•</span>
                <span>{lineCount} Lines</span>
                <span>•</span>
                <span>{byteCount} Bytes</span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunVimCommand('w')}
              disabled={saving || !isModified}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-terminal-green/20 text-terminal-green hover:bg-terminal-green/30 border border-terminal-green/40 text-xs disabled:opacity-40 transition-colors"
              title="Save File (:w)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>:w Save</span>
            </button>

            <button
              onClick={() => handleRunVimCommand('wq')}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-terminal-blue/20 text-terminal-blue hover:bg-terminal-blue/30 border border-terminal-blue/40 text-xs transition-colors font-semibold"
              title="Save & Quit (:wq)"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>:wq Save & Exit</span>
            </button>

            <button
              onClick={() => handleRunVimCommand(isModified ? 'q!' : 'q')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-800/40 text-xs transition-colors font-semibold"
              title={isModified ? "Force Quit & Discard Changes (:q!)" : "Quit without saving (:q)"}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isModified ? ':q! Discard & Exit' : ':q Quit'}</span>
            </button>

            <button
              onClick={() => setShowLineNumbers(prev => !prev)}
              className="p-1.5 rounded-lg bg-terminal-border/40 hover:bg-terminal-border text-terminal-muted hover:text-terminal-text transition-colors"
              title="Toggle Line Numbers"
            >
              {showLineNumbers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-terminal-border/40 hover:bg-terminal-border text-terminal-muted hover:text-terminal-text transition-colors"
              title="Copy All"
            >
              {copied ? <Check className="w-4 h-4 text-terminal-green" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowCheatSheet(prev => !prev)}
              className="p-1.5 rounded-lg bg-terminal-border/40 hover:bg-terminal-border text-terminal-muted hover:text-terminal-text transition-colors"
              title="Vim Cheat Sheet"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleRunVimCommand('q')}
              className="p-1.5 rounded-lg bg-terminal-border/40 hover:bg-red-900/40 text-terminal-muted hover:text-red-400 transition-colors ml-1"
              title="Close (:q)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional Cheat Sheet Drawer */}
        {showCheatSheet && (
          <div className="bg-terminal-surface/90 border-b border-terminal-border p-3 px-5 text-xs grid grid-cols-2 md:grid-cols-4 gap-3 text-terminal-muted animate-fade-in shrink-0">
            <div>
              <span className="font-bold text-terminal-text block mb-1">MODES</span>
              <div><code className="text-terminal-green">i</code> : Enter Insert mode</div>
              <div><code className="text-terminal-blue">Esc</code> : Normal mode</div>
              <div><code className="text-purple-400">v</code> : Visual mode</div>
            </div>
            <div>
              <span className="font-bold text-terminal-text block mb-1">SAVE & QUIT</span>
              <div><code className="text-amber-400">:w</code> : Save file</div>
              <div><code className="text-amber-400">:q</code> : Quit</div>
              <div><code className="text-amber-400">:wq</code> : Save & Quit</div>
              <div><code className="text-amber-400">:q!</code> : Force quit</div>
            </div>
            <div>
              <span className="font-bold text-terminal-text block mb-1">VIEW SETTINGS</span>
              <div><code className="text-terminal-text">:set nu</code> : Show line numbers</div>
              <div><code className="text-terminal-text">:set nonu</code> : Hide numbers</div>
              <div><code className="text-terminal-text">:revert</code> : Reload file</div>
            </div>
            <div>
              <span className="font-bold text-terminal-text block mb-1">SHORTCUT BUTTONS</span>
              <p className="text-[11px] leading-tight">
                You can also use top action toolbar buttons to Save, Exit, or toggle features anytime.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert if any */}
        {error && (
          <div className="bg-red-950/60 border-b border-red-900/60 px-4 py-2 text-xs text-red-300 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Main Editor Body */}
        <div className="flex-1 flex overflow-hidden bg-black/60 relative">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-terminal-muted gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-terminal-green" />
              <span>Loading file contents...</span>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden relative">
              {/* Line Numbers Gutter */}
              {showLineNumbers && (
                <div className="w-12 py-3 bg-black/40 border-r border-terminal-border/50 text-right pr-3 select-none text-terminal-muted/40 text-xs font-mono shrink-0 overflow-hidden leading-relaxed">
                  {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
                    <div key={i} className={cursorPos.line === i + 1 ? 'text-terminal-green font-bold' : ''}>
                      {i + 1}
                    </div>
                  ))}
                </div>
              )}

              {/* Text Area Viewport */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => {
                  setContent(e.target.value)
                  updateCursorPos()
                }}
                onKeyDown={handleKeyDown}
                onClick={updateCursorPos}
                onKeyUp={updateCursorPos}
                placeholder="~ Empty file ~ Type 'i' to start editing..."
                className="flex-1 bg-transparent p-3 text-terminal-text text-sm font-mono focus:outline-none resize-none overflow-y-auto leading-relaxed border-none selection:bg-terminal-blue/30 selection:text-white"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Command Line Input (Active in COMMAND mode) */}
        {mode === 'COMMAND' && (
          <div className="bg-terminal-surface border-t border-terminal-border px-3 py-1.5 flex items-center gap-2 text-sm text-terminal-text shrink-0">
            <span className="text-amber-400 font-bold">:</span>
            <input
              ref={commandInputRef}
              type="text"
              value={commandInput.startsWith(':') ? commandInput.substring(1) : commandInput}
              onChange={e => setCommandInput(':' + e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRunVimCommand()
                if (e.key === 'Escape') setMode('NORMAL')
              }}
              placeholder="w, q, wq, q!, set nu..."
              className="flex-1 bg-transparent border-none focus:outline-none text-amber-300 font-mono text-xs"
              autoFocus
            />
          </div>
        )}

        {/* Vim Status Bar */}
        <div className="bg-terminal-surface border-t border-terminal-border px-4 py-1.5 flex items-center justify-between text-xs font-mono shrink-0 select-none">
          {/* Mode Pill & Message */}
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                mode === 'INSERT'
                  ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/40'
                  : mode === 'VISUAL'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : mode === 'COMMAND'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-terminal-blue/20 text-terminal-blue border border-terminal-blue/40'
              }`}
            >
              {mode === 'INSERT' ? '-- INSERT --' : mode === 'VISUAL' ? '-- VISUAL --' : mode === 'COMMAND' ? 'COMMAND' : 'NORMAL'}
            </span>

            <span className="text-terminal-muted truncate text-[11px]">
              {statusMessage || (isModified ? '[Modified]' : 'Press i to edit, : for commands')}
            </span>
          </div>

          {/* Line:Col & Metadata */}
          <div className="flex items-center gap-4 text-terminal-muted text-[11px] shrink-0">
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span>utf-8</span>
            <span>{lineCount}L</span>
          </div>
        </div>

      </div>
    </div>
  )
}
