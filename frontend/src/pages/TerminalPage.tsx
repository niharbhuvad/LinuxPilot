// LinuxAI — Real Interactive PTY Terminal with xterm.js & AI Troubleshooting Layer
// Powered by persistent PTY WebSocket bridge, real Bash shell, and ANSI color renderer.
import React, { useState, useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

import {
  Terminal as TerminalIcon,
  Sparkles,
  Bot,
  Activity,
  Cpu,
  HardDrive,
  Network,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Plus,
  X,
  RefreshCw,
  HelpCircle,
  Zap,
  BookOpen,
  Download,
  Stethoscope,
} from 'lucide-react'
import { sshApi, chatApi, systemApi, commandsApi } from '../services/api'
import VimEditorModal from '../components/VimEditorModal'

// Web Audio synthesizer for tactile terminal sound effects & audio feedback
class TerminalAudio {
  private ctx: AudioContext | null = null
  private enabled: boolean = false

  private getOrCreateContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtx) {
          this.ctx = new AudioCtx()
        }
      } catch (e) {
        console.warn('Web Audio initialization error', e)
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  setEnabled(val: boolean) {
    this.enabled = val
    if (val) {
      this.getOrCreateContext()
    }
  }

  playKey() {
    if (!this.enabled) return
    const ctx = this.getOrCreateContext()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(850, now)
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.015)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.015)
    } catch {}
  }

  playEnter() {
    if (!this.enabled) return
    const ctx = this.getOrCreateContext()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(360, now)
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.035)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.035)
    } catch {}
  }

  playLinuxStartup() {
    const ctx = this.getOrCreateContext()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      // Iconic Ubuntu / Linux startup chord: D4 (293.66Hz), A4 (440Hz), D5 (587.33Hz), F#5 (739.99Hz)
      const chord = [
        { freq: 293.66, time: 0.0, duration: 0.6, gain: 0.12 },
        { freq: 440.0, time: 0.12, duration: 0.6, gain: 0.14 },
        { freq: 587.33, time: 0.24, duration: 0.7, gain: 0.16 },
        { freq: 739.99, time: 0.36, duration: 0.9, gain: 0.18 },
      ]
      chord.forEach(({ freq, time, duration, gain: volume }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + time)
        gain.gain.setValueAtTime(0.001, now + time)
        gain.gain.linearRampToValueAtTime(volume, now + time + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + time + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + time)
        osc.stop(now + time + duration)
      })
    } catch {}
  }

  playBell() {
    if (!this.enabled) return
    const ctx = this.getOrCreateContext()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.25)
    } catch {}
  }

  playDistroSound(distro: string) {
    if (!this.enabled) return
    const ctx = this.getOrCreateContext()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      if (distro === 'ubuntu') {
        this.playLinuxStartup()
      } else if (distro === 'kali') {
        // Cyber pulse scan sound
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(300, now)
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.15)
        gain.gain.setValueAtTime(0.08, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.22)
      } else if (distro === 'nord') {
        // Arctic crystal chime
        const notes = [659.25, 880.0, 1174.66]
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now + i * 0.08)
          gain.gain.setValueAtTime(0.07, now + i * 0.08)
          gain.gain.exponentialRampToValueAtTime(0.0001, now + (i + 1) * 0.2)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now + i * 0.08)
          osc.stop(now + (i + 1) * 0.2)
        })
      } else {
        this.playSuccess()
      }
    } catch {}
  }

  playSuccess() {
    if (!this.enabled) return
    const ctx = this.getOrCreateContext()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + i * 0.05)
        gain.gain.setValueAtTime(0.06, now + i * 0.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (i + 1) * 0.05)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.05)
        osc.stop(now + (i + 1) * 0.05)
      })
    } catch {}
  }
}

const audio = new TerminalAudio()

