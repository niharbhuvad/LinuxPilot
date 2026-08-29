import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, Cpu, Activity,
  Server, HardDrive, Network, Users, Package,
  FileText, Calendar, History, Bell, LogOut,
  Terminal, Radio, Sliders, Mic, ShieldCheck
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { sshApi } from '../services/api'
import clsx from 'clsx'

const navItems = [
  { icon: Mic, label: 'AI Assitant', path: '/' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Terminal, label: 'Terminal Console', path: '/terminal' },

  { icon: Cpu, label: 'System Monitor', path: '/monitor' },
  { icon: Activity, label: 'Processes', path: '/processes' },
  { icon: Server, label: 'Services', path: '/services' },
  { icon: HardDrive, label: 'Storage', path: '/storage' },
  { icon: Network, label: 'Network', path: '/network' },
  { icon: Users, label: 'Users', path: '/users' },
  { icon: Package, label: 'Packages', path: '/packages' },
  { icon: FileText, label: 'Logs', path: '/logs' },
  { icon: Calendar, label: 'Tasks', path: '/tasks' },
  { icon: History, label: 'History', path: '/history' },
  { icon: Bell, label: 'Alerts', path: '/alerts' },
  { icon: Radio, label: 'Host Connection', path: '/connection' },
  { icon: Sliders, label: 'Settings', path: '/settings' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isConnected, setIsConnected] = useState<boolean>(true)
  const [hostLabel, setHostLabel] = useState<string>('mahesh@192.168.232.129')

  const checkSshStatus = async () => {
    try {
      const res = await sshApi.getConfig()
      if (res.data) {
        const active = res.data.status === 'CONNECTED' || res.data.enabled !== false
        setIsConnected(active)
        const host = res.data.host || '192.168.232.129'
        const sshUser = res.data.user || 'mahesh'
        setHostLabel(`${sshUser}@${host}`)
      } else {
        setIsConnected(true)
      }
    } catch {
      setIsConnected(true)
    }
  }

  useEffect(() => {
    checkSshStatus()
    const interval = setInterval(checkSshStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-56 shrink-0 h-screen flex flex-col bg-terminal-surface border-r border-terminal-border select-none">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-terminal-green" />
          <span className="font-mono font-bold text-terminal-green tracking-tight">LinuxAI</span>
          <span className="ml-auto text-[10px] text-terminal-muted font-mono bg-terminal-border px-1.5 py-0.5 rounded">
            v1.0
          </span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-terminal-muted font-mono">AI Admin</p>
          <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-terminal-green bg-terminal-green/10 border border-terminal-green/30 px-1.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
            AI ONLINE
          </span>
        </div>

        {/* Dynamic Remote Host Connection Status Badge */}
        <NavLink
          to="/connection"
          className={clsx(
            'mt-3 flex items-center justify-between px-2.5 py-1.5 rounded-md border transition-all group',
            isConnected
              ? 'bg-terminal-green/10 border-terminal-green/40 hover:border-terminal-green shadow-sm shadow-terminal-green/10'
              : 'bg-red-950/20 border-red-800/40 hover:border-red-600'
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={clsx(
                'w-2 h-2 rounded-full shrink-0 animate-pulse',
                isConnected ? 'bg-terminal-green' : 'bg-red-500'
              )}
            />
            <span
              className={clsx(
                'text-[10px] font-mono truncate font-semibold',
                isConnected ? 'text-terminal-green' : 'text-red-400'
              )}
            >
              {isConnected ? hostLabel : 'Disconnected'}
            </span>
          </div>
          <span
            className={clsx(
              'text-[9px] font-mono shrink-0 font-bold',
              isConnected ? 'text-terminal-green' : 'text-red-400'
            )}
          >
            {isConnected ? 'SSH →' : 'OFFLINE →'}
          </span>
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              clsx('sidebar-item', isActive && 'active')
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-terminal-border">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-terminal-border/30 mb-2">
          <div className="w-7 h-7 rounded-full bg-terminal-blue/20 flex items-center justify-center">
            <span className="text-terminal-blue text-xs font-bold">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-terminal-text truncate">{user?.username}</p>
            <p className="text-[10px] text-terminal-muted">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-terminal-red hover:text-terminal-red hover:bg-red-900/20"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
