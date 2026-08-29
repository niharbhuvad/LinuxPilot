// LinuxAI — Package Manager & RPM/DNF Suite Page
import React, { useState, useEffect } from 'react'
import {
  Package as PackageIcon, Search, RefreshCw, Download, CheckCircle2,
  AlertTriangle, Box, Info, X, ShieldCheck, Terminal
} from 'lucide-react'
import { packagesApi } from '../services/api'
import MetricCard from '../components/MetricCard'

interface RPMPackage {
  name: string
  version: string
  arch: string
}

export default function PackagesPage() {
  const [activeTab, setActiveTab] = useState<'installed' | 'search' | 'updates'>('installed')
  const [installedPackages, setInstalledPackages] = useState<RPMPackage[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<string>('')
  const [updatesOutput, setUpdatesOutput] = useState<string>('')
  const [hasUpdates, setHasUpdates] = useState<boolean>(false)

  const [loadingInstalled, setLoadingInstalled] = useState(true)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingUpdates, setLoadingUpdates] = useState(false)

  const [selectedPkgInfo, setSelectedPkgInfo] = useState<{ pkg: string; info: string } | null>(null)

  const loadInstalled = async () => {
    setLoadingInstalled(true)
    try {
      const res = await packagesApi.installed()
      setInstalledPackages(res.data.packages || [])
    } catch (err) {
      console.error('Failed to load installed packages', err)
    } finally {
      setLoadingInstalled(false)
    }
  }

  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch || searchQuery).trim()
    if (!q) return
    setLoadingSearch(true)
    setSearchResults('')
    try {
      const res = await packagesApi.search(q)
      setSearchResults(res.data.output || 'No results found.')
    } catch (err: any) {
      setSearchResults(err.response?.data?.detail || err.message || 'Search failed.')
    } finally {
      setLoadingSearch(false)
    }
  }

  const checkUpdates = async () => {
    setLoadingUpdates(true)
    try {
      const res = await packagesApi.updates()
      setUpdatesOutput(res.data.output || 'All system packages are up to date.')
      setHasUpdates(res.data.updates_available || false)
    } catch (err: any) {
      setUpdatesOutput(err.response?.data?.detail || err.message || 'Failed to check updates.')
    } finally {
      setLoadingUpdates(false)
    }
  }

  const inspectPackage = async (packageName: string) => {
    try {
      const res = await packagesApi.info(packageName)
      setSelectedPkgInfo({ pkg: packageName, info: res.data.output || 'No inspection output.' })
    } catch (err: any) {
      setSelectedPkgInfo({ pkg: packageName, info: 'Failed to retrieve package information.' })
    }
  }

  useEffect(() => {
    loadInstalled()
  }, [])

  const filteredInstalled = installedPackages.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.arch.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 h-full flex flex-col space-y-5 overflow-hidden animate-fade-in font-mono relative">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-5 border border-terminal-border rounded-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-terminal-blue/10 border border-terminal-blue/30 text-terminal-blue">
            <PackageIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-terminal-text flex items-center gap-2">
              RPM & DNF Package Manager
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-terminal-blue/20 text-terminal-blue border border-terminal-blue/30 font-semibold">
                RHEL 9 / DNF
              </span>
            </h1>
            <p className="text-xs text-terminal-muted mt-0.5">
              Inspect installed system RPM packages, search DNF repositories, check available security updates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={checkUpdates}
            disabled={loadingUpdates}
            className="flex items-center gap-2 px-3.5 py-2 text-xs rounded-lg bg-terminal-green/20 hover:bg-terminal-green/30 text-terminal-green border border-terminal-green/40 transition-colors"
          >
            <Download className={`w-3.5 h-3.5 ${loadingUpdates ? 'animate-spin' : ''}`} />
            Check Updates
          </button>

          <button
            onClick={loadInstalled}
            disabled={loadingInstalled}
            className="flex items-center gap-2 px-3.5 py-2 text-xs rounded-lg bg-terminal-surface hover:bg-terminal-border border border-terminal-border text-terminal-text transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInstalled ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        <MetricCard
          title="Installed RPM Packages"
          value={installedPackages.length}
          subtitle="System software packages"
          icon={<Box className="w-4 h-4 text-terminal-green" />}
          status="ok"
        />
        <MetricCard
          title="Update Status"
          value={hasUpdates ? 'Updates Available' : 'System Up to Date'}
          subtitle={hasUpdates ? 'Package security patches ready' : 'All packages at latest'}
          icon={<ShieldCheck className="w-4 h-4 text-terminal-blue" />}
          status={hasUpdates ? 'warning' : 'ok'}
        />
        <MetricCard
          title="Package Architecture"
          value="x86_64 / noarch"
          subtitle="RHEL 9 BaseOS / AppStream"
          icon={<Terminal className="w-4 h-4 text-purple-400" />}
          status="ok"
        />
      </div>

      {/* Control Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 bg-terminal-surface p-1 rounded-xl border border-terminal-border text-xs">
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
              activeTab === 'installed'
                ? 'bg-terminal-blue text-black font-bold shadow'
                : 'text-terminal-muted hover:text-terminal-text'
            }`}
          >
            Installed Packages ({installedPackages.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
              activeTab === 'search'
                ? 'bg-terminal-blue text-black font-bold shadow'
                : 'text-terminal-muted hover:text-terminal-text'
            }`}
          >
            Repository Search
          </button>
          <button
            onClick={() => {
              setActiveTab('updates')
              if (!updatesOutput) checkUpdates()
            }}
            className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
              activeTab === 'updates'
                ? 'bg-terminal-blue text-black font-bold shadow'
                : 'text-terminal-muted hover:text-terminal-text'
            }`}
          >
            Updates Check
          </button>
        </div>

        {activeTab === 'installed' && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-terminal-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter installed packages..."
              className="w-full bg-terminal-surface border border-terminal-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-blue"
            />
          </div>
        )}
      </div>

      {/* Main Viewport */}
      <div className="flex-1 glass-card border border-terminal-border rounded-xl p-4 overflow-y-auto bg-black/40">
        {activeTab === 'installed' ? (
          loadingInstalled ? (
            <div className="flex items-center justify-center h-48 text-terminal-muted gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-terminal-blue" />
              <span>Querying RPM database...</span>
            </div>
          ) : filteredInstalled.length === 0 ? (
            <div className="text-center py-12 text-terminal-muted text-xs">
              No installed packages match "{searchQuery}".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-terminal-border text-terminal-muted text-[11px] uppercase tracking-wider bg-terminal-surface/50">
                    <th className="p-3">Package Name</th>
                    <th className="p-3">Version & Release</th>
                    <th className="p-3">Architecture</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-border/50">
                  {filteredInstalled.map(pkg => (
                    <tr key={pkg.name} className="hover:bg-terminal-surface/40 transition-colors">
                      <td className="p-3 font-bold text-terminal-text flex items-center gap-2">
                        <Box className="w-3.5 h-3.5 text-terminal-blue shrink-0" />
                        <span>{pkg.name}</span>
                      </td>
                      <td className="p-3 text-terminal-green font-mono">{pkg.version}</td>
                      <td className="p-3 text-terminal-muted font-mono">{pkg.arch}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => inspectPackage(pkg.name)}
                          className="px-2.5 py-1 rounded bg-terminal-surface hover:bg-terminal-border border border-terminal-border text-terminal-blue hover:text-white transition-colors text-[11px] inline-flex items-center gap-1"
                        >
                          <Info className="w-3 h-3" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'search' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Type package name to search DNF repository (e.g. nginx, git, python3)..."
                className="flex-1 bg-terminal-surface border border-terminal-border rounded-lg px-3 py-2 text-xs font-mono text-terminal-text focus:outline-none focus:border-terminal-blue"
              />
              <button
                onClick={() => handleSearch()}
                disabled={loadingSearch || !searchQuery.trim()}
                className="px-4 py-2 rounded-lg bg-terminal-blue text-black font-bold text-xs hover:bg-terminal-blue/90 transition-colors flex items-center gap-2"
              >
                {loadingSearch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Search DNF
              </button>
            </div>

            {loadingSearch ? (
              <div className="flex items-center justify-center h-40 text-terminal-muted gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-terminal-blue" />
                <span>Searching DNF repository...</span>
              </div>
            ) : searchResults ? (
              <pre className="p-4 rounded-lg bg-terminal-bg border border-terminal-border text-xs text-terminal-text font-mono whitespace-pre-wrap leading-relaxed">
                {searchResults}
              </pre>
            ) : (
              <div className="text-center py-12 text-terminal-muted text-xs">
                Enter a package query above and click <span className="text-terminal-blue font-bold">Search DNF</span>.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-terminal-muted uppercase tracking-wider">DNF Package Update Status</h3>
              <button
                onClick={checkUpdates}
                disabled={loadingUpdates}
                className="px-3 py-1 text-xs rounded bg-terminal-surface border border-terminal-border text-terminal-muted hover:text-terminal-text"
              >
                Re-check Updates
              </button>
            </div>

            {loadingUpdates ? (
              <div className="flex items-center justify-center h-40 text-terminal-muted gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-terminal-green" />
                <span>Checking repository for available updates...</span>
              </div>
            ) : (
              <pre className="p-4 rounded-lg bg-terminal-bg border border-terminal-border text-xs text-terminal-green font-mono whitespace-pre-wrap leading-relaxed">
                {updatesOutput}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Package Inspection Modal */}
      {selectedPkgInfo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-terminal-bg border border-terminal-border rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-terminal-border pb-3">
              <h3 className="text-sm font-bold text-terminal-text flex items-center gap-2">
                <Info className="w-4 h-4 text-terminal-blue" />
                RPM Package Details: <span className="text-terminal-green">{selectedPkgInfo.pkg}</span>
              </h3>
              <button onClick={() => setSelectedPkgInfo(null)} className="text-terminal-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="p-3 rounded-lg bg-terminal-surface text-xs text-terminal-text font-mono max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-terminal-border">
              {selectedPkgInfo.info}
            </pre>

            <div className="flex justify-end">
              <button onClick={() => setSelectedPkgInfo(null)} className="btn-secondary px-4 py-1.5 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
