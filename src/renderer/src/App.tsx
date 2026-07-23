import { useEffect, useState } from 'react'
import { useStore } from './store'
import { SetupPage } from './pages/SetupPage'
import { PreviewPage } from './pages/PreviewPage'
import { ExecutePage } from './pages/ExecutePage'
import { DEFAULT_SETTINGS } from './utils/buildName'
import type { UpdateStatus } from '@shared/types'

function UpdateBadge() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'not-available' })
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.getAppVersion().then(setVersion)
    return window.api.onUpdateStatus(setStatus)
  }, [])

  const checking = status.state === 'checking'
  const downloading = status.state === 'downloading'

  return (
    <div className="flex items-center gap-2">
      {status.state === 'downloaded' && (
        <button
          className="btn-primary text-xs px-3 py-1"
          onClick={() => window.api.installUpdate()}
          title={`Έκδοση ${status.version} έτοιμη`}
        >
          🔄 Επανεκκίνηση για ενημέρωση
        </button>
      )}
      {downloading && (
        <span className="text-xs text-blue-400">Λήψη ενημέρωσης… {status.percent ?? 0}%</span>
      )}
      {status.state === 'error' && (
        <span className="text-xs text-red-400" title={status.message}>
          ⚠ Σφάλμα ενημέρωσης
        </span>
      )}
      <button
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        onClick={() => window.api.checkForUpdates()}
        disabled={checking || downloading}
        title="Έλεγχος για ενημερώσεις"
      >
        {checking ? '⏳ Έλεγχος…' : `⟳ v${version}`}
      </button>
    </div>
  )
}

export default function App() {
  const { tab, setTab, settings, setSettings, entries, imagePdfs } = useStore()

  // Load persisted settings on startup
  useEffect(() => {
    window.api.loadSettings().then((saved) => {
      if (saved && Object.keys(saved).length > 0) {
        setSettings({ ...DEFAULT_SETTINGS, ...saved })
      }
    })
  }, [])

  const tabs = [
    { id: 'setup' as const, label: '⚙ Ρυθμίσεις' },
    { id: 'preview' as const, label: '👁 Προεπισκόπηση' },
    { id: 'execute' as const, label: '▶ Εκτέλεση' }
  ]

  const previewBadge = entries.length + imagePdfs.length

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-100 select-none">📎 Μετονομαστής PDF</span>
        </div>
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${tab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
            >
              {t.label}
              {t.id === 'preview' && previewBadge > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {previewBadge > 99 ? '99+' : previewBadge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <UpdateBadge />
      </header>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {tab === 'setup' && <SetupPage />}
        {tab === 'preview' && <PreviewPage />}
        {tab === 'execute' && <ExecutePage />}
      </main>
    </div>
  )
}
