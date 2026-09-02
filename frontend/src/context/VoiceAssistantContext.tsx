import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { chatApi, commandsApi, systemApi } from '../services/api'

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'completed' | 'greeting'
export type AutonomyLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type EmotionState = 'neutral' | 'happy' | 'caring' | 'alert' | 'proud' | 'thinking' | 'greeting'

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  command?: string
  commandOutput?: string
  riskTier?: 'SAFE' | 'WARNING' | 'DANGEROUS'
  suggestedActions?: { label: string; action: string }[]
  timestamp: string
  emotion?: EmotionState
}

export interface AiActivityLog {
  id: string
  time: string
  userRequest: string
  command: string
  risk: 'SAFE' | 'WARNING' | 'DANGEROUS'
  status: 'Approved' | 'Executed' | 'Cancelled' | 'Blocked'
  result: string
}

export interface VoiceSettings {
  enabled: boolean
  language: string
  selectedVoiceURI?: string
  voicePersona: 'vedic-soft' | 'standard-indian' | 'hindi' | 'default'
  speed: number
  volume: number
  autoSpeak: boolean
  continuousMode: boolean
  voiceNotifications: boolean
  confirmationRequired: boolean
  autonomyLevel: AutonomyLevel
  autoGreet: boolean
  healthAlerts: boolean
}

export interface SystemHealthSnapshot {
  cpuPercent: number
  memoryPercent: number
  diskPercent: number
  hostname: string
  uptime: string
  status: 'healthy' | 'warning' | 'critical'
}

export interface PendingApprovalCommand {
  id: string
  request: string
  command: string
  explanation: string
  riskTier: 'SAFE' | 'WARNING' | 'DANGEROUS'
}

export interface SavedConversationItem {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export type AiMode = 'quick' | 'thinking' | 'deep-search'

export interface LanguageOption {
  code: string
  name: string
  nativeName: string
  flag: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-IN', name: 'English (India)', nativeName: 'English (IN)', flag: '🇮🇳' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh-CN', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
]

export interface VoiceAssistantContextType {
  voiceStatus: VoiceStatus
  setVoiceStatus: (status: VoiceStatus) => void
  emotionState: EmotionState
  isMuted: boolean
  setIsMuted: (muted: boolean) => void
  messages: ChatMessage[]
  transcript: string
  conversationId: string
  voiceSettings: VoiceSettings
  aiActivities: AiActivityLog[]
  pendingApproval: PendingApprovalCommand | null
  systemHealth: SystemHealthSnapshot | null
  aiMode: AiMode
  setAiMode: (mode: AiMode) => void
  audioLevel: number
  currentThoughtStep: string
  conversations: SavedConversationItem[]
  loadConversations: () => Promise<void>
  selectConversation: (id: string) => Promise<void>
  startListening: () => void
  stopListening: () => void
  sendMessage: (userText: string) => Promise<void>
  speakText: (text: string, emotion?: EmotionState) => void
  stopSpeaking: () => void
  approveCommand: () => Promise<void>
  cancelCommand: () => void
  clearConversation: () => void
  updateSettings: (newSettings: Partial<VoiceSettings>) => void
  isOverlayOpen: boolean
  setIsOverlayOpen: (open: boolean) => void
  availableVoices: SpeechSynthesisVoice[]
}

const VoiceAssistantContext = createContext<VoiceAssistantContextType | undefined>(undefined)

const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: true,
  language: 'en-IN',
  voicePersona: 'vedic-soft',
  speed: 0.92,
  volume: 1.0,
  autoSpeak: true,
  continuousMode: true,
  voiceNotifications: true,
  confirmationRequired: true,
  autonomyLevel: 'MEDIUM',
  autoGreet: true,
  healthAlerts: true,
}

// ── Time-aware greetings with Indian warmth ──
function getTimeGreeting(): { greeting: string; emoji: string; emotion: EmotionState } {
  const hour = new Date().getHours()
  if (hour >= 4 && hour < 12) return { greeting: 'Good morning', emoji: '🙏🌅', emotion: 'greeting' }
  if (hour >= 12 && hour < 17) return { greeting: 'Good afternoon', emoji: '🙏☀️', emotion: 'greeting' }
  if (hour >= 17 && hour < 21) return { greeting: 'Good evening', emoji: '🙏🌇', emotion: 'caring' }
  return { greeting: 'Working late I see', emoji: '🙏🌙', emotion: 'caring' }
}

