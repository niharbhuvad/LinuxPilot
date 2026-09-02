import React, { useRef, useEffect, useState } from 'react'
import {
  Mic, MicOff, Volume2, VolumeX, Trash2, ShieldAlert, CheckCircle2,
  RefreshCw, Sliders, Heart, AlertTriangle, Zap, Activity, Maximize2,
  Minimize2, Terminal, Send, Search, Brain, History, Sparkles, X, ChevronRight, MessageSquare, Globe
} from 'lucide-react'
import { useVoiceAssistant, ChatMessage, AiMode, SUPPORTED_LANGUAGES } from '../context/VoiceAssistantContext'
import ParticleSphere from '../components/ParticleSphere'
import RobotAvatar from '../components/RobotAvatar'
import clsx from 'clsx'

const sampleVoicePrompts = [
  { label: '🧠 Memory & Swap', prompt: 'Show current memory usage and swap state on the connected system' },
  { label: '🔥 Top CPU Procs', prompt: 'Show top 5 processes consuming CPU right now' },
  { label: '💾 Storage Health', prompt: 'Check disk storage space usage and filesystem health' },
  { label: '⚡ Failed Services', prompt: 'Check if any system services have failed or are degraded' },
  { label: '🌐 Network & Ports', prompt: 'Show active listening ports and network sockets' },
  { label: '🖥️ System Overview', prompt: 'Give me a full overview of this connected system — hostname, OS, uptime, CPU, RAM, disk' },
  { label: '📋 Recent Logs', prompt: 'Show recent system journal errors and warnings' },
  { label: '🔒 Security Audit', prompt: 'Run a basic security check on this system' },
]

const emotionColors: Record<string, string> = {
  neutral: 'text-cyan-400',
  happy: 'text-emerald-400',
  caring: 'text-pink-400',
  alert: 'text-amber-400',
  proud: 'text-violet-400',
  thinking: 'text-purple-400',
  greeting: 'text-yellow-400',
}

const emotionEmojis: Record<string, string> = {
  neutral: '🤖',
  happy: '😊',
  caring: '🙏',
  alert: '⚠️',
  proud: '✨',
  thinking: '🧠',
  greeting: '🙏',
}

