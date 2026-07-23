import type { SupplierExtractor, PartialExtraction } from './types'
import { dmyToISO, parseGreekMonthDate } from './types'

// Facebook / Meta ad invoices.
//   Header: "Τιμολόγιο για τον λογαριασμό 45081725"
//   Footer: "Meta Platforms Ireland Limited"
//   Date: Greek month-name format → "1 Μαρ 2026, 6:12 π.μ."
//   Transaction ID: "Κωδικός συναλλαγής\n25955410897476811-26300083619676199"

const RE_HEADER = /Meta\s+Platforms|Τιμολόγιο\s+για\s+τον\s+λογαριασμό/u
const RE_TXN = /Κωδικός\s+συναλλαγής\s*\n\s*(\d{10,})(?:-(\d+))?/u
const RE_NUMERIC_DATE = /(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(20\d{2})/

export const facebook: SupplierExtractor = {
  key: 'FACEBOOK',
  label: 'FACEBOOK',

  detect(text) {
    return RE_HEADER.test(text)
  },

  extract(text): PartialExtraction {
    const out: PartialExtraction = { docTypeCode: 'ΣΥΝΑΛΛ' }

    out.dateISO = parseGreekMonthDate(text)
    if (!out.dateISO) {
      const m = RE_NUMERIC_DATE.exec(text)
      if (m) out.dateISO = dmyToISO(m[1], m[2], m[3])
    }

    const tx = RE_TXN.exec(text)
    if (tx) out.docNumber = tx[1]

    return out
  }
}
