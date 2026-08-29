// LinuxAI — Login Page
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Terminal, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg flex items-center justify-center relative overflow-hidden">
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(#00ff9f 1px, transparent 1px), linear-gradient(90deg, #00ff9f 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Glow blob */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-terminal-blue/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md mx-4 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-terminal-surface border border-terminal-green/30 mb-4 glow-green">
            <Terminal className="w-8 h-8 text-terminal-green" />
          </div>
          <h1 className="text-3xl font-bold font-mono text-terminal-green tracking-tight">LinuxAI</h1>
          <p className="text-terminal-muted text-sm mt-1">AI Brain for Linux System Administration</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold text-terminal-text mb-1">Sign In</h2>
          <p className="text-terminal-muted text-sm mb-6">Access your Linux administration dashboard</p>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-terminal-red">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">

            <div>
              <label className="block text-xs text-terminal-muted mb-1.5 font-mono">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                required
                autoFocus
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2.5 text-sm font-mono text-terminal-text
                           focus:outline-none focus:border-terminal-blue transition-colors placeholder:text-terminal-muted/40"
              />
            </div>
            <div>
              <label className="block text-xs text-terminal-muted mb-1.5 font-mono">PASSWORD</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2.5 text-sm font-mono text-terminal-text
                             focus:outline-none focus:border-terminal-blue transition-colors pr-10 placeholder:text-terminal-muted/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-muted hover:text-terminal-text"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-2.5 mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Dev hint */}
          <div className="mt-6 pt-4 border-t border-terminal-border text-center">
            <p className="text-xs text-terminal-muted font-mono">
              Default: <span className="text-terminal-green">admin</span> / <span className="text-terminal-green">admin123</span>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-terminal-muted mt-6">
          All actions are audited and require approval for risky operations.
        </p>
      </div>
    </div>
  )
}
