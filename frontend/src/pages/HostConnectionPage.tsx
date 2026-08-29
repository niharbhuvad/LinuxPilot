// LinuxAI — Dedicated Host & SSH Connection Page
import { useState } from 'react'
import SSHConnectionCard from '../components/SSHConnectionCard'
import {
  Server, ShieldCheck, Terminal, Network, Info, HelpCircle, BookOpen,
  Cpu, CheckCircle2, Copy, Check, Lock, Shield, Radio, Sparkles, AlertTriangle,
  Layers, ArrowRight, ExternalLink, RefreshCw
} from 'lucide-react'
import clsx from 'clsx'

export default function HostConnectionPage() {
  const [activeTab, setActiveTab] = useState<'manager' | 'help'>('manager')
  const [selectedPlatform, setSelectedPlatform] = useState<'rhel' | 'ubuntu' | 'aws' | 'online' | 'vmware'>('rhel')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="p-6 animate-fade-in space-y-6 max-w-6xl h-full overflow-y-auto font-mono">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-terminal-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-terminal-blue/10 border border-terminal-blue/30 text-terminal-blue">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-terminal-text tracking-tight font-sans">
              Host & SSH Lab Connection
            </h1>
            <p className="text-xs text-terminal-muted font-mono mt-0.5">
              Connect target Linux environments (RHEL, Ubuntu, Debian, AWS EC2, Online Labs, Local VMs)
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-terminal-surface border border-terminal-border rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab('manager')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
              activeTab === 'manager'
                ? 'bg-terminal-blue text-black shadow-md shadow-terminal-blue/20 font-bold'
                : 'text-terminal-muted hover:text-terminal-text'
            )}
          >
            <Radio className="w-4 h-4" />
            <span>Connection Manager</span>
          </button>

          <button
            onClick={() => setActiveTab('help')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
              activeTab === 'help'
                ? 'bg-terminal-green text-black shadow-md shadow-terminal-green/20 font-bold'
                : 'text-terminal-muted hover:text-terminal-text'
            )}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Platform Help & Setup Guide</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CONNECTION MANAGER & PROFILES */}
      {activeTab === 'manager' && (
        <div className="space-y-6 animate-fade-in">
          {/* Main SSH Configuration Card */}
          <SSHConnectionCard />
        </div>
      )}

      {/* TAB 2: PLATFORM HELP & SETUP GUIDE */}
      {activeTab === 'help' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section 1: System Core Architecture & Execution Flow */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-terminal-border">
              <div className="flex items-center gap-2 text-terminal-text font-semibold text-sm font-sans">
                <Sparkles className="w-5 h-5 text-terminal-green" />
                <span>How LinuxAI System Execution Architecture Works</span>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-terminal-green/10 text-terminal-green border border-terminal-green/30 font-bold">
                Dual Execution Engine
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-terminal-surface/60 border border-terminal-border space-y-2">
                <div className="flex items-center gap-2 text-terminal-blue font-bold">
                  <span className="w-5 h-5 rounded-full bg-terminal-blue/20 flex items-center justify-center text-[10px]">1</span>
                  <span>AI Tool Call</span>
                </div>
                <p className="text-terminal-muted text-[11px] leading-relaxed">
                  User prompt is analyzed by AI Brain (Gemini, Groq, OpenAI). AI requests specific diagnostic tool execution (e.g. <code className="text-terminal-green">get_disk_usage</code>).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-terminal-surface/60 border border-terminal-border space-y-2">
                <div className="flex items-center gap-2 text-terminal-amber font-bold">
                  <span className="w-5 h-5 rounded-full bg-terminal-amber/20 flex items-center justify-center text-[10px]">2</span>
                  <span>Risk Engine</span>
                </div>
                <p className="text-terminal-muted text-[11px] leading-relaxed">
                  Commands are categorized as <span className="text-terminal-green font-bold">LOW</span> (auto-run), <span className="text-terminal-amber font-bold">MEDIUM</span> (approval required), or <span className="text-terminal-red font-bold">HIGH</span> (double confirm).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-terminal-surface/60 border border-terminal-border space-y-2">
                <div className="flex items-center gap-2 text-terminal-green font-bold">
                  <span className="w-5 h-5 rounded-full bg-terminal-green/20 flex items-center justify-center text-[10px]">3</span>
                  <span>Paramiko SSH Runner</span>
                </div>
                <p className="text-terminal-muted text-[11px] leading-relaxed">
                  Executes non-interactively over SSH using <code className="text-terminal-blue">sudo -S</code> for administrative commands without interactive pseudo-terminal hang.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-terminal-surface/60 border border-terminal-border space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-purple-950/40 flex items-center justify-center text-[10px]">4</span>
                  <span>Secret Redaction & Audit</span>
                </div>
                <p className="text-terminal-muted text-[11px] leading-relaxed">
                  Command outputs are automatically sanitized to mask API keys, passwords, and private SSH keys before saving to SQLite audit history.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Platform Selection Guide */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-terminal-border">
              <div>
                <h2 className="text-sm font-bold text-terminal-text font-sans flex items-center gap-2">
                  <Layers className="w-4 h-4 text-terminal-blue" />
                  Target Platform Configuration Setup Guide
                </h2>
                <p className="text-xs text-terminal-muted mt-0.5">
                  Select your target operating system or deployment environment to view setup commands and instructions.
                </p>
              </div>
            </div>

            {/* Platform Selector Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'rhel', label: 'RHEL / Rocky / Alma', icon: '🔴' },
                { id: 'ubuntu', label: 'Ubuntu / Debian', icon: '🟠' },
                { id: 'aws', label: 'AWS EC2 / Cloud VM', icon: '☁️' },
                { id: 'online', label: 'Online RHEL Lab (Pinggy)', icon: '🌐' },
                { id: 'vmware', label: 'Local VM / WSL2', icon: '🖥️' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedPlatform(item.id as any)}
                  className={clsx(
                    'p-3 rounded-xl border text-xs font-mono font-bold flex flex-col items-center gap-1.5 transition-all text-center',
                    selectedPlatform === item.id
                      ? 'bg-terminal-blue/15 border-terminal-blue text-terminal-blue shadow-md'
                      : 'bg-terminal-surface/60 border-terminal-border text-terminal-muted hover:text-terminal-text hover:border-terminal-border'
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-[11px]">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Platform Content Details */}
            <div className="p-5 rounded-xl bg-terminal-bg border border-terminal-border space-y-4">
              {/* RHEL / ROCKY / ALMA */}
              {selectedPlatform === 'rhel' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-terminal-border/60 pb-2">
                    <h3 className="text-xs font-bold text-terminal-green flex items-center gap-2">
                      <span>🔴 Red Hat Enterprise Linux 9 / 8, Rocky Linux, AlmaLinux & CentOS Stream</span>
                    </h3>
                    <span className="text-[10px] text-terminal-muted">Default Target OS</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <span className="text-terminal-text font-bold block">1. Sudo User Configuration (<code className="text-terminal-blue">wheel</code> group):</span>
                      <p className="text-terminal-muted text-[11px]">Add your SSH user to the <code className="text-terminal-text">wheel</code> group to allow non-interactive sudo elevation:</p>
                      <div className="flex items-center justify-between bg-terminal-surface p-2 rounded border border-terminal-border text-terminal-green font-mono text-[11px]">
                        <code>sudo usermod -aG wheel student</code>
                        <button
                          onClick={() => handleCopy('sudo usermod -aG wheel student', 'rhel-wheel')}
                          className="p-1 text-terminal-muted hover:text-terminal-text"
                          title="Copy command"
                        >
                          {copiedId === 'rhel-wheel' ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5 text-terminal-blue" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-terminal-text font-bold block">2. Firewall Port 22 Authorization:</span>
                      <p className="text-terminal-muted text-[11px]">Ensure firewalld permits SSH traffic:</p>
                      <div className="flex items-center justify-between bg-terminal-surface p-2 rounded border border-terminal-border text-terminal-green font-mono text-[11px]">
                        <code>sudo firewall-cmd --add-service=ssh --permanent && sudo firewall-cmd --reload</code>
                        <button
                          onClick={() => handleCopy('sudo firewall-cmd --add-service=ssh --permanent && sudo firewall-cmd --reload', 'rhel-fw')}
                          className="p-1 text-terminal-muted hover:text-terminal-text"
                          title="Copy command"
                        >
                          {copiedId === 'rhel-fw' ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5 text-terminal-blue" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-terminal-surface/40 border border-terminal-border text-[11px] text-terminal-muted space-y-1">
                    <span className="font-bold text-terminal-text block">💡 Key RHEL Characteristics:</span>
                    <p>• Package manager: <code className="text-terminal-blue">dnf</code> (or legacy <code className="text-terminal-blue">yum</code>).</p>
                    <p>• Service manager: <code className="text-terminal-blue">systemctl</code> with SELinux enforcement in Enforcing mode.</p>
                    <p>• Default user on Red Hat Workstation: <code className="text-terminal-text">student</code> or <code className="text-terminal-text">ec2-user</code>.</p>
                  </div>
                </div>
              )}

              {/* UBUNTU / DEBIAN */}
              {selectedPlatform === 'ubuntu' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-terminal-border/60 pb-2">
                    <h3 className="text-xs font-bold text-terminal-amber flex items-center gap-2">
                      <span>🟠 Ubuntu Server (24.04 / 22.04 LTS) & Debian GNU/Linux</span>
                    </h3>
                    <span className="text-[10px] text-terminal-muted">Debian Ecosystem</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <span className="text-terminal-text font-bold block">1. Sudo Group Assignment:</span>
                      <p className="text-terminal-muted text-[11px]">Ubuntu uses the <code className="text-terminal-text">sudo</code> group for administrator privileges:</p>
                      <div className="flex items-center justify-between bg-terminal-surface p-2 rounded border border-terminal-border text-terminal-green font-mono text-[11px]">
                        <code>sudo usermod -aG sudo ubuntu</code>
                        <button
                          onClick={() => handleCopy('sudo usermod -aG sudo ubuntu', 'ubu-sudo')}
                          className="p-1 text-terminal-muted hover:text-terminal-text"
                        >
                          {copiedId === 'ubu-sudo' ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5 text-terminal-blue" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-terminal-text font-bold block">2. UFW Firewall Configuration:</span>
                      <p className="text-terminal-muted text-[11px]">Allow SSH port 22 in Uncomplicated Firewall:</p>
                      <div className="flex items-center justify-between bg-terminal-surface p-2 rounded border border-terminal-border text-terminal-green font-mono text-[11px]">
                        <code>sudo ufw allow 22/tcp && sudo ufw reload</code>
                        <button
                          onClick={() => handleCopy('sudo ufw allow 22/tcp && sudo ufw reload', 'ubu-ufw')}
                          className="p-1 text-terminal-muted hover:text-terminal-text"
                        >
                          {copiedId === 'ubu-ufw' ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5 text-terminal-blue" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-terminal-surface/40 border border-terminal-border text-[11px] text-terminal-muted space-y-1">
                    <span className="font-bold text-terminal-text block">💡 Key Ubuntu Characteristics:</span>
                    <p>• Package manager: <code className="text-terminal-blue">apt</code> / <code className="text-terminal-blue">dpkg</code>.</p>
                    <p>• Service name: <code className="text-terminal-blue">ssh</code> (instead of <code className="text-terminal-blue">sshd</code>).</p>
                    <p>• Default user: <code className="text-terminal-text">ubuntu</code> or <code className="text-terminal-text">debian</code>.</p>
                  </div>
                </div>
              )}

              {/* AWS EC2 & CLOUD */}
              {selectedPlatform === 'aws' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-terminal-border/60 pb-2">
                    <h3 className="text-xs font-bold text-terminal-blue flex items-center gap-2">
                      <span>☁️ AWS EC2, Google Cloud (GCP), Azure & DigitalOcean VMs</span>
                    </h3>
                    <span className="text-[10px] text-terminal-muted">Cloud Infrastructure</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg bg-terminal-surface border border-terminal-border space-y-2">
                      <span className="font-bold text-terminal-text block">1. AWS Security Group Inbound Rule:</span>
                      <p className="text-terminal-muted text-[11px]">
                        Ensure your AWS EC2 Instance Security Group has an Inbound Rule allowing <strong className="text-terminal-text">Type: SSH | Protocol: TCP | Port: 22 | Source: 0.0.0.0/0</strong> (or your IP).
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-terminal-surface border border-terminal-border space-y-2">
                      <span className="font-bold text-terminal-text block">2. Cloud Default Usernames & Key File (.pem):</span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-terminal-bg border border-terminal-border">
                          <span className="text-terminal-muted block text-[10px]">AWS RHEL</span>
                          <span className="font-bold text-terminal-blue">ec2-user</span>
                        </div>
                        <div className="p-2 rounded bg-terminal-bg border border-terminal-border">
                          <span className="text-terminal-muted block text-[10px]">AWS UBUNTU</span>
                          <span className="font-bold text-terminal-blue">ubuntu</span>
                        </div>
                        <div className="p-2 rounded bg-terminal-bg border border-terminal-border">
                          <span className="text-terminal-muted block text-[10px]">AWS DEBIAN</span>
                          <span className="font-bold text-terminal-blue">admin</span>
                        </div>
                        <div className="p-2 rounded bg-terminal-bg border border-terminal-border">
                          <span className="text-terminal-muted block text-[10px]">DIGITALOCEAN</span>
                          <span className="font-bold text-terminal-blue">root</span>
                        </div>
                      </div>
                      <p className="text-terminal-muted text-[11px] pt-1">
                        In LinuxAI, select <strong className="text-terminal-text">SSH Key File</strong> authentication and enter the local filepath to your downloaded <code className="text-terminal-blue">keypair.pem</code> file.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ONLINE LAB (PINGGY) */}
              {selectedPlatform === 'online' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-terminal-border/60 pb-2">
                    <h3 className="text-xs font-bold text-terminal-green flex items-center gap-2">
                      <span>🌐 Online Red Hat Learning (ROL), Sandbox & Remote Friend Setup</span>
                    </h3>
                    <span className="text-[10px] text-terminal-muted">Reverse SSH Tunneling</span>
                  </div>

                  <p className="text-xs text-terminal-muted leading-relaxed">
                    If your RHEL lab is behind NAT or firewall without a public IP, ask your lab partner or run this 1-line command in the lab terminal:
                  </p>

                  <div className="flex items-center justify-between bg-black/60 border border-terminal-green/40 rounded-xl p-3 text-xs text-terminal-green font-mono">
                    <code>ssh -p 443 -R0:localhost:22 tcp@a.pinggy.io</code>
                    <button
                      onClick={() => handleCopy('ssh -p 443 -R0:localhost:22 tcp@a.pinggy.io', 'pinggy-help')}
                      className="flex items-center gap-1 px-3 py-1 bg-terminal-green text-black font-bold rounded hover:bg-terminal-green/90 transition-colors shrink-0"
                    >
                      {copiedId === 'pinggy-help' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === 'pinggy-help' ? 'Copied!' : 'Copy Tunnel Cmd'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-terminal-muted">
                    <div className="p-3 rounded-lg bg-terminal-surface border border-terminal-border space-y-1">
                      <span className="font-bold text-terminal-text block">Step 1: Execute</span>
                      <p className="text-[11px]">Run command in lab machine terminal (<code className="text-terminal-text">student@workstation</code>).</p>
                    </div>
                    <div className="p-3 rounded-lg bg-terminal-surface border border-terminal-border space-y-1">
                      <span className="font-bold text-terminal-text block">Step 2: Copy URL</span>
                      <p className="text-[11px]">Copy the generated address e.g. <code className="text-terminal-blue">yqpjs-xxx.run.pinggy-free.link:35685</code>.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-terminal-surface border border-terminal-border space-y-1">
                      <span className="font-bold text-terminal-text block">Step 3: Connect</span>
                      <p className="text-[11px]">Paste host and port into LinuxAI Connection Manager & click Connect!</p>
                    </div>
                  </div>
                </div>
              )}

              {/* LOCAL VM / WSL2 */}
              {selectedPlatform === 'vmware' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-terminal-border/60 pb-2">
                    <h3 className="text-xs font-bold text-purple-400 flex items-center gap-2">
                      <span>🖥️ VMware Workstation, VirtualBox, KVM / QEMU & WSL2</span>
                    </h3>
                    <span className="text-[10px] text-terminal-muted">Hypervisor Environment</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-lg bg-terminal-surface border border-terminal-border space-y-2">
                      <span className="font-bold text-terminal-text block">1. Network Adapter Mode:</span>
                      <p className="text-terminal-muted text-[11px]">
                        Set VM network adapter to <strong className="text-terminal-blue">Bridged Mode</strong> so the VM gets a real local IP address on your network (e.g. <code className="text-terminal-green">192.168.1.150</code>).
                      </p>
                      <p className="text-terminal-muted text-[11px]">
                        If using NAT mode, add a Port Forwarding rule in VM settings: <code className="text-terminal-text">Host Port 2222 &rarr; Guest Port 22</code>.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-terminal-surface border border-terminal-border space-y-2">
                      <span className="font-bold text-terminal-text block">2. Discover Guest VM IP:</span>
                      <p className="text-terminal-muted text-[11px]">Execute this command inside your local VM terminal to print its IP:</p>
                      <div className="flex items-center justify-between bg-terminal-bg p-2 rounded border border-terminal-border text-terminal-green font-mono text-[11px]">
                        <code>{"hostname -I | awk '{print $1}'"}</code>
                        <button
                          onClick={() => handleCopy("hostname -I | awk '{print $1}'", 'vm-ip')}
                          className="p-1 text-terminal-muted hover:text-terminal-text"
                        >
                          {copiedId === 'vm-ip' ? <Check className="w-3.5 h-3.5 text-terminal-green" /> : <Copy className="w-3.5 h-3.5 text-terminal-blue" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Troubleshooting & FAQ Accordion */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-bold text-terminal-text font-sans flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-terminal-amber" />
              Frequently Asked Troubleshooting Questions (FAQ)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-terminal-surface/60 border border-terminal-border space-y-1.5">
                <span className="font-bold text-terminal-amber block">Q: Connection Refused on Port 22</span>
                <p className="text-terminal-muted text-[11px] leading-relaxed">
                  Ensure the SSH daemon is running on the target machine: <code className="text-terminal-text">sudo systemctl enable --now sshd</code> and verify firewall permits port 22.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-terminal-surface/60 border border-terminal-border space-y-1.5">
                <span className="font-bold text-terminal-amber block">Q: Permission Denied (publickey, password)</span>
                <p className="text-terminal-muted text-[11px] leading-relaxed">
                  Verify username spelling, password accuracy, or check file permissions on SSH key: <code className="text-terminal-text">chmod 600 ~/.ssh/authorized_keys</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-terminal-surface/60 border border-terminal-border space-y-1.5">
                <span className="font-bold text-terminal-amber block">Q: Sudo Password Required for Commands</span>
                <p className="text-terminal-muted text-[11px] leading-relaxed">
                  LinuxAI uses <code className="text-terminal-blue">sudo -S</code>. Make sure to enter your user SSH password in the connection configuration form so LinuxAI can elevate automatically.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-terminal-surface/60 border border-terminal-border space-y-1.5">
                <span className="font-bold text-terminal-amber block">Q: Host Key Verification Failed</span>
                <p className="text-terminal-muted text-[11px] leading-relaxed">
                  Target host SSH keys changed. Clear the cached host key on workstation using: <code className="text-terminal-text">ssh-keygen -R &lt;host&gt;</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
