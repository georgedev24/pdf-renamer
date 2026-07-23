import type { SupplierExtractor, PartialExtraction } from './types'
import { dmyToISO } from './types'

// ΓΚΙΟΖΗΣ Γ. ΕΥΑΓΓΕΛΟΣ — auto repair shop.
//   First line: "ΓΚΙΟΖΗΣ Γ. ΕΥΑΓΓΕΛΟΣ"
//   "Σειρά: ΤΠ-ΔΑ Αριθμός: 294"

const RE_FOOTPRINT = /ΓΚΙΟΖΗΣ\s+Γ\.?\s+ΕΥΑΓΓΕΛΟΣ/u
const RE_SN = /Σειρά\s*:\s*(\S+)\s+Αριθμός\s*:\s*(\d+)/u
const RE_DATE = /\b(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])[./](20\d{2})\b/

export const gkiozis: SupplierExtractor = {
  key: 'GKIOZIS',
  label: 'ΓΚΙΟΖΗΣ-Γ-ΕΥΑΓΓΕΛΟΣ',

  detect(text) {
    return RE_FOOTPRINT.test(text)
  },

  extract(text): PartialExtraction {
    const out: PartialExtraction = {}

    const sn = RE_SN.exec(text)
    if (sn) {
      out.series = sn[1]
      out.docNumber = sn[2]
    }

    const dm = RE_DATE.exec(text)
    if (dm) out.dateISO = dmyToISO(dm[1], dm[2], dm[3])

    return out
  }
}
