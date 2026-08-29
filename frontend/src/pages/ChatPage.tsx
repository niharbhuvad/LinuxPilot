// LinuxAI — AI Chat Page
import { useState, useRef, useEffect, FormEvent } from 'react'
import { chatApi, commandsApi } from '../services/api'
import ToolExecutionStepComp from '../components/ToolExecutionStep'
import ApprovalModal from '../components/ApprovalModal'
import { Send, Terminal, Loader2, Plus, Bot, User as UserIcon, History, Trash2, MessageSquare, Mic, MicOff, X } from 'lucide-react'
import clsx from 'clsx'
import type { ToolExecutionStep, ApprovalOut } from '../types'
import { useVoiceAssistant } from '../context/VoiceAssistantContext'

const QUICK_COMMANDS = [
  'Why is my system slow?',
  'Check my server health',
  'Show failed services',
  'Check disk usage',
  'What processes use the most memory?',
  'Check network interfaces',
]

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolSteps?: ToolExecutionStep[]
  loading?: boolean
  created_at: string
  suggestedActions?: { label: string; action: string }[]
}

interface SavedConversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export default function ChatPage() {
  const { voiceStatus, startListening, stopListening, messages: contextMessages, sendMessage: voiceSendMessage } = useVoiceAssistant()
  const isListening = voiceStatus === 'listening'

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [conversations, setConversations] = useState<SavedConversation[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<ApprovalOut | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (contextMessages.length > 0) {
      setMessages(contextMessages.map(m => ({
        id: m.id,
        role: m.sender,
        content: m.text + (m.commandOutput ? `\n\n\`\`\`\n${m.commandOutput}\n\`\`\`` : ''),
        created_at: new Date().toISOString(),
        suggestedActions: m.suggestedActions
      })))
    }
  }, [contextMessages])

  const loadConversations = async () => {
    try {
      const res = await chatApi.conversations()
      setConversations(res.data)
    } catch (err) {
      console.error('Failed to load chat history:', err)
    }
  }

  useEffect(() => {
    loadConversations()
  }, [])

  const selectConversation = async (id: string) => {
    setConversationId(id)
    try {
      const res = await chatApi.history(id)
      setMessages((res.data.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolSteps: m.tool_calls,
        created_at: m.created_at,
        suggestedActions: m.suggestedActions
      })))
    } catch (err) {
      console.error('Failed to load conversation:', err)
    }
  }

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this conversation?')) return
    try {
      await chatApi.deleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (conversationId === id) {
        setMessages([])
        setConversationId(undefined)
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const handleClearAllHistory = async () => {
    if (!confirm('Are you sure you want to delete ALL saved chat history permanently?')) return
    try {
      await chatApi.clearAllConversations()
      setMessages([])
      setConversationId(undefined)
      setConversations([])
    } catch (err) {
      console.error('Failed to clear history:', err)
    }
  }

  const send = async (message: string) => {
    if (!message.trim() || loading) return
    setInput('')
    await voiceSendMessage(message)
  }

  const handleApprove = async (confirmText?: string) => {
    if (!pendingApproval) return
    try {
      await commandsApi.decide(pendingApproval.id, true, confirmText)
      setPendingApproval(null)
      await send('The approved command has been confirmed. Please proceed.')
    } catch (err: any) {
      console.error(err)
    }
  }

  const handleReject = async () => {
    if (!pendingApproval) return
    await commandsApi.decide(pendingApproval.id, false)
    setPendingApproval(null)
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '✓ Command rejected. No changes were made.',
      created_at: new Date().toISOString(),
    }])
  }

  const newConversation = () => {
    setMessages([])
    setConversationId(undefined)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="flex h-full bg-terminal-bg overflow-hidden">
      {/* Saved History Sidebar Drawer */}
      {showHistory && (
        <div className="w-64 border-r border-terminal-border bg-terminal-surface flex flex-col h-full animate-fade-in shrink-0">
          <div className="p-3 border-b border-terminal-border flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono font-bold text-xs text-terminal-text">
              <History className="w-4 h-4 text-terminal-blue" />
              <span>Saved History ({conversations.length})</span>
            </div>
            <div className="flex items-center gap-1">
              {conversations.length > 0 && (
                <button
                  onClick={handleClearAllHistory}
                  title="Clear All History"
                  className="p-1 rounded text-red-400 hover:bg-red-950/40 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 rounded text-terminal-muted hover:text-terminal-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-terminal-muted text-xs font-mono">
                No saved chats found.
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={clsx(
                    'group flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono cursor-pointer transition-all',
                    conversationId === conv.id
                      ? 'bg-terminal-blue/15 border-terminal-blue/40 text-terminal-blue font-bold'
                      : 'bg-terminal-bg/50 border-terminal-border/40 text-terminal-muted hover:text-terminal-text hover:border-terminal-border'
                  )}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{conv.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={e => handleDeleteConversation(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:bg-red-950/50 transition-all shrink-0 ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Chat Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border bg-terminal-surface shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={clsx(
                'p-1.5 rounded-lg border text-xs flex items-center gap-1.5 font-mono transition-colors',
                showHistory ? 'bg-terminal-blue/20 border-terminal-blue/40 text-terminal-blue' : 'bg-terminal-bg border-terminal-border text-terminal-muted hover:text-terminal-text'
              )}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History ({conversations.length})</span>
            </button>

            <Terminal className="w-5 h-5 text-terminal-green ml-2" />
            <h1 className="font-bold font-mono text-terminal-text">AI Assistant Console</h1>
          </div>

          <button onClick={newConversation} className="btn-ghost text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-6 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-terminal-surface border border-terminal-green/30 flex items-center justify-center glow-green">
                <Bot className="w-8 h-8 text-terminal-green" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-terminal-text">How can I help?</h2>
                <p className="text-terminal-muted text-sm mt-1">
                  Ask me anything about your Linux system using voice or text.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-2xl w-full">
                {QUICK_COMMANDS.map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => send(cmd)}
                    className="text-left px-3 py-2.5 bg-terminal-surface border border-terminal-border rounded-lg text-sm text-terminal-muted hover:text-terminal-text hover:border-terminal-blue transition-all"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={clsx('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-terminal-green/10 border border-terminal-green/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-terminal-green" />
                </div>
              )}

              <div className={clsx('max-w-[85%] space-y-2', msg.role === 'user' ? 'items-end flex flex-col' : '')}>
                {msg.loading ? (
                  <div className="chat-bubble-ai flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                    <span className="text-xs text-terminal-muted font-mono">Investigating...</span>
                  </div>
                ) : (
                  <>
                    {/* Tool steps */}
                    {msg.toolSteps && msg.toolSteps.length > 0 && (
                      <div className="space-y-1.5 w-full">
                        {msg.toolSteps.map((step, i) => (
                          <ToolExecutionStepComp key={i} step={step} index={i} />
                        ))}
                      </div>
                    )}

                    {/* Content */}
                    {msg.content && (
                      <div className={clsx(msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai')}>
                        <p className="text-sm text-terminal-text leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}

                    {/* Suggested Action Buttons */}
                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {msg.suggestedActions.map((sa, idx) => (
                          <button
                            key={idx}
                            onClick={() => send(sa.action)}
                            className="px-3 py-1.5 bg-terminal-surface border border-terminal-cyan/40 text-terminal-cyan rounded-lg hover:bg-terminal-cyan hover:text-black font-mono text-xs font-semibold transition-colors"
                          >
                            {sa.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <span className="text-[10px] text-terminal-muted font-mono px-1">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-terminal-blue/10 border border-terminal-blue/30 flex items-center justify-center shrink-0 mt-0.5">
                  <UserIcon className="w-4 h-4 text-terminal-blue" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form with Mic Integration */}
        <form onSubmit={onSubmit} className="px-4 py-4 border-t border-terminal-border bg-terminal-surface shrink-0">
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={clsx(
                'p-3 rounded-xl border transition-all shrink-0',
                isListening
                  ? 'bg-red-600 border-red-400 text-white animate-pulse'
                  : 'bg-terminal-bg border-terminal-border text-terminal-cyan hover:border-terminal-cyan'
              )}
              title={isListening ? 'Stop Listening' : 'Speak Voice Command'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <div className="flex-1 bg-terminal-bg border border-terminal-border rounded-xl overflow-hidden focus-within:border-terminal-blue transition-colors">
              <textarea
                value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                placeholder="Ask about your Linux system... (Enter to send, Shift+Enter for newline)"
                rows={1}
                disabled={loading}
                className="w-full bg-transparent px-4 py-3 text-sm text-terminal-text resize-none focus:outline-none font-mono max-h-32 placeholder:text-terminal-muted/40"
                style={{ minHeight: '44px' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary shrink-0 h-11 w-11 justify-center p-0 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>

        {/* Approval Modal */}
        {pendingApproval && (
          <ApprovalModal
            approval={pendingApproval}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>
    </div>
  )
}
