import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { buildEntryName } from '../utils/buildName'
import type { PdfEntry } from '@shared/types'

// ── Auto-renamed table ────────────────────────────────────────────────────────
function AutoTable() {
  const { entries, settings, updateEntry } = useStore()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          e.originalName.toLowerCase().includes(search.toLowerCase()) ||
          e.proposedName.toLowerCase().includes(search.toLowerCase())
      ),
    [entries, search]
  )

  const allSelected = filtered.every((e) => !e.skip)
  function toggleAll() {
    const newSkip = allSelected
    filtered.forEach((e) => updateEntry(e.id, { skip: newSkip }))
  }

  function startEdit(e: PdfEntry) {
    setEditingId(e.id)
    setEditVal(e.customName || e.proposedName)
  }

  function commitEdit(e: PdfEntry) {
    const trimmed = editVal.replace(/\.pdf$/i, '').trim()
    updateEntry(e.id, {
      customName: trimmed,
      proposedName: trimmed || buildEntryName(e, settings)
    })
    setEditingId(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* toolbar */}
      <div className="flex items-center gap-3 mb-3">
        <input
          className="input w-64"
          placeholder="Αναζήτηση αρχείων…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-gray-500">{filtered.length} αρχεία</span>
        <button className="btn-secondary text-xs" onClick={toggleAll}>
          {allSelected ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
        </button>
      </div>

      {/* table */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
            <tr>
              <th className="w-10 px-3 py-2.5 text-left text-gray-400 font-medium">Παράλειψη</th>
              <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Αρχικό Όνομα</th>
              <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Νέο Όνομα</th>
              <th className="w-24 px-3 py-2.5 text-left text-gray-400 font-medium">Φάκελος</th>
              <th className="w-10 px-3 py-2.5 text-left text-gray-400 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr
                key={e.id}
                className={`border-b border-gray-800 ${i % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900'} ${e.skip ? 'opacity-40' : ''}`}
              >
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    className="accent-blue-500"
                    checked={!e.skip}
                    onChange={(ev) => updateEntry(e.id, { skip: !ev.target.checked })}
                  />
                </td>
                <td className="px-3 py-1.5 font-mono text-gray-400 max-w-xs truncate" title={e.originalName}>
                  {e.originalName}
                </td>
                <td className="px-3 py-1.5 font-mono">
                  {editingId === e.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        className="input text-xs font-mono flex-1"
                        value={editVal}
                        onChange={(ev) => setEditVal(ev.target.value)}
                        onBlur={() => commitEdit(e)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') commitEdit(e)
                          if (ev.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <span className="text-gray-500 text-xs">.pdf</span>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1 group cursor-text"
                      onClick={() => startEdit(e)}
                      title="Κλικ για επεξεργασία"
                    >
                      <span className={`truncate max-w-xs ${e.customName ? 'text-yellow-300' : 'text-green-300'}`}>
                        {e.proposedName}
                      </span>
                      <span className="text-gray-600 text-xs">.pdf</span>
                      <span className="opacity-0 group-hover:opacity-100 text-gray-500 text-xs">✎</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-gray-500 truncate">{e.subfolder || '.'}</td>
                <td className="px-3 py-1.5 text-center">
                  <button
                    className="text-gray-500 hover:text-blue-400 transition-colors"
                    title="Άνοιγμα PDF"
                    onClick={() => window.api.openPdf(e.originalPath)}
                  >
                    📄
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-600">Δεν βρέθηκαν αρχεία για την αναζήτησή σας.</div>
        )}
      </div>
    </div>
  )
}

// ── Manual rename table ───────────────────────────────────────────────────────
function ManualTable() {
  const { imagePdfs, settings, updateImagePdf } = useStore()

  if (imagePdfs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600">
        Δεν υπάρχουν PDFs εικόνας  -  όλα έχουν εξαγώγιμο κείμενο.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
            <tr>
              <th className="w-10 px-3 py-2.5 text-left text-gray-400 font-medium">Συμπ.</th>
              <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Αρχικό Όνομα</th>
              <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Νέο Όνομα (χειροκίνητο)</th>
              <th className="w-10 px-3 py-2.5 text-left text-gray-400 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {imagePdfs.map((e, i) => (
              <tr
                key={e.id}
                className={`border-b border-gray-800 ${i % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900'} ${e.skip ? 'opacity-40' : ''}`}
              >
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    className="accent-blue-500"
                    checked={!e.skip}
                    onChange={(ev) => updateImagePdf(e.id, { skip: !ev.target.checked })}
                  />
                </td>
                <td className="px-3 py-1.5 font-mono text-gray-400 max-w-xs truncate" title={e.originalName}>
                  {e.originalName}
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <input
                      className="input font-mono text-xs flex-1"
                      value={e.customName}
                      onChange={(ev) =>
                        updateImagePdf(e.id, {
                          customName: ev.target.value,
                          proposedName: ev.target.value
                        })
                      }
                      placeholder="Εισάγετε νέο όνομα (χωρίς .pdf)"
                    />
                    <span className="text-gray-500 text-xs">.pdf</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-center">
                  <button
                    className="text-gray-500 hover:text-blue-400 transition-colors"
                    title="Άνοιγμα PDF"
                    onClick={() => window.api.openPdf(e.originalPath)}
                  >
                    📄
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── PreviewPage ───────────────────────────────────────────────────────────────
export function PreviewPage() {
  const { entries, imagePdfs, setTab } = useStore()
  const [subTab, setSubTab] = useState<'auto' | 'manual'>('auto')

  const toRename = entries.filter((e) => !e.skip).length
  const toManual = imagePdfs.filter((e) => !e.skip && e.customName).length

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* sub-tabs */}
      <div className="flex border-b border-gray-800">
        <button
          className={`tab-btn ${subTab === 'auto' ? 'tab-active' : 'tab-inactive'}`}
          onClick={() => setSubTab('auto')}
        >
          Αυτόματη Μετονομασία
          <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-gray-800 text-gray-400">
            {entries.length}
          </span>
        </button>
        <button
          className={`tab-btn ${subTab === 'manual' ? 'tab-active' : 'tab-inactive'}`}
          onClick={() => setSubTab('manual')}
        >
          Χειροκίνητα  -  PDFs Εικόνας
          {imagePdfs.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-orange-900 text-orange-300">
              {imagePdfs.length}
            </span>
          )}
        </button>
      </div>

      {/* content */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'auto' ? <AutoTable /> : <ManualTable />}
      </div>

      {/* actions */}
      <div className="flex items-center justify-between border-t border-gray-800 pt-4">
        <button className="btn-secondary" onClick={() => setTab('setup')}>
          ← Πίσω στις Ρυθμίσεις
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {toRename + toManual} αρχεία έτοιμα
          </span>
          <button
            className="btn-primary px-6"
            onClick={() => setTab('execute')}
            disabled={toRename + toManual === 0}
          >
            ▶ Εκτέλεση →
          </button>
        </div>
      </div>
    </div>
  )
}
