import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { resolveDuplicateNames } from '../utils/buildName'
import type { ExecuteProgress } from '@shared/types'

interface LogLine {
  status: 'ok' | 'skip' | 'error'
  text: string
}

export function ExecutePage() {
  const { entries, imagePdfs, settings, setTab, setExecuteResult, executeResult } = useStore()
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<ExecuteProgress | null>(null)
  const [log, setLog] = useState<LogLine[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  // Bake in the same Windows-style (2)/(3) numbering shown in the Preview tab,
  // so the file actually written matches exactly what was previewed.
  const allEntries = useMemo(() => {
    const raw = [...entries, ...imagePdfs.filter((e) => !e.skip && (e.customName || e.proposedName))]
    const resolved = resolveDuplicateNames(raw)
    return raw.map((e) => {
      const finalName = resolved.get(e.id)
      return finalName ? { ...e, customName: finalName, proposedName: finalName } : e
    })
  }, [entries, imagePdfs])
  const total = allEntries.filter((e) => !e.skip).length

  async function handleRun() {
    if (isRunning) return
    setIsRunning(true)
    setLog([])
    setProgress(null)
    setExecuteResult(null)

    // Determine output folder
    const effectiveSettings = { ...settings }
    if (settings.outputMode === 'copy' && !settings.useSameFolder && !settings.outputFolder) {
      effectiveSettings.outputFolder = settings.sourceFolder
    }

    const unsub = window.api.onExecuteProgress((p) => {
      setProgress(p)
      const icon = p.status === 'ok' ? '✓' : p.status === 'skip' ? '⏭' : '✗'
      setLog((prev) => [
        ...prev,
        { status: p.status, text: `${icon} ${p.fileName}${p.message ? '  -  ' + p.message : ''}` }
      ])
    })

    try {
      const result = await window.api.execute(allEntries, effectiveSettings)
      setExecuteResult(result)
    } catch (e: unknown) {
      setLog((prev) => [
        ...prev,
        { status: 'error', text: `✗ Κρίσιμο σφάλμα: ${e instanceof Error ? e.message : String(e)}` }
      ])
    } finally {
      unsub()
      setIsRunning(false)
    }
  }

  function openOutputFolder() {
    const folder =
      settings.outputMode === 'copy' && !settings.useSameFolder
        ? settings.outputFolder || settings.sourceFolder
        : settings.sourceFolder
    window.api.openInExplorer(folder)
  }

  const pct =
    progress && total > 0 ? Math.round((progress.index / total) * 100) : 0

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Summary before run */}
      {!isRunning && !executeResult && (
        <div className="card flex flex-col items-center gap-4 py-10">
          <div className="text-5xl">▶</div>
          <div className="text-lg font-semibold text-gray-200">Έτοιμο για Εκτέλεση</div>
          <div className="text-sm text-gray-400">
            {settings.outputMode === 'copy' ? 'Αντιγραφή' : 'Μετονομασία'}{' '}
            <span className="text-white font-semibold">{total}</span> αρχεία
            {settings.outputMode === 'copy' && (
              <>
                {' '}→{' '}
                <span className="text-blue-400 font-mono text-xs">
                  {settings.useSameFolder ? settings.sourceFolder : settings.outputFolder || settings.sourceFolder}
                </span>
              </>
            )}
          </div>
          <button className="btn-primary px-8 py-3 text-base" onClick={handleRun} disabled={total === 0}>
            ▶ Έναρξη
          </button>
        </div>
      )}

      {/* Progress */}
      {(isRunning || (executeResult && log.length > 0)) && (
        <div className="card space-y-3">
          {isRunning && progress && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300 truncate max-w-xs font-mono text-xs">{progress.fileName}</span>
                <span className="text-gray-400 shrink-0 ml-2">{progress.index} / {total}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}

          {/* Log */}
          <div
            ref={logRef}
            className="bg-gray-950 rounded-lg p-3 h-64 overflow-y-auto font-mono text-xs space-y-0.5"
          >
            {log.map((l, i) => (
              <div
                key={i}
                className={
                  l.status === 'ok'
                    ? 'text-green-400'
                    : l.status === 'skip'
                    ? 'text-gray-500'
                    : 'text-red-400'
                }
              >
                {l.text}
              </div>
            ))}
            {isRunning && (
              <div className="text-gray-500 animate-pulse">●</div>
            )}
          </div>
        </div>
      )}

      {/* Result summary */}
      {executeResult && !isRunning && (
        <div className="card space-y-3">
          <h3 className="text-base font-semibold text-gray-200">Περίληψη</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-950 border border-green-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{executeResult.success}</div>
              <div className="text-xs text-green-600 mt-1">Επιτυχία</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-400">{executeResult.skipped}</div>
              <div className="text-xs text-gray-600 mt-1">Παραλήφθηκαν</div>
            </div>
            <div
              className={`border rounded-lg p-3 text-center ${
                executeResult.errors > 0
                  ? 'bg-red-950 border-red-800'
                  : 'bg-gray-800 border-gray-700'
              }`}
            >
              <div
                className={`text-2xl font-bold ${executeResult.errors > 0 ? 'text-red-400' : 'text-gray-400'}`}
              >
                {executeResult.errors}
              </div>
              <div className={`text-xs mt-1 ${executeResult.errors > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                Σφάλματα
              </div>
            </div>
          </div>

          {executeResult.errorList.length > 0 && (
            <div className="bg-red-950 border border-red-900 rounded-lg p-3">
              <div className="text-xs font-semibold text-red-300 mb-1">Σφάλματα:</div>
              {executeResult.errorList.map((err, i) => (
                <div key={i} className="text-xs text-red-400 font-mono">
                  {err.name}: {err.msg}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button className="btn-secondary" onClick={openOutputFolder}>
              📂 Άνοιγμα Φακέλου Εξόδου
            </button>
            <button className="btn-secondary" onClick={() => setTab('setup')}>
              ← Πίσω στις Ρυθμίσεις
            </button>
          </div>
        </div>
      )}

      {/* Back navigation during or before run */}
      {!executeResult && (
        <div className="flex justify-start">
          <button
            className="btn-secondary"
            onClick={() => setTab('preview')}
            disabled={isRunning}
          >
            ← Πίσω στην Προεπισκόπηση
          </button>
        </div>
      )}
    </div>
  )
}
