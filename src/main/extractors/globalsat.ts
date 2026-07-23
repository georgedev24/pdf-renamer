import type { SupplierExtractor, PartialExtraction } from './types'
import { dmyToISO, FIELD_CODE_MAP } from './types'

// GLOBALSAT Α.Ε — has two layouts:
//
// NEW (Entersoft template):
//   GLOBALSAT Α.Ε
//   ...
//   DD/MM/YYYY
//   ΗΜΕΡΟΜΗΝΙΑ
//   ΤΥΠΟΣ ΠΑΡΑΣΤΑΤΙΚΟΥ
//   ΑΡΙΘΜΟΣ
//   <doc-type-text>
//   ΠΤΙ-86394           or  ΠΤΙ-VGC-18249  or  ΤΙΠ-VGC-185831
//
// OLD:
//   ΤΥΠΟΣ ΠΑΡΑΣΤΑΤΙΚΟΥ:
//   Τιμολόγιο Πώλησης
//   ΑΡΙΘΜΟΣ:
//   ΤΙΠ-VGC-63887
//   ΗΜΕΡ/ΝΙΑ-ΏΡΑ:
//   5/11/2020

const RE_HEADER_NEW = /GLOBALSAT\s+Α\.?Ε/u
// Old layout has no GLOBALSAT keyword in the body. Identify it via the
// distinctive "Α.Μ.Π.: 01394" issuer code or the website footer.
const RE_HEADER_OLD =
  /Α\.Μ\.Π\.:?\s*0?1394|globalsat\.gr|ΗΜΕΡ\/ΝΙΑ-ΏΡΑ/iu

// New layout: date appears just before "ΗΜΕΡΟΜΗΝΙΑ" label
const RE_DATE_NEW = /(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(20\d{2})\s*\n\s*ΗΜΕΡΟΜΗΝΙΑ/u
// Old layout: "ΗΜΕΡ/ΝΙΑ-ΏΡΑ:\n5/11/2020"
const RE_DATE_OLD =
  /ΗΜΕΡ\/ΝΙΑ[^:]*:\s*\n?\s*(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(\d{4})/u
// Generic Greek date as a final fallback
const RE_DATE_ANY = /\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(20\d{2})\b/u

// The doc number pattern works for both layouts.
//   Capture group 1 = code (ΠΤΙ / ΤΙΠ / ΤΠΙ)
//   Capture group 2 = optional middle series (e.g. VGC, V)
//   Capture group 3 = trailing digits (the doc number)
//
// NOTE: JS `\b` is ASCII-only, so we can't put a word boundary before Greek
// letters. We anchor with a non-word lookbehind that accepts start/whitespace/
// punctuation, and (?!\d) at the end.
const RE_NUMBER = /(?:^|[^\wA-ZΑ-Ω])(ΠΤΙ|ΤΙΠ|ΤΠΙ)-(?:([A-Z]{1,5})-)?(\d{4,})(?!\d)/u

export const globalsat: SupplierExtractor = {
  key: 'GLOBALSAT',
  label: 'GLOBALSAT',

  detect(text, stem) {
    return (
      RE_HEADER_NEW.test(text) ||
      RE_HEADER_OLD.test(text) ||
      /(?:^|[^\wA-ZΑ-Ω])(?:ΠΤΙ|ΤΙΠ|ΤΠΙ)-/u.test(stem)
    )
  },

  extract(text): PartialExtraction {
    const out: PartialExtraction = {}

    let dm = RE_DATE_NEW.exec(text) ?? RE_DATE_OLD.exec(text) ?? RE_DATE_ANY.exec(text)
    if (dm) out.dateISO = dmyToISO(dm[1], dm[2], dm[3])

    const nm = RE_NUMBER.exec(text)
    if (nm) {
      out.docTypeCode = FIELD_CODE_MAP[nm[1]] ?? nm[1]
      // Always set both series and docNumber explicitly (empty string when
      // absent) so the generic fallback can't overwrite them.
      out.series = nm[2] ?? ''
      out.docNumber = nm[3]
    }

    return out
  }
}
