// Smoke test: run the new dispatcher against every sample PDF in
// "ΤΥΠΟΙ ΤΙΜΟΛΟΓΙΩΝ" plus the user's 2026 folder, print the result.
//
// Run with:  npx tsx scripts/smoke-extract.ts
//
// (no production code depends on this file)

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, basename, extname, dirname } from 'path'

import { extractAllFields } from '../src/main/extract'
import { detectSupplier } from '../src/main/extractors'

const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
  buf: Buffer
) => Promise<{ text: string }>

async function processFile(pdfPath: string): Promise<void> {
  const buf = readFileSync(pdfPath)
  const { text } = await pdfParse(buf)
  const stem = basename(pdfPath, extname(pdfPath))
  const subfolder = basename(dirname(pdfPath))

  const supplier = detectSupplier(text, stem, subfolder)
  const result = extractAllFields(text, stem, subfolder)

  const detector = supplier ? supplier.key : 'GENERIC'
  console.log(
    `[${detector.padEnd(16)}] ${subfolder}/${basename(pdfPath)}\n` +
      `  date=${result.dateISO}  code=${result.docTypeCode}  ` +
      `series=${result.series}  num=${result.docNumber}  supplier=${result.supplier}`
  )
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (p.toLowerCase().endsWith('.pdf')) yield p
  }
}

async function main(): Promise<void> {
  const roots = process.argv.slice(2)
  if (roots.length === 0) {
    console.error('Usage: npx tsx scripts/smoke-extract.ts <root> [<root>...]')
    process.exit(1)
  }
  for (const root of roots) {
    for (const f of walk(root)) {
      try {
        await processFile(f)
      } catch (err) {
        console.error(`ERROR ${f}: ${(err as Error).message}`)
      }
    }
  }
}

main()
