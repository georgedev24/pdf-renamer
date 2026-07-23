import type { SupplierExtractor } from './types'
import { vodafone } from './vodafone'
import { globalsat } from './globalsat'
import { facebook } from './facebook'
import { eskap } from './eskap'
import { gkiozis } from './gkiozis'
import { vouza } from './vouza'
import { epsilonDigital } from './epsilonDigital'

// Order matters: more specific suppliers should come BEFORE the generic
// Epsilon Digital template (which matches any PDF with "Έγγραφο:" /
// "Epsilon Digital" footprint).
//
// `vodafone` and `globalsat` use Epsilon Digital footers too, but their
// header signatures match first and are far more reliable.
export const SUPPLIERS: SupplierExtractor[] = [
  vodafone,
  globalsat,
  facebook,
  eskap,
  gkiozis,
  vouza,
  epsilonDigital
]

export function detectSupplier(
  text: string,
  stem: string,
  subfolder: string
): SupplierExtractor | null {
  for (const ext of SUPPLIERS) {
    try {
      if (ext.detect(text, stem, subfolder)) return ext
    } catch {
      // a misbehaving regex must never break the whole pipeline
    }
  }
  return null
}

export type { SupplierExtractor, PartialExtraction } from './types'
