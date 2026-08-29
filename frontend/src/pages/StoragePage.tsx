// LinuxAI — Storage Page
import { useEffect, useState } from 'react'
import { storageApi } from '../services/api'
import { HardDrive, RefreshCw } from 'lucide-react'

export default function StoragePage() {
  const [data, setData] = useState<any>(null)
  const [large, setLarge] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const [stRes, lfRes] = await Promise.allSettled([storageApi.overview(), storageApi.largeFiles('/', 500)])
    if (stRes.status === 'fulfilled') setData(stRes.value.data)
    if (lfRes.status === 'fulfilled') setLarge(lfRes.value.data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Storage</h1>
        <button onClick={fetch} className="btn-ghost"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : (
        <>
          {/* Block Devices */}
          {data?.block_devices?.output && (
            <div className="glass-card p-5">
              <h3 className="text-xs text-terminal-muted uppercase tracking-wider mb-3">
                <HardDrive className="w-3.5 h-3.5 inline mr-1" /> Block Devices (lsblk)
              </h3>
              <pre className="text-xs font-mono text-terminal-text bg-terminal-bg rounded-lg p-3 overflow-x-auto">
                {data.block_devices.output}
              </pre>
            </div>
          )}

          {/* LVM */}
          {data?.lvm && (
            <div className="glass-card p-5">
              <h3 className="text-xs text-terminal-muted uppercase tracking-wider mb-3">LVM Volumes</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Physical Volumes', 'Volume Groups', 'Logical Volumes'].map((title, i) => {
                  const content = [data.lvm.physical_volumes, data.lvm.volume_groups, data.lvm.logical_volumes][i]
                  return content ? (
                    <div key={title} className="bg-terminal-bg border border-terminal-border rounded-lg p-3">
                      <p className="text-xs text-terminal-muted mb-2">{title}</p>
                      <pre className="text-xs font-mono text-terminal-text whitespace-pre-wrap">{content}</pre>
                    </div>
                  ) : null
                })}
                {!data.lvm.lvm_available && (
                  <div className="col-span-3 text-center text-terminal-muted text-sm py-4">LVM not available on this system</div>
                )}
              </div>
            </div>
          )}

          {/* Large Files */}
          {large?.files?.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-xs text-terminal-muted uppercase tracking-wider mb-3">
                Large Files (&gt;500MB)
              </h3>
              <div className="space-y-1.5">
                {large.files.map((f: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-xs px-3 py-2 bg-terminal-bg rounded-lg border border-terminal-border">
                    <span className="font-mono text-terminal-text truncate max-w-sm">{f.path}</span>
                    <span className={`font-mono font-bold ml-4 shrink-0 ${f.size_mb > 5000 ? 'text-terminal-red' : f.size_mb > 1000 ? 'text-terminal-yellow' : 'text-terminal-muted'}`}>
                      {f.size_mb >= 1024 ? `${(f.size_mb/1024).toFixed(1)} GB` : `${f.size_mb} MB`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
