// Renderer-side re-export of pure functions from extract logic
// (duplicated here so the renderer doesn't import from Electron main)

import type { DateFormat } from '@shared/types'

export function formatDate(iso: string, fmt: DateFormat = 'DD-MM-YYYY'): string {
  if (!iso || !iso.includes('-')) return iso
  const [yyyy, mm, dd] = iso.split('-')
  switch (fmt) {
    case 'DD-MM-YYYY': return `${dd}-${mm}-${yyyy}`
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`
    case 'MM-DD-YYYY': return `${mm}-${dd}-${yyyy}`
    case 'DDMMYYYY':   return `${dd}${mm}${yyyy}`
    case 'YYYYMMDD':   return `${yyyy}${mm}${dd}`
    default:           return `${dd}-${mm}-${yyyy}`
  }
}

/** @deprecated use formatDate */
export function isoToGreek(iso: string): string {
  return formatDate(iso, 'DD-MM-YYYY')
}

export function sanitizeToken(s: string): string {
  return (s || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
}
