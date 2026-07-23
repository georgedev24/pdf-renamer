import type { SupplierExtractor, PartialExtraction } from './types'
import { dmyToISO, FIELD_CODE_MAP } from './types'

// VODAFONE - ΠΑΝΑΦΟΝ invoices.
// Layout: "VODAFONE - ΠΑΝΑΦΟΝ" header at top, doc-type after "ΕΙΔΟΣ ΠΑΡΑΣΤΑΤΙΚΟΥ:",
// series sometimes on its own ΣΕΙΡΑ\n<value> line, doc number after
// "ΑΡ.ΠΑΡΑΣΤΑΤΙΚΟΥ:" or "ΠΑΡΑΣΤΑΤΙΚΟ:".

const RE_HEADER = /VODAFONE\s*-\s*ΠΑΝΑΦΟΝ/u
const RE_DATE = /ΗΜΕΡΟΜΗΝΙΑ:?\s*(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])[./](20\d{2})/u

// Spaced form: "ΑΡ.ΠΑΡΑΣΤΑΤΙΚΟΥ: ΤΠ   Α55 0979970"
const RE_AR_3 =
  /ΑΡ\.?\s*ΠΑΡΑΣΤΑΤΙΚΟΥ\s*:\s*([Α-ΩA-Z][Α-ΩA-Z0-9]{1,3})\s+([Α-ΩA-Zα-ωa-z][Α-ΩA-Zα-ωa-z0-9]{0,7}?)\s+(\d{6,})/u
// Jammed form: "ΑΡ.ΠΑΡΑΣΤΑΤΙΚΟΥ: ΤΠ    Α550921542"  — Vodafone doc numbers are
// always exactly 7 digits, so the trailing \d{7} reliably separates them.
const RE_AR_3_JAMMED =
  /ΑΡ\.?\s*ΠΑΡΑΣΤΑΤΙΚΟΥ\s*:\s*([Α-ΩA-Z][Α-ΩA-Z0-9]{1,3})\s+([Α-ΩA-Zα-ωa-z][Α-ΩA-Zα-ωa-z0-9]{1,4})(\d{7})\b/u
// "ΑΡ.ΠΑΡΑΣΤΑΤΙΚΟΥ: ΠΤ   40890000129" (series on the standalone ΣΕΙΡΑ\n line)
const RE_AR_2 = /ΑΡ\.?\s*ΠΑΡΑΣΤΑΤΙΚΟΥ\s*:\s*([Α-ΩA-Z][Α-ΩA-Z0-9]{1,3})\s+(\d{6,})/u

// "ΠΑΡΑΣΤΑΤΙΚΟ:\n ΤΠΥ  Α53 0380321"   (multi-line variant for self-billing types)
const RE_PARAS_3 =
  /ΠΑΡΑΣΤΑΤΙΚΟ\s*:\s*\n?\s*([Α-ΩA-Z][Α-ΩA-Z0-9]{1,3})\s+([Α-ΩA-Zα-ωa-z][Α-ΩA-Zα-ωa-z0-9]{0,7}?)\s+(\d{6,})/u
// Jammed form: "ΠΑΡΑΣΤΑΤΙΚΟ:\n ΤΠΥ   Α530270208" — same 7-digit rule as RE_AR_3_JAMMED
const RE_PARAS_3_JAMMED =
  /ΠΑΡΑΣΤΑΤΙΚΟ\s*:\s*\n?\s*([Α-ΩA-Z][Α-ΩA-Z0-9]{1,3})\s+([Α-ΩA-Zα-ωa-z][Α-ΩA-Zα-ωa-z0-9]{1,4})(\d{7})\b/u
// "ΠΑΡΑΣΤΑΤΙΚΟ:\n ΠΤ  40890000129"  (code + spaces + number, no series, no dash)
const RE_PARAS_2 =
  /ΠΑΡΑΣΤΑΤΙΚΟ\s*:\s*\n?\s*([Α-ΩA-Z][Α-ΩA-Z0-9]{1,3})\s+(\d{6,})/u
// "ΠΑΡΑΣΤΑΤΙΚΟ:\n ΠΤ    -  1495729"  (old format: code + spaces + dash + spaces + number)
const RE_PARAS_DASH =
  /ΠΑΡΑΣΤΑΤΙΚΟ\s*:\s*\n?\s*([Α-ΩA-Z][Α-ΩA-Z0-9]{1,3})\s*[-–—]\s*(\d{4,})/u

