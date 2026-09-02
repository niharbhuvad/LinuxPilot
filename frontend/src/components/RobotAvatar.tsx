import React from 'react'
import clsx from 'clsx'

export interface RobotAvatarProps {
  status?: 'idle' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'completed' | 'greeting'
  emotionState?: 'neutral' | 'happy' | 'caring' | 'alert' | 'proud' | 'thinking' | 'greeting'
  size?: number
  className?: string
  audioLevel?: number
}

export const RobotAvatar: React.FC<RobotAvatarProps> = ({
  status = 'idle',
  emotionState = 'neutral',
  size = 280,
  className = '',
  audioLevel = 0,
}) => {
  const isListening = status === 'listening'
  const isThinking = status === 'thinking' || emotionState === 'thinking'
  const isSpeaking = status === 'speaking'
  const isExecuting = status === 'executing'
  const isGreeting = status === 'greeting' || emotionState === 'greeting'
  const isCompleted = status === 'completed' || emotionState === 'proud'
  const isAlert = emotionState === 'alert'
  const isHappy = emotionState === 'happy'
  const isCaring = emotionState === 'caring'

  // Determine active pose
  let pose: 'waving' | 'thinking' | 'happy' | 'listening' | 'talking' | 'alert' | 'success' | 'eureka' | 'idle' = 'idle'
  if (isGreeting) pose = 'waving'
  else if (isThinking) pose = 'thinking'
  else if (isListening) pose = 'listening'
  else if (isSpeaking) pose = 'talking'
  else if (isExecuting || isAlert) pose = 'alert'
  else if (isCompleted) pose = 'success'
  else if (isHappy) pose = 'happy'

  // Determine visor color scheme & neon glow aura
  let mainGlowColor = '#00f0ff' // Cyan
  let secondaryGlow = 'rgba(0, 240, 255, 0.45)'

  if (isThinking) {
    mainGlowColor = '#a855f7' // Purple
    secondaryGlow = 'rgba(168, 85, 247, 0.45)'
  } else if (isSpeaking) {
    mainGlowColor = '#ec4899' // Pink
    secondaryGlow = 'rgba(236, 72, 153, 0.45)'
  } else if (isAlert) {
    mainGlowColor = '#f59e0b' // Amber/Red
    secondaryGlow = 'rgba(245, 158, 11, 0.45)'
  } else if (isHappy || isCompleted) {
    mainGlowColor = '#10b981' // Emerald
    secondaryGlow = 'rgba(16, 185, 129, 0.45)'
  } else if (isCaring || isGreeting) {
    mainGlowColor = '#f472b6' // Warm pink
    secondaryGlow = 'rgba(244, 114, 182, 0.45)'
  }

  const svgScale = size / 280

  return (
    <div
      className={clsx('relative flex flex-col items-center justify-center select-none', className)}
      style={{ width: size, height: size }}
    >
      {/* ── Ambient Floating Glow Effects ── */}
      <div
        className="absolute inset-0 rounded-full blur-[65px] pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${secondaryGlow} 0%, transparent 70%)`,
          transform: `scale(${1 + audioLevel * 0.3})`,
        }}
      />

      {/* Eureka Lightbulb / Overhead Indicator */}
      {isThinking && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center z-20 animate-bounce">
          <div className="px-2.5 py-1 rounded-full bg-purple-950/90 border border-purple-400/60 shadow-[0_0_20px_#a855f7] text-[11px] font-mono font-bold text-purple-200 flex items-center gap-1.5">
            <span className="text-amber-300 animate-pulse">💡</span>
            <span>AI Reasoning...</span>
          </div>
        </div>
      )}

      {isAlert && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center z-20 animate-pulse">
          <div className="px-2.5 py-1 rounded-full bg-amber-950/90 border border-amber-400/60 shadow-[0_0_20px_#f59e0b] text-[11px] font-mono font-bold text-amber-200 flex items-center gap-1.5">
            <span>⚠️</span>
            <span>SYSTEM ALERT</span>
          </div>
        </div>
      )}

      {isGreeting && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center z-20 animate-bounce">
          <div className="px-2.5 py-1 rounded-full bg-pink-950/90 border border-pink-400/60 shadow-[0_0_20px_#ec4899] text-[11px] font-mono font-bold text-pink-200 flex items-center gap-1.5">
            <span>🙏</span>
            <span>Namaste!</span>
          </div>
        </div>
      )}

      {/* ── Main Robot SVG Model ── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 280 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-500"
        style={{
          transform: `scale(${svgScale}) ${isListening ? 'translateY(-5px)' : isThinking ? 'rotate(-3deg)' : 'translateY(0)'}`,
        }}
      >
        <defs>
          {/* Head & Armor Metal Gradients */}
          <linearGradient id="metalBody" x1="40" y1="20" x2="240" y2="260" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#070c18" />
          </linearGradient>

          <linearGradient id="helmetRim" x1="70" y1="40" x2="210" y2="160" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.15" />
          </linearGradient>

          <linearGradient id="visorBg" x1="75" y1="75" x2="205" y2="155" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="100%" stopColor="#090d16" />
          </linearGradient>

          {/* Dynamic Glow Filter */}
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="corePulse" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── 1. Antenna & LED Core ── */}
        <g className="animate-pulse">
          <line x1="140" y1="50" x2="140" y2="25" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
          <circle cx="140" cy="22" r="6" fill={mainGlowColor} filter="url(#neonGlow)" />
        </g>

        {/* ── 2. Robot Ears / Audio Sensors ── */}
        <g>
          {/* Left Ear */}
          <rect x="52" y="90" width="14" height="28" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="2" />
          <circle cx="59" cy="104" r="4" fill={mainGlowColor} opacity="0.8" />
          {/* Right Ear */}
          <rect x="214" y="90" width="14" height="28" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="2" />
          <circle cx="221" cy="104" r="4" fill={mainGlowColor} opacity="0.8" />
        </g>

        {/* ── 3. Robot Head / Helmet Outer Shell ── */}
        <rect
          x="65"
          y="48"
          width="150"
          height="114"
          rx="32"
          fill="url(#metalBody)"
          stroke="url(#helmetRim)"
          strokeWidth="2.5"
          className="shadow-2xl"
        />

        {/* ── 4. Futuristic Dark Glass Visor Screen ── */}
        <rect
          x="76"
          y="66"
          width="128"
          height="78"
          rx="22"
          fill="url(#visorBg)"
          stroke={mainGlowColor}
          strokeWidth="1.8"
          strokeOpacity="0.75"
          filter="url(#neonGlow)"
        />

        {/* Visor Scanline Details */}
        <line x1="82" y1="76" x2="198" y2="76" stroke="white" strokeOpacity="0.05" strokeWidth="1" />
        <line x1="82" y1="134" x2="198" y2="134" stroke="white" strokeOpacity="0.05" strokeWidth="1" />

        {/* ── 5. DEEP EXPRESSIVE VISOR FACIAL ANIMATIONS ── */}
        <g filter="url(#neonGlow)">

          {/* A. THINKING MODE: Upward curious eyes, thought dots, squiggly mouth */}
          {isThinking && (
            <>
              {/* Upward Looking Glossy Eyes */}
              <g className="animate-pulse">
                <circle cx="116" cy="92" r="9" fill={mainGlowColor} />
                <circle cx="114" cy="90" r="3" fill="#ffffff" />
                <circle cx="172" cy="92" r="9" fill={mainGlowColor} />
                <circle cx="170" cy="90" r="3" fill="#ffffff" />
              </g>
              {/* Squiggly Puzzled Thought Mouth */}
              <path d="M 128 122 Q 134 118 140 123 T 152 120" stroke={mainGlowColor} strokeWidth="3" strokeLinecap="round" fill="none" />
              {/* Floating Visor Thought Dots */}
              <circle cx="180" cy="78" r="2.5" fill={mainGlowColor} className="animate-ping" />
              <circle cx="186" cy="72" r="3.5" fill={mainGlowColor} className="animate-pulse" />
            </>
          )}

          {/* B. LISTENING MODE: Wide Curious Eyes with Audio Reactive Dilating Iris */}
          {isListening && (
            <>
              {/* Left Eye */}
              <circle cx="110" cy="98" r={10 + audioLevel * 4} fill="none" stroke={mainGlowColor} strokeWidth="2.5" />
              <circle cx="110" cy="98" r={5 + audioLevel * 3} fill={mainGlowColor} />
              <circle cx="107" cy="95" r="2.5" fill="#ffffff" />
              
              {/* Right Eye */}
              <circle cx="170" cy="98" r={10 + audioLevel * 4} fill="none" stroke={mainGlowColor} strokeWidth="2.5" />
              <circle cx="170" cy="98" r={5 + audioLevel * 3} fill={mainGlowColor} />
              <circle cx="167" cy="95" r="2.5" fill="#ffffff" />

              {/* Curious O-Mouth */}
              <circle cx="140" cy="122" r={3.5 + audioLevel * 4} fill="none" stroke={mainGlowColor} strokeWidth="2.5" />
            </>
          )}

          {/* C. TALKING / SPEAKING MODE: Happy Eyes + Audio Vocal Mouth Equalizer */}
          {isSpeaking && (
            <>
              {/* Crescent Smiling Eyes ^ ^ */}
              <path d="M 98 98 Q 112 86 126 98" stroke={mainGlowColor} strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 154 98 Q 168 86 182 98" stroke={mainGlowColor} strokeWidth="4" strokeLinecap="round" fill="none" />
              
              {/* Vocal Equalizer Mouth Bars */}
              <g className="animate-pulse">
                <rect x="122" y="118" width="3" height={10} rx="1.5" fill={mainGlowColor} />
                <rect x="129" y="114" width="3" height={16} rx="1.5" fill={mainGlowColor} />
                <rect x="136" y="110" width="3" height={22} rx="1.5" fill={mainGlowColor} />
                <rect x="143" y="114" width="3" height={16} rx="1.5" fill={mainGlowColor} />
                <rect x="150" y="118" width="3" height={10} rx="1.5" fill={mainGlowColor} />
              </g>
            </>
          )}

          {/* D. HAPPY / DELIGHTED / GREETING MODE: Anime Joy Eyes + Cheek Blushes */}
          {(isHappy || isGreeting) && !isSpeaking && (
            <>
              {/* Anime Joy Eyes ^ ^ */}
              <path d="M 96 100 Q 112 84 128 100" stroke={mainGlowColor} strokeWidth="4.5" strokeLinecap="round" fill="none" />
              <path d="M 152 100 Q 168 84 184 100" stroke={mainGlowColor} strokeWidth="4.5" strokeLinecap="round" fill="none" />
              
              {/* Big Joyful Smile */}
              <path d="M 122 118 Q 140 134 158 118 Z" fill={mainGlowColor} opacity="0.9" />

              {/* Anime Pink Cheek Blushes // // */}
              <g opacity="0.75">
                <line x1="88" y1="112" x2="96" y2="106" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="94" y1="114" x2="102" y2="108" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="178" y1="106" x2="186" y2="112" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="184" y1="108" x2="192" y2="114" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </>
          )}

          {/* E. SUCCESS / COMPLETED MODE: Star Eyes ★ ★ */}
          {isCompleted && (
            <>
              {/* Star Eyes */}
              <path d="M 112 88 L 114 94 L 120 95 L 115 99 L 117 105 L 112 101 L 107 105 L 109 99 L 104 95 L 110 94 Z" fill={mainGlowColor} />
              <path d="M 168 88 L 170 94 L 176 95 L 171 99 L 173 105 L 168 101 L 163 105 L 165 99 L 160 95 L 166 94 Z" fill={mainGlowColor} />
              {/* Cheerful Smile */}
              <path d="M 124 118 Q 140 130 156 118" stroke={mainGlowColor} strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          )}

          {/* F. ALERT / WARNING MODE: Angry Eyes > < */}
          {isAlert && (
            <>
              {/* Angular Angry Eyes > < */}
              <path d="M 100 90 L 124 104 M 100 104 L 124 90" stroke={mainGlowColor} strokeWidth="4" strokeLinecap="round" />
              <path d="M 156 90 L 180 104 M 156 104 L 180 90" stroke={mainGlowColor} strokeWidth="4" strokeLinecap="round" />
              {/* Frown Mouth */}
              <path d="M 126 126 Q 140 118 154 126" stroke={mainGlowColor} strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </>
          )}

          {/* G. IDLE / NEUTRAL MODE: Glossy Alive Eyes with Pupil Reflection & Soft Smile */}
          {!isThinking && !isListening && !isSpeaking && !isHappy && !isGreeting && !isCompleted && !isAlert && (
            <>
              {/* Glossy Left Eye */}
              <circle cx="112" cy="98" r="9.5" fill={mainGlowColor} />
              <circle cx="112" cy="98" r="5" fill="#020617" opacity="0.45" />
              <circle cx="109" cy="94" r="3" fill="#ffffff" />

              {/* Glossy Right Eye */}
              <circle cx="168" cy="98" r="9.5" fill={mainGlowColor} />
              <circle cx="168" cy="98" r="5" fill="#020617" opacity="0.45" />
              <circle cx="165" cy="94" r="3" fill="#ffffff" />

              {/* Soft Friendly Smile Line */}
              <path d="M 126 120 Q 140 127 154 120" stroke={mainGlowColor} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.95" />
            </>
          )}
        </g>

        {/* ── 6. Neck ── */}
        <rect x="122" y="162" width="36" height="14" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="2" />

        {/* ── 7. Robot Torso & LinuxAI Arc Core Reactor ── */}
        <path d="M 80 176 L 200 176 L 185 250 L 95 250 Z" fill="url(#metalBody)" stroke="#334155" strokeWidth="2" />

        {/* Arc Core Reactor */}
        <circle cx="140" cy="208" r="16" fill="#020617" stroke={mainGlowColor} strokeWidth="2" filter="url(#corePulse)" />
        <circle cx="140" cy="208" r="8" fill={mainGlowColor} opacity="0.9" />

        {/* Chest Armor Accents */}
        <line x1="95" y1="190" x2="118" y2="190" stroke="#334155" strokeWidth="2" />
        <line x1="162" y1="190" x2="185" y2="190" stroke="#334155" strokeWidth="2" />

        {/* ── 8. ARMS & POSES ── */}
        {/* WAVING POSE: Right Arm Raised High Waving */}
        {pose === 'waving' && (
          <g className="animate-bounce" style={{ animationDuration: '2s' }}>
            {/* Left Arm Normal */}
            <path d="M 75 180 Q 55 210 60 240" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            {/* Right Arm Raised Waving */}
            <path d="M 205 180 Q 235 150 240 110" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <circle cx="240" cy="105" r="10" fill={mainGlowColor} filter="url(#neonGlow)" />
          </g>
        )}

        {/* THINKING POSE: Hand on Chin */}
        {pose === 'thinking' && (
          <g>
            {/* Left Arm Normal */}
            <path d="M 75 180 Q 55 210 60 240" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            {/* Right Arm Up to Chin */}
            <path d="M 205 180 Q 180 200 155 155" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <circle cx="155" cy="150" r="8" fill="#475569" />
          </g>
        )}

        {/* LISTENING POSE: Hands Clasped Attentively */}
        {pose === 'listening' && (
          <g>
            <path d="M 75 180 Q 110 220 135 220" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M 205 180 Q 170 220 145 220" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <circle cx="140" cy="220" r="9" fill={mainGlowColor} />
          </g>
        )}

        {/* TALKING POSE: One Hand Gesturing Outward */}
        {pose === 'talking' && (
          <g>
            <path d="M 75 180 Q 50 200 45 225" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M 205 180 Q 235 200 245 210" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <circle cx="248" cy="212" r="8" fill={mainGlowColor} />
          </g>
        )}

        {/* SUCCESS POSE: Thumbs-Up Gesture */}
        {pose === 'success' && (
          <g>
            <path d="M 75 180 Q 55 210 60 240" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M 205 180 Q 235 170 230 140" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <circle cx="230" cy="135" r="9" fill={mainGlowColor} />
          </g>
        )}

        {/* ALERT POSE: Arms Crossed in X */}
        {pose === 'alert' && (
          <g>
            <path d="M 75 180 Q 140 210 180 230" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M 205 180 Q 140 210 100 230" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* IDLE POSE: Standard Arms at Rest */}
        {(pose === 'idle' || pose === 'happy') && (
          <g>
            <path d="M 75 180 Q 55 210 60 240" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
            <path d="M 205 180 Q 225 210 220 240" stroke="#334155" strokeWidth="12" strokeLinecap="round" fill="none" />
          </g>
        )}
      </svg>
    </div>
  )
}

export default RobotAvatar
