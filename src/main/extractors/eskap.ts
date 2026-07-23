import type { SupplierExtractor, PartialExtraction } from './types'
import { dmyToISO } from './types'

// ΕΣΚΑΠ — Στ. ΣΤΑΪΟΣ Δημήτριος (electrical materials)
//   "Σειρά Παραστατικού: 1ΤΙΜΠ"
//   "Α/Α Παραστατικού: 1205"
//   "Ημερομηνία Έκδοσης: 03/04/2026"

const RE_FOOTPRINT = /eskap\.gr|ΕΣΚΑΠ|ΣΤΑΙΟΣ\s+ΔΗΜΗΤΡΙΟΣ|ΣΤΑΪΟΣ\s+ΔΗΜΗΤΡΙΟΣ/iu
const RE_SERIES = /Σειρά\s+Παραστατικού\s*:\s*(\S+)/u
const RE_NUM = /Α\/Α\s+Παραστατικού\s*:\s*(\d+)/u
const RE_DATE =
  /Ημερομηνία\s+Έκδοσης\s*:?\s*(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])[./](20\d{2})/u

export const eskap: SupplierExtractor = {
  key: 'ESKAP',
  label: 'ΕΣΚΑΠ',

  detect(text) {
    return RE_FOOTPRINT.test(text)
  },

  extract(text): PartialExtraction {
    const out: PartialExtraction = {}

    const dm = RE_DATE.exec(text)
    if (dm) out.dateISO = dmyToISO(dm[1], dm[2], dm[3])

    const sm = RE_SERIES.exec(text)
    const nm = RE_NUM.exec(text)
    if (sm) out.series = sm[1]
    if (nm) out.docNumber = nm[1]

    return out
  }
}