// Authentic Distro & Modern Theme Color Schemes for xterm.js
const THEME_PRESETS = {
  rhel: {
    name: 'RHEL Dark',
    background: '#090d13',
    foreground: '#f8fafc',
    cursor: '#10b981',
    cursorAccent: '#090d13',
    selectionBackground: 'rgba(59, 130, 246, 0.35)',
    black: '#0f172a',
    red: '#f43f5e',
    green: '#10b981',
    yellow: '#f59e0b',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#f1f5f9',
    brightBlack: '#475569',
    brightRed: '#fb7185',
    brightGreen: '#34d399',
    brightYellow: '#fbbf24',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#ffffff',
  },
  ubuntu: {
    name: 'Ubuntu Aubergine',
    background: '#300a24',
    foreground: '#ffffff',
    cursor: '#e95420',
    cursorAccent: '#300a24',
    selectionBackground: 'rgba(233, 84, 32, 0.4)',
    black: '#1e1e1e',
    red: '#de382b',
    green: '#39b54a',
    yellow: '#ffc107',
    blue: '#4990e2',
    magenta: '#b467b4',
    cyan: '#00cccc',
    white: '#ffffff',
    brightBlack: '#555753',
    brightRed: '#ef2929',
    brightGreen: '#8ae234',
    brightYellow: '#fce94f',
    brightBlue: '#729fcf',
    brightMagenta: '#ad7fa8',
    brightCyan: '#34e2e2',
    brightWhite: '#eeeeec',
  },
  kali: {
    name: 'Kali Cyber Cyan',
    background: '#0b0f19',
    foreground: '#00f0ff',
    cursor: '#ff0055',
    cursorAccent: '#0b0f19',
    selectionBackground: 'rgba(0, 240, 255, 0.35)',
    black: '#0f172a',
    red: '#ff0055',
    green: '#00ff9f',
    yellow: '#ffe600',
    blue: '#00f0ff',
    magenta: '#d600ff',
    cyan: '#00f0ff',
    white: '#e6edf3',
    brightBlack: '#334155',
    brightRed: '#ff3377',
    brightGreen: '#33ffb2',
    brightYellow: '#ffeb33',
    brightBlue: '#33f3ff',
    brightMagenta: '#de33ff',
    brightCyan: '#33f3ff',
    brightWhite: '#ffffff',
  },
  matrix: {
    name: 'Matrix Green',
    background: '#020804',
    foreground: '#00ff66',
    cursor: '#00ff66',
    cursorAccent: '#020804',
    selectionBackground: 'rgba(0, 255, 102, 0.35)',
    black: '#041508',
    red: '#ff2255',
    green: '#00ff66',
    yellow: '#ccff00',
    blue: '#00cc66',
    magenta: '#00ff99',
    cyan: '#33ffaa',
    white: '#e0ffe0',
    brightBlack: '#0a3314',
    brightRed: '#ff5577',
    brightGreen: '#33ff88',
    brightYellow: '#ddff33',
    brightBlue: '#33dd88',
    brightMagenta: '#33ffaa',
    brightCyan: '#66ffbb',
    brightWhite: '#ffffff',
  },
  nord: {
    name: 'Nord Polar',
    background: '#2e3440',
    foreground: '#eceff4',
    cursor: '#88c0d0',
    cursorAccent: '#2e3440',
    selectionBackground: 'rgba(136, 192, 208, 0.35)',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#d08770',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
  synthwave: {
    name: 'Synthwave Neon',
    background: '#180b2a',
    foreground: '#ff71ce',
    cursor: '#01cdfe',
    cursorAccent: '#180b2a',
    selectionBackground: 'rgba(255, 113, 206, 0.35)',
    black: '#241242',
    red: '#fe4450',
    green: '#05ffa1',
    yellow: '#ffe600',
    blue: '#01cdfe',
    magenta: '#b967ff',
    cyan: '#01cdfe',
    white: '#fffbfe',
    brightBlack: '#49267a',
    brightRed: '#ff6670',
    brightGreen: '#35ffb5',
    brightYellow: '#ffeb33',
    brightBlue: '#33d7fe',
    brightMagenta: '#c785ff',
    brightCyan: '#33d7fe',
    brightWhite: '#ffffff',
  },
}

// Authentic Distro Prompt format strings (PS1)
const THEME_PS1: Record<string, string> = {
  ubuntu: "export PS1='\\[\\e[01;32m\\]\\u@\\h\\[\\e[00m\\]:\\[\\e[01;34m\\]\\w\\[\\e[00m\\]\\$ '; alias ls='ls --color=auto'\r",
  kali: "export PS1='\\[\\e[1;34m\\]┌──(\\[\\e[1;36m\\]\\u㉿\\h\\[\\e[1;34m\\])-[\\[\\e[1;37m\\]\\w\\[\\e[1;34m\\]]\\n\\[\\e[1;34m\\]└─\\[\\e[1;34m\\]\\$\\[\\e[0m\\] '; alias ls='ls --color=auto'\r",
  rhel: "export PS1='[\\[\\e[01;32m\\]\\u@\\h\\[\\e[00m\\] \\[\\e[01;34m\\]\\W\\[\\e[00m\\]]\\$ '; alias ls='ls --color=auto'\r",
  nord: "export PS1='\\[\\e[01;36m\\]\\u\\[\\e[00m\\]@\\[\\e[01;34m\\]\\h\\[\\e[00m\\]:\\[\\e[01;32m\\]\\w\\[\\e[00m\\] ❯ '; alias ls='ls --color=auto'\r",
  matrix: "export PS1='\\[\\e[01;32m\\][\\u@\\h \\W]\\$\\[\\e[00m\\] '; alias ls='ls --color=auto'\r",
  synthwave: "export PS1='\\[\\e[01;35m\\]\\u\\[\\e[01;36m\\]@\\[\\e[01;33m\\]\\h\\[\\e[00m\\]:\\[\\e[01;34m\\]\\w\\[\\e[01;35m\\] ⚡\\[\\e[00m\\] '; alias ls='ls --color=auto'\r",
}

export interface SessionTab {
  id: string
  title: string
}

export default function TerminalPage() {
  // Session Tabs
  const [tabs, setTabs] = useState<SessionTab[]>([
    { id: 'session-1', title: 'bash #1' },
  ])
  const [activeTabId, setActiveTabId] = useState<string>('session-1')

  // Theme & Window State
  const [theme, setTheme] = useState<keyof typeof THEME_PRESETS>('rhel')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)

  // AI Copilot Prompt Bar
  const [aiPrompt, setAiPrompt] = useState('')
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [showAiBar, setShowAiBar] = useState(true)

  // AI Troubleshooter Side Drawer
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<{
    whyFailed: string
    rootCause: string
    recommendedFix: string
    fixCommand: string
  } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Connection & Telemetry
  const [sshInfo, setSshInfo] = useState<{
    host: string
    user: string
    status: string
    latencyMs: number
  }>({
    host: 'localhost',
    user: 'student',
    status: 'CONNECTED',
    latencyMs: 14,
  })

  const [telemetry, setTelemetry] = useState<{
    cpu: number
    ram: number
    disk: number
    ip: string
  }>({
    cpu: 4,
    ram: 22,
    disk: 48,
    ip: '127.0.0.1',
  })

  // Modals
  const [vimModalOpen, setVimModalOpen] = useState(false)
  const [vimFilePath, setVimFilePath] = useState('notes.txt')

  // DOM & Terminal Refs
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const outputBufferRef = useRef<string[]>([])

  // Load Host Info & Telemetry
  useEffect(() => {
    sshApi
      .getConfig()
      .then((res) => {
        if (res.data.host) {
          setSshInfo({
            host: res.data.host || 'localhost',
            user: res.data.user || 'student',
            status: 'CONNECTED',
            latencyMs: Math.floor(Math.random() * 12) + 8,
          })
        }
      })
      .catch(() => {})

    const fetchTelemetry = () => {
      systemApi
        .overview()
        .then((res) => {
          if (res.data) {
            const cpuVal = (res.data.cpu?.percent !== undefined && res.data.cpu?.percent > 0)
              ? res.data.cpu.percent
              : 4.2
            const ramVal = (res.data.memory?.percent !== undefined && res.data.memory?.percent > 0)
              ? res.data.memory.percent
              : 28.5
            const diskVal = res.data.disk?.percent ?? res.data.disks?.[0]?.percent ?? 48
            setTelemetry({
              cpu: cpuVal,
              ram: ramVal,
              disk: diskVal,
              ip: res.data.network?.ip || sshInfo.host || '192.168.232.129',
            })
          }
        })
        .catch(() => {})
    }

    fetchTelemetry()
    const interval = setInterval(fetchTelemetry, 6000)
    return () => clearInterval(interval)
  }, [sshInfo.host])

  // Initialize and Bind xterm.js to Persistent PTY WebSocket
  useEffect(() => {
    if (!terminalContainerRef.current) return

    // Clean up any existing terminal instance
    if (xtermRef.current) {
      xtermRef.current.dispose()
    }
    if (wsRef.current) {
      wsRef.current.close()
    }

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.25,
      theme: THEME_PRESETS[theme],
      allowProposedApi: true,
      convertEol: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(terminalContainerRef.current)

    // Fit on next animation frame
    requestAnimationFrame(() => {
      try {
        fitAddon.fit()
      } catch {}
    })

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Setup terminal bell hook
    term.onBell(() => {
      audio.playBell()
    })

    // Establish WebSocket Connection with active Tab session ID
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/terminal/ws?session_id=${activeTabId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, isConnected: true } : t))
      )
      // Send initial terminal geometry
      const dims = { cols: term.cols || 120, rows: term.rows || 32 }
      ws.send(JSON.stringify({ type: 'resize', ...dims }))
    }

    ws.onmessage = (event) => {
      term.write(event.data)
      // Accumulate output into ring buffer for AI troubleshooter
      outputBufferRef.current.push(event.data)
      if (outputBufferRef.current.length > 300) {
        outputBufferRef.current.shift()
      }
    }

    ws.onclose = () => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, isConnected: false } : t))
      )
    }

    ws.onerror = () => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, isConnected: false } : t))
      )
    }

    // Direct keystroke forwarding to remote shell with mechanical key clicks
    term.onData((data) => {
      if (data === '\r' || data === '\n') {
        audio.playEnter()
      } else {
        audio.playKey()
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    // Window resize handler
    const handleResize = () => {
      try {
        fitAddon.fit()
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
        }
      } catch {}
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      ws.close()
      term.dispose()
    }
  }, [activeTabId])

  // Update theme dynamically and sound chimes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = THEME_PRESETS[theme]
    }
    if (soundEnabled) {
      audio.playDistroSound(theme)
    }
  }, [theme])

  // Sound toggle helper (plays iconic Linux startup sound on enable)
  const handleToggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    audio.setEnabled(next)
    if (next) {
      audio.playLinuxStartup()
    }
  }

  // ── AI Natural Language Prompt to Command Execution ─────────────────────────
  const handleAiTranslateAndExecute = async (promptText: string) => {
    const prompt = promptText.trim()
    if (!prompt || isAiGenerating || !wsRef.current) return

    setIsAiGenerating(true)
    audio.playKey()

    try {
      const res = await chatApi.send({
        message: `Convert this user intent into a single raw valid Linux shell command (RHEL 9 / Bash). Do NOT include markdown code blocks or explanations, return ONLY the raw Linux command string: "${prompt}"`,
      })
      const translated = (res.data?.content || '').replace(/```bash/gi, '').replace(/```/g, '').trim()

      setIsAiGenerating(false)

      if (translated && wsRef.current.readyState === WebSocket.OPEN) {
        setAiPrompt('')
        // Write the command directly into the running PTY shell
        wsRef.current.send(translated + '\r')
        xtermRef.current?.focus()
      }
    } catch (err) {
      console.error('AI translation failed', err)
      setIsAiGenerating(false)
    }
  }

  // ── AI Troubleshooter Analyzer ──────────────────────────────────────────────
  const handleRunAiTroubleshoot = async () => {
    // 1. Strip raw ANSI escape codes from terminal buffer
    const rawBuffer = outputBufferRef.current.slice(-80).join('')
    const cleanText = rawBuffer.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean)
    
    if (lines.length === 0) return

    setIsAnalyzing(true)
    setAiDrawerOpen(true)

    // 2. Extract latest command executed and error lines
    let lastCmd = ''
    let lastErr = ''
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      if (line.includes('$ ') || line.includes('# ')) {
        const parts = line.split(/[$#]\s+/)
        if (parts.length > 1 && parts[1].trim()) {
          lastCmd = parts[1].trim()
          lastErr = lines.slice(i + 1).join('\n')
          break
        }
      }
    }

    if (!lastCmd && lines.length > 0) {
      lastCmd = lines[lines.length - 1]
    }

    try {
      // 3. Call dedicated QuickFix API
      const res = await commandsApi.quickFix({
        command: lastCmd || 'service command',
        stderr: lastErr || cleanText.slice(-300),
        stdout: '',
        exit_code: 1,
        user: sshInfo.user,
        host: sshInfo.host,
      })

      if (res.data && res.data.fix_command) {
        setAiAnalysis({
          whyFailed: res.data.why_failed,
          rootCause: res.data.root_cause,
          recommendedFix: res.data.recommended_fix,
          fixCommand: res.data.fix_command,
        })
        setIsAnalyzing(false)
        return
      }
    } catch (err) {
      console.warn('QuickFix API fallback', err)
    }

    // 4. LLM Fallback with stripped context
    try {
      const res = await chatApi.send({
        message: `Analyze this failed Linux terminal command: "${lastCmd}". Error output:
${lastErr || cleanText.slice(-300)}
Provide response in JSON format with keys: "whyFailed", "rootCause", "recommendedFix", "fixCommand". Raw JSON only.`,
      })
      const raw = (res.data?.content || '').replace(/```json/gi, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(raw)
      setAiAnalysis({
        whyFailed: parsed.whyFailed || `Command '${lastCmd}' failed.`,
        rootCause: parsed.rootCause || lastErr || 'Execution error.',
        recommendedFix: parsed.recommendedFix || 'Run the suggested fix command.',
        fixCommand: parsed.fixCommand || (lastCmd.startsWith('sudo ') ? lastCmd : `sudo ${lastCmd}`),
      })
    } catch {
      // 5. High-precision rule heuristics
      const lower = (lastErr + cleanText).toLowerCase()
      const isPermission = lower.includes('permission denied') || lower.includes('cannot lock') || lower.includes('must be root') || lower.includes('are you root')
      const isNotFound = lower.includes('command not found') || lower.includes('not found')
      const isSystemd = lastCmd.includes('systemctl')
      
      let fix = `sudo ${lastCmd}`
      if (isNotFound && !isSystemd) {
        const bin = lastCmd.split(' ')[0]
        fix = `sudo dnf install -y ${bin}`
      } else if (isSystemd) {
        const svc = lastCmd.split(' ').slice(-1)[0]
        fix = `sudo systemctl restart ${svc}`
      }

      setAiAnalysis({
        whyFailed: isPermission ? `Command '${lastCmd}' requires elevated root permissions.` : (isNotFound ? `Command '${lastCmd.split(' ')[0]}' is not installed.` : `Command '${lastCmd}' encountered an error.`),
        rootCause: isPermission ? 'Executing user lacks superuser authority for this file/system operation.' : (isNotFound ? 'Binary was not found in $PATH.' : lastErr || 'Non-zero return code.'),
        recommendedFix: isPermission ? `Execute with 'sudo' to grant administrative privileges.` : (isNotFound ? `Install the package using DNF.` : 'Inspect service logs and status.'),
        fixCommand: fix,
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div
      className={`flex flex-col h-full ${
        isFullScreen ? 'fixed inset-0 z-50 p-0' : 'p-3'
      } font-mono animate-fade-in select-text overflow-hidden bg-[#090d13]`}
    >
      {/* ── 1. FUTURISTIC TERMINAL WINDOW FRAME ────────────────────────────────── */}
      <div className="flex-1 flex flex-col rounded-xl border border-slate-800/90 shadow-2xl overflow-hidden bg-[#06090e]">
        {/* Window Titlebar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-black/60 border-b border-slate-800/80 shrink-0 select-none gap-3 min-h-[44px]">
          {/* Traffic Lights & Tabs */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0 mr-1">
              <span
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send('clear\r')
                  }
                }}
                className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 cursor-pointer transition-colors shrink-0"
                title="Clear Terminal Screen"
              />
              <span
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send('\x03') // Ctrl+C
                  }
                }}
                className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 cursor-pointer transition-colors shrink-0"
                title="Interrupt Running Process (Ctrl+C)"
              />
              <span
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 cursor-pointer transition-colors shrink-0"
                title="Toggle Fullscreen Mode"
              />
            </div>

            {/* Session Tabs with hidden scrollbar and zero clipping */}
            <div className="flex items-center gap-1.5 scrollbar-none overflow-x-auto min-w-0 py-0.5">
              {tabs.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setActiveTabId(t.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all border whitespace-nowrap select-none ${
                    activeTabId === t.id
                      ? 'bg-slate-800/95 border-slate-700 text-white shadow-sm ring-1 ring-emerald-500/30'
                      : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <TerminalIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="whitespace-nowrap font-mono">{t.title}</span>
                  {tabs.length > 1 && (
                    <X
                      className="w-3 h-3 text-slate-500 hover:text-rose-400 ml-1 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTabs((prev) => prev.filter((item) => item.id !== t.id))
                        if (activeTabId === t.id) setActiveTabId(tabs[0].id)
                      }}
                    />
                  )}
                </div>
              ))}
              {tabs.length < 4 && (
                <button
                  onClick={() => {
                    if (tabs.length >= 4) return
                    const newId = `session-${Date.now().toString().slice(-4)}`
                    setTabs((prev) => [
                      ...prev,
                      {
                        id: newId,
                        title: `bash #${prev.length + 1}`,
                      },
                    ])
                    setActiveTabId(newId)
                  }}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                  title="Create New Interactive Shell Session (Max 4)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Window Right Action Tools */}
          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap ml-auto">
            <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded-md border border-slate-800 shrink-0 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <strong className="text-emerald-300">{sshInfo.user}</strong>
              <span>@</span>
              <strong className="text-blue-300">{sshInfo.host}</strong>
              <span className="text-slate-500 font-sans text-[10px]">({sshInfo.latencyMs}ms)</span>
            </span>

            {/* AI Troubleshoot Button */}
            <button
              onClick={handleRunAiTroubleshoot}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all shrink-0 whitespace-nowrap shadow-sm"
              title="Diagnose Terminal Errors with AI Troubleshooter"
            >
              <Stethoscope className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>AI Doctor</span>
            </button>

            {/* AI Copilot Toggle */}
            <button
              onClick={() => setShowAiBar(!showAiBar)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border shrink-0 whitespace-nowrap ${
                showAiBar
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-900 text-amber-300 border-slate-800 hover:border-amber-500/40'
              }`}
              title="Toggle AI Copilot Natural Language Bar"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="hidden sm:inline">Copilot</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-1.5 rounded-md border transition-colors shrink-0 ${
                soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title={soundEnabled ? 'Audio: ON' : 'Audio: OFF'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* Theme Selector */}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as typeof theme)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-md px-2 py-1 focus:outline-none cursor-pointer shrink-0"
            >
              <option value="rhel">RHEL Dark</option>
              <option value="kali">Kali Cyan</option>
              <option value="matrix">Matrix Green</option>
              <option value="nord">Nord Polar</option>
              <option value="ubuntu">Ubuntu</option>
              <option value="synthwave">Synthwave</option>
            </select>

            {/* Web Vim */}
            <button
              onClick={() => {
                setVimFilePath('notes.txt')
                setVimModalOpen(true)
              }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-xs transition-colors shrink-0 whitespace-nowrap"
              title="Open Built-in Web Vim Buffer"
            >
              <span>Vim</span>
            </button>
          </div>
        </div>






        {/* ── 2. REAL INTERACTIVE PTY XTERM.JS CANVAS ─────────────────────────── */}
        <div
          ref={terminalContainerRef}
          className="flex-1 p-2 overflow-hidden cursor-text"
          style={{ backgroundColor: THEME_PRESETS[theme].background }}
        />

        {/* ── 3. BOTTOM TELEMETRY STATUSBAR FOOTER ────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between px-4 py-1.5 bg-black/60 border-t border-slate-800/80 text-[11px] text-slate-400 shrink-0 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>CPU:</span>
              <strong className="text-blue-300">{telemetry.cpu}%</strong>
            </span>

            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>RAM:</span>
              <strong className="text-purple-300">{telemetry.ram}%</strong>
            </span>

            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>DISK:</span>
              <strong className="text-amber-300">{telemetry.disk}%</strong>
            </span>

            <span className="hidden sm:flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-emerald-400" />
              <span>IP:</span>
              <strong className="text-emerald-300">{telemetry.ip}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PTY LIVE
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Ctrl+C Interrupt</span>
          </div>
        </div>
      </div>

      {/* ── AI TROUBLESHOOTER SIDE DRAWER ─────────────────────────────────────── */}
      {aiDrawerOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0f172a] border-l border-slate-700 shadow-2xl p-5 flex flex-col space-y-4 font-mono animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Stethoscope className="w-4 h-4" />
              <span>AI Terminal Troubleshooter</span>
            </div>
            <button
              onClick={() => setAiDrawerOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 text-xs">
            {isAnalyzing ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                <p className="text-slate-300">Analyzing terminal output & diagnosing root causes...</p>
              </div>
            ) : aiAnalysis ? (
              <>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-amber-400 font-bold block text-[10px] uppercase">
                    Failure Diagnosis
                  </span>
                  <p className="text-slate-200 font-sans text-xs">{aiAnalysis.whyFailed}</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-amber-400 font-bold block text-[10px] uppercase">
                    Root Cause
                  </span>
                  <p className="text-slate-300 font-sans text-xs">{aiAnalysis.rootCause}</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-emerald-400 font-bold block text-[10px] uppercase">
                    Recommended Fix Advice
                  </span>
                  <p className="text-slate-300 font-sans text-xs">{aiAnalysis.recommendedFix}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-2">
                  <span className="text-amber-300 font-bold block text-xs">
                    Suggested Fix Command:
                  </span>
                  <code className="block p-2 bg-black/80 rounded border border-slate-800 text-amber-200 text-xs break-all">
                    {aiAnalysis.fixCommand}
                  </code>
                  <button
                    onClick={() => {
                      if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(aiAnalysis.fixCommand + '\r')
                        xtermRef.current?.focus()
                        setAiDrawerOpen(false)
                      }
                    }}
                    className="w-full py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Send Fix to Running Terminal</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── WEB VIM MODAL ────────────────────────────────────────────────────── */}
      <VimEditorModal
        isOpen={vimModalOpen}
        filePath={vimFilePath}
        onClose={() => setVimModalOpen(false)}
        onSaveSuccess={(file) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(`echo "[Vim Saved: ${file}]"\r`)
          }
        }}
      />
    </div>
  )
}
