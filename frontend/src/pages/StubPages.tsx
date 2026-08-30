// LinuxAI — Stub pages for Monitor, Users, Packages, Settings
import { systemApi } from '../services/api'
import { useEffect, useState, useRef } from 'react'
import MetricCard from '../components/MetricCard'
import { Cpu, MemoryStick, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Monitor Page
export function MonitorPage() {
  const [history, setHistory] = useState<any[]>([])
  const isFetchingRef = useRef<boolean>(false)

  useEffect(() => {
    const tick = async () => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true

      try {
        const [cpu, mem] = await Promise.all([systemApi.cpu(), systemApi.memory()])
        setHistory(prev => [...prev.slice(-30), {
          time: new Date().toLocaleTimeString(),
          cpu: cpu.data.percent,
          mem: mem.data.percent,
        }])
      } catch {
        // Silently catch errors if backend is reloading
      } finally {
        isFetchingRef.current = false
      }
    }
    tick()
    const t = setInterval(tick, 5000)
    return () => clearInterval(t)
  }, [])

  const latest = history[history.length - 1]

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto animate-fade-in">
      <h1 className="text-2xl font-bold">System Monitor</h1>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard title="CPU" value={latest?.cpu?.toFixed(1) ?? '—'} unit="%" percent={latest?.cpu} icon={<Cpu className="w-4 h-4" />} />
        <MetricCard title="Memory" value={latest?.mem?.toFixed(1) ?? '—'} unit="%" percent={latest?.mem} icon={<MemoryStick className="w-4 h-4" />} />
        <MetricCard title="Samples" value={history.length} icon={<Activity className="w-4 h-4" />} status="ok" subtitle="Last 30 readings" />
      </div>
      {history.length > 2 && (
        <div className="glass-card p-5">
          <h3 className="text-xs text-terminal-muted uppercase tracking-wider mb-4">CPU & Memory (last 30 samples)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4d9fff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4d9fff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="mem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff9f" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00ff9f" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: '#8b949e', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#8b949e', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="cpu" stroke="#4d9fff" fill="url(#cpu)" name="CPU%" strokeWidth={2} />
              <Area type="monotone" dataKey="mem" stroke="#00ff9f" fill="url(#mem)" name="MEM%" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// Stub pages
export const Stub = ({ title }: { title: string }) => (
  <div className="p-6 animate-fade-in">
    <h1 className="text-2xl font-bold mb-2">{title}</h1>
    <p className="text-terminal-muted text-sm">Use the <a href="/chat" className="text-terminal-blue hover:underline">AI Assistant</a> to explore {title.toLowerCase()} or this page will populate with live data once deployed on RHEL 9.</p>
  </div>
)


