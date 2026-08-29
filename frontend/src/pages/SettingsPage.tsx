import { useState } from 'react'
import { chatApi } from '../services/api'
import {
  Sliders, Bot, Shield, Bell, Terminal as TerminalIcon,
  Palette, Save, RotateCcw, Check, Info, Sparkles, Lock,
  Activity, Play, CheckCircle, AlertTriangle, XCircle, RefreshCw, Radio
} from 'lucide-react'

interface SettingsState {
  // AI Settings
  aiProvider: string
  aiModel: string
  geminiApiKey: string
  groqApiKey: string
  openaiApiKey: string
  ollamaBaseUrl: string
  aiTemperature: number
  aiPersona: string
  maxTokens: number

  // Security & Execution Policies
  executionMode: 'manual' | 'hybrid' | 'autonomous'
  autoSudo: boolean
  redactSecrets: boolean
  dangerousCommandSafeguard: boolean

  // Monitoring & Alerts
  cpuWarningPct: number
  cpuCriticalPct: number
  memWarningPct: number
  diskWarningPct: number
  pollingIntervalSec: number
  autoScanFailedServices: boolean

  // Terminal Preferences
  defaultShell: string
  terminalFontSize: number
  terminalScrollback: number
  autoScrollTerminal: boolean

  // UI & Notifications
  soundAlerts: boolean
  compactMode: boolean
  timeFormat: '24h' | '12h'
}

const DEFAULT_SETTINGS: SettingsState = {
  aiProvider: 'gemini',
  aiModel: 'gemini-2.5-flash',
  geminiApiKey: 'your_gemini_api_key',
  groqApiKey: 'your_groq_api_key',
  openaiApiKey: 'your_openai_api_key',
  ollamaBaseUrl: 'http://localhost:11434/v1',
  aiTemperature: 0.2,
  aiPersona: 'sysadmin',
  maxTokens: 2048,

  executionMode: 'hybrid',
  autoSudo: true,
  redactSecrets: true,
  dangerousCommandSafeguard: true,

  cpuWarningPct: 80,
  cpuCriticalPct: 95,
  memWarningPct: 85,
  diskWarningPct: 85,
  pollingIntervalSec: 5,
  autoScanFailedServices: true,

  defaultShell: '/bin/bash',
  terminalFontSize: 13,
  terminalScrollback: 1000,
  autoScrollTerminal: true,

  soundAlerts: false,
  compactMode: false,
  timeFormat: '24h',
}

const STORAGE_KEY = 'linuxai_system_settings_v1'

