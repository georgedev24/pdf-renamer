import type { PdfEntry, FormatToken, AppSettings } from '@shared/types'
import { formatDate, sanitizeToken } from './extract'

const TOKEN_FIELD: Record<string, keyof PdfEntry | null> = {
  DATE: 'dateISO',
  DOCTYPE: null, // computed
  SERIES: 'series',
  DOCNUMBER: 'docNumber',
  SUPPLIER: 'supplier',
  AMOUNT: null,
  CUSTOM: null
}

export function buildEntryName(entry: PdfEntry, settings: AppSettings): string {
  const { tokens, separator } = settings
  const sep = separator || '-'

  const getValue = (t: FormatToken): string => {
    switch (t.type) {
      case 'DATE':
        return entry.dateISO && entry.dateISO !== 'ΑΓΝΩΣΤΗ-ΗΜΕΡ'
          ? formatDate(entry.dateISO, settings.dateFormat ?? 'DD-MM-YYYY')
          : entry.dateISO || ''
      case 'DOCTYPE':
        return sanitizeToken(entry.docTypeCode || entry.docTypeFallback)
      case 'SERIES':
        return sanitizeToken(entry.series)
      case 'DOCNUMBER':
        return sanitizeToken(entry.docNumber)
      case 'SUPPLIER':
        return sanitizeToken(entry.supplier)
      case 'AMOUNT':
        return ''
      case 'CUSTOM':
        return sanitizeToken(t.customText || '')
      default:
        return ''
    }
  }

  return tokens
    .map(getValue)
    .filter(Boolean)
    .join(sep)
    .slice(0, 150)
}

// Resolves same-batch name collisions the way Windows Explorer does when you
// "keep both files": first one keeps the plain name, the rest get " (2)", " (3)", …
// Order matters  -  it must match the order entries are actually written in
// (see ExecutePage's allEntries), so the preview and the real run agree.
export function resolveDuplicateNames(items: PdfEntry[]): Map<string, string> {
  const seen = new Map<string, number>()
  const resolved = new Map<string, string>()

  for (const e of items) {
    if (e.skip) continue
    const base = (e.customName || e.proposedName).trim()
    if (!base) continue

    const key = base.toLowerCase()
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    resolved.set(e.id, count === 1 ? base : `${base} (${count})`)
  }

  return resolved
}

export const DEFAULT_TOKENS: FormatToken[] = [
  { id: 'tok-date', type: 'DATE', label: '📅 ΗΜΕΡΟΜΗΝΙΑ' },
  { id: 'tok-dtype', type: 'DOCTYPE', label: '📄 ΤΥΠΟΣ' },
  { id: 'tok-series', type: 'SERIES', label: '🔤 ΣΕΙΡΑ' },
  { id: 'tok-docnum', type: 'DOCNUMBER', label: '# ΑΡΙΘΜΟΣ' },
  { id: 'tok-supplier', type: 'SUPPLIER', label: '🏢 ΠΡΟΜΗΘΕΥΤΗΣ' }
]

export const DEFAULT_SETTINGS: AppSettings = {
  sourceFolder: '',
  outputFolder: '',
  useSameFolder: false,
  outputMode: 'copy',
  tokens: DEFAULT_TOKENS,
  separator: '-',
  dateFormat: 'DD-MM-YYYY'
}
