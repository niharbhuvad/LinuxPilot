// LinuxAI — System Users & Groups Page
import React, { useState, useEffect } from 'react'
import {
  Users as UsersIcon, UserCheck, Shield, Users, Terminal, RefreshCw,
  Search, Key, HardDrive, Filter, CheckCircle2, User, AlertCircle
} from 'lucide-react'
import { usersApi } from '../services/api'
import MetricCard from '../components/MetricCard'

interface SystemUser {
  username: string
  uid: number
  gid: string
  home: string
  shell: string
  is_system: boolean
}

interface SystemGroup {
  name: string
  gid: string
  members: string[]
}

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<'human' | 'system' | 'groups' | 'sessions' | 'sudo'>('human')
  const [users, setUsers] = useState<SystemUser[]>([])
  const [groups, setGroups] = useState<SystemGroup[]>([])
  const [loggedInOutput, setLoggedInOutput] = useState('')
  const [sudoOutput, setSudoOutput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, groupsRes, loggedInRes, sudoRes] = await Promise.all([
        usersApi.list(),
        usersApi.groups(),
        usersApi.loggedIn(),
        usersApi.sudo(),
      ])

      setUsers(usersRes.data.users || [])
      setGroups(groupsRes.data.groups || [])
      setLoggedInOutput(loggedInRes.data.output || 'No active sessions.')
      setSudoOutput(sudoRes.data.output || 'Cannot read sudoers.')
    } catch (err) {
      console.error('Failed to fetch user data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const humanUsers = users.filter(u => !u.is_system && u.uid >= 1000)
  const systemAccounts = users.filter(u => u.is_system || u.uid < 1000)

  const filteredUsers = (activeTab === 'human' ? humanUsers : activeTab === 'system' ? systemAccounts : users).filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.shell.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.uid.toString().includes(searchQuery)
  )

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.members.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="p-6 h-full flex flex-col space-y-5 overflow-hidden animate-fade-in font-mono">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-5 border border-terminal-border rounded-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-terminal-blue/10 border border-terminal-blue/30 text-terminal-blue">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-terminal-text flex items-center gap-2">
              System Users & Accounts
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-terminal-blue/20 text-terminal-blue border border-terminal-blue/30 font-semibold">
                {users.length} Registered
              </span>
            </h1>
            <p className="text-xs text-terminal-muted mt-0.5">
              Inspect user identities, GIDs, login shells, active SSH/TTY sessions, and group memberships.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg bg-terminal-surface hover:bg-terminal-border border border-terminal-border text-terminal-text transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Users
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <MetricCard
          title="Human Users"
          value={humanUsers.length}
          subtitle="UID >= 1000 accounts"
          icon={<UserCheck className="w-4 h-4 text-terminal-green" />}
          status="ok"
        />
        <MetricCard
          title="System Accounts"
          value={systemAccounts.length}
          subtitle="Services & daemon IDs"
          icon={<Shield className="w-4 h-4 text-terminal-blue" />}
          status="ok"
        />
        <MetricCard
          title="System Groups"
          value={groups.length}
          subtitle="Security & ACL groups"
          icon={<Users className="w-4 h-4 text-purple-400" />}
          status="ok"
        />
        <MetricCard
          title="Active Sessions"
          value={loggedInOutput.trim().split('\n').filter(Boolean).length}
          subtitle="Logged-in TTY/SSH"
          icon={<Terminal className="w-4 h-4 text-amber-400" />}
          status="ok"
        />
      </div>

      {/* Control Toolbar & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 bg-terminal-surface p-1 rounded-xl border border-terminal-border text-xs">
          {[
            { id: 'human', label: `Human Users (${humanUsers.length})` },
            { id: 'system', label: `System Accounts (${systemAccounts.length})` },
            { id: 'groups', label: `Groups (${groups.length})` },
            { id: 'sessions', label: 'Active Sessions' },
            { id: 'sudo', label: 'Sudo Config' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                activeTab === tab.id
                  ? 'bg-terminal-blue text-black font-bold shadow'
                  : 'text-terminal-muted hover:text-terminal-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(activeTab === 'human' || activeTab === 'system' || activeTab === 'groups') && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-terminal-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search user, UID, shell, group..."
              className="w-full bg-terminal-surface border border-terminal-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-blue"
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 glass-card border border-terminal-border rounded-xl p-4 overflow-y-auto bg-black/40">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-terminal-muted gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-terminal-blue" />
            <span>Scanning system user database...</span>
          </div>
        ) : activeTab === 'human' || activeTab === 'system' ? (
          filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-terminal-muted text-xs">
              No matching accounts found for "{searchQuery}".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-terminal-border text-terminal-muted text-[11px] uppercase tracking-wider bg-terminal-surface/50">
                    <th className="p-3">User</th>
                    <th className="p-3">UID</th>
                    <th className="p-3">GID</th>
                    <th className="p-3">Home Directory</th>
                    <th className="p-3">Login Shell</th>
                    <th className="p-3 text-right">Account Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-border/50">
                  {filteredUsers.map(u => (
                    <tr key={u.username} className="hover:bg-terminal-surface/40 transition-colors">
                      <td className="p-3 flex items-center gap-2.5 font-bold text-terminal-text">
                        <div className="w-6 h-6 rounded-full bg-terminal-blue/20 flex items-center justify-center text-terminal-blue text-[10px]">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <span>{u.username}</span>
                      </td>
                      <td className="p-3 text-terminal-blue">{u.uid}</td>
                      <td className="p-3 text-terminal-muted">{u.gid}</td>
                      <td className="p-3 text-terminal-muted font-mono">{u.home}</td>
                      <td className="p-3 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${u.shell.includes('nologin') ? 'text-terminal-muted bg-terminal-border/30' : 'text-terminal-green bg-terminal-green/10 border border-terminal-green/30'}`}>
                          {u.shell}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${u.uid >= 1000 ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/40' : u.uid === 0 ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-terminal-blue/20 text-terminal-blue border border-terminal-blue/40'}`}>
                          {u.uid === 0 ? 'SUPERUSER (ROOT)' : u.uid >= 1000 ? 'HUMAN USER' : 'SYSTEM DAEMON'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'groups' ? (
          filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-terminal-muted text-xs">
              No matching groups found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredGroups.map(g => (
                <div key={g.name} className="p-3.5 rounded-lg bg-terminal-surface/60 border border-terminal-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-terminal-text text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      {g.name}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-terminal-border/50 text-terminal-muted font-mono">
                      GID {g.gid}
                    </span>
                  </div>
                  <div className="text-xs text-terminal-muted">
                    <span className="text-[10px] block uppercase text-terminal-muted/60 mb-1">MEMBERS ({g.members.length}):</span>
                    {g.members.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {g.members.map(m => (
                          <span key={m} className="px-1.5 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 text-[10px]">
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="italic text-terminal-muted/40">No additional members</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'sessions' ? (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-terminal-muted uppercase tracking-wider">Active Logged-In TTY / SSH Sessions (`who`)</h3>
            <pre className="p-4 rounded-lg bg-terminal-bg border border-terminal-border text-xs text-terminal-green whitespace-pre-wrap leading-relaxed">
              {loggedInOutput || 'No active sessions logged.'}
            </pre>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-terminal-muted uppercase tracking-wider">Sudoers Policy Configuration Summary</h3>
            <pre className="p-4 rounded-lg bg-terminal-bg border border-terminal-border text-xs text-terminal-text whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {sudoOutput || 'No sudoers config loaded.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