// Stand-alone "ΣΕΙΡΑ\n4089" near the top (used by 2-part variants).
// Constrained to short alphanumeric tokens so we never accidentally capture
// the "ΕΙΔΟΣ ΠΑΡΑΣΤΑΤΙΚΟΥ: ..." line that appears when there is NO series value.
const RE_SERIES_BLOCK = /ΣΕΙΡΑ\s*\n\s*([Α-ΩA-Zα-ωa-z0-9]{1,10})\s*(?:\n|$)/u

// "ΕΙΔΟΣ ΠΑΡΑΣΤΑΤΙΚΟΥ: ΤΙΜΟΛΟΓΙΟ (ΠΩΛΗΣΗΣ ΑΓΑΘΩΝ)"
const RE_DOCTYPE = /ΕΙΔΟΣ\s+ΠΑΡΑΣΤΑΤΙΚΟΥ\s*:\s*([^\n]+)/u

const DOC_TYPE_MAP: Array<[RegExp, string]> = [
  [/ΠΙΣΤΩΤΙΚΟ\s+ΤΙΜΟΛΟΓΙΟ\s+ΕΠΙΣΤΡΟΦΗΣ/u, 'ΠΤ'],
  [/ΠΙΣΤΩΤΙΚΟ\s+ΤΙΜΟΛΟΓΙΟ\s+ΠΑΡ\.?ΥΠΗΡΕΣΙΩΝ/u, 'ΠΥ'],
  [/ΠΙΣΤΩΤΙΚΟ\s+ΤΙΜΟΛΟΓΙΟ/u, 'ΠΤ'],
  [/ΤΙΜΟΛΟΓΙΟ\s+ΠΑΡΟΧΗΣ\s+ΥΠΗΡΕΣΙΩΝ\s+ΚΑΡΤΩΝ/u, 'ΤΚ'],
  [/ΤΙΜΟΛΟΓΙΟ\s+ΠΑΡΟΧΗ?Σ?\s+ΥΠΗΡΕΣΙΩΝ/u, 'ΤΠΥ'],
  [/ΤΙΜΟΛΟΓΙΟ\s*\(?ΠΩΛΗΣΗΣ?\s+ΑΓΑΘΩΝ\)?/u, 'ΤΠ'],
  [/ΔΕΛΤΙΟ\s+ΑΠΟΣΤΟΛΗΣ/u, 'ΔΑ']
]

function detectDocType(text: string): string | null {
  const m = RE_DOCTYPE.exec(text)
  if (!m) return null
  const desc = m[1]
  for (const [pat, code] of DOC_TYPE_MAP) {
    if (pat.test(desc)) return code
  }
  return null
}

export const vodafone: SupplierExtractor = {
  key: 'VODAFONE',
  label: 'VODAFONE',

  detect(text) {
    return RE_HEADER.test(text)
  },

  extract(text): PartialExtraction {
    const out: PartialExtraction = {}

    const dm = RE_DATE.exec(text)
    if (dm) out.dateISO = dmyToISO(dm[1], dm[2], dm[3])

    // Try the 3-part forms first
    let sm =
      RE_AR_3.exec(text) ??
      RE_AR_3_JAMMED.exec(text) ??
      RE_PARAS_3.exec(text) ??
      RE_PARAS_3_JAMMED.exec(text)
    if (sm) {
      const code = FIELD_CODE_MAP[sm[1]] ?? sm[1]
      out.docTypeCode = code
      out.series = sm[2]
      out.docNumber = sm[3]
    } else {
      sm = RE_AR_2.exec(text) ?? RE_PARAS_2.exec(text) ?? RE_PARAS_DASH.exec(text)
      if (sm) {
        const code = FIELD_CODE_MAP[sm[1]] ?? sm[1]
        out.docTypeCode = code
        out.docNumber = sm[2]
        const sb = RE_SERIES_BLOCK.exec(text)
        if (sb) out.series = sb[1].trim()
      }
    }

    // Doc-type from text overrides whatever code we got from the number block
    // (more reliable when ΑΡ.ΠΑΡΑΣΤΑΤΙΚΟΥ is missing entirely)
    if (!out.docTypeCode) {
      const dt = detectDocType(text)
      if (dt) out.docTypeCode = dt
    }

    return out
  }
}
