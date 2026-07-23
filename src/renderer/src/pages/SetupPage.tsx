import { useState } from 'react'
import { useStore } from '../store'
import { TokenBuilder } from '../components/TokenBuilder'
import { buildEntryName } from '../utils/buildName'
import type { FormatToken } from '@shared/types'

// Sample entry for preview
const PREVIEW_ENTRY = {
  id: '',
  originalPath: '',
  subfolder: '',
  originalName: '',
  proposedName: '',
  dateISO: '2026-03-23',
  docTypeCode: 'ΤΠ',
  docTypeFallback: 'ΤΠ',
  series: 'Α55',
  docNumber: '0978297',
  supplier: 'VODAFONE',
  isImagePdf: false,
  extractError: false,
  customName: '',
  skip: false
}

export function SetupPage() {
  const { settings, setSettings, setTab, setEntries, isScanning, setIsScanning, setScanError, scanError } =
    useStore()
  const [localSep, setLocalSep] = useState(settings.separator)

  const previewName = buildEntryName(PREVIEW_ENTRY, settings)

  async function handleBrowseSource() {
    const path = await window.api.openFolder()
    if (path) {
      setSettings({ sourceFolder: path })
      if (settings.useSameFolder) setSettings({ outputFolder: path })
    }
  }

  async function handleBrowseOutput() {
    const path = await window.api.openFolder()
    if (path) setSettings({ outputFolder: path })
  }

  async function handleScan() {
    if (!settings.sourceFolder) return
    setScanError('')
    setIsScanning(true)
    try {
      const result = await window.api.scanFolder(settings.sourceFolder)
      setEntries(result.entries, result.imagePdfs)
      // Save settings after successful scan
      await window.api.saveSettings(settings)
      setTab('preview')
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsScanning(false)
    }
  }

  function handleTokensChange(tokens: FormatToken[]) {
    setSettings({ tokens })
  }

  function handleSepChange(sep: string) {
    setLocalSep(sep)
    setSettings({ separator: sep })
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">

      {/* ── Folders ─────────────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-200">📁 Φάκελοι</h2>

        {/* Source */}
        <div>
          <span className="label">Φάκελος Πηγή</span>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={settings.sourceFolder}
              onChange={(e) => setSettings({ sourceFolder: e.target.value })}
              placeholder="C:\Users\…\2026"
            />
            <button className="btn-secondary" onClick={handleBrowseSource}>
              Αναζήτηση
            </button>
          </div>
        </div>

        {/* Output mode */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="outputMode"
              value="copy"
              checked={settings.outputMode === 'copy'}
              onChange={() => setSettings({ outputMode: 'copy' })}
              className="accent-blue-500"
            />
            <span className="text-gray-300">Αντιγραφή σε φάκελο εξόδου</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="outputMode"
              value="rename"
              checked={settings.outputMode === 'rename'}
              onChange={() => setSettings({ outputMode: 'rename' })}
              className="accent-blue-500"
            />
            <span className="text-gray-300">Μετονομασία στη θέση</span>
          </label>
        </div>

        {/* Output folder (only shown for copy mode) */}
        {settings.outputMode === 'copy' && (
          <div>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.useSameFolder}
                  onChange={(e) => setSettings({ useSameFolder: e.target.checked })}
                  className="accent-blue-500"
                />
                <span className="text-gray-300">Ίδιος με τον φάκελο πηγή</span>
              </label>
            </div>
            {!settings.useSameFolder && (
              <div>
                <span className="label">Φάκελος Εξόδου</span>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={settings.outputFolder}
                    onChange={(e) => setSettings({ outputFolder: e.target.value })}
                    placeholder="C:\Users\…\μετονομασμένα"
                  />
                  <button className="btn-secondary" onClick={handleBrowseOutput}>
                    Αναζήτηση
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Token Format ─────────────────────────────────────────────────────── */}
      <div className="card space-y-5">
        <h2 className="text-base font-semibold text-gray-200">🏷️ Μορφή Ονόματος Αρχείου</h2>

        {/* Date format */}
        <div>
          <span className="label">Μορφή Ημερομηνίας</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {([
              ['DD-MM-YYYY', '23-03-2026'],
              ['YYYY-MM-DD', '2026-03-23'],
              ['MM-DD-YYYY', '03-23-2026'],
              ['DDMMYYYY',   '23032026'],
              ['YYYYMMDD',   '20260323'],
            ] as const).map(([fmt, example]) => (
              <button
                key={fmt}
                onClick={() => setSettings({ dateFormat: fmt })}
                className={`px-3 py-1.5 rounded-lg border text-sm font-mono transition-colors
                  ${settings.dateFormat === fmt
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
              >
                {fmt}
                <span className="ml-2 text-xs opacity-60">{example}</span>
              </button>
            ))}
          </div>
        </div>

        <TokenBuilder
          tokens={settings.tokens}
          separator={localSep}
          onChange={handleTokensChange}
          onSeparatorChange={handleSepChange}
          preview={previewName}
        />
      </div>

      {/* ── Scan ─────────────────────────────────────────────────────────────── */}
      {scanError && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
          ⚠ {scanError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          className="btn-primary px-6 py-2.5 text-base"
          onClick={handleScan}
          disabled={!settings.sourceFolder || isScanning}
        >
          {isScanning ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Scanning…
            </>
          ) : (
            '🔍 Σάρωση Φακέλου →'
          )}
        </button>
      </div>
    </div>
  )
}