// ── Lightweight Markdown Renderer ──
function SimpleMarkdown({ content }: { content: string }) {
  if (!content) return null
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeBuffer: string[] = []

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${idx}`} className="p-3 bg-black/90 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto my-2 leading-relaxed" style={{ scrollbarWidth: 'thin' }}>
            {codeBuffer.join('\n')}
          </pre>
        )
        codeBuffer = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      return
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      return
    }

    if (!line.trim()) {
      elements.push(<div key={`sp-${idx}`} className="h-1.5" />)
      return
    }

    const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx} className="font-semibold text-cyan-200">{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={pIdx} className="px-1.5 py-0.5 rounded bg-black/60 border border-slate-800 text-cyan-300 font-mono text-[11px]">{part.slice(1, -1)}</code>
      }
      return part
    })

    if (line.startsWith('### ')) {
      elements.push(<h3 key={`h3-${idx}`} className="text-sm font-bold text-cyan-300 mt-2 mb-1">{parts}</h3>)
    } else if (line.startsWith('#### ')) {
      elements.push(<h4 key={`h4-${idx}`} className="text-xs font-bold text-slate-200 mt-1.5 mb-1">{parts}</h4>)
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <li key={`li-${idx}`} className="ml-4 list-disc text-slate-200 leading-relaxed my-0.5">
          {parts}
        </li>
      )
    } else {
      elements.push(
        <p key={`p-${idx}`} className="text-[13px] leading-relaxed text-slate-200">
          {parts}
        </p>
      )
    }
  })

  return <div className="space-y-1">{elements}</div>
}

// ── Organic Dual-Tone Audio Waveform ──
function DualToneAudioWaveform({ isActive, barCount = 48 }: { isActive: boolean; barCount?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const barsRef = useRef<Float32Array>(new Float32Array(barCount).fill(0.05))
  const velocityRef = useRef<Float32Array>(new Float32Array(barCount).fill(0))
  const phaseRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const logW = 380
    const logH = 52
    canvas.width = logW * dpr
    canvas.height = logH * dpr
    canvas.style.width = `${logW}px`
    canvas.style.height = `${logH}px`
    ctx.scale(dpr, dpr)

    const draw = () => {
      ctx.clearRect(0, 0, logW, logH)
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'

      phaseRef.current += isActive ? 0.06 : 0.02
      const phase = phaseRef.current

      const gap = 2.5
      const barWidth = Math.max(2.5, (logW - gap * barCount) / barCount)
      const centerY = logH / 2

      const bars = barsRef.current
      const vels = velocityRef.current

      for (let i = 0; i < barCount; i++) {
        const norm = i / (barCount - 1)
        const leftHump = Math.exp(-Math.pow((norm - 0.2) * 4.5, 2))
        const rightHump = Math.exp(-Math.pow((norm - 0.8) * 4.5, 2))
        const centerDip = 0.3 + 0.15 * Math.sin(norm * Math.PI * 3)
        const envelope = 0.15 + 0.75 * (leftHump + rightHump * 0.9) + centerDip * 0.12

        const wave = Math.sin(norm * 14 + phase) * 0.18
          + Math.cos(norm * 9 - phase * 1.4) * 0.12
          + Math.sin(norm * 21 + phase * 0.7) * 0.06

        let target: number
        if (isActive) {
          const randomJitter = (Math.random() - 0.5) * 0.3
          target = Math.max(0.06, (envelope + wave + randomJitter) * 0.85)
        } else {
          target = Math.max(0.04, envelope * 0.15 + Math.sin(phase * 0.5 + norm * 5) * 0.04 + 0.06)
        }

        const springK = isActive ? 0.08 : 0.03
        const damping = 0.82
        const force = (target - bars[i]) * springK
        vels[i] = vels[i] * damping + force
        bars[i] += vels[i]
        bars[i] = Math.max(0.02, Math.min(1, bars[i]))
      }

      for (let i = 0; i < barCount; i++) {
        const norm = i / (barCount - 1)
        const val = bars[i]
        const barHeight = Math.max(2, val * (logH * 0.45))
        const x = i * (barWidth + gap)

        let r: number, g: number, b: number
        if (norm < 0.4) {
          const t = norm / 0.4
          r = Math.round(0 + 139 * t)
          g = Math.round(220 + (92 - 220) * t)
          b = Math.round(255 + (246 - 255) * t)
        } else {
          const t = (norm - 0.4) / 0.6
          r = Math.round(139 + (236 - 139) * t)
          g = Math.round(92 + (72 - 92) * t)
          b = Math.round(246 + (153 - 246) * t)
        }

        const color = `rgb(${r},${g},${b})`
        const grad = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight)
        grad.addColorStop(0, `rgba(${r},${g},${b},0.6)`)
        grad.addColorStop(0.3, color)
        grad.addColorStop(0.5, color)
        grad.addColorStop(0.7, color)
        grad.addColorStop(1, `rgba(${r},${g},${b},0.6)`)

        ctx.fillStyle = grad

        if (isActive && val > 0.3) {
          ctx.shadowColor = color
          ctx.shadowBlur = 6
        } else {
          ctx.shadowBlur = 0
        }

        const radius = Math.min(barWidth / 2, 3)
        const bx = x
        const by = centerY - barHeight
        const bw = barWidth
        const bh = barHeight * 2

        ctx.beginPath()
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, by, bw, bh, radius)
        } else {
          ctx.rect(bx, by, bw, bh)
        }
        ctx.fill()
      }

      ctx.shadowBlur = 0
      animationRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animationRef.current)
  }, [isActive, barCount])

  return (
    <canvas
      ref={canvasRef}
      className="block w-full max-w-[380px]"
      style={{ height: '52px' }}
    />
  )
}

export default function VoiceAssistantPage() {
  const {
    voiceStatus, emotionState,
    startListening, stopListening,
    isMuted, setIsMuted,
    messages, sendMessage, transcript, speakText,
    clearConversation,
    pendingApproval, approveCommand, cancelCommand,
    voiceSettings, updateSettings,
    systemHealth,
    aiMode, setAiMode, audioLevel, currentThoughtStep,
    conversations, loadConversations, selectConversation, availableVoices
  } = useVoiceAssistant()

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [textInput, setTextInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false)
  const [immersiveMode, setImmersiveMode] = useState(false)
  const [sliderPosition, setSliderPosition] = useState(18)

  const isListening = voiceStatus === 'listening'
  const isSpeaking = voiceStatus === 'speaking'
  const isThinking = voiceStatus === 'thinking'
  const isExecuting = voiceStatus === 'executing'
  const isBusy = isThinking || isExecuting || isSpeaking || voiceStatus === 'greeting'

  // Animate slider when listening
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        setSliderPosition(prev => (prev >= 92 ? 12 : prev + 0.8))
      }, 40)
      return () => clearInterval(interval)
    } else {
      setSliderPosition(18)
    }
  }, [isListening])

  // Keyboard shortcut: Press Space key to toggle mic when input not focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement !== inputRef.current && (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')) {
        e.preventDefault()
        if (isListening) stopListening()
        else if (!isBusy) startListening()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isListening, isBusy, startListening, stopListening])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleTextSend = () => {
    if (textInput.trim()) {
      sendMessage(textInput)
      setTextInput('')
    }
  }

  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === voiceSettings.language) || SUPPORTED_LANGUAGES[0]

  const statusConfig: Record<string, { title: string; subtitle: string }> = {
    idle: { title: 'LinuxAI Voice', subtitle: `Ready in ${currentLangObj.nativeName} • Speak or type command` },
    listening: { title: 'Listening...', subtitle: `Listening in ${currentLangObj.nativeName}... Speak now!` },
    thinking: { title: 'Analyzing...', subtitle: 'Reasoning about your request...' },
    executing: { title: 'Executing...', subtitle: 'Running Linux command on server...' },
    speaking: { title: 'Speaking Answer', subtitle: `Speaking in ${currentLangObj.nativeName}...` },
    completed: { title: 'Completed', subtitle: 'Task finished successfully' },
    greeting: { title: 'Namaste 🙏', subtitle: 'Welcome to AI Linux Assistant' },
  }

  const currentStatus = statusConfig[voiceStatus] || statusConfig.idle

  return (
    <div className="h-full flex flex-col bg-[#050811] text-slate-100 overflow-hidden select-none relative">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between border-b border-cyan-950/40 bg-[#070b16]/80 backdrop-blur-md px-5 py-2 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
            <span className="text-xs font-mono font-bold tracking-wider text-cyan-300">LINUXAI VOICE</span>
          </div>
          {systemHealth && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-slate-400">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>CPU {Math.round(systemHealth.cpuPercent)}%</span>
              <span>RAM {Math.round(systemHealth.memoryPercent)}%</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400">{systemHealth.hostname}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Multi-language Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded-lg px-2 py-1 text-[11px] font-mono text-cyan-300 transition-all">
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={voiceSettings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
              className="bg-transparent text-slate-200 outline-none cursor-pointer text-[11px] font-medium"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-200">
                  {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (!showHistoryDrawer) loadConversations()
              setShowHistoryDrawer(!showHistoryDrawer)
            }}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono transition-all cursor-pointer',
              showHistoryDrawer ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            )}
            title="Chat History"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
          </button>
          <button
            onClick={() => setImmersiveMode(!immersiveMode)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 text-[10px] font-mono text-slate-300 hover:text-cyan-400 transition-all cursor-pointer"
          >
            {immersiveMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{immersiveMode ? 'Split' : 'Focus'}</span>
          </button>
          <button
            onClick={() => updateSettings({ continuousMode: !voiceSettings.continuousMode })}
            className={clsx(
              'px-2 py-1 rounded-lg text-[10px] font-mono transition-all border flex items-center gap-1 cursor-pointer',
              voiceSettings.continuousMode
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800'
            )}
          >
            <RefreshCw className={clsx('w-3 h-3', voiceSettings.continuousMode && 'animate-spin')} style={{ animationDuration: '4s' }} />
            <span>{voiceSettings.continuousMode ? 'Auto' : 'Manual'}</span>
          </button>
          <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer">
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer">
            <Sliders className="w-3.5 h-3.5" />
          </button>
          <button onClick={clearConversation} className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Settings Drawer ── */}
      {showSettings && (
        <div className="border-b border-cyan-950/50 px-5 py-2 bg-[#080d1b] flex flex-wrap items-center gap-4 shrink-0 z-20">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Voice Engine:</span>
            <select
              value={voiceSettings.selectedVoiceURI || ''}
              onChange={(e) => updateSettings({ selectedVoiceURI: e.target.value })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-cyan-300 text-xs outline-none focus:border-cyan-500 max-w-[210px] truncate"
            >
              <option value="">✨ Auto (Best Human Voice)</option>
              {availableVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI} className="bg-slate-900 text-slate-200">
                  {v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Online') ? '✨ ' : ''}
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <button
              onClick={() => speakText('Hello Mahesh! Testing natural human voice output.', 'happy')}
              className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono hover:bg-cyan-900/60 cursor-pointer"
            >
              🔊 Test Voice
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Persona:</span>
            <select
              value={voiceSettings.voicePersona}
              onChange={(e) => updateSettings({ voicePersona: e.target.value as any })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-slate-200 text-xs outline-none focus:border-cyan-500"
            >
              <option value="vedic-soft">🇮🇳 Vedic Soft</option>
              <option value="hindi">🇮🇳 Hindi</option>
              <option value="standard-indian">🇮🇳 Indian English</option>
              <option value="default">Default AI</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Speed {voiceSettings.speed}x:</span>
            <input type="range" min="0.7" max="1.3" step="0.05" value={voiceSettings.speed}
              onChange={(e) => updateSettings({ speed: parseFloat(e.target.value) })}
              className="w-20 accent-cyan-400 cursor-pointer" />
          </div>
          <button onClick={() => updateSettings({ autoGreet: !voiceSettings.autoGreet })}
            className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono border cursor-pointer', voiceSettings.autoGreet ? 'bg-pink-950/30 text-pink-400 border-pink-500/30' : 'bg-slate-900 text-slate-500 border-slate-800')}>
            <Heart className="w-3 h-3" /> Greet {voiceSettings.autoGreet ? 'ON' : 'OFF'}
          </button>
          <button onClick={() => updateSettings({ healthAlerts: !voiceSettings.healthAlerts })}
            className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono border cursor-pointer', voiceSettings.healthAlerts ? 'bg-amber-950/30 text-amber-400 border-amber-500/30' : 'bg-slate-900 text-slate-500 border-slate-800')}>
            <AlertTriangle className="w-3 h-3" /> Alerts {voiceSettings.healthAlerts ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

      {/* ── Conversation History Drawer ── */}
      {showHistoryDrawer && (
        <div className="absolute right-0 top-12 bottom-0 w-72 bg-[#080d1a] border-l border-cyan-950/60 z-30 p-4 flex flex-col shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Saved Conversations</span>
            </div>
            <button onClick={() => setShowHistoryDrawer(false)} className="text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs" style={{ scrollbarWidth: 'thin' }}>
            {conversations.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs">No saved history found</div>
            ) : (
              conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    selectConversation(c.id)
                    setShowHistoryDrawer(false)
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-900/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/40 transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-slate-200 font-medium truncate">
                    <span className="truncate">{c.title}</span>
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Main Layout ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0 relative">

        {/* ─── LEFT: Voice Visualizer ─── */}
        <div className={clsx(
          'flex flex-col items-center justify-between py-4 px-4 relative overflow-hidden min-h-0 transition-all duration-300',
          immersiveMode ? 'lg:col-span-12' : 'lg:col-span-5 xl:col-span-5 border-r border-cyan-950/30'
        )}>

          {/* Ambient background glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-600/[0.06] blur-[140px] pointer-events-none" />
          <div className="absolute top-1/2 left-[55%] -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-pink-600/[0.05] blur-[120px] pointer-events-none" />

          {/* 1. Branded Header: Dynamic Title + Clean Subtitle Ticker */}
          <div className="relative z-10 flex flex-col items-center text-center shrink-0 w-full max-w-md">

            {/* Main Dynamic Status Title */}
            <h1 className={clsx(
              'text-2xl sm:text-3xl font-black font-mono tracking-tight transition-all duration-500 flex items-center justify-center gap-2',
              isListening ? 'text-cyan-300 drop-shadow-[0_0_25px_rgba(0,240,255,0.6)]' :
              isThinking ? 'text-purple-300 drop-shadow-[0_0_25px_rgba(168,85,247,0.6)]' :
              isSpeaking ? 'text-pink-300 drop-shadow-[0_0_25px_rgba(236,72,153,0.6)]' :
              isExecuting ? 'text-amber-300 drop-shadow-[0_0_25px_rgba(245,158,11,0.6)]' :
              'text-cyan-200 drop-shadow-[0_0_18px_rgba(0,240,255,0.4)]'
            )}>
              <Terminal className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span>{currentStatus.title}</span>
            </h1>

            {/* Clean Subtitle / Dynamic Thought Ticker */}
            <p className={clsx(
              'mt-2 text-xs font-mono max-w-[360px] leading-relaxed transition-all tracking-wide text-center',
              currentThoughtStep ? 'text-purple-300 font-bold animate-pulse' :
              isListening && transcript ? 'text-cyan-200 font-semibold' : 'text-slate-400'
            )}>
              {currentThoughtStep ? (
                <span>{currentThoughtStep} <span className="animate-ping">_</span></span>
              ) : transcript && isListening ? (
                <span>"{transcript}" <span className="animate-pulse">|</span></span>
              ) : (
                <span>{currentStatus.subtitle}</span>
              )}
            </p>

          </div>

          {/* 2. Hero Visualizer: Epic Robot Companion with Glowing 3D Neural Particle Halo */}
          <div className="relative z-10 flex-1 flex items-center justify-center w-full min-h-0 my-2">
            
            {/* Ambient 3D Particle Halo */}
            <div className="absolute inset-0 flex items-center justify-center opacity-70 pointer-events-none">
              <ParticleSphere
                status={voiceStatus}
                emotionState={emotionState}
                size={immersiveMode ? 360 : 300}
                audioLevel={audioLevel || (isListening ? 0.6 : 0)}
              />
            </div>

            {/* Prominent Hero Robot AI Avatar Companion */}
            <RobotAvatar
              status={voiceStatus}
              emotionState={emotionState}
              size={immersiveMode ? 320 : 250}
              audioLevel={audioLevel}
              className="z-20 transition-all duration-500"
            />
          </div>

          {/* 3. Audio Waveform */}
          <div className="relative z-10 flex justify-center w-full shrink-0">
            <DualToneAudioWaveform
              isActive={isListening || isSpeaking}
              barCount={48}
            />
          </div>

          {/* 4. Mic Button */}
          <div className="relative z-10 flex flex-col items-center mt-2 mb-1 shrink-0">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isThinking || isExecuting}
              aria-label="Voice input toggle"
              className={clsx(
                'group relative w-[72px] h-[72px] rounded-full p-[3px] transition-all duration-300 flex items-center justify-center cursor-pointer',
                isListening
                  ? 'bg-gradient-to-tr from-rose-500 via-pink-500 to-cyan-400 shadow-[0_0_40px_rgba(244,63,94,0.5)] scale-110'
                  : 'bg-gradient-to-tr from-cyan-400 via-indigo-500 to-pink-500 shadow-[0_0_30px_rgba(0,200,255,0.25),0_0_30px_rgba(236,72,153,0.2)] hover:scale-105 active:scale-95',
                (isThinking || isExecuting) && 'opacity-40 cursor-not-allowed scale-100'
              )}
            >
              <div className="w-full h-full rounded-full bg-[#080d1a] flex items-center justify-center border border-slate-700/40 group-hover:bg-[#0c1325] transition-colors">
                {isListening ? (
                  <MicOff className="w-7 h-7 text-rose-400 animate-pulse" />
                ) : (
                  <Mic className="w-7 h-7 text-white/90 group-hover:text-cyan-300 transition-colors" />
                )}
              </div>
              {isListening && (
                <span className="absolute inset-[-4px] rounded-full border-2 border-pink-400/40 animate-ping pointer-events-none" />
              )}
            </button>

            <p className={clsx(
              'mt-2 text-[11px] font-medium tracking-wide flex items-center gap-1.5',
              isListening ? 'text-rose-400' : 'text-slate-500'
            )}>
              <span>{isListening ? 'Tap to stop' : voiceSettings.continuousMode ? 'Continuous mode' : 'Tap or press Space to speak'}</span>
            </p>
          </div>

          {/* Immersive mode input bar */}
          {immersiveMode && (
            <div className="relative z-10 w-full max-w-xl mt-3 shrink-0">
              <div className="flex items-center gap-2 bg-[#090e1d]/90 border border-slate-800 rounded-2xl p-1.5">
                <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
                  placeholder="Ask anything or command your Linux system..."
                  disabled={isBusy}
                  className="flex-1 bg-transparent px-4 py-2 text-sm font-mono text-slate-200 placeholder:text-slate-500 outline-none" />
                <button onClick={handleTextSend} disabled={isBusy || !textInput.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 text-xs font-mono font-semibold transition-all disabled:opacity-30 cursor-pointer">
                  Send
                </button>
              </div>
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {sampleVoicePrompts.slice(0, 4).map(({ label, prompt }) => (
                  <button key={prompt} onClick={() => sendMessage(prompt)} disabled={isBusy}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-cyan-300/80 hover:border-cyan-500/50 transition-all cursor-pointer disabled:opacity-30 shrink-0">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Conversation Panel ─── */}
        {!immersiveMode && (
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col overflow-hidden min-h-0 bg-[#060914]">

            {/* Quick Prompts */}
            <div className="px-4 py-2 border-b border-slate-800/50 shrink-0 overflow-x-auto bg-[#080d1a]">
              <div className="flex gap-1.5" style={{ scrollbarWidth: 'none' }}>
                {sampleVoicePrompts.map(({ label, prompt }) => (
                  <button key={prompt} onClick={() => sendMessage(prompt)} disabled={isBusy}
                    className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/40 transition-all cursor-pointer disabled:opacity-30 shrink-0">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Approval Banner */}
            {pendingApproval && (
              <div className="mx-4 mt-3 bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 font-mono shrink-0">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>COMMAND CONFIRMATION REQUIRED</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">{pendingApproval.riskTier}</span>
                </div>
                <p className="text-xs text-slate-200 mb-2">{pendingApproval.explanation}</p>
                <div className="p-2 bg-black/80 rounded-xl border border-amber-500/30 text-xs text-amber-300 font-mono mb-2.5">
                  <code>$ {pendingApproval.command}</code>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={cancelCommand} className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer">Cancel</button>
                  <button onClick={approveCommand} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs cursor-pointer">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Run
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <Terminal className="w-10 h-10 text-slate-700 mb-3" />
                  <p className="text-sm font-mono text-slate-400">Ready for voice or text commands</p>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm">
                    Say "Check memory usage", "Show failed services", or tap any quick prompt above.
                  </p>
                </div>
              ) : (
                messages.map((msg: ChatMessage) => (
                  <div key={msg.id}
                    className={clsx(
                      'group relative rounded-2xl text-xs space-y-2 p-3.5 transition-all',
                      msg.sender === 'user'
                        ? 'ml-12 bg-cyan-950/30 border border-cyan-500/25'
                        : 'mr-6 bg-slate-900/80 border border-slate-800'
                    )}>
                    <div className="flex items-center justify-between">
                      <span className={clsx('text-[11px] font-mono font-bold', msg.sender === 'user' ? 'text-cyan-400' : emotionColors[msg.emotion || 'neutral'])}>
                        {msg.sender === 'user' ? '🎤 You' : `${emotionEmojis[msg.emotion || 'neutral']} AI Assistant`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {msg.sender === 'assistant' && (
                          <button
                            onClick={() => speakText(msg.text, msg.emotion)}
                            title="Speak answer out loud in active language"
                            className="p-1 rounded-md bg-slate-800/60 hover:bg-cyan-950/60 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer border border-slate-700/40"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-[10px] font-mono text-slate-500">{msg.timestamp}</span>
                      </div>
                    </div>

                    {/* Formatted Markdown Output */}
                    <SimpleMarkdown content={msg.text} />

                    {msg.command && (
                      <div className="p-2.5 bg-black/80 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300 flex items-center gap-2">
                        <span className="text-slate-500">$</span>
                        <code>{msg.command}</code>
                      </div>
                    )}

                    {msg.commandOutput && (
                      <pre className="p-3 bg-black/90 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48 leading-relaxed" style={{ scrollbarWidth: 'thin' }}>
                        {msg.commandOutput}
                      </pre>
                    )}

                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                        {msg.suggestedActions.map((sa, idx) => (
                          <button key={idx} onClick={() => sendMessage(sa.action)}
                            className="px-2.5 py-1 bg-slate-950 border border-cyan-500/30 text-cyan-300 rounded-lg hover:bg-cyan-950/40 transition-all text-[10px] font-mono cursor-pointer">
                            {sa.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              {isThinking && (
                <div className="mr-6 p-4 bg-slate-900/90 border border-purple-500/30 rounded-2xl animate-pulse space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-purple-400">
                      {aiMode === 'deep-search' ? '🔎 Deep Searching System...' : '🧠 AI Reasoning...'}
                    </span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
                      ))}
                    </div>
                  </div>
                  <div className="h-2.5 bg-purple-500/10 rounded w-3/4" />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-800/80 bg-[#080c18] shrink-0">
              <div className="flex items-center gap-2">
                <input ref={inputRef} type="text" value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
                  placeholder="Type Linux command or natural query..."
                  disabled={isBusy}
                  className="flex-1 bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/50 transition-all disabled:opacity-40" />
                <button onClick={handleTextSend} disabled={isBusy || !textInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 transition-all disabled:opacity-20 text-xs font-mono font-semibold cursor-pointer">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
