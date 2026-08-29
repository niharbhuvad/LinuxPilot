import React, { useEffect, useRef, useCallback } from 'react'

interface ParticleSphereProps {
  status?: 'idle' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'completed' | 'greeting'
  emotionState?: 'neutral' | 'happy' | 'caring' | 'alert' | 'proud' | 'thinking' | 'greeting'
  size?: number
  className?: string
  audioLevel?: number
}

// Simple seeded noise for organic motion
function noise(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 43.758) * 43758.5453
  return n - Math.floor(n)
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r},${g},${bl})`
}

// Color stops for the sphere gradient: Deep Cyan → Electric Blue → Violet → Magenta → Rose
const colorStops: Array<{ pos: number; rgb: [number, number, number] }> = [
  { pos: 0.0, rgb: [0, 200, 255] },     // Deep Electric Cyan
  { pos: 0.2, rgb: [56, 189, 248] },     // Sky Blue
  { pos: 0.35, rgb: [96, 165, 250] },    // Blue
  { pos: 0.5, rgb: [139, 92, 246] },     // Violet
  { pos: 0.65, rgb: [217, 70, 239] },    // Fuchsia/Magenta
  { pos: 0.8, rgb: [236, 72, 153] },     // Pink
  { pos: 1.0, rgb: [244, 63, 94] },      // Rose/Red
]

function getGradientColor(t: number): string {
  const tc = Math.max(0, Math.min(1, t))
  for (let i = 0; i < colorStops.length - 1; i++) {
    if (tc >= colorStops[i].pos && tc <= colorStops[i + 1].pos) {
      const local = (tc - colorStops[i].pos) / (colorStops[i + 1].pos - colorStops[i].pos)
      return lerpColor(colorStops[i].rgb, colorStops[i + 1].rgb, local)
    }
  }
  return lerpColor(colorStops[0].rgb, colorStops[colorStops.length - 1].rgb, tc)
}

interface Particle {
  baseX: number
  baseY: number
  baseZ: number
  normX: number // normalized position for coloring (-1 to 1)
  color: string
  baseSize: number
  noisePhase: number
  noiseSeed: number
}

export const ParticleSphere: React.FC<ParticleSphereProps> = ({
  status = 'idle',
  emotionState = 'neutral',
  size = 320,
  className = '',
  audioLevel = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const stateRef = useRef({
    angleX: 0,
    angleY: 0,
    time: 0,
    waveOffset: 0,
    particles: null as Particle[] | null,
    radius: 0,
  })

  // Stable init function
  const initParticles = useCallback((radius: number) => {
    const numParticles = 3000
    const particles: Particle[] = []
    const phi = (1 + Math.sqrt(5)) / 2

    for (let i = 0; i < numParticles; i++) {
      const theta = 2 * Math.PI * i / phi
      const y = 1 - (i / (numParticles - 1)) * 2
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
      const x = Math.cos(theta) * radiusAtY
      const z = Math.sin(theta) * radiusAtY

      // Smooth gradient from X position
      const mixRatio = (x + 1) / 2
      const jitter = (Math.random() - 0.5) * 0.08
      const color = getGradientColor(Math.max(0, Math.min(1, mixRatio + jitter)))

      particles.push({
        baseX: x * radius,
        baseY: y * radius,
        baseZ: z * radius,
        normX: x,
        color,
        baseSize: Math.random() * 1.4 + 0.8,
        noisePhase: Math.random() * Math.PI * 2,
        noiseSeed: Math.random() * 100,
      })
    }
    return particles
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    // HiDPI support
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const canvasLogicalW = size * 1.35
    const canvasLogicalH = size * 1.35
    canvas.width = canvasLogicalW * dpr
    canvas.height = canvasLogicalH * dpr
    canvas.style.width = `${canvasLogicalW}px`
    canvas.style.height = `${canvasLogicalH}px`
    ctx.scale(dpr, dpr)

    const radius = size * 0.38
    stateRef.current.radius = radius

    // Create particles once
    if (!stateRef.current.particles) {
      stateRef.current.particles = initParticles(radius)
    }

    const particles = stateRef.current.particles!
    const state = stateRef.current

    const render = () => {
      const cW = canvasLogicalW
      const cH = canvasLogicalH
      ctx.clearRect(0, 0, cW, cH)
      const centerX = cW / 2
      const centerY = cH / 2

      state.time += 0.016
      state.waveOffset += 0.035

      const isListening = status === 'listening'
      const isSpeaking = status === 'speaking'
      const isThinking = status === 'thinking'
      const isExecuting = status === 'executing'
      const isActive = isListening || isSpeaking

      // ── Dynamic speeds & scale based on status + emotion ──
      let speedX = 0.0015
      let speedY = 0.004
      let scalePulse = 1
      let breathe = Math.sin(state.time * 0.8) * 0.012

      if (isListening) {
        speedY = 0.008
        speedX = 0.003
        scalePulse = 1 + Math.sin(state.waveOffset * 1.5) * 0.035 + (audioLevel * 0.08)
        breathe = 0
      } else if (isThinking || emotionState === 'thinking') {
        speedY = 0.018
        speedX = 0.012
        scalePulse = 1 + Math.sin(state.waveOffset * 2.8) * 0.03
        breathe = 0
      } else if (emotionState === 'alert') {
        speedY = 0.014
        speedX = 0.008
        scalePulse = 1 + Math.abs(Math.sin(state.waveOffset * 3)) * 0.045
        breathe = 0
      } else if (isSpeaking) {
        speedY = 0.007
        speedX = 0.003
        scalePulse = 1 + Math.abs(Math.sin(state.waveOffset * 2)) * 0.05
        breathe = 0
      } else if (isExecuting) {
        speedY = 0.012
        speedX = 0.007
        breathe = 0
      }

      scalePulse += breathe

      state.angleX += speedX
      state.angleY += speedY

      const cosX = Math.cos(state.angleX)
      const sinX = Math.sin(state.angleX)
      const cosY = Math.cos(state.angleY)
      const sinY = Math.sin(state.angleY)

      // ── LAYER 1: Emotion-driven outer ambient glow ──
      const outerGlow = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius * 1.5)
      if (isListening) {
        outerGlow.addColorStop(0, 'rgba(0, 220, 255, 0.14)')
        outerGlow.addColorStop(0.5, 'rgba(180, 70, 220, 0.07)')
        outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else if (emotionState === 'alert') {
        outerGlow.addColorStop(0, 'rgba(245, 158, 11, 0.16)')
        outerGlow.addColorStop(0.5, 'rgba(239, 68, 68, 0.08)')
        outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else if (emotionState === 'happy' || emotionState === 'proud') {
        outerGlow.addColorStop(0, 'rgba(16, 185, 129, 0.15)')
        outerGlow.addColorStop(0.5, 'rgba(139, 92, 246, 0.08)')
        outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else if (emotionState === 'caring' || emotionState === 'greeting') {
        outerGlow.addColorStop(0, 'rgba(236, 72, 153, 0.15)')
        outerGlow.addColorStop(0.5, 'rgba(244, 114, 182, 0.07)')
        outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else if (isThinking || emotionState === 'thinking') {
        outerGlow.addColorStop(0, 'rgba(168, 85, 247, 0.18)')
        outerGlow.addColorStop(0.6, 'rgba(217, 70, 239, 0.08)')
        outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else {
        outerGlow.addColorStop(0, 'rgba(0, 200, 255, 0.06)')
        outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      }
      ctx.fillStyle = outerGlow
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2)
      ctx.fill()

      // ── LAYER 2: Concentric acoustic rings ──
      ctx.save()
      const ringCount = 5
      for (let r = 1; r <= ringCount; r++) {
        const ringRadius = radius * (1.08 + r * 0.18)
        const pulseMag = isActive ? 0.04 : (isThinking || emotionState === 'thinking') ? 0.03 : 0.015
        const pulse = Math.sin(state.time * 2.5 - r * 0.6) * pulseMag
        const currentR = ringRadius * (1 + pulse)

        ctx.beginPath()
        ctx.arc(centerX, centerY, currentR, 0, Math.PI * 2)

        const ringGrad = ctx.createLinearGradient(
          centerX - currentR, centerY,
          centerX + currentR, centerY
        )
        const baseA = isActive ? 0.12 : (isThinking || emotionState === 'thinking') ? 0.09 : 0.04
        const ringA = Math.max(0.008, baseA / (r * 0.7))
        
        if (emotionState === 'alert') {
          ringGrad.addColorStop(0, `rgba(245, 158, 11, ${ringA})`)
          ringGrad.addColorStop(1, `rgba(239, 68, 68, ${ringA})`)
        } else if (emotionState === 'caring' || emotionState === 'greeting') {
          ringGrad.addColorStop(0, `rgba(236, 72, 153, ${ringA})`)
          ringGrad.addColorStop(1, `rgba(168, 85, 247, ${ringA})`)
        } else {
          ringGrad.addColorStop(0, `rgba(0, 220, 255, ${ringA})`)
          ringGrad.addColorStop(0.4, `rgba(139, 92, 246, ${ringA * 0.5})`)
          ringGrad.addColorStop(1, `rgba(236, 72, 153, ${ringA})`)
        }

        ctx.strokeStyle = ringGrad
        ctx.lineWidth = isActive ? 1.2 : 0.8
        ctx.stroke()
      }
      ctx.restore()

      // ── LAYER 3: Inner core glow ──
      const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.85)
      if (isListening) {
        coreGlow.addColorStop(0, 'rgba(0, 240, 255, 0.18)')
        coreGlow.addColorStop(0.5, 'rgba(139, 92, 246, 0.08)')
        coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else if (emotionState === 'alert') {
        coreGlow.addColorStop(0, 'rgba(245, 158, 11, 0.2)')
        coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else if (isThinking || emotionState === 'thinking') {
        coreGlow.addColorStop(0, 'rgba(168, 85, 247, 0.22)')
        coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else if (isSpeaking) {
        coreGlow.addColorStop(0, 'rgba(236, 72, 153, 0.16)')
        coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      } else {
        coreGlow.addColorStop(0, 'rgba(0, 200, 255, 0.06)')
        coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      }
      ctx.fillStyle = coreGlow
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * 0.9, 0, Math.PI * 2)
      ctx.fill()

      // ── LAYER 4: Project, deform, and sort particles ──
      const projected: Array<{
        x: number; y: number; size: number; alpha: number; color: string; z: number
      }> = []

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Rotate Y
        let x1 = p.baseX * cosY - p.baseZ * sinY
        let z1 = p.baseX * sinY + p.baseZ * cosY
        // Rotate X
        let y1 = p.baseY * cosX - z1 * sinX
        let z2 = p.baseY * sinX + z1 * cosX

        // Scale + pulse
        x1 *= scalePulse
        y1 *= scalePulse
        z2 *= scalePulse

        // Audio-reactive organic deformation
        if (isActive) {
          const dist = Math.sqrt(x1 * x1 + y1 * y1 + z2 * z2)
          // Multi-frequency noise
          const wave1 = Math.sin(dist * 0.04 - state.waveOffset * 1.8 + p.noisePhase) * 3.0
          const wave2 = Math.sin(y1 * 0.06 + state.time * 2.5) * 1.5
          const total = (wave1 + wave2) * (isListening ? 1.2 : 0.8)
          const invDist = 1 / (dist || 1)
          x1 += x1 * invDist * total
          y1 += y1 * invDist * total
          z2 += z2 * invDist * total * 0.5
        } else if (isThinking) {
          // Swirl deformation for thinking
          const angle = Math.atan2(y1, x1) + state.time * 0.5
          const dist = Math.sqrt(x1 * x1 + y1 * y1)
          const swirl = Math.sin(dist * 0.05 + angle * 2) * 2
          x1 += Math.cos(angle) * swirl
          y1 += Math.sin(angle) * swirl
        }

        // Perspective projection
        const fov = 450
        const projScale = fov / (fov + z2 + radius * 1.3)
        const projX = centerX + x1 * projScale
        const projY = centerY + y1 * projScale

        // Depth-based alpha with better falloff
        const depthRatio = (z2 + radius) / (2 * radius)
        const alpha = Math.max(0.12, Math.min(1.0, Math.pow(depthRatio, 1.0) * 1.1))

        // Per-particle micro-pulse for shimmer
        const shimmer = 1 + Math.sin(state.time * 3 + p.noisePhase) * 0.15
        const dotSize = Math.max(0.6, p.baseSize * projScale * shimmer)

        projected.push({
          x: projX,
          y: projY,
          size: dotSize,
          alpha,
          color: p.color,
          z: z2,
        })
      }

      // Sort back-to-front
      projected.sort((a, b) => a.z - b.z)

      // ── Render particles with sub-pixel anti-aliasing ──
      ctx.save()
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i]
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      ctx.globalAlpha = 1.0

      frameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(frameRef.current)
    }
  }, [status, size, audioLevel, initParticles])

  // Reset particles when size changes
  useEffect(() => {
    stateRef.current.particles = null
  }, [size])

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="block pointer-events-none"
      />
    </div>
  )
}

export default ParticleSphere
