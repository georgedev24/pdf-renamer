// PDF text extraction and naming logic.
//
// Architecture: per-supplier dispatcher.
//   1. detectSupplier() picks the matching SupplierExtractor (see ./extractors/)
//   2. The supplier extractor returns whatever fields it can confidently
//      provide for that issuer's invoice layout.
//   3. Any field the supplier extractor leaves null falls back to the
//      generic regex-based logic below (which catches stragglers).
//
// To add a new supplier: create src/main/extractors/<name>.ts and register
// it in src/main/extractors/index.ts. No changes to this file are needed.

import { detectSupplier } from './extractors'

const FIELD_CODE_MAP: Record<string, string> = {
  ΤΠ: 'ΤΠ',
  ΤΠΥ: 'ΤΠΥ',
  ΤΔΑ: 'ΤΔΑ',
  ΔΑ: 'ΔΑ',
  ΠΤ: 'ΠΤ',
  ΤΙΠ: 'ΤΠ',
  ΠΤΙ: 'ΠΤ',
  ΤΙΜ: 'ΤΠ'
}

const DOC_TYPE_MAP: Array<[string, string]> = [
  ['ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ ΑΞΙΑΣ', 'ΠΤΑ'],
  ['ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ ΕΠΙΣΤΡΟΦΗΣ', 'ΠΤΕ'],
  ['ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ ΔΩΡΕΑΝ', 'ΠΤΔ'],
  ['ΠΙΣΤΩΤΙΚΟ ΤΙΜ.ΠΑΡ.ΥΠΗΡΕΣΙΩΝ', 'ΠΥ'],
  ['ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ', 'ΠΤ'],
  ['ΤΙΜΟΛΟΓΙΟ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ', 'ΤΠΥ'],
  ['ΤΙΜ ΠΑΡ ΥΠΗΡΕΣΙΩΝ ΚΑΡΤΩΝ', 'ΤΚ'],
  ['ΤΙΜΟΛΟΓΙΟ ΔΕΛΤΙΟ ΑΠΟΣΤΟΛΗΣ', 'ΤΔΑ'],
  ['Τιμολόγιο Παροχής', 'ΤΠΥ'],
  ['Τιμολόγιο Πώλησης', 'ΤΠ'],
  ['Πιστωτικό Τιμολόγιο Πώλησης', 'ΠΤ'],
  ['Πιστωτικό Τιμολόγιο', 'ΠΤ'],
  ['ΤΙΜΟΛΟΓΙΟ ΠΩΛΗΣΗΣ', 'ΤΠ'],
  ['ΔΕΛΤΙΟ ΑΠΟΣΤΟΛΗΣ', 'ΔΑ'],
  ['INVOICE', 'INV'],
  ['ΤΠΥΑ', 'ΤΠΥ'],
  ['ΠΤΠΥΑ', 'ΠΥ'],
  ['ΤΙΠ', 'ΤΠ'],
  ['ΠΤΙ', 'ΠΤ'],
  ['ΤΔΑ', 'ΤΔΑ'],
  ['ΣΥΝΑΛΛΑΓΗ', 'ΣΥΝΑΛΛ'],
  ['ΣΥΝΑΛΛΑΓΉ', 'ΣΥΝΑΛΛ']
]

const SUPPLIER_MAP: Array<[string, string]> = [
  ['VODAFONE', 'VODAFONE'],
  ['VF606', 'VODAFONE'],
  ['GLOBALSAT', 'GLOBALSAT'],
  ['COSMOTE', 'COSMOTE'],
  ['WIND', 'WIND'],
  ['ΕΣΚΑΠ', 'ΕΣΚΑΠ'],
  ['ESKAP', 'ΕΣΚΑΠ'],
  ['EPSILON DIGITAL', 'EPSILON-DIGITAL'],
  ['ΓΕΝΙΚΗ ΤΑΧΥΔΡΟΜΙΚΗ', 'ΓΕΝ-ΤΑΧΥΔΡΟΜΙΚΗ'],
  ['FACEBOOK', 'FACEBOOK'],
  ['META PLATFORMS', 'META'],
  ['ΣΑΒΟΠΟΥΛΟΣ', 'ΣΑΒΟΠΟΥΛΟΣ'],
  ['ΣΑΒΒΟΠΟΥΛΟΣ', 'ΣΑΒΟΠΟΥΛΟΣ'],
  ['TPDA', 'TPDA'],
  ['TPY', 'TPY'],
  ['ΣΚΟΔΡΑ', 'ΣΚΟΔΡΑ']
]