function getWelcomeMessage(): string {
  const { greeting, emoji } = getTimeGreeting()
  const day = new Date().toLocaleDateString('en-IN', { weekday: 'long' })
  return `${emoji} Namaste! ${greeting}!\n\nWelcome back to your AI Linux Administration Engine. I am your Vedic multi-lingual voice assistant — always listening, always caring for your systems in your preferred language.\n\nToday is ${day}. I'm continuously monitoring your connected host. Select your language from the top bar and just speak naturally or type any command! 🙏`
}

function getWelcomeSpokenText(): string {
  const { greeting } = getTimeGreeting()
  const day = new Date().toLocaleDateString('en-IN', { weekday: 'long' })
  return `Namaste! ${greeting}! Welcome back. Today is ${day}. I am your multi-lingual AI Linux assistant, ready to assist you. Just speak naturally to begin.`
}

export const VoiceAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [emotionState, setEmotionState] = useState<EmotionState>('neutral')
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [transcript, setTranscript] = useState<string>('')
  const [isOverlayOpen, setIsOverlayOpen] = useState<boolean>(false)
  const [pendingApproval, setPendingApproval] = useState<PendingApprovalCommand | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealthSnapshot | null>(null)
  const [aiMode, setAiMode] = useState<AiMode>('quick')
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [currentThoughtStep, setCurrentThoughtStep] = useState<string>('')
  const [conversations, setConversations] = useState<SavedConversationItem[]>([])

  const [conversationId, setConversationId] = useState<string>(() => {
    return localStorage.getItem('linuxai_active_conv_id') || `conv-${Date.now()}`
  })

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    const saved = localStorage.getItem('linuxai_voice_settings_v2')
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
  })

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'welcome-1',
        sender: 'assistant',
        text: getWelcomeMessage(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'greeting',
      }
    ]
  })

  const [aiActivities, setAiActivities] = useState<AiActivityLog[]>([
    {
      id: 'log-1',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      userRequest: 'Vedic AI Engine — Session Started',
      command: 'system health check',
      risk: 'SAFE',
      status: 'Executed',
      result: 'Success'
    }
  ])

  const recognitionRef = useRef<any>(null)
  const isListeningRef = useRef<boolean>(false)
  const manualStopRef = useRef<boolean>(false)
  const voiceStatusRef = useRef<VoiceStatus>('idle')
  const hasGreeted = useRef<boolean>(false)
  const healthAlertCooldown = useRef<number>(0)
  const transcriptRef = useRef<string>('')
  const sendLockRef = useRef<boolean>(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number>(0)
  const silenceTimerRef = useRef<any>(null)

  // ── Load saved conversations list ──
  const loadConversations = useCallback(async () => {
    try {
      const res = await chatApi.conversations()
      if (Array.isArray(res.data)) {
        setConversations(res.data.map((c: any) => ({
          id: c.id || c.conversation_id,
          title: c.title || `Conversation ${c.id?.slice(0, 6)}`,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
        })))
      }
    } catch (e) {
      // Chat API offline fallback
    }
  }, [])

  const selectConversation = useCallback(async (id: string) => {
    try {
      setConversationId(id)
      localStorage.setItem('linuxai_active_conv_id', id)
      const res = await chatApi.history(id)
      if (res.data && Array.isArray(res.data.messages)) {
        const mappedMsgs: ChatMessage[] = res.data.messages.map((m: any) => ({
          id: m.id || `msg-${Math.random()}`,
          sender: m.role === 'user' ? 'user' : 'assistant',
          text: m.content || m.text || '',
          timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }))
        setMessages(mappedMsgs)
      }
    } catch (e) {
      console.error('Failed to load conversation details:', e)
    }
  }, [])

  useEffect(() => { voiceStatusRef.current = voiceStatus }, [voiceStatus])

  // ── Load system voices ──
  useEffect(() => {
    const loadVoices = () => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices()
        setAvailableVoices(voices)
      }
    }
    loadVoices()
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  const updateSettings = (newSettings: Partial<VoiceSettings>) => {
    setVoiceSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem('linuxai_voice_settings_v2', JSON.stringify(updated))
      return updated
    })
  }

  // ── Intelligent natural voice selection ──
  const getSelectedVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!('speechSynthesis' in window) || availableVoices.length === 0) return null

    // 1. User explicitly picked a voice from dropdown
    if (voiceSettings.selectedVoiceURI) {
      const userChoice = availableVoices.find(v => v.voiceURI === voiceSettings.selectedVoiceURI || v.name === voiceSettings.selectedVoiceURI)
      if (userChoice) return userChoice
    }

    const currentLang = voiceSettings.language || 'en-IN'
    const langPrefix = currentLang.split('-')[0].toLowerCase()

    // Score voice by natural human voice markers (Natural / Neural / Online / Google vs legacy robotic SAPI)
    const getHumanScore = (v: SpeechSynthesisVoice): number => {
      const name = v.name.toLowerCase()
      let score = 0
      if (name.includes('natural')) score += 100
      if (name.includes('neural')) score += 90
      if (name.includes('online')) score += 80
      if (name.includes('google')) score += 70
      if (name.includes('apple') || name.includes('siri')) score += 60
      if (name.includes('enhanced') || name.includes('premium')) score += 50
      if (name.includes('david') || name.includes('zira') || name.includes('mark') || name.includes('desktop')) score -= 50
      return score
    }

    // Filter matching voices by exact lang
    const exactLangVoices = availableVoices.filter(v => v.lang.replace('_', '-').toLowerCase() === currentLang.toLowerCase())
    if (exactLangVoices.length > 0) {
      exactLangVoices.sort((a, b) => getHumanScore(b) - getHumanScore(a))
      return exactLangVoices[0]
    }

    // Filter by lang prefix (e.g. 'en', 'hi', 'es', 'fr')
    const prefixLangVoices = availableVoices.filter(v => v.lang.toLowerCase().startsWith(langPrefix))
    if (prefixLangVoices.length > 0) {
      prefixLangVoices.sort((a, b) => getHumanScore(b) - getHumanScore(a))
      return prefixLangVoices[0]
    }

    // Sort all available voices by human naturalness score
    const sortedAll = [...availableVoices].sort((a, b) => getHumanScore(b) - getHumanScore(a))
    return sortedAll[0] || availableVoices[0] || null
  }, [availableVoices, voiceSettings.language, voiceSettings.selectedVoiceURI])

  // ── Speak with natural human voice intonation & sentence chunking ──
  const speakText = useCallback((text: string, emotion: EmotionState = 'neutral') => {
    if (!voiceSettings.enabled || isMuted || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    setEmotionState(emotion)

    // Clean out code blocks, emojis (like 🙏, 🤖, etc.), markdown symbols, and URLs before TTS
    const cleanText = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{200D}]/gu, '')
      .replace(/[*_#`[\]()]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanText) return

    // Split text into natural sentence chunks for human cadence & breathing pauses
    const sentences = cleanText
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean)

    if (sentences.length === 0) return

    const selectedVoice = getSelectedVoice()
    setVoiceStatus('speaking')

    sentences.forEach((sentence, index) => {
      const utterance = new SpeechSynthesisUtterance(sentence)
      if (selectedVoice) utterance.voice = selectedVoice

      // Human-like pitch & speed modulation
      switch (emotion) {
        case 'greeting':
        case 'happy':
          utterance.rate = voiceSettings.speed * 1.02
          utterance.pitch = 1.06
          break
        case 'caring':
          utterance.rate = voiceSettings.speed * 0.95
          utterance.pitch = 0.98
          break
        case 'alert':
          utterance.rate = voiceSettings.speed * 1.05
          utterance.pitch = 1.10
          break
        case 'proud':
          utterance.rate = voiceSettings.speed * 0.98
          utterance.pitch = 1.02
          break
        default:
          utterance.rate = voiceSettings.speed * 0.98
          utterance.pitch = 1.0
      }

      utterance.volume = voiceSettings.volume
      utterance.lang = selectedVoice?.lang || voiceSettings.language || 'en-IN'

      if (index === sentences.length - 1) {
        utterance.onend = () => {
          setVoiceStatus('idle')
          setEmotionState('neutral')
          if (voiceSettings.continuousMode && !manualStopRef.current) {
            setTimeout(() => {
              if (!isListeningRef.current && voiceStatusRef.current === 'idle') {
                startListening()
              }
            }, 600)
          }
        }

        utterance.onerror = () => {
          setVoiceStatus('idle')
          setEmotionState('neutral')
        }
      }

      window.speechSynthesis.speak(utterance)
    })
  }, [voiceSettings, isMuted, getSelectedVoice])

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setVoiceStatus('idle')
    setEmotionState('neutral')
  }

  // ── Auto-welcome greeting on first load ──
  useEffect(() => {
    if (hasGreeted.current || !voiceSettings.autoGreet || !voiceSettings.enabled) return
    hasGreeted.current = true

    const timer = setTimeout(() => {
      setVoiceStatus('greeting')
      setEmotionState('greeting')
      speakText(getWelcomeSpokenText(), 'greeting')
    }, 1200)
    return () => clearTimeout(timer)
  }, [voiceSettings.autoGreet, voiceSettings.enabled, speakText])

  const isPollingHealthRef = useRef<boolean>(false)
  const speakTextRef = useRef(speakText)
  useEffect(() => { speakTextRef.current = speakText }, [speakText])

  // ── System health polling with voice notifications ──
  useEffect(() => {
    if (!voiceSettings.healthAlerts || !voiceSettings.enabled) return

    const pollHealth = async () => {
      if (isPollingHealthRef.current) return
      isPollingHealthRef.current = true

      try {
        const res = await systemApi.overview()
        const data = res.data
        const cpuPct = data.cpu?.percent ?? 0
        const memPct = data.memory?.percent ?? 0
        const diskPct = data.disk?.[0]?.percent ?? 0

        let status: 'healthy' | 'warning' | 'critical' = 'healthy'
        if (cpuPct > 90 || memPct > 90 || diskPct > 95) status = 'critical'
        else if (cpuPct > 75 || memPct > 80 || diskPct > 85) status = 'warning'

        let rawHost = data.hostname || 'mahesh-yash-rhel'
        let cleanHost = rawHost.replace(/hostname:\s*/gi, '').trim()
        if (cleanHost.includes('command completed') || cleanHost.includes('successfully') || !cleanHost) {
          cleanHost = 'mahesh-yash-rhel'
        }

        setSystemHealth({
          cpuPercent: cpuPct,
          memoryPercent: memPct,
          diskPercent: diskPct,
          hostname: cleanHost,
          uptime: data.uptime || '',
          status,
        })

        // Voice alert for critical issues
        const now = Date.now()
        if (status === 'critical' && voiceSettings.voiceNotifications && (now - healthAlertCooldown.current > 120000)) {
          healthAlertCooldown.current = now
          const alertParts: string[] = []
          if (cpuPct > 90) alertParts.push(`CPU is at ${Math.round(cpuPct)} percent`)
          if (memPct > 90) alertParts.push(`Memory usage is at ${Math.round(memPct)} percent`)
          if (diskPct > 95) alertParts.push(`Disk is at ${Math.round(diskPct)} percent`)

          const alertText = `Attention! System alert on ${data.hostname || 'your host'}. ${alertParts.join(', and ')}. I recommend investigating immediately.`

          const alertMsg: ChatMessage = {
            id: `alert-${Date.now()}`,
            sender: 'assistant',
            text: `⚠️ **System Health Alert**\n\n${alertParts.map(p => `• ${p}`).join('\n')}\n\nI detected elevated resource usage on **${data.hostname || 'your connected host'}**. Would you like me to investigate further?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            emotion: 'alert',
            suggestedActions: [
              { label: 'Investigate CPU', action: 'Show top CPU consuming processes and diagnose high CPU' },
              { label: 'Check Memory', action: 'Show detailed memory usage and what is consuming RAM' },
              { label: 'Disk Cleanup', action: 'Check disk space and suggest cleanup options' },
            ],
          }
          setMessages(prev => [...prev, alertMsg])

          if (!isMuted) {
            speakTextRef.current(alertText, 'alert')
          }
        }
      } catch {
        // Silently handle offline API
      } finally {
        isPollingHealthRef.current = false
      }
    }

    pollHealth()
    const interval = setInterval(pollHealth, 15000)
    return () => clearInterval(interval)
  }, [voiceSettings.healthAlerts, voiceSettings.enabled, voiceSettings.voiceNotifications, isMuted])

  // ── Execute command ──
  const executeCommand = async (reqText: string, cmdToRun: string, riskTier: 'SAFE' | 'WARNING' | 'DANGEROUS') => {
    setVoiceStatus('executing')
    try {
      const execRes = await commandsApi.execute(cmdToRun)
      const output = execRes.data?.output || execRes.data?.error || 'Command executed cleanly.'

      setAiActivities(prev => [{
        id: `log-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        userRequest: reqText,
        command: cmdToRun,
        risk: riskTier,
        status: 'Executed',
        result: execRes.data?.status || 'Success'
      }, ...prev])

      return output
    } catch (err: any) {
      return `Execution error: ${err.message || err}`
    }
  }

  // ── Send message with multi-language awareness ──
  const sendMessage = async (userText: string) => {
    if (!userText.trim()) return

    if (sendLockRef.current) return
    sendLockRef.current = true

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg])
    setVoiceStatus('thinking')
    setEmotionState('thinking')

    let stepTimer1: any, stepTimer2: any, stepTimer3: any

    if (aiMode === 'deep-search') {
      setCurrentThoughtStep('🔎 Deep Searching system topology & kernel logs...')
      stepTimer1 = setTimeout(() => {
        setEmotionState('alert')
        setCurrentThoughtStep('⚡ Querying Linux system metrics & process tree...')
      }, 700)
      stepTimer2 = setTimeout(() => {
        setEmotionState('thinking')
        setCurrentThoughtStep('🧠 Correlating CPU/RAM metrics with journald logs...')
      }, 1500)
      stepTimer3 = setTimeout(() => {
        setEmotionState('proud')
        setCurrentThoughtStep('✨ Formulating response...')
      }, 2300)
    } else if (aiMode === 'thinking') {
      setCurrentThoughtStep('🧠 Deep reasoning about system request...')
      stepTimer1 = setTimeout(() => {
        setEmotionState('thinking')
        setCurrentThoughtStep('🔍 Inspecting systemd services & resource usage...')
      }, 800)
      stepTimer2 = setTimeout(() => {
        setEmotionState('caring')
        setCurrentThoughtStep('💡 Synthesizing AI response...')
      }, 1600)
    } else {
      setCurrentThoughtStep('⚡ Parsing query & fetching metrics...')
      stepTimer1 = setTimeout(() => {
        setEmotionState('neutral')
        setCurrentThoughtStep('🔍 Processing system command...')
      }, 600)
    }

    try {
      const savedSettingsStr = localStorage.getItem('linuxai_system_settings_v1')
      const savedSettings = savedSettingsStr ? JSON.parse(savedSettingsStr) : {}
      const provider = savedSettings.aiProvider || 'gemini'
      const model = savedSettings.aiModel || (provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'groq' ? 'openai/gpt-oss-120b' : 'gpt-4o')
      const apiKey =
        provider === 'gemini' ? savedSettings.geminiApiKey :
        provider === 'groq' ? savedSettings.groqApiKey :
        provider === 'openai' ? savedSettings.openaiApiKey : undefined

      // Instruct AI to reply in the user's selected language
      let formattedPrompt = userText
      const currentLang = voiceSettings.language || 'en-IN'
      if (currentLang !== 'en-US') {
        const langObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLang)
        const langName = langObj ? `${langObj.name} (${langObj.nativeName})` : currentLang
        formattedPrompt = `[Language Preference: Respond in ${langName} (${currentLang})]\n${userText}`
      }

      const response = await chatApi.send({
        message: formattedPrompt,
        conversation_id: conversationId,
        provider,
        model,
        api_key: apiKey,
        base_url: savedSettings.ollamaBaseUrl,
      })
      const data = response.data

      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)
      clearTimeout(stepTimer3)
      setCurrentThoughtStep('')

      if (data.conversation_id && data.conversation_id !== conversationId) {
        setConversationId(data.conversation_id)
        localStorage.setItem('linuxai_active_conv_id', data.conversation_id)
      }

      const aiText = data.content || data.text || data.response || 'Investigation complete.'
      const command = data.command
      const riskTier = (data.risk_tier || 'SAFE') as 'SAFE' | 'WARNING' | 'DANGEROUS'
      const suggestedActions = data.suggested_actions

      let responseEmotion: EmotionState = 'neutral'
      const lowerText = aiText.toLowerCase()
      if (lowerText.includes('namaste') || lowerText.includes('welcome') || lowerText.includes('good morning') || lowerText.includes('good evening')) responseEmotion = 'greeting'
      else if (lowerText.includes('success') || lowerText.includes('healthy') || lowerText.includes('looks great') || lowerText.includes('excellent')) responseEmotion = 'happy'
      else if (lowerText.includes('warning') || lowerText.includes('alert') || lowerText.includes('critical') || lowerText.includes('high usage')) responseEmotion = 'alert'
      else if (lowerText.includes('recommend') || lowerText.includes('suggest') || lowerText.includes('care')) responseEmotion = 'caring'
      else if (lowerText.includes('completed') || lowerText.includes('done') || lowerText.includes('resolved')) responseEmotion = 'proud'

      setEmotionState(responseEmotion)

      let output = ''
      let needsConfirmation = false
      if (command) {
        if (riskTier === 'DANGEROUS') needsConfirmation = true
        else if (riskTier === 'WARNING') needsConfirmation = voiceSettings.autonomyLevel !== 'HIGH'
        else if (voiceSettings.autonomyLevel === 'LOW') needsConfirmation = true

        if (needsConfirmation) {
          setPendingApproval({ id: `approve-${Date.now()}`, request: userText, command, explanation: aiText, riskTier })

          setMessages(prev => [...prev, {
            id: `msg-${Date.now()}-resp`,
            sender: 'assistant',
            text: `${aiText}\n\n*Requires your approval to execute:* \`${command}\``,
            command, riskTier, suggestedActions, emotion: 'caring',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }])
          if (voiceSettings.autoSpeak) speakText(`${aiText}. This command requires your confirmation before I proceed.`, 'caring')
          return
        } else {
          output = await executeCommand(userText, command, riskTier)
        }
      }

      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-resp`,
        sender: 'assistant',
        text: aiText,
        command, commandOutput: output, riskTier, suggestedActions,
        emotion: responseEmotion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])

      if (voiceSettings.autoSpeak) {
        const spokenResponse = command && output ? `${aiText}. ${output.slice(0, 200)}` : aiText
        speakText(spokenResponse, responseEmotion)
      } else {
        setVoiceStatus('completed')
        setTimeout(() => {
          setVoiceStatus('idle')
          setEmotionState('neutral')
          if (voiceSettings.continuousMode && !manualStopRef.current) startListening()
        }, 1500)
      }
    } catch (err: any) {
      let detailMsg = err.response?.data?.detail || err.message || String(err)
      if (detailMsg === 'Network Error' || detailMsg.includes('NetworkError') || detailMsg.includes('Failed to fetch')) {
        detailMsg = 'Server connection temporarily interrupted. Reconnecting to LinuxPilot engine...'
      }
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-err`,
        sender: 'assistant',
        text: `I apologize, ${detailMsg} Please try again, I am here for you. 🙏`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'caring',
      }])
      setVoiceStatus('idle')
      setEmotionState('neutral')
    } finally {
      setTimeout(() => { sendLockRef.current = false }, 300)
    }
  }

  const approveCommand = async () => {
    if (!pendingApproval) return
    const { request, command, riskTier } = pendingApproval
    setPendingApproval(null)
    const output = await executeCommand(request, command, riskTier)

    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}-approved`,
      sender: 'assistant',
      text: `✅ Approved & Executed: \`${command}\``,
      command, commandOutput: output, riskTier, emotion: 'proud',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }])

    if (voiceSettings.autoSpeak) {
      speakText(`Command executed successfully. ${output.slice(0, 150)}`, 'proud')
    } else {
      setVoiceStatus('completed')
      setTimeout(() => {
        setVoiceStatus('idle')
        if (voiceSettings.continuousMode && !manualStopRef.current) startListening()
      }, 1500)
    }
  }

  const cancelCommand = () => {
    if (pendingApproval) {
      setAiActivities(prev => [{
        id: `log-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        userRequest: pendingApproval.request,
        command: pendingApproval.command,
        risk: pendingApproval.riskTier,
        status: 'Cancelled',
        result: 'User cancelled execution'
      }, ...prev])
    }
    setPendingApproval(null)
    setVoiceStatus('idle')
    if (voiceSettings.continuousMode && !manualStopRef.current) startListening()
  }

  // ── High performance continuous multi-language Speech Recognition ──
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.')
      return
    }

    if (isListeningRef.current) return
    manualStopRef.current = false

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = voiceSettings.language || 'en-IN'

      recognition.onstart = () => {
        isListeningRef.current = true
        transcriptRef.current = ''
        setVoiceStatus('listening')
        setTranscript('')
        setEmotionState('neutral')

        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
              audioContextRef.current = audioCtx
              const analyser = audioCtx.createAnalyser()
              analyser.fftSize = 64
              const source = audioCtx.createMediaStreamSource(stream)
              source.connect(analyser)

              const dataArray = new Uint8Array(analyser.frequencyBinCount)
              const updateLevel = () => {
                if (!isListeningRef.current) return
                analyser.getByteFrequencyData(dataArray)
                let sum = 0
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
                const avg = sum / dataArray.length
                setAudioLevel(Math.min(1, avg / 128))
                animFrameRef.current = requestAnimationFrame(updateLevel)
              }
              updateLevel()
            }).catch(() => {})
          }
        } catch (e) {}
      }

      recognition.onresult = (event: any) => {
        let currentTranscript = ''
        let hasFinal = false

        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript
          if (event.results[i].isFinal) {
            hasFinal = true
          }
        }

        const text = currentTranscript.trim()
        if (text) {
          transcriptRef.current = text
          setTranscript(text)

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)

          // Smart silence timer (800ms for final result, 1400ms for interim)
          const timeoutMs = hasFinal ? 800 : 1400
          silenceTimerRef.current = setTimeout(() => {
            if (isListeningRef.current && transcriptRef.current.trim()) {
              if (recognitionRef.current) {
                try { recognitionRef.current.stop() } catch (e) {}
              }
            }
          }, timeoutMs)
        }
      }

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error)
        if (event.error === 'no-speech') return
        isListeningRef.current = false
        if (event.error !== 'aborted') setVoiceStatus('idle')
      }

      recognition.onend = () => {
        isListeningRef.current = false
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)

        const finalText = transcriptRef.current.trim()
        transcriptRef.current = ''
        setTranscript('')

        if (finalText) {
          sendMessage(finalText)
        } else {
          if (voiceSettings.continuousMode && !manualStopRef.current && voiceStatusRef.current === 'listening') {
            setTimeout(() => {
              if (!isListeningRef.current && voiceStatusRef.current === 'idle') startListening()
            }, 500)
          } else {
            setVoiceStatus('idle')
          }
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (e) {
      console.error('Failed to start speech recognition:', e)
      setVoiceStatus('idle')
    }
  }

  const stopListening = () => {
    manualStopRef.current = true
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (recognitionRef.current && isListeningRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
      isListeningRef.current = false
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    setAudioLevel(0)
    setVoiceStatus('idle')
  }

  const clearConversation = () => {
    const newId = `conv-${Date.now()}`
    setConversationId(newId)
    localStorage.setItem('linuxai_active_conv_id', newId)
    setMessages([{
      id: 'fresh-1',
      sender: 'assistant',
      text: '🙏 Session renewed with fresh context. Ask me anything about your system.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      emotion: 'caring',
    }])
  }

  return (
    <VoiceAssistantContext.Provider
      value={{
        voiceStatus, setVoiceStatus, emotionState,
        isMuted, setIsMuted,
        messages, transcript, conversationId,
        voiceSettings, aiActivities, pendingApproval, systemHealth,
        aiMode, setAiMode, audioLevel, currentThoughtStep, conversations,
        loadConversations, selectConversation,
        startListening, stopListening,
        sendMessage, speakText, stopSpeaking,
        approveCommand, cancelCommand,
        clearConversation, updateSettings,
        isOverlayOpen, setIsOverlayOpen,
        availableVoices,
      }}
    >
      {children}
    </VoiceAssistantContext.Provider>
  )
}

export const useVoiceAssistant = () => {
  const context = useContext(VoiceAssistantContext)
  if (!context) throw new Error('useVoiceAssistant must be used within a VoiceAssistantProvider')
  return context
}
