// Shared types and helpers for per-supplier extractors.
//
// Each supplier module returns a PartialExtraction. Missing fields
// fall back to the generic extractors in src/main/extract.ts.

export interface PartialExtraction {
  dateISO?: string | null
  docTypeCode?: string | null
  series?: string | null
  docNumber?: string | null
  supplier?: string | null
}

export interface SupplierExtractor {
  /** Stable identifier (used for logging only) */
  key: string
  /** Canonical supplier label that appears in the final filename */
  label: string
  /** True if this PDF was issued by this supplier */
  detect(text: string, stem: string, subfolder: string): boolean
  /** Extract whatever fields this supplier can confidently provide */
  extract(text: string, stem: string): PartialExtraction
}

// ── Date helpers ─────────────────────────────────────────────────────────────
export function dmyToISO(d: string, m: string, y: string): string {
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

const GR_MONTHS: Record<string, string> = {
  Ιαν: '01', Φεβ: '02', Μαρ: '03', Απρ: '04', Μαϊ: '05', Μαι: '05',
  Ιουν: '06', Ιουλ: '07', Αυγ: '08', Σεπ: '09', Οκτ: '10', Νοε: '11', Δεκ: '12'
}

/** Parse Greek month-name dates like "1 Μαρ 2026" or "15 Ιανουαρίου 2026" */
export function parseGreekMonthDate(text: string): string | null {
  const m =
    /\b(0?[1-9]|[12]\d|3[01])\s+(Ιαν|Φεβ|Μαρ|Απρ|Μαϊ|Μαι|Ιουν|Ιουλ|Αυγ|Σεπ|Οκτ|Νοε|Δεκ)[\u0370-\u03ff]*\.?\s+(20\d{2})\b/u.exec(
      text
    )
  if (!m) return null
  const mm = GR_MONTHS[m[2]]
  return mm ? dmyToISO(m[1], mm, m[3]) : null
}

// ── Doc-type code mapping ────────────────────────────────────────────────────
export const FIELD_CODE_MAP: Record<string, string> = {
  ΤΠ: 'ΤΠ',
  ΤΠΥ: 'ΤΠΥ',
  ΤΔΑ: 'ΤΔΑ',
  ΔΑ: 'ΔΑ',
  ΠΤ: 'ΠΤ',
  ΤΙΠ: 'ΤΠ',
  ΠΤΙ: 'ΠΤ',
  ΤΠΙ: 'ΤΠ',
  ΤΙΜ: 'ΤΠ'
}
