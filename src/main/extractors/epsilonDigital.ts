import type { SupplierExtractor, PartialExtraction } from './types'
import { dmyToISO, FIELD_CODE_MAP } from './types'

// Epsilon Digital myDATA template.
//
// Multiple suppliers use this template:
//   - ΓΕΝΙΚΗ ΤΑΧΥΔΡΟΜΙΚΗ ΑΕΕ
//   - ΣΑΒΒΟΠΟΥΛΟΣ ΒΑΣΙΛΕΙΟΣ
//   - ΣΚΟΔΡΑ self-issued
//
// Layout:
//   <issuer name>          ← line 1
//   <ΑΦΜ>
//   <Address>
//   ...
//   A/A:
//   <doc-number-line>      ← e.g. "ΤΠΥ-GR-Β.-76346"
//   <date HH:MM>           ← e.g. "16/04/2026 14:29"
//   Ημ/νία Έκδοσης:
//   ...
//   Έγγραφο: ΤΠΥ-GR-Β. 76346
//   Ολοκληρώθηκε
//
// Supplier label is left blank here — the dispatcher's generic
// fallback resolves it from the first line via SUPPLIER_MAP.

const RE_FOOTPRINT =
  /Epsilon\s+Digital|EPSILON\s+NET|epsilondigital(?:\d+)?\.epsilonnet\.gr/iu

// Layout (Epsilon Digital myDATA template):
//   Στοιχεία Παραστατικού
//   <number-line>           ← e.g. "ΤΠΥ-GR-Β.-76346"
//   <date HH:MM>            ← e.g. "16/04/2026 14:29"
//   A/A:                    ← labels come AFTER the values
//   Ημ/νία Έκδοσης:
const RE_PAR_BLOCK =
  /Στοιχεία\s+Παραστατικού\s*\n([^\n]+)\n\s*(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(20\d{2})/u

// Tail "Έγγραφο:" line — present in most Epsilon Digital myDATA invoices.
// Two flavours coexist in the wild:
//   - dotted:        "Έγγραφο: ΤΠΥ-GR-Β. 76346"     (ΓΕΝ.ΤΑΧΥΔΡ.)
//   - space-dashed:  "Έγγραφο: ΤΔΑ -ΥΠ 8956"        (ΣΑΒΒΟΠΟΥΛΟΣ)
// Strict short prefix forces the first capture to be just the doc-type code.
const RE_EGGRAFO =
  /[ΕέΈ]γγραφο\s*:\s*([Α-ΩΆ-ΏA-Z]{2,4})[-\s]+(?:([Α-ΩΆ-ΏA-Za-z][Α-ΩΆ-ΏA-Za-z0-9.\-]*)[-\s.]+)?(\d{3,})\b/u

const RE_DATE_LABEL =
  /Ημ\/νία\s+Έκδοσης:\s*\n?\s*(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(20\d{2})/u

// Number on a stand-alone line: "ΤΠΥ-GR-Β.-76346"  →  code=ΤΠΥ middle=GR-Β num=76346
const RE_NUMBER_LINE =
  /^([Α-ΩΆ-ΏA-Z]{2,4})-(.+?)[\s.-]+(\d{3,})\s*$/u

function parseFromBlock(text: string): { code?: string; series?: string; num?: string; iso?: string } {
  const m = RE_PAR_BLOCK.exec(text)
  if (!m) return {}
  const numLine = m[1].trim()
  const iso = dmyToISO(m[2], m[3], m[4])
  const np = RE_NUMBER_LINE.exec(numLine)
  if (np) {
    return {
      code: FIELD_CODE_MAP[np[1]] ?? np[1],
      series: np[2].replace(/\.$/, ''),
      num: np[3],
      iso
    }
  }
  return { iso }
}

export const epsilonDigital: SupplierExtractor = {
  key: 'EPSILON_DIGITAL',
  label: '', // resolved by generic supplier fallback (first-line / SUPPLIER_MAP)

  detect(text) {
    return RE_FOOTPRINT.test(text) || /Έγγραφο\s*:\s*[Α-ΩA-Z]/u.test(text)
  },

  extract(text): PartialExtraction {
    const out: PartialExtraction = {}

    // Try the Στοιχεία Παραστατικού block first — gives us code/series/num/date
    // in one shot from the value lines that precede the labels.
    const block = parseFromBlock(text)
    if (block.iso) out.dateISO = block.iso
    if (block.code) {
      out.docTypeCode = block.code
      out.series = block.series ?? ''
      out.docNumber = block.num ?? ''
    }

    // If the block didn't give us a number, try the tail "Έγγραφο:" line.
    if (!out.docNumber) {
      const em = RE_EGGRAFO.exec(text)
      if (em) {
        out.docTypeCode = FIELD_CODE_MAP[em[1]] ?? em[1]
        // Strip trailing dot that some issuers leave on their series tag
        // (e.g. "GR-Β." → "GR-Β").
        out.series = (em[2] ?? '').replace(/\.$/, '')
        out.docNumber = em[3]
      }
    }

    if (!out.dateISO) {
      const dm = RE_DATE_LABEL.exec(text)
      if (dm) out.dateISO = dmyToISO(dm[1], dm[2], dm[3])
    }

    return out
  }
}