// ── Date regexes ──────────────────────────────────────────────────────────────
const RE_FN_TIMESTAMP = /^(\d{4})(\d{2})(\d{2})\d/
const RE_ISO_T = /(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T/
const RE_FN_ISO_DATE = /(20\d{2})[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])/
// DD-MM-YYYY anywhere in stem (catches files already renamed by us)
const RE_FN_DDMMYYYY_DASH = /(?:^|[^\d])(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-(20\d{2})(?:[^\d]|$)/
const RE_DATE_LABEL = /ΗΜΕΡΟΜΗΝΙΑ:?\s*(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])[./](20\d{2})/
// Ημερομηνία Έκδοσης label → date in next 200 chars (myDATA table format)
const RE_EKDOSIS_DATE = /Ημερομηνία\s+Έκδοσης[\s\S]{0,200}?(0?[1-9]|[12]\d|3[01])[/.](0?[1-9]|1[0-2])[/.](20\d{2})/u
const RE_GR_DATE = /\b(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])[./](20\d{2})\b/
// Greek month-name dates: "1 Μαρ 2026", "15 Ιανουαρίου 2026" (used by Facebook/Meta invoices)
const RE_GR_MONTH_DATE =
  /\b(0?[1-9]|[12]\d|3[01])\s+(Ιαν|Φεβ|Μαρ|Απρ|Μαϊ|Μαι|Ιουν|Ιουλ|Αυγ|Σεπ|Οκτ|Νοε|Δεκ)[\u0370-\u03ff]*\.?\s+(20\d{2})\b/u
