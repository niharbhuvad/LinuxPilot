// LinuxAI — SSH Connection Card & Saved Host Profiles Manager
import { useState, useEffect } from 'react'
import {
  Server, Wifi, CheckCircle2, XCircle, Loader2, Key, Lock, ShieldAlert,
  Terminal, RefreshCw, Copy, Check, HelpCircle, Bookmark, Plus, Trash2,
  BookmarkCheck, Sparkles, X, ArrowRight, Play, Eye, FileText, Pencil, Edit3
} from 'lucide-react'
import { sshApi } from '../services/api'

interface SSHProfile {
  id: string
  name: string
  description?: string
  host: string
  port: number
  user: string
  password?: string
  key_path?: string
  is_fixed?: boolean
}

export default function SSHConnectionCard() {
  const [host, setHost] = useState('yqpjs-120-136-44-4.run.pinggy-free.link')
  const [port, setPort] = useState(35685)
  const [user, setUser] = useState('student')
  const [authType, setAuthType] = useState<'key' | 'password'>('password')
  const [password, setPassword] = useState('')
  const [keyPath, setKeyPath] = useState('')

  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)
  const [copiedSshCmd, setCopiedSshCmd] = useState(false)
  const [status, setStatus] = useState<'CONNECTED' | 'DISCONNECTED'>('DISCONNECTED')
  const [targetInfo, setTargetInfo] = useState<any>(null)

  // Saved Profiles State
  const [savedProfiles, setSavedProfiles] = useState<SSHProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [connectingProfileId, setConnectingProfileId] = useState<string | null>(null)

  // Modals State
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [viewingProfile, setViewingProfile] = useState<SSHProfile | null>(null)
  const [editingProfile, setEditingProfile] = useState<SSHProfile | null>(null)

  // Form Fields State for Save / Edit Modal
  const [profileName, setProfileName] = useState('')
  const [profileDesc, setProfileDesc] = useState('')
  const [editHost, setEditHost] = useState('')
  const [editPort, setEditPort] = useState(22)
  const [editUser, setEditUser] = useState('root')
  const [editAuthType, setEditAuthType] = useState<'key' | 'password'>('password')
  const [editPassword, setEditPassword] = useState('')
  const [editKeyPath, setEditKeyPath] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    info?: any
    suggestion?: string
  } | null>(null)

  const loadInitial = async () => {
    setLoading(true)
    setLoadingProfiles(true)
    try {
      const [configRes, profilesRes] = await Promise.all([
        sshApi.getConfig(),
        sshApi.getSavedProfiles(),
      ])
      const data = configRes.data
      setStatus(data.status)
      if (data.host) setHost(data.host)
      if (data.port) setPort(data.port)
      if (data.user) setUser(data.user)
      if (data.target_info) setTargetInfo(data.target_info)

      setSavedProfiles(profilesRes.data || [])
    } catch (err) {
      console.error('Failed to load SSH config', err)
    } finally {
      setLoading(false)
      setLoadingProfiles(false)
    }
  }

  useEffect(() => {
    loadInitial()
  }, [])

  const handleTestConnection = async (overrideHost?: string, overridePort?: number, overrideUser?: string, overridePassword?: string) => {
    const targetHost = overrideHost || host
    const targetPort = overridePort || Number(port)
    const targetUser = overrideUser || user
    const targetPass = overridePassword !== undefined ? overridePassword : password

    if (!targetHost) {
      setTestResult({ success: false, message: 'Please enter a server host or IP address.' })
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const res = await sshApi.testConnection({
        host: targetHost,
        port: targetPort,
        user: targetUser,
        password: targetPass,
        key_path: keyPath,
      })
      setTestResult(res.data)
      if (res.data.success && res.data.info) {
        setTargetInfo(res.data.info)
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.detail || 'Failed to reach remote host.',
        suggestion: 'Verify SSH credentials, open port 22 in firewall, and internet connectivity.',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveAndConnect = async () => {
    if (!host) return
    setLoading(true)
    try {
      await sshApi.saveConfig({
        enabled: true,
        host,
        port: Number(port),
        user,
        password,
        key_path: keyPath,
      })

      // Automatically save current connected host to saved profiles
      try {
        await sshApi.saveProfile({
          name: `${user}@${host}`,
          description: `Connected RHEL Lab Host (${host})`,
          host,
          port: Number(port),
          user,
          password,
          key_path: keyPath,
        })
      } catch (e) {
        // ignore if already saved
      }

      setStatus('CONNECTED')
      setTestResult({
        success: true,
        message: `Connected to RHEL Lab (${host})! Saved to connection profiles list. LinuxAI commands will now execute remotely over SSH.`,
      })
      loadInitial()
      window.dispatchEvent(new Event('ssh-config-updated'))
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.detail || 'Failed to save connection config.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConnectProfile = async (profile: SSHProfile) => {
    setConnectingProfileId(profile.id)
    setLoading(true)
    try {
      await sshApi.connectProfile(profile.id)
      setHost(profile.host)
      setPort(profile.port)
      setUser(profile.user)
      if (profile.password) setPassword(profile.password)
      if (profile.key_path) setKeyPath(profile.key_path)
      setStatus('CONNECTED')
      setTestResult({
        success: true,
        message: `Activated profile "${profile.name}" (${profile.host})! LinuxAI is now connected live over SSH.`,
      })
      loadInitial()
      window.dispatchEvent(new Event('ssh-config-updated'))
      if (viewingProfile?.id === profile.id) {
        setViewingProfile(null)
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.detail || `Failed to connect profile "${profile.name}".`,
      })
    } finally {
      setConnectingProfileId(null)
      setLoading(false)
    }
  }

  const handleOpenSaveModal = () => {
    setProfileName(host ? `${user}@${host}` : 'New SSH Connection')
    setProfileDesc('')
    setEditHost(host)
    setEditPort(port)
    setEditUser(user)
    setEditAuthType(authType)
    setEditPassword('')
    setEditKeyPath(keyPath)
    setModalError(null)
    setShowSaveModal(true)
  }

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    if (!profileName.trim()) {
      setModalError('Profile name is required')
      return
    }
    if (!editHost.trim()) {
      setModalError('Host or IP address is required')
      return
    }

    setSavingProfile(true)
    try {
      await sshApi.saveProfile({
        name: profileName.trim(),
        description: profileDesc.trim(),
        host: editHost.trim(),
        port: Number(editPort),
        user: editUser.trim(),
        password: editAuthType === 'password' ? editPassword : '',
        key_path: editAuthType === 'key' ? editKeyPath.trim() : '',
      })
      setShowSaveModal(false)
      loadInitial()
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Failed to save connection profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleStartEditProfile = (profile: SSHProfile) => {
    setEditingProfile(profile)
    setProfileName(profile.name)
    setProfileDesc(profile.description || '')
    setEditHost(profile.host)
    setEditPort(profile.port)
    setEditUser(profile.user)
    setEditAuthType(profile.key_path ? 'key' : 'password')
    setEditPassword(profile.password || '')
    setEditKeyPath(profile.key_path || '')
    setModalError(null)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    if (!editingProfile || !profileName.trim() || !editHost.trim()) {
      setModalError('Profile name and host address are required.')
      return
    }

    setSavingProfile(true)
    try {
      await sshApi.saveProfile({
        id: editingProfile.id,
        name: profileName.trim(),
        description: profileDesc.trim(),
        host: editHost.trim(),
        port: Number(editPort),
        user: editUser.trim(),
        password: editAuthType === 'password' ? editPassword : '',
        key_path: editAuthType === 'key' ? editKeyPath.trim() : '',
        is_fixed: editingProfile.is_fixed,
      })
      setEditingProfile(null)
      setViewingProfile(null)
      loadInitial()
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Failed to update connection profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleDeleteProfile = async (profileId: string, profileName: string) => {
    if (confirm(`Are you sure you want to delete saved SSH profile "${profileName}"?`)) {
      try {
        await sshApi.deleteProfile(profileId)
        loadInitial()
        if (viewingProfile?.id === profileId) {
          setViewingProfile(null)
        }
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Failed to delete profile')
      }
    }
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await sshApi.disconnect()
      setStatus('DISCONNECTED')
      setTargetInfo(null)
      setTestResult({
        success: true,
        message: 'Disconnected from remote SSH lab. Switched to local mode.',
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card p-6 border border-terminal-border relative overflow-hidden font-mono space-y-6">
      {/* Background glow when connected */}
      {status === 'CONNECTED' && (
        <div className="absolute top-0 right-0 w-64 h-64 bg-terminal-green/5 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-terminal-border">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${status === 'CONNECTED' ? 'bg-terminal-green/10 border-terminal-green/30 text-terminal-green' : 'bg-terminal-surface border-terminal-border text-terminal-muted'}`}>
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-terminal-text">Connect Online RHEL Lab (SSH)</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${status === 'CONNECTED' ? 'bg-emerald-950 text-terminal-green border border-terminal-green/40' : 'bg-terminal-surface text-terminal-muted border border-terminal-border'}`}>
                <span className={`w-2 h-2 rounded-full ${status === 'CONNECTED' ? 'bg-terminal-green animate-pulse' : 'bg-terminal-muted'}`} />
                {status === 'CONNECTED' ? 'REMOTE SSH ACTIVE' : 'LOCAL / SIMULATION MODE'}
              </span>
            </div>
            <p className="text-xs text-terminal-muted mt-0.5">
              Connect your online RHEL 9 lab (EC2, Cloud, Red Hat Sandbox) to execute live AI administration commands.
            </p>
          </div>
        </div>

        <button
          onClick={loadInitial}
          disabled={loading}
          className="p-2 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text transition-colors"
          title="Refresh Status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Target Server Specifications Badge if verified */}
      {targetInfo && (
        <div className="p-4 rounded-xl bg-terminal-bg border border-terminal-green/30 font-mono text-xs text-terminal-text grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
          <div>
            <span className="text-terminal-muted block text-[10px]">REMOTE HOSTNAME</span>
            <span className="font-bold text-terminal-green">{targetInfo.hostname || host}</span>
          </div>
          <div>
            <span className="text-terminal-muted block text-[10px]">OPERATING SYSTEM</span>
            <span>{targetInfo.os_name || 'RHEL 9'}</span>
          </div>
          <div>
            <span className="text-terminal-muted block text-[10px]">KERNEL VERSION</span>
            <span>{targetInfo.kernel || 'Linux 5.14'}</span>
          </div>
          <div>
            <span className="text-terminal-muted block text-[10px]">SSH LATENCY</span>
            <span className="text-terminal-blue">{targetInfo.latency_ms ? `${targetInfo.latency_ms} ms` : '< 10ms'}</span>
          </div>
          <div className="flex justify-end col-span-2 md:col-span-1">
            <button
              onClick={handleOpenSaveModal}
              className="px-3 py-1.5 rounded-lg bg-terminal-green/20 text-terminal-green border border-terminal-green/40 hover:bg-terminal-green/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Save Active Host
            </button>
          </div>
        </div>
      )}

      {/* ─── SAVED & FIXED CONNECTIONS SECTION ─────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-terminal-muted uppercase tracking-wider flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-terminal-blue" />
            Saved & Fixed Host Connections ({savedProfiles.length})
          </h3>

          <button
            onClick={handleOpenSaveModal}
            className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-terminal-blue/20 text-terminal-blue hover:bg-terminal-blue/30 border border-terminal-blue/40 font-mono transition-colors font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            Save Current as Profile
          </button>
        </div>

        {loadingProfiles ? (
          <div className="flex items-center justify-center h-24 text-terminal-muted text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-terminal-blue" />
            <span>Loading saved host profiles...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {savedProfiles.map(p => {
              const isActive = status === 'CONNECTED' && host === p.host && Number(port) === p.port
              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-xl border transition-all space-y-2 flex flex-col justify-between ${
                    isActive
                      ? 'bg-emerald-950/30 border-terminal-green/50 shadow-lg'
                      : 'bg-terminal-surface/60 border-terminal-border hover:border-terminal-border/80'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-terminal-text text-xs truncate flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-terminal-blue shrink-0" />
                        {p.name}
                      </span>
                      <div className="flex items-center gap-1">
                        {p.is_fixed && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-terminal-border/60 text-terminal-muted mr-0.5">PRESET</span>
                        )}
                        <button
                          onClick={() => handleStartEditProfile(p)}
                          className="text-terminal-muted hover:text-terminal-blue p-1 rounded hover:bg-terminal-border/40"
                          title="Edit Connection Profile"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProfile(p.id, p.name)}
                          className="text-terminal-muted hover:text-red-400 p-1 rounded hover:bg-terminal-border/40"
                          title="Delete Connection Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {p.description && <p className="text-[11px] text-terminal-muted line-clamp-1">{p.description}</p>}
                    <div className="text-[11px] font-mono text-terminal-green truncate">
                      {p.user}@{p.host}:{p.port}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-terminal-border/40">
                    <button
                      onClick={() => setViewingProfile(p)}
                      className="text-[11px] text-terminal-muted hover:text-terminal-blue flex items-center gap-1"
                      title="View Full Profile Details"
                    >
                      <Eye className="w-3.5 h-3.5 text-terminal-blue" />
                      View
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTestConnection(p.host, p.port, p.user, p.password)}
                        disabled={testing}
                        className="text-[11px] text-terminal-muted hover:text-terminal-text flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-terminal-border/40"
                      >
                        <Wifi className="w-3 h-3 text-terminal-blue" />
                        Test
                      </button>

                      <button
                        onClick={() => handleConnectProfile(p)}
                        disabled={loading || connectingProfileId === p.id}
                        className={`px-2.5 py-1 text-[11px] rounded font-mono font-bold flex items-center gap-1 transition-colors ${
                          isActive
                            ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/40'
                            : 'bg-terminal-blue text-black hover:bg-terminal-blue/90'
                        }`}
                      >
                        {connectingProfileId === p.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isActive ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <ArrowRight className="w-3 h-3" />
                        )}
                        <span>{isActive ? 'ACTIVE' : 'Connect'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Manual Connection Form */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold text-terminal-muted uppercase tracking-wider">
          Host Credentials & Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-mono text-terminal-muted mb-1">RHEL LAB HOST / IP ADDRESS *</label>
            <input
              type="text"
              value={host}
              onChange={e => setHost(e.target.value)}
              placeholder="e.g. 192.168.1.100 or ec2-xx-xx-xx-xx.compute-1.amazonaws.com"
              className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-sm font-mono text-terminal-text focus:outline-none focus:border-terminal-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-terminal-muted mb-1">SSH PORT</label>
            <input
              type="number"
              value={port}
              onChange={e => setPort(Number(e.target.value))}
              className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-sm font-mono text-terminal-text focus:outline-none focus:border-terminal-blue"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-terminal-muted mb-1">SSH USERNAME</label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="root or student or ec2-user"
              className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-sm font-mono text-terminal-text focus:outline-none focus:border-terminal-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-terminal-muted mb-1">AUTHENTICATION METHOD</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthType('key')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 border ${authType === 'key' ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue' : 'bg-terminal-bg border-terminal-border text-terminal-muted'}`}
              >
                <Key className="w-3.5 h-3.5" /> SSH Key File
              </button>
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 border ${authType === 'password' ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue' : 'bg-terminal-bg border-terminal-border text-terminal-muted'}`}
              >
                <Lock className="w-3.5 h-3.5" /> Password
              </button>
            </div>
          </div>
        </div>

        {authType === 'key' ? (
          <div>
            <label className="block text-xs font-mono text-terminal-muted mb-1">PRIVATE KEY PATH (OPTIONAL)</label>
            <input
              type="text"
              value={keyPath}
              onChange={e => setKeyPath(e.target.value)}
              placeholder="e.g. C:/Users/name/.ssh/id_rsa or /home/user/.ssh/rhel_key.pem"
              className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-sm font-mono text-terminal-text focus:outline-none focus:border-terminal-blue placeholder:text-terminal-muted/40"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-mono text-terminal-muted mb-1">SSH PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2 text-sm font-mono text-terminal-text focus:outline-none focus:border-terminal-blue"
            />
          </div>
        )}

        {/* Test Connection Results Alert Box */}
        {testResult && (
          <div className={`p-4 rounded-xl border text-xs font-mono space-y-1.5 animate-fade-in ${testResult.success ? 'bg-emerald-950/40 border-terminal-green/40 text-terminal-green' : 'bg-red-950/40 border-red-800/40 text-red-300'}`}>
            <div className="flex items-center gap-2 font-bold">
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-terminal-green" /> : <XCircle className="w-4 h-4 shrink-0 text-red-400" />}
              <span>{testResult.message}</span>
            </div>
            {testResult.suggestion && (
              <p className="text-terminal-muted pl-6">{testResult.suggestion}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleTestConnection()}
            disabled={testing || !host}
            className="btn-secondary px-4 py-2 text-xs flex items-center gap-2"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-terminal-blue" />}
            {testing ? 'Testing SSH Connection...' : 'Test Connection'}
          </button>

          <button
            type="button"
            onClick={handleSaveAndConnect}
            disabled={loading || !host}
            className="btn-primary px-5 py-2 text-xs flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
            Save & Enable Remote SSH
          </button>

          {status === 'CONNECTED' && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={loading}
              className="px-4 py-2 text-xs font-mono rounded-lg border border-red-800/50 bg-red-950/30 text-red-400 hover:bg-red-900/40 transition-colors ml-auto"
            >
              Disconnect (Use Local Mode)
            </button>
          )}
        </div>
      </div>

      {/* Save Profile Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-terminal-bg border border-terminal-border rounded-xl p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-terminal-border pb-3">
              <h3 className="text-sm font-bold text-terminal-text flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-terminal-blue" />
                Save SSH Connection Profile
              </h3>
              <button onClick={() => setShowSaveModal(false)} className="text-terminal-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProfile} className="space-y-3 text-xs">
              <div>
                <label className="block text-terminal-muted mb-1">PROFILE NAME *</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="e.g. AWS EC2 Production or RHEL Lab"
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                />
              </div>

              <div>
                <label className="block text-terminal-muted mb-1">DESCRIPTION (OPTIONAL)</label>
                <input
                  type="text"
                  value={profileDesc}
                  onChange={e => setProfileDesc(e.target.value)}
                  placeholder="e.g. Primary web server node"
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-terminal-muted mb-1">HOST / IP ADDRESS *</label>
                  <input
                    type="text"
                    required
                    value={editHost}
                    onChange={e => setEditHost(e.target.value)}
                    placeholder="e.g. 192.168.1.10"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
                <div>
                  <label className="block text-terminal-muted mb-1">PORT</label>
                  <input
                    type="number"
                    value={editPort}
                    onChange={e => setEditPort(Number(e.target.value))}
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-terminal-muted mb-1">USERNAME</label>
                  <input
                    type="text"
                    value={editUser}
                    onChange={e => setEditUser(e.target.value)}
                    placeholder="root or student"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
                <div>
                  <label className="block text-terminal-muted mb-1">AUTH METHOD</label>
                  <select
                    value={editAuthType}
                    onChange={e => setEditAuthType(e.target.value as any)}
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  >
                    <option value="password">Password</option>
                    <option value="key">SSH Key File</option>
                  </select>
                </div>
              </div>

              {editAuthType === 'password' ? (
                <div>
                  <label className="block text-terminal-muted mb-1">SSH PASSWORD</label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-terminal-muted mb-1">PRIVATE KEY PATH</label>
                  <input
                    type="text"
                    value={editKeyPath}
                    onChange={e => setEditKeyPath(e.target.value)}
                    placeholder="e.g. /home/user/.ssh/id_rsa"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-lg bg-terminal-blue text-black font-bold hover:bg-terminal-blue/90 transition-colors flex items-center gap-2"
                >
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save Connection Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="w-full max-w-md bg-terminal-bg border border-terminal-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-terminal-border pb-3">
              <h3 className="text-sm font-bold text-terminal-text flex items-center gap-2">
                <Pencil className="w-4 h-4 text-terminal-blue" />
                Edit Connection Profile ({editingProfile.name})
              </h3>
              <button onClick={() => setEditingProfile(null)} className="text-terminal-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-3 text-xs">
              <div>
                <label className="block text-terminal-muted mb-1">PROFILE NAME *</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                />
              </div>

              <div>
                <label className="block text-terminal-muted mb-1">DESCRIPTION</label>
                <input
                  type="text"
                  value={profileDesc}
                  onChange={e => setProfileDesc(e.target.value)}
                  className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-terminal-muted mb-1">HOST / IP ADDRESS *</label>
                  <input
                    type="text"
                    required
                    value={editHost}
                    onChange={e => setEditHost(e.target.value)}
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
                <div>
                  <label className="block text-terminal-muted mb-1">PORT</label>
                  <input
                    type="number"
                    value={editPort}
                    onChange={e => setEditPort(Number(e.target.value))}
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-terminal-muted mb-1">USERNAME</label>
                  <input
                    type="text"
                    value={editUser}
                    onChange={e => setEditUser(e.target.value)}
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
                <div>
                  <label className="block text-terminal-muted mb-1">AUTH METHOD</label>
                  <select
                    value={editAuthType}
                    onChange={e => setEditAuthType(e.target.value as any)}
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  >
                    <option value="password">Password</option>
                    <option value="key">SSH Key File</option>
                  </select>
                </div>
              </div>

              {editAuthType === 'password' ? (
                <div>
                  <label className="block text-terminal-muted mb-1">SSH PASSWORD</label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-terminal-muted mb-1">PRIVATE KEY PATH</label>
                  <input
                    type="text"
                    value={editKeyPath}
                    onChange={e => setEditKeyPath(e.target.value)}
                    placeholder="e.g. /home/user/.ssh/id_rsa"
                    className="w-full bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-terminal-text focus:outline-none focus:border-terminal-blue"
                  />
                </div>
              )}

              <div className="pt-3 flex justify-end gap-3 border-t border-terminal-border">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-lg bg-terminal-blue text-black font-bold hover:bg-terminal-blue/90 transition-colors flex items-center gap-2"
                >
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Update Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Saved Connection Details Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="w-full max-w-lg bg-terminal-bg border border-terminal-border rounded-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-terminal-border pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-terminal-blue" />
                <h3 className="text-sm font-bold text-terminal-text">{viewingProfile.name}</h3>
              </div>
              <button onClick={() => setViewingProfile(null)} className="text-terminal-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-terminal-surface/60 border border-terminal-border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-terminal-muted text-[10px] uppercase">PROFILE TYPE</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${viewingProfile.is_fixed ? 'bg-terminal-blue/20 text-terminal-blue' : 'bg-terminal-green/20 text-terminal-green'}`}>
                    {viewingProfile.is_fixed ? 'BUILT-IN FIXED PRESET' : 'USER SAVED PROFILE'}
                  </span>
                </div>

                {viewingProfile.description && (
                  <div>
                    <span className="text-terminal-muted text-[10px] block uppercase">DESCRIPTION</span>
                    <span className="text-terminal-text">{viewingProfile.description}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-terminal-border/40">
                  <div>
                    <span className="text-terminal-muted text-[10px] block uppercase">TARGET HOST / IP</span>
                    <span className="font-bold text-terminal-green">{viewingProfile.host}</span>
                  </div>
                  <div>
                    <span className="text-terminal-muted text-[10px] block uppercase">SSH PORT</span>
                    <span className="font-bold text-terminal-blue">{viewingProfile.port}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-terminal-border/40">
                  <div>
                    <span className="text-terminal-muted text-[10px] block uppercase">USERNAME</span>
                    <span className="font-bold text-terminal-text">{viewingProfile.user}</span>
                  </div>
                  <div>
                    <span className="text-terminal-muted text-[10px] block uppercase">AUTHENTICATION</span>
                    <span className="text-terminal-text">
                      {viewingProfile.key_path ? 'SSH Key File' : 'Password Auth'}
                    </span>
                  </div>
                </div>

                {viewingProfile.key_path && (
                  <div className="pt-1 border-t border-terminal-border/40">
                    <span className="text-terminal-muted text-[10px] block uppercase">KEY PATH</span>
                    <code className="text-terminal-blue">{viewingProfile.key_path}</code>
                  </div>
                )}
              </div>

              {/* SSH Terminal Command snippet */}
              <div className="space-y-1">
                <span className="text-[10px] text-terminal-muted uppercase">Terminal SSH Command</span>
                <div className="flex items-center justify-between bg-terminal-bg border border-terminal-border rounded-lg p-2.5 font-mono text-xs text-terminal-green">
                  <code>{`ssh -p ${viewingProfile.port} ${viewingProfile.user}@${viewingProfile.host}`}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`ssh -p ${viewingProfile.port} ${viewingProfile.user}@${viewingProfile.host}`)
                      setCopiedSshCmd(true)
                      setTimeout(() => setCopiedSshCmd(false), 2000)
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] bg-terminal-border/40 hover:bg-terminal-border text-terminal-text rounded transition-colors"
                  >
                    {copiedSshCmd ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5 text-terminal-blue" />}
                    <span>{copiedSshCmd ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-terminal-border flex items-center justify-between font-mono">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestConnection(viewingProfile.host, viewingProfile.port, viewingProfile.user, viewingProfile.password)}
                  disabled={testing}
                  className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-terminal-blue" />}
                  <span>Test</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartEditProfile(viewingProfile)}
                  className="px-3 py-1.5 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-blue hover:bg-terminal-blue/20 text-xs flex items-center gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteProfile(viewingProfile.id, viewingProfile.name)}
                  className="px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 hover:bg-red-900/40 text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingProfile(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleConnectProfile(viewingProfile)}
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-terminal-blue text-black font-bold hover:bg-terminal-blue/90 text-xs flex items-center gap-1.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Connect Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
