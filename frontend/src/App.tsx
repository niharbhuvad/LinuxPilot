// LinuxAI — App Router
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { VoiceAssistantProvider } from './context/VoiceAssistantContext'
import Sidebar from './components/Sidebar'
import FloatingVoiceButton from './components/FloatingVoiceButton'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import VoiceAssistantPage from './pages/VoiceAssistantPage'
import ServicesPage from './pages/ServicesPage'
import ProcessesPage from './pages/ProcessesPage'
import NetworkPage from './pages/NetworkPage'
import StoragePage from './pages/StoragePage'
import LogsPage from './pages/LogsPage'
import HistoryPage from './pages/HistoryPage'
import AlertsPage from './pages/AlertsPage'
import TasksPage from './pages/TasksPage'
import TerminalPage from './pages/TerminalPage'
import UsersPage from './pages/UsersPage'
import PackagesPage from './pages/PackagesPage'
import { MonitorPage } from './pages/StubPages'
import SettingsPage from './pages/SettingsPage'
import HostConnectionPage from './pages/HostConnectionPage'

function ProtectedLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-terminal-bg">
        <div className="text-center space-y-3">
          <div className="spinner mx-auto" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p className="text-terminal-muted text-sm font-mono">Loading LinuxAI...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-terminal-bg relative">
      <Sidebar />
      <main className="flex-1 overflow-hidden relative">
        <Routes>
          <Route path="/"           element={<DashboardPage />} />
          <Route path="/dashboard"  element={<Navigate to="/" replace />} />
          <Route path="/assistant"  element={<VoiceAssistantPage />} />
          <Route path="/terminal"   element={<TerminalPage />} />
          <Route path="/chat"       element={<Navigate to="/assistant" replace />} />
          <Route path="/voice"      element={<Navigate to="/assistant" replace />} />
          <Route path="/ai-activity" element={<Navigate to="/assistant" replace />} />

          <Route path="/monitor"    element={<MonitorPage />} />
          <Route path="/processes"  element={<ProcessesPage />} />
          <Route path="/services"   element={<ServicesPage />} />
          <Route path="/storage"    element={<StoragePage />} />
          <Route path="/network"    element={<NetworkPage />} />
          <Route path="/users"      element={<UsersPage />} />
          <Route path="/packages"   element={<PackagesPage />} />
          <Route path="/logs"       element={<LogsPage />} />
          <Route path="/tasks"      element={<TasksPage />} />
          <Route path="/history"    element={<HistoryPage />} />
          <Route path="/alerts"     element={<AlertsPage />} />
          <Route path="/connection" element={<HostConnectionPage />} />
          <Route path="/settings"   element={<SettingsPage />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <VoiceAssistantProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*"     element={<ProtectedLayout />} />
          </Routes>
        </BrowserRouter>
      </VoiceAssistantProvider>
    </AuthProvider>
  )
}
