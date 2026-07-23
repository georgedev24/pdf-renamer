import type { SupplierExtractor, PartialExtraction } from './types'
import { dmyToISO } from './types'

// ΒΟΥΖΑ ΓΙΑΝΝΟΥΛΑ ΒΑΣΙΛΕΙΟΣ — ΡΑΔΙΟ ΛΕΧΟΒΟ.
// PDF lists ΣΚΟΔΡΑ as customer first, with the actual issuer behind a
// "Στοιχεία Εκδότη" header → match by website footer or ΒΟΥΖΑ block.

const RE_FOOTPRINT = /radio-lehovo\.gr|ΒΟΥΖΑ\s+ΓΙΑΝΝΟΥΛΑ|ΡΑΔΙΟ\s+ΛΕΧΟΒΟ/iu

const RE_DATE = /\b(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])[./](20\d{2})\b/

export const vouza: SupplierExtractor = {
  key: 'VOUZA',
  label: 'ΒΟΥΖΑ-ΓΙΑΝΝΟΥΛΑ-ΒΑΣΙΛΕΙΟΣ',

  detect(text) {
    return RE_FOOTPRINT.test(text)
  },

  extract(text): PartialExtraction {
    const out: PartialExtraction = {}

    const dm = RE_DATE.exec(text)
    if (dm) out.dateISO = dmyToISO(dm[1], dm[2], dm[3])

    // Series/number is more reliably handled by the generic Epsilon Digital
    // / Σειρά Παραστατικού paths (Vouza uses myDATA template).
    return out
  }
}