interface AITestResult {
  status: 'ok' | 'fallback' | 'error'
  provider: string
  model: string
  key_configured: boolean
  data_received: boolean
  latency_ms: number
  response_sample: string
  timestamp: string
  message: string
  diagnostics?: Record<string, any>
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'ai' | 'security' | 'monitoring' | 'terminal' | 'ui'>('ai')
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })
  const [isSaved, setIsSaved] = useState(false)
  const [resetMessage, setResetMessage] = useState(false)

  const [isTestingAi, setIsTestingAi] = useState(false)
  const [aiTestResult, setAiTestResult] = useState<AITestResult | null>(null)

  const handleTestAi = async () => {
    setIsTestingAi(true)
    setAiTestResult(null)
    try {
      const apiKeyToUse =
        settings.aiProvider === 'gemini' ? settings.geminiApiKey :
          settings.aiProvider === 'groq' ? settings.groqApiKey :
            settings.aiProvider === 'openai' ? settings.openaiApiKey : undefined

      const res = await chatApi.testAiConnection({
        provider: settings.aiProvider,
        model: settings.aiModel,
        api_key: apiKeyToUse,
        ollama_base_url: settings.ollamaBaseUrl,
      })
      setAiTestResult(res.data)
    } catch (err: any) {
      setAiTestResult({
        status: 'error',
        provider: settings.aiProvider,
        model: settings.aiModel,
        key_configured: false,
        data_received: false,
        latency_ms: 0,
        response_sample: '',
        timestamp: new Date().toISOString(),
        message: err.response?.data?.detail || err.message || 'Failed to connect to backend AI probe',
        diagnostics: { error: String(err) }
      })
    } finally {
      setIsTestingAi(false)
    }
  }

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 3000)
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
    setResetMessage(true)
    setTimeout(() => setResetMessage(false), 3000)
  }

  return (
    <div className="p-6 animate-fade-in space-y-6 max-w-6xl h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-terminal-green/10 border border-terminal-green/30 text-terminal-green">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-terminal-text tracking-tight">System & AI Settings</h1>
            <p className="text-sm text-terminal-muted">
              Configure AI agent behavior, execution policies, monitoring thresholds, and terminal preferences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text hover:border-terminal-muted transition-colors text-xs font-mono"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-terminal-green text-black font-semibold hover:bg-terminal-green/90 transition-colors text-xs font-mono shadow-lg shadow-terminal-green/20"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4" />
                Saved Successfully!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {resetMessage && (
        <div className="p-3 rounded-lg bg-terminal-amber/10 border border-terminal-amber/30 text-terminal-amber text-xs flex items-center gap-2 font-mono">
          <Info className="w-4 h-4 shrink-0" />
          Settings have been reset to factory defaults.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-terminal-border space-x-2">
        {[
          { id: 'ai', label: 'AI Agent & LLM', icon: Bot },
          { id: 'security', label: 'Security & Execution', icon: Shield },
          { id: 'monitoring', label: 'Monitoring & Thresholds', icon: Bell },
          { id: 'terminal', label: 'Terminal Console', icon: TerminalIcon },
          { id: 'ui', label: 'Preferences & UI', icon: Palette },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${isActive
                  ? 'border-terminal-blue text-terminal-blue bg-terminal-blue/5'
                  : 'border-transparent text-terminal-muted hover:text-terminal-text hover:border-terminal-border'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT: AI AGENT & LLM */}
      {activeTab === 'ai' && (
        <div className="space-y-5">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-terminal-border">
              <div className="flex items-center gap-2 text-terminal-text font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-terminal-blue" />
                <span>LLM Engine & Model Architecture</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-terminal-blue/10 text-terminal-blue border border-terminal-blue/30 uppercase">
                Active: {settings.aiProvider}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-terminal-muted block mb-1.5">Model Provider</label>
                <select
                  value={settings.aiProvider}
                  onChange={e => {
                    const newProv = e.target.value
                    let defaultModel = settings.aiModel
                    if (newProv === 'gemini') defaultModel = 'gemini-2.5-flash'
                    else if (newProv === 'groq') defaultModel = 'openai/gpt-oss-120b'
                    else if (newProv === 'openai') defaultModel = 'gpt-4o'
                    else if (newProv === 'anthropic') defaultModel = 'claude-3-5-sonnet'
                    else if (newProv === 'ollama') defaultModel = 'qwen2.5-coder:7b'
                    setSettings({ ...settings, aiProvider: newProv, aiModel: defaultModel })
                  }}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text focus:border-terminal-blue outline-none"
                >
                  <option value="gemini">Google Gemini (Gemini 2.5 Flash / Pro)</option>
                  <option value="groq">Groq (Ultra-Fast LPU Engine)</option>
                  <option value="openai">OpenAI (Official API)</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="ollama">Ollama (Local Offline LLM)</option>
                  <option value="custom">Custom OpenAI-Compatible Endpoint</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-terminal-muted block mb-1.5">Model Selection</label>
                <select
                  value={settings.aiModel}
                  onChange={e => setSettings({ ...settings, aiModel: e.target.value })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text focus:border-terminal-blue outline-none font-mono"
                >
                  {settings.aiProvider === 'gemini' && (
                    <>
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Accurate SysAdmin Reasoning)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (High-Context Diagnostic Analysis)</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash (Latest Generation Flash)</option>
                    </>
                  )}
                  {settings.aiProvider === 'groq' && (
                    <>
                      <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Ultra-Fast LPU Inference)</option>
                      <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (High Capacity Llama 3.3)</option>
                      <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (MoE Architecture)</option>
                    </>
                  )}
                  {settings.aiProvider === 'openai' && (
                    <>
                      <option value="gpt-4o">gpt-4o (High Intelligence & Tool Accuracy)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (Fast & Cost Effective)</option>
                      <option value="o3-mini">o3-mini (Advanced Reasoning)</option>
                    </>
                  )}
                  {settings.aiProvider === 'anthropic' && (
                    <>
                      <option value="claude-3-5-sonnet">claude-3-5-sonnet (Advanced Code Reasoning)</option>
                      <option value="claude-3-haiku">claude-3-haiku (Fast)</option>
                    </>
                  )}
                  {settings.aiProvider === 'ollama' && (
                    <>
                      <option value="qwen2.5-coder:7b">qwen2.5-coder:7b (Local Ollama SysAdmin)</option>
                      <option value="llama3:8b">llama3:8b (Local Ollama Instance)</option>
                      <option value="deepseek-r1">deepseek-r1 (Local Diagnostic Engine)</option>
                    </>
                  )}
                  {settings.aiProvider === 'custom' && (
                    <option value={settings.aiModel}>{settings.aiModel || 'custom-model'}</option>
                  )}
                </select>
              </div>
            </div>

            {settings.aiProvider === 'gemini' && (
              <div className="p-3 bg-terminal-blue/10 border border-terminal-blue/30 rounded-lg space-y-1.5 font-mono">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-terminal-blue">Google Gemini API Key</label>
                  <span className="text-[10px] text-terminal-green bg-terminal-green/10 border border-terminal-green/30 px-2 py-0.5 rounded">✓ Provider Active</span>
                </div>
                <input
                  type="password"
                  value={settings.geminiApiKey}
                  onChange={e => setSettings({ ...settings, geminiApiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-1.5 text-xs text-terminal-text focus:border-terminal-blue outline-none"
                />
                <p className="text-[11px] text-terminal-muted">Powered by Google AI Studio OpenAI-compatible endpoint with low latency.</p>
              </div>
            )}

            {settings.aiProvider === 'groq' && (
              <div className="p-3 bg-terminal-blue/10 border border-terminal-blue/30 rounded-lg space-y-1.5 font-mono">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-terminal-blue">Groq LPU API Key</label>
                  <span className="text-[10px] text-terminal-green bg-terminal-green/10 border border-terminal-green/30 px-2 py-0.5 rounded">✓ Provider Active</span>
                </div>
                <input
                  type="password"
                  value={settings.groqApiKey}
                  onChange={e => setSettings({ ...settings, groqApiKey: e.target.value })}
                  placeholder="gsk_..."
                  className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-1.5 text-xs text-terminal-text focus:border-terminal-blue outline-none"
                />
                <p className="text-[11px] text-terminal-muted">Powered by Groq LPU hardware acceleration for near-instant inference speeds.</p>
              </div>
            )}

            {settings.aiProvider === 'openai' && (
              <div className="p-3 bg-terminal-blue/10 border border-terminal-blue/30 rounded-lg space-y-1.5 font-mono">
                <label className="text-xs font-semibold text-terminal-blue block">OpenAI API Key</label>
                <input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={e => setSettings({ ...settings, openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-1.5 text-xs text-terminal-text focus:border-terminal-blue outline-none"
                />
              </div>
            )}

            {settings.aiProvider === 'ollama' && (
              <div className="p-3 bg-terminal-blue/10 border border-terminal-blue/30 rounded-lg space-y-1.5">
                <label className="text-xs font-semibold text-terminal-blue block">Local Ollama Endpoint URL</label>
                <input
                  type="text"
                  value={settings.ollamaBaseUrl}
                  onChange={e => setSettings({ ...settings, ollamaBaseUrl: e.target.value })}
                  placeholder="http://localhost:11434/v1"
                  className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-1.5 text-xs font-mono text-terminal-text focus:border-terminal-blue outline-none"
                />
                <p className="text-[11px] text-terminal-muted">Runs 100% locally and offline without cloud API fees.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs text-terminal-muted block mb-1.5">
                  AI Agent Persona & Tone
                </label>
                <select
                  value={settings.aiPersona}
                  onChange={e => setSettings({ ...settings, aiPersona: e.target.value })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text focus:border-terminal-blue outline-none"
                >
                  <option value="sysadmin">Senior Enterprise Linux Administrator (Strict, Precise, Safe)</option>
                  <option value="devops">DevOps & Cloud Engineer (Automation, Metrics & Scripting)</option>
                  <option value="tutor">Red Hat Certified Instructor (Explanatory, Educational)</option>
                  <option value="minimalist">Minimalist CLI Operator (Compact, Raw Commands & Outputs)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs text-terminal-muted">Model Temperature (Creativity)</label>
                  <span className="text-xs font-mono text-terminal-blue">{settings.aiTemperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={settings.aiTemperature}
                  onChange={e => setSettings({ ...settings, aiTemperature: parseFloat(e.target.value) })}
                  className="w-full accent-terminal-blue cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-terminal-muted mt-1">
                  <span>0.0 (Deterministic / Safe)</span>
                  <span>1.0 (Creative)</span>
                </div>
              </div>
            </div>

            {/* AI Diagnostic Test & Data Flow Card */}
            <div className="pt-4 border-t border-terminal-border space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-terminal-text flex items-center gap-1.5 font-mono">
                    <Activity className="w-4 h-4 text-terminal-green" />
                    AI Engine & Data Flow Probe
                  </h3>
                  <p className="text-[11px] text-terminal-muted">
                    Run a live probe to verify backend & frontend connectivity, measure latency, and validate AI data response.
                  </p>
                </div>
                <button
                  onClick={handleTestAi}
                  disabled={isTestingAi}
                  className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-terminal-blue/10 border border-terminal-blue/40 text-terminal-blue font-mono text-xs font-medium hover:bg-terminal-blue/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                >
                  {isTestingAi ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-terminal-blue" />
                      <span>Testing AI Engine...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-terminal-blue fill-terminal-blue/30" />
                      <span>Test AI Connection</span>
                    </>
                  )}
                </button>
              </div>

              {/* Diagnostic Result Card */}
              {aiTestResult && (
                <div className={`p-4 rounded-xl border font-mono text-xs space-y-3 transition-all ${aiTestResult.status === 'ok'
                    ? 'bg-terminal-green/5 border-terminal-green/30 text-terminal-text'
                    : aiTestResult.status === 'fallback'
                      ? 'bg-terminal-amber/5 border-terminal-amber/30 text-terminal-text'
                      : 'bg-terminal-red/5 border-terminal-red/30 text-terminal-text'
                  }`}>
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between pb-2 border-b border-terminal-border/50">
                    <div className="flex items-center gap-2">
                      {aiTestResult.status === 'ok' ? (
                        <span className="flex items-center gap-1.5 text-terminal-green font-bold">
                          <CheckCircle className="w-4 h-4" />
                          AI ENGINE OPERATIONAL
                        </span>
                      ) : aiTestResult.status === 'fallback' ? (
                        <span className="flex items-center gap-1.5 text-terminal-amber font-bold">
                          <AlertTriangle className="w-4 h-4" />
                          LOCAL FALLBACK DIAGNOSTIC ENGINE
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-terminal-red font-bold">
                          <XCircle className="w-4 h-4" />
                          AI CONNECTION ERROR
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-terminal-muted">
                      Tested at {new Date(aiTestResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Grid of Diagnostics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-terminal-surface/60 border border-terminal-border/40">
                      <span className="text-terminal-muted block text-[10px]">Active Provider</span>
                      <span className="font-semibold text-terminal-blue uppercase">{aiTestResult.provider}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-terminal-surface/60 border border-terminal-border/40">
                      <span className="text-terminal-muted block text-[10px]">Target Model</span>
                      <span className="font-semibold text-terminal-text truncate block">{aiTestResult.model}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-terminal-surface/60 border border-terminal-border/40">
                      <span className="text-terminal-muted block text-[10px]">Response Latency</span>
                      <span className={`font-semibold ${aiTestResult.latency_ms > 2000 ? 'text-terminal-amber' : 'text-terminal-green'}`}>
                        {aiTestResult.latency_ms} ms
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-terminal-surface/60 border border-terminal-border/40">
                      <span className="text-terminal-muted block text-[10px]">Data Flow Check</span>
                      <span className={`font-semibold flex items-center gap-1 ${aiTestResult.data_received ? 'text-terminal-green' : 'text-terminal-red'}`}>
                        <Radio className="w-3 h-3 animate-pulse" />
                        {aiTestResult.data_received ? 'Data Incoming (PASS)' : 'No Data Payload'}
                      </span>
                    </div>
                  </div>

                  {/* Message & Payload Preview */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-terminal-muted">Status Message:</div>
                    <div className="p-2.5 rounded-lg bg-black/40 border border-terminal-border/40 text-terminal-text text-[11px]">
                      {aiTestResult.message}
                    </div>
                  </div>

                  {aiTestResult.response_sample && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-terminal-muted flex items-center justify-between">
                        <span>AI Response Data Payload Preview:</span>
                        <span className="text-[10px] text-terminal-green font-semibold">✓ Valid Data Streamed</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/60 border border-terminal-green/30 text-terminal-green text-[11px] font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
                        {aiTestResult.response_sample}
                      </div>
                    </div>
                  )}

                  {aiTestResult.diagnostics && Object.keys(aiTestResult.diagnostics).length > 0 && (
                    <div className="text-[10px] text-terminal-muted pt-1 border-t border-terminal-border/40 flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(aiTestResult.diagnostics).map(([k, v]) => (
                        <span key={k}>
                          <strong className="text-terminal-text">{k}:</strong> {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SECURITY & EXECUTION POLICIES */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-terminal-border text-terminal-text font-semibold text-sm">
              <Lock className="w-4 h-4 text-terminal-amber" />
              <span>Command Execution & Elevation Governance</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-start justify-between p-3 rounded-lg bg-terminal-surface/60 border border-terminal-border">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-terminal-text font-mono">Autonomous Execution Policy</span>
                  <p className="text-xs text-terminal-muted">
                    Determines whether the AI Assistant can execute low-risk read commands without prompt approval.
                  </p>
                </div>
                <select
                  value={settings.executionMode}
                  onChange={e => setSettings({ ...settings, executionMode: e.target.value as any })}
                  className="bg-terminal-bg border border-terminal-border rounded-md px-3 py-1.5 text-xs text-terminal-text font-mono outline-none"
                >
                  <option value="manual">Manual Approval (Always Ask)</option>
                  <option value="hybrid">Hybrid (Auto-run LOW, Ask MEDIUM/HIGH)</option>
                  <option value="autonomous">Full Autonomous (Direct Execution)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-terminal-surface/60 border border-terminal-border">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-terminal-text font-mono">Automatic Sudo Elevation (-S)</span>
                  <p className="text-xs text-terminal-muted">
                    Automatically pipes stored SSH password into <code className="text-terminal-blue">sudo -S</code> for administrative commands.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSudo}
                  onChange={e => setSettings({ ...settings, autoSudo: e.target.checked })}
                  className="w-4 h-4 accent-terminal-green cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-terminal-surface/60 border border-terminal-border">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-terminal-text font-mono">Secret & Credential Masking</span>
                  <p className="text-xs text-terminal-muted">
                    Automatically redact passwords, tokens, and SSH private keys from command outputs and logs.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.redactSecrets}
                  onChange={e => setSettings({ ...settings, redactSecrets: e.target.checked })}
                  className="w-4 h-4 accent-terminal-green cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-terminal-surface/60 border border-terminal-border">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-terminal-text font-mono">Destructive Command Safeguard</span>
                  <p className="text-xs text-terminal-muted">
                    Hard-blocks catastrophic system operations like <code className="text-terminal-red">rm -rf /</code> or raw partition wipe.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.dangerousCommandSafeguard}
                  onChange={e => setSettings({ ...settings, dangerousCommandSafeguard: e.target.checked })}
                  className="w-4 h-4 accent-terminal-green cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MONITORING & THRESHOLDS */}
      {activeTab === 'monitoring' && (
        <div className="space-y-5">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-terminal-border text-terminal-text font-semibold text-sm">
              <Bell className="w-4 h-4 text-terminal-blue" />
              <span>Real-Time Diagnostic & Alert Triggers</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-terminal-muted">CPU Warning Threshold</span>
                  <span className="font-mono text-terminal-amber">{settings.cpuWarningPct}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="90"
                  value={settings.cpuWarningPct}
                  onChange={e => setSettings({ ...settings, cpuWarningPct: parseInt(e.target.value) })}
                  className="w-full accent-terminal-amber cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-terminal-muted">CPU Critical Threshold</span>
                  <span className="font-mono text-terminal-red">{settings.cpuCriticalPct}%</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="99"
                  value={settings.cpuCriticalPct}
                  onChange={e => setSettings({ ...settings, cpuCriticalPct: parseInt(e.target.value) })}
                  className="w-full accent-terminal-red cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-terminal-muted">Memory (RAM) Warning Threshold</span>
                  <span className="font-mono text-terminal-amber">{settings.memWarningPct}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  value={settings.memWarningPct}
                  onChange={e => setSettings({ ...settings, memWarningPct: parseInt(e.target.value) })}
                  className="w-full accent-terminal-amber cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-terminal-muted">Disk Storage Warning Threshold</span>
                  <span className="font-mono text-terminal-amber">{settings.diskWarningPct}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  value={settings.diskWarningPct}
                  onChange={e => setSettings({ ...settings, diskWarningPct: parseInt(e.target.value) })}
                  className="w-full accent-terminal-amber cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-terminal-border grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-terminal-muted block mb-1.5">Live Telemetry Polling Rate</label>
                <select
                  value={settings.pollingIntervalSec}
                  onChange={e => setSettings({ ...settings, pollingIntervalSec: parseInt(e.target.value) })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text font-mono outline-none"
                >
                  <option value={3}>Every 3 seconds (High Frequency)</option>
                  <option value={5}>Every 5 seconds (Recommended)</option>
                  <option value={10}>Every 10 seconds (Low Bandwidth)</option>
                  <option value={30}>Every 30 seconds (Minimal Load)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-terminal-surface/60 border border-terminal-border">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-terminal-text">Systemd Failed Unit Scanner</span>
                  <p className="text-[11px] text-terminal-muted">Auto-trigger alert on service crash</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoScanFailedServices}
                  onChange={e => setSettings({ ...settings, autoScanFailedServices: e.target.checked })}
                  className="w-4 h-4 accent-terminal-green cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TERMINAL CONSOLE */}
      {activeTab === 'terminal' && (
        <div className="space-y-5">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-terminal-border text-terminal-text font-semibold text-sm">
              <TerminalIcon className="w-4 h-4 text-terminal-green" />
              <span>Interactive Shell Environment</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-terminal-muted block mb-1.5">Target Shell</label>
                <select
                  value={settings.defaultShell}
                  onChange={e => setSettings({ ...settings, defaultShell: e.target.value })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text font-mono outline-none"
                >
                  <option value="/bin/bash">/bin/bash (Default)</option>
                  <option value="/bin/sh">/bin/sh (POSIX Standard)</option>
                  <option value="/bin/zsh">/bin/zsh (Z Shell)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-terminal-muted block mb-1.5">Font Size</label>
                <select
                  value={settings.terminalFontSize}
                  onChange={e => setSettings({ ...settings, terminalFontSize: parseInt(e.target.value) })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text font-mono outline-none"
                >
                  <option value={12}>12px (Compact)</option>
                  <option value={13}>13px (Standard)</option>
                  <option value={14}>14px (Medium)</option>
                  <option value={16}>16px (Large)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-terminal-muted block mb-1.5">Scrollback Buffer</label>
                <select
                  value={settings.terminalScrollback}
                  onChange={e => setSettings({ ...settings, terminalScrollback: parseInt(e.target.value) })}
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-xs text-terminal-text font-mono outline-none"
                >
                  <option value={500}>500 Lines</option>
                  <option value={1000}>1,000 Lines (Recommended)</option>
                  <option value={2500}>2,500 Lines</option>
                  <option value={5000}>5,000 Lines (Heavy)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-terminal-surface/60 border border-terminal-border">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-terminal-text">Auto-scroll on Execution</span>
                  <p className="text-xs text-terminal-muted">Keep prompt and fresh command output pinned to the bottom</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoScrollTerminal}
                  onChange={e => setSettings({ ...settings, autoScrollTerminal: e.target.checked })}
                  className="w-4 h-4 accent-terminal-green cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}