const RE_ISO_DATE = /(20\d{2})[-./](0[1-9]|1[0-2])[-./](0[1-9]|[12]\d|3[01])/
const RE_FN_DDMMYYYY = /(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(20\d{2})$/

// ── Series/doc-number regexes ─────────────────────────────────────────────────
// Vodafone: ΑΡ.ΠΑΡΑΣΤΑΤΙΚΟΥ (allow optional space after dot and around colon)
const RE_VF_3 =
  /ΑΡ\.?\s*ΠΑΡΑΣΤΑΤΙΚΟΥ\s*:\s*([Α-ΩΆ-ΏA-Z][Α-ΩΆ-ΏA-Z0-9]{1,3})\s+([Α-ΩΆ-Ώα-ωά-ώa-zA-Z][Α-ΩΆ-Ώα-ωά-ώa-zA-Z0-9]{0,7})\s+(\d{4,})/u
const RE_VF_2 =
  /ΑΡ\.?\s*ΠΑΡΑΣΤΑΤΙΚΟΥ\s*:\s*([Α-ΩΆ-ΏA-Z][Α-ΩΆ-ΏA-Z0-9]{1,3})\s+(\d{6,})/u
const RE_SERIES_LABEL = /ΣΕΙΡΑ\s*[|\n]\s*([^\s|]+)/
// GLOBALSAT table: value under ΑΡΙΘΜΟΣ column (TYPE DESC line then code)
const RE_GLOBALSAT_TABLE = /ΑΡΙΘΜΟΣ\s*\n[^\n]*\n\s*(\S+-\S+)/
const RE_GLOBALSAT = /\b((?:ΤΙΠ|ΠΤΙ|ΤΠΙ)-[\w-]+)\b/
// Epsilon Digital: Έγγραφο: TYPE-SERIES NUMBER (number group strict-digits to avoid grabbing
// trailing words like "Ολοκληρώθηκε" that pdf-parse may glue to the number)
const RE_EPSILON = /[ΕέΈ]γγραφο:\s*(\S+-\S+)\s+(\d+)/
// ΣΑΒΒΟΠΟΥΛΟΣ / myDATA-based: Έγγραφο: TYPE -SERIES NUMBER (space before dash)
const RE_EGGRAFO = /[ΕέΈ]γγραφο:\s*([Α-ΩΆ-ΏA-Z]{2,4})\s+-\s*([Α-ΩΆ-ΏA-Za-z]{1,6})\s+(\d{3,})/u
const RE_ESKAP_SERIES = /Σειρά Παραστατικού:\s*(\S+)/
const RE_ESKAP_NUM = /Α\/Α Παραστατικού:\s*(\d+)/
// Generic Σειρά/Αριθμός labels (ΓΚΙΟΖΗΣ, many Greek accounting apps)
const RE_SERIES_NUM = /Σειρά\s*:\s*(\S+)\s+Αριθμός\s*:\s*(\d+)/
// myDATA table: doc-type name immediately followed by a 1-8 digit number (no colon)
// Handles fitz layout: "ΤΙΜΟΛΟΓΙΟ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ2021\n" or with \n/space before number
const RE_MYDATA_NUM = /(?:ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ|ΠΩΛΗΣΗΣ ΑΓΑΘΩΝ|ΠΩΛΗΣΕΩΝ ΑΓΑΘΩΝ|ΤΙΜΟΛΟΓΙΟ ΠΩΛΗΣΗΣ)\s*\n?\s*(\d{1,8})\s*\n/
const RE_SKODRA_TYPED = /\b([Α-ΩA-Z]{2,3}-[Α-ΩA-Za-z]{1,3}\d{3,})\b/

// ── Helpers ───────────────────────────────────────────────────────────────────
export function isoToGreek(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-')
  return `${dd}-${mm}-${yyyy}`
}

export function sanitizeToken(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
}

// ── Extraction functions ──────────────────────────────────────────────────────
export function extractDate(text: string, stem: string): string {
  let m: RegExpExecArray | null

  m = RE_FN_TIMESTAMP.exec(stem)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  m = RE_ISO_T.exec(stem)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  m = RE_FN_ISO_DATE.exec(stem)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  m = RE_FN_DDMMYYYY_DASH.exec(stem)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  m = RE_FN_DDMMYYYY.exec(stem)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  m = RE_DATE_LABEL.exec(text)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`

  m = RE_GR_DATE.exec(text)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`

  // Greek month-name: "1 Μαρ 2026" (Facebook/Meta)
  m = RE_GR_MONTH_DATE.exec(text)
  if (m) {
    const monthMap: Record<string, string> = {
      Ιαν: '01', Φεβ: '02', Μαρ: '03', Απρ: '04', Μαϊ: '05', Μαι: '05',
      Ιουν: '06', Ιουλ: '07', Αυγ: '08', Σεπ: '09', Οκτ: '10', Νοε: '11', Δεκ: '12'
    }
    const mm = monthMap[m[2]]
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`
  }

  // Ημερομηνία Έκδοσης label → look for date in the text chunk that follows it
  m = RE_EKDOSIS_DATE.exec(text)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`

  m = RE_ISO_DATE.exec(text)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  return 'ΑΓΝΩΣΤΗ-ΗΜΕΡ'
}

export function extractSeriesAndCode(
  text: string,
  stem: string
): [string, string, string] {
  let m: RegExpExecArray | null

  // 1. Vodafone 3-part
  m = RE_VF_3.exec(text)
  if (m) {
    const code = FIELD_CODE_MAP[m[1]] ?? m[1]
    return [code, m[2], m[3]]
  }

  // 2. Epsilon Digital: Έγγραφο: TYPE-SERIES NUMBER (no space before dash)
  m = RE_EPSILON.exec(text)
  if (m) {
    const firstPart = m[1].replace(/\.$/, '')
    const number = m[2].trim()
    const parts = firstPart.split('-')
    const prefix = parts[0]
    const code = FIELD_CODE_MAP[prefix] ?? prefix
    const rest = parts.slice(1).join('-')
    return [code, rest ? `${rest}-${number}` : number, '']
  }

  // 3. myDATA/ΣΑΒΒΟΠΟΥΛΟΣ: Έγγραφο: TYPE -SERIES NUMBER (space before dash)
  m = RE_EGGRAFO.exec(text)
  if (m) {
    const code = FIELD_CODE_MAP[m[1]] ?? m[1]
    return [code, m[2], m[3]]
  }

  // 4. ESKAP
  const ms = RE_ESKAP_SERIES.exec(text)
  const mn = RE_ESKAP_NUM.exec(text)
  if (ms && mn) return ['', ms[1], mn[1]]

  // 5. Generic Σειρά/Αριθμός labels (ΓΚΙΟΖΗΣ and other Greek accounting apps)
  m = RE_SERIES_NUM.exec(text)
  if (m) return ['', m[1], m[2]]

  // 6. Vodafone 2-part
  m = RE_VF_2.exec(text)
  if (m) {
    const code = FIELD_CODE_MAP[m[1]] ?? m[1]
    const sm = RE_SERIES_LABEL.exec(text)
    return [code, sm ? sm[1].trim() : '', m[2]]
  }

  // 7. GLOBALSAT — table: value under ΑΡΙΘΜΟΣ column header
  if (/GLOBALSAT/i.test(text)) {
    m = RE_GLOBALSAT_TABLE.exec(text)
    if (m) {
      const ref = m[1].trim()
      const parts = ref.split('-')
      const code = FIELD_CODE_MAP[parts[0]] ?? parts[0]
      return [code, parts.slice(1).join('-'), '']
    }
  }

  // 7b. GLOBALSAT — direct ΤΙΠ/ΠΤΙ/ΤΠΙ prefix pattern
  m = RE_GLOBALSAT.exec(text)
  if (m) {
    const ref = m[1].trim()
    const parts = ref.split('-')
    const code = FIELD_CODE_MAP[parts[0]] ?? parts[0]
    return [code, parts.slice(1).join('-'), '']
  }

  // 8. ΣΚΟΔΡΑ timestamp
  m = RE_SKODRA_TYPED.exec(text)
  if (m) return ['', m[1], '']

  // 9. myDATA table doc number (doc-type name + number, no colon)
  m = RE_MYDATA_NUM.exec(text)
  if (m) return ['', '', m[1]]

  // 10. Fallback: long number from filename
  m = /(\d{6,})/.exec(stem)
  if (m) return ['', '', m[1]]

  return ['', '', '']
}

// ── First-line supplier helpers ─────────────────────────────────────────────
const RE_EKDOTIS = /Στοιχεί[αά]\s+Εκδότη/u
const RE_SKIP_LINE =
  /^[-\s]*$|^[\d\s./,\-]+$|[:\u0387]\s*$|^(?:ΑΦΜ|Α\.Φ\.Μ|ΔΟΥ|Δ\.Ο\.Υ|ΤΗΛ|FAX|EMAIL|E-MAIL|WWW|HTTP|ΚΩΔΙΚΟΣ|ΕΙΔΟΣ|ΤΙΜΗ|ΑΞΙΑ|ΠΕΡΙΓΡΑΦΗ|ΠΟΣΟΤ|ΜΜ|ΑΘΕΩΡΗΤ|ΕΞΟΦΛ|ΜΕΧΡΙ|ΒΕΒΑΙΩΝΕΤ|ΣΤΟΙΧΕΙΑ|ΤΙΜΟΛΟΓ|ΠΑΡΑΣΤΑΤΙΚ|ΗΜΕΡΟΜΗΝ|ΑΡΙΘΜ|ΣΕΙΡΑ|ΠΛΗΡΩΜ|ΤΡΟΠΟΣ|ΣΚΟΠΟΣ|ΠΑΡΑΤΗΡ|INVOICE|RECEIPT)\b/iu

function isNameLine(line: string): boolean {
  if (!line || line.length < 3 || line.length > 80) return false
  if (RE_SKIP_LINE.test(line)) return false
  if (/\b\d{5}\b/.test(line)) return false // postal code
  if (line[0] === '-' || line[0] === '•' || line[0] === '●') return false
  // must have at least 3 Greek letters
  return [...line].filter(c => c >= '\u0370' && c <= '\u03ff').length >= 3
}

function nameToToken(line: string): string {
  const words = line.trim().split(/\s+/).slice(0, 3)
  return words
    .map(w => w.replace(/[\\//:*?"<>|]/g, '').replace(/^\.+|\.+$/g, ''))
    .filter(Boolean)
    .join('-')
    .slice(0, 40)
}

function firstLineFromBlock(block: string): string {
  for (const raw of block.split('\n').slice(0, 10)) {
    const line = raw.trim()
    if (isNameLine(line)) return nameToToken(line)
  }
  return ''
}

// ─────────────────────────────────────────────────────────────────────────────
export function extractDocType(text: string, stem: string): string {
  const stemU = stem.toUpperCase()
  for (const [kw, code] of DOC_TYPE_MAP) {
    if (stemU.includes(kw.toUpperCase())) return code
  }
  const textU = text.slice(0, 4000).toUpperCase()
  for (const [kw, code] of DOC_TYPE_MAP) {
    if (textU.includes(kw.toUpperCase())) return code
  }
  return 'ΠΑΡ'
}

export function extractSupplier(
  text: string,
  stem: string,
  subfolder: string
): string {
  // 1. Subfolder keyword — most reliable (user-organised folder)
  if (subfolder) {
    const sfU = subfolder.toUpperCase()
    for (const [kw, label] of SUPPLIER_MAP) {
      if (sfU.includes(kw.toUpperCase())) return label
    }
  }

  // 2. Στοιχεία Εκδότη block — explicit issuer label in the PDF
  //    Return immediately so we don't false-match a customer's name from full text.
  const ekdM = RE_EKDOTIS.exec(text)
  if (ekdM) {
    const candidate = firstLineFromBlock(text.slice(ekdM.index + ekdM[0].length))
    if (candidate) {
      const cu = candidate.toUpperCase()
      for (const [kw, label] of SUPPLIER_MAP) {
        if (cu.includes(kw.toUpperCase())) return label
      }
      return candidate // e.g. ΒΟΥΖΑ-ΓΙΑΝΝΟΥΛΑ, ΣΤΑΙΟΣ-ΔΗΜΗΤΡΙΟΣ
    }
  }

  // 3. First meaningful line of the PDF — only if it matches a known supplier keyword.
  //    If it doesn't match, don't guess: the entry will be routed to the manual tab.
  const firstLine = firstLineFromBlock(text)
  if (firstLine) {
    const flu = firstLine.toUpperCase()
    for (const [kw, label] of SUPPLIER_MAP) {
      if (flu.includes(kw.toUpperCase())) return label
    }
  }

  // 4. Full-text keyword scan — exclude ΣΚΟΔΡΑ (appears as customer on all invoices)
  const textU = text.slice(0, 4000).toUpperCase()
  for (const [kw, label] of SUPPLIER_MAP) {
    if (kw.toUpperCase() === 'ΣΚΟΔΡΑ') continue
    if (textU.includes(kw.toUpperCase())) return label
  }

  // 5. Stem keyword — last resort (old filename may carry customer or doc-type name)
  const stemU = stem.toUpperCase()
  for (const [kw, label] of SUPPLIER_MAP) {
    if (stemU.includes(kw.toUpperCase())) return label
  }

  return 'ΑΓΝΩΣΤΟΣ'
}

export interface ExtractionResult {
  dateISO: string
  docTypeCode: string
  docTypeFallback: string
  series: string
  docNumber: string
  supplier: string
}

export function extractAllFields(
  text: string,
  stem: string,
  subfolder: string
): ExtractionResult {
  // 1. Try the per-supplier extractor first. Any field it can't determine
  //    falls through to the generic regex-based logic.
  const ext = detectSupplier(text, stem, subfolder)
  const partial = ext?.extract(text, stem) ?? {}

  // 2. Generic fallbacks fill in whatever is missing.
  const [genCode, genSeries, genNumber] = extractSeriesAndCode(text, stem)

  // 3. Supplier label: explicit subfolder wins → otherwise the extractor's
  //    canonical label → otherwise generic first-line heuristic.
  let supplier = partial.supplier ?? null
  if (!supplier && subfolder) {
    const sfU = subfolder.toUpperCase()
    for (const [kw, label] of SUPPLIER_MAP) {
      if (sfU.includes(kw.toUpperCase())) {
        supplier = label
        break
      }
    }
  }
  if (!supplier && ext?.label) supplier = ext.label
  if (!supplier) supplier = extractSupplier(text, stem, subfolder)

  return {
    dateISO: partial.dateISO || extractDate(text, stem),
    docTypeCode: partial.docTypeCode || genCode,
    docTypeFallback: extractDocType(text, stem),
    series: partial.series ?? genSeries,
    docNumber: partial.docNumber || genNumber,
    supplier
  }
}
