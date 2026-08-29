// LinuxAI — Network Page
import { useEffect, useState } from 'react'
import { networkApi } from '../services/api'
import { RefreshCw, Wifi, Globe, Shield } from 'lucide-react'

export default function NetworkPage() {
  const [data, setData] = useState<any>(null)
  const [firewall, setFirewall] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const [netRes, fwRes] = await Promise.allSettled([networkApi.overview(), networkApi.firewall()])
    if (netRes.status === 'fulfilled') setData(netRes.value.data)
    if (fwRes.status === 'fulfilled') setFirewall(fwRes.value.data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const ifaces = data?.interfaces || []

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Network</h1>
        <button onClick={fetch} className="btn-ghost"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : (
        <>
          {/* Interfaces */}
          <div className="glass-card p-5">
            <h3 className="text-xs text-terminal-muted uppercase tracking-wider mb-4">
              <Wifi className="w-3.5 h-3.5 inline mr-1" /> Network Interfaces
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ifaces.map((iface: any) => (
                <div key={iface.name} className="bg-terminal-bg border border-terminal-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-bold text-terminal-text">{iface.name}</span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${iface.is_up ? 'text-terminal-green bg-green-900/30' : 'text-terminal-red bg-red-900/30'}`}>
                      {iface.is_up ? 'UP' : 'DOWN'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {iface.addresses?.map((addr: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-terminal-muted w-10">{addr.type}</span>
                        <span className="font-mono text-terminal-text">{addr.address}</span>
                        {addr.netmask && <span className="text-terminal-muted">/{addr.netmask}</span>}
                      </div>
                    ))}
                    {iface.speed_mbps > 0 && (
                      <div className="text-xs text-terminal-muted">{iface.speed_mbps} Mbps · MTU {iface.mtu}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Ports */}
          {data?.ports?.raw_ss && (
            <div className="glass-card p-5">
              <h3 className="text-xs text-terminal-muted uppercase tracking-wider mb-3">
                <Globe className="w-3.5 h-3.5 inline mr-1" /> Open Ports (ss -tulpn)
              </h3>
              <pre className="text-xs font-mono text-terminal-text bg-terminal-bg rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {data.ports.raw_ss}
              </pre>
            </div>
          )}

          {/* Firewall */}
          {firewall && (
            <div className="glass-card p-5">
              <h3 className="text-xs text-terminal-muted uppercase tracking-wider mb-3">
                <Shield className="w-3.5 h-3.5 inline mr-1" /> Firewall Status (firewalld)
              </h3>
              <pre className="text-xs font-mono text-terminal-text bg-terminal-bg rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64">
                {firewall.firewall_rules || 'Firewall not available or not running'}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}
