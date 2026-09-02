import React, { useRef, useEffect, useState } from 'react'
import { Mic, MicOff, Volume2, VolumeX, X, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { useVoiceAssistant } from '../context/VoiceAssistantContext'
import ParticleSphere from './ParticleSphere'
import RobotAvatar from './RobotAvatar'
import clsx from 'clsx'

// ── Compact Dual-Tone Waveform for the modal overlay ──
function ModalWaveform({ isActive }: { isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const barsRef = useRef<Float32Array>(new Float32Array(32).fill(0.05))
  const velsRef = useRef<Float32Array>(new Float32Array(32).fill(0))
  const phaseRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const logW = 260
    const logH = 40
    canvas.width = logW * dpr
    canvas.height = logH * dpr
    canvas.style.width = `${logW}px`
    canvas.style.height = `${logH}px`
    ctx.scale(dpr, dpr)

    const barCount = 32

    const draw = () => {
      ctx.clearRect(0, 0, logW, logH)
      ctx.shadowBlur = 0

      phaseRef.current += isActive ? 0.07 : 0.02
      const phase = phaseRef.current
      const gap = 2
      const barWidth = Math.max(2, (logW - gap * barCount) / barCount)
      const centerY = logH / 2
      const bars = barsRef.current
      const vels = velsRef.current

      for (let i = 0; i < barCount; i++) {
        const norm = i / (barCount - 1)
        const env = 0.15 + 0.7 * (
          Math.exp(-Math.pow((norm - 0.2) * 4.5, 2)) +
          Math.exp(-Math.pow((norm - 0.8) * 4.5, 2)) * 0.9
        )
        const wave = Math.sin(norm * 14 + phase) * 0.15 + Math.cos(norm * 9 - phase * 1.4) * 0.1

        let target: number
        if (isActive) {
          target = Math.max(0.06, (env + wave + (Math.random() - 0.5) * 0.25) * 0.8)
        } else {
          target = Math.max(0.04, env * 0.12 + Math.sin(phase * 0.5 + norm * 5) * 0.03 + 0.05)
        }

        const k = isActive ? 0.08 : 0.03
        vels[i] = vels[i] * 0.82 + (target - bars[i]) * k
        bars[i] = Math.max(0.02, Math.min(1, bars[i] + vels[i]))
      }

      for (let i = 0; i < barCount; i++) {
        const norm = i / (barCount - 1)
        const val = bars[i]
        const barHeight = Math.max(2, val * (logH * 0.42))
        const x = i * (barWidth + gap)

        let r: number, g: number, b: number
        if (norm < 0.4) {
          const t = norm / 0.4
          r = Math.round(139 * t); g = Math.round(220 + (92 - 220) * t); b = Math.round(255 + (246 - 255) * t)
        } else {
          const t = (norm - 0.4) / 0.6
          r = Math.round(139 + (236 - 139) * t); g = Math.round(92 + (72 - 92) * t); b = Math.round(246 + (153 - 246) * t)
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`
        if (isActive && val > 0.3) { ctx.shadowColor = `rgb(${r},${g},${b})`; ctx.shadowBlur = 5 } else { ctx.shadowBlur = 0 }

        const rad = Math.min(barWidth / 2, 2.5)
        ctx.beginPath()
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, centerY - barHeight, barWidth, barHeight * 2, rad)
        } else {
          ctx.rect(x, centerY - barHeight, barWidth, barHeight * 2)
        }
        ctx.fill()
      }

      ctx.shadowBlur = 0
      animationRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animationRef.current)
  }, [isActive])

  return <canvas ref={canvasRef} className="block mx-auto" style={{ width: 260, height: 40 }} />
}

export const FloatingVoiceButton: React.FC = () => {
  const {
    voiceStatus, startListening, stopListening,
    isMuted, setIsMuted, transcript, messages,
    pendingApproval, approveCommand, cancelCommand,
    isOverlayOpen, setIsOverlayOpen
  } = useVoiceAssistant()

  const [sliderPos, setSliderPos] = useState(18)

  const isListening = voiceStatus === 'listening'
  const isBusy = voiceStatus === 'thinking' || voiceStatus === 'executing' || voiceStatus === 'speaking'

  useEffect(() => {
    if (isListening) {
      const iv = setInterval(() => setSliderPos(p => p >= 90 ? 12 : p + 1.5), 50)
      return () => clearInterval(iv)
    } else {
      setSliderPos(18)
    }
  }, [isListening])

  const lastMessage = messages[messages.length - 1]

  const statusTitle =
    voiceStatus === 'listening' ? 'Listening...' :
      voiceStatus === 'thinking' ? 'Analyzing...' :
        voiceStatus === 'executing' ? 'Executing...' :
          voiceStatus === 'speaking' ? 'Speaking...' : 'LinuxAI Voice'

  return (
    <>
      {/* Floating Trigger */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOverlayOpen(true)}
          className={clsx(
            'group flex items-center gap-2 px-4 py-3 rounded-full font-mono text-xs font-semibold shadow-2xl transition-all duration-300 border cursor-pointer',
            isListening || isBusy
              ? 'bg-gradient-to-r from-cyan-950 via-slate-900 to-pink-950 border-cyan-400/60 text-cyan-200 shadow-cyan-500/30 ring-2 ring-cyan-400/30 scale-105'
              : 'bg-[#090e1c]/90 backdrop-blur-md border-slate-800 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-300'
          )}
        >
          <span className={clsx(
            'w-2.5 h-2.5 rounded-full shrink-0',
            isListening ? 'bg-cyan-400 animate-ping shadow-[0_0_8px_#00f0ff]' :
              isBusy ? 'bg-purple-400 animate-pulse' : 'bg-emerald-400'
          )} />
          <Mic className={clsx('w-4 h-4', isListening && 'animate-bounce text-cyan-300')} />
          <span>{isListening ? 'Listening...' : isBusy ? 'AI Working...' : '● AI Voice'}</span>
        </button>
      </div>

      {/* Modal Overlay */}
      {isOverlayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
          <div className="relative w-full max-w-md bg-[#070b16] border border-cyan-950/50 rounded-3xl p-5 shadow-2xl shadow-cyan-950/50 flex flex-col items-center text-center overflow-hidden">

            {/* Ambient glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full bg-cyan-500/8 blur-[90px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full bg-pink-500/6 blur-[80px] pointer-events-none" />

            {/* Top controls */}
            <div className="w-full flex items-center justify-between pb-1 relative z-10">
              <span className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-wider">LinuxAI Assistant</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer">
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                </button>
                <button onClick={() => setIsOverlayOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Title + Clean Subtitle */}
            <div className="relative z-10 mt-2 flex flex-col items-center">
              <h2 className={clsx(
                'text-2xl font-semibold tracking-tight transition-colors',
                isListening ? 'text-cyan-300 drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-cyan-200'
              )}>
                {statusTitle}
              </h2>
              <p className="mt-1.5 text-[11px] font-mono text-slate-400">
                {transcript && isListening ? `"${transcript}"` : 'Speak now or type a command'}
              </p>
            </div>

            {/* Robot Avatar Visualizer */}
            <div className="my-1 relative z-10 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center opacity-60 pointer-events-none">
                <ParticleSphere status={voiceStatus} size={220} audioLevel={isListening ? 0.6 : 0} />
              </div>
              <RobotAvatar status={voiceStatus} size={180} />
            </div>

            {/* Waveform */}
            <div className="w-full relative z-10 my-1">
              <ModalWaveform isActive={isListening || voiceStatus === 'speaking'} />
            </div>

            {/* Approval */}
            {pendingApproval && (
              <div className="w-full bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3 my-2 text-left font-mono relative z-10">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Confirm Command</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">{pendingApproval.riskTier}</span>
                </div>
                <p className="text-[11px] text-slate-200 mb-1.5">{pendingApproval.explanation}</p>
                <div className="p-2 bg-black/80 rounded-lg border border-amber-500/30 text-[11px] text-amber-300 mb-2">
                  <code>$ {pendingApproval.command}</code>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={cancelCommand} className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-800 cursor-pointer">Cancel</button>
                  <button onClick={approveCommand} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold cursor-pointer">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                </div>
              </div>
            )}

            {/* Last message preview */}
            {!pendingApproval && lastMessage && (
              <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 my-1 text-left font-mono text-[11px] max-h-20 overflow-y-auto relative z-10">
                <p className="text-slate-200">{lastMessage.text}</p>
                {lastMessage.command && (
                  <div className="mt-1 p-1.5 bg-black/60 rounded border border-slate-800 text-[10px] text-cyan-300">
                    <code>$ {lastMessage.command}</code>
                  </div>
                )}
              </div>
            )}

            {/* Mic Button */}
            <div className="mt-2 flex flex-col items-center relative z-10">
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isBusy}
                className={clsx(
                  'group relative w-16 h-16 rounded-full p-[3px] transition-all duration-300 flex items-center justify-center cursor-pointer',
                  isListening
                    ? 'bg-gradient-to-tr from-rose-500 via-pink-500 to-cyan-400 shadow-[0_0_35px_rgba(244,63,94,0.5)] scale-105'
                    : 'bg-gradient-to-tr from-cyan-400 via-indigo-500 to-pink-500 shadow-[0_0_25px_rgba(0,200,255,0.25),0_0_25px_rgba(236,72,153,0.2)] hover:scale-105'
                )}
              >
                <div className="w-full h-full rounded-full bg-[#080d1a] flex items-center justify-center border border-slate-700/40 group-hover:bg-[#0c1325] transition-colors">
                  {isListening ? <MicOff className="w-6 h-6 text-rose-400 animate-pulse" /> : <Mic className="w-6 h-6 text-white/90 group-hover:text-cyan-300 transition-colors" />}
                </div>
              </button>
              <p className={clsx('mt-1.5 text-[11px] font-medium', isListening ? 'text-rose-400' : 'text-slate-500')}>
                {isListening ? 'Tap to stop' : 'Tap to speak'}
              </p>
            </div>

          </div>
        </div>
      )}
    </>
  )
}

export default FloatingVoiceButton
