import { detectEncoding, decodeBuffer } from '../encoding/EncodingDetector'
import type {
  FileReaderPlugin,
  FileReadResult,
  RawSheet,
  ParsedRow,
  ParseWarning,
  FileEncoding
} from '../models/types'

/** Section header pattern: [SectionName] */
const SECTION_PATTERN = /^\[([^\]]+)\]$/

/** Key=Value pattern */
const KEY_VALUE_PATTERN = /^([^=]+)=(.*)$/

/** Sections that start a new invoice group */
const INVOICE_SECTION = 'Faktura'

/** Sections that represent line items within an invoice */
const ITEM_SECTION = 'Pozycja'

/** Sections that close an invoice group */
const END_SECTION = 'KoniecFaktury'

interface EppSection {
  name: string
  fields: Record<string, string>
}

/**
 * EppFileReader — reads Insert Subiekt GT / Rachmistrz GT / Rewizor GT
 * EPP (EDI++) files with section-based key=value format.
 *
 * Structure:
 *   [Faktura]
 *   NrFaktury=FV/2026/001
 *   ...
 *   [Pozycja]
 *   NazwaTowaru=Widget
 *   ...
 *   [KoniecFaktury]
 *
 * Flatten strategy: each [Pozycja] produces one row, inheriting
 * all fields from its parent [Faktura] section.
 */
export class EppFileReader implements FileReaderPlugin {
  readonly name = 'EppFileReader'
  readonly supportedExtensions = ['epp']

  canRead(buffer: Buffer, filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'epp') return false

    // Quick content check: look for [Faktura] or [Pozycja] section marker
    let sample = buffer.subarray(0, Math.min(2048, buffer.length))
    // Strip UTF-8 BOM if present
    if (sample.length >= 3 && sample[0] === 0xef && sample[1] === 0xbb && sample[2] === 0xbf) {
      sample = sample.subarray(3)
    }
    const text = sample.toString('utf-8')
    return SECTION_PATTERN.test(text.split(/\r?\n/).find((l) => l.trim().startsWith('[')) ?? '')
  }

  read(buffer: Buffer, filename: string): FileReadResult {
    const warnings: ParseWarning[] = []

    // 1. Detect and decode encoding
    const encodingResult = detectEncoding(buffer)
    const encoding: FileEncoding = encodingResult.encoding
    const text = decodeBuffer(buffer, encoding)

    if (encodingResult.confidence < 0.7) {
      warnings.push({
        level: 'warning',
        message: `Niska pewność detekcji kodowania (${(encodingResult.confidence * 100).toFixed(0)}%). Wykryto: ${encoding}`
      })
    }

    // 2. Split into lines
    const lines = text.split(/\r?\n/)

    if (lines.every((l) => l.trim().length === 0)) {
      return { sheets: [], encoding, warnings: [{ level: 'warning', message: 'Plik jest pusty' }] }
    }

    // 3. Parse sections
    const sections = this.parseSections(lines, warnings)

    // 4. Flatten invoices: each Pozycja inherits its parent Faktura fields
    const { headers, rows } = this.flattenSections(sections, warnings)

    if (rows.length === 0) {
      return {
        sheets: [],
        encoding,
        warnings: [...warnings, { level: 'warning', message: 'Nie znaleziono pozycji faktur w pliku EPP' }]
      }
    }

    const sheet: RawSheet = {
      name: filename,
      headers,
      rows,
      metadata: { format: 'epp', system: 'INSERT_SUBIEKT' }
    }

    return { sheets: [sheet], encoding, warnings }
  }

  /** Parse lines into a flat list of sections with their key-value fields */
  private parseSections(lines: string[], warnings: ParseWarning[]): EppSection[] {
    const sections: EppSection[] = []
    let currentSection: EppSection | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.length === 0) continue

      const sectionMatch = line.match(SECTION_PATTERN)
      if (sectionMatch) {
        currentSection = { name: sectionMatch[1], fields: {} }
        sections.push(currentSection)
        continue
      }

      const kvMatch = line.match(KEY_VALUE_PATTERN)
      if (kvMatch && currentSection) {
        const key = kvMatch[1].trim()
        const value = kvMatch[2].trim()
        currentSection.fields[key] = value
        continue
      }

      if (line.length > 0 && currentSection) {
        warnings.push({
          level: 'warning',
          message: `Wiersz ${i + 1}: nie rozpoznano formatu linii w sekcji [${currentSection.name}]`,
          row: i
        })
      }
    }

    return sections
  }

  /** Flatten sections: each Pozycja row inherits Faktura-level fields */
  private flattenSections(
    sections: EppSection[],
    warnings: ParseWarning[]
  ): { headers: string[]; rows: ParsedRow[] } {
    // Collect all unique keys across invoices and items to build stable headers
    const invoiceKeys = new Set<string>()
    const itemKeys = new Set<string>()

    let currentInvoice: EppSection | null = null

    for (const section of sections) {
      if (section.name === INVOICE_SECTION) {
        currentInvoice = section
        for (const key of Object.keys(section.fields)) invoiceKeys.add(key)
      } else if (section.name === ITEM_SECTION) {
        for (const key of Object.keys(section.fields)) itemKeys.add(key)
      } else if (section.name === END_SECTION) {
        currentInvoice = null
      }
    }

    // Build headers: invoice fields first, then item fields
    const headers = [...Array.from(invoiceKeys), ...Array.from(itemKeys)]

    if (headers.length === 0) {
      return { headers: [], rows: [] }
    }

    // Build rows
    const rows: ParsedRow[] = []
    currentInvoice = null
    let rowIndex = 0

    for (const section of sections) {
      if (section.name === INVOICE_SECTION) {
        currentInvoice = section
      } else if (section.name === ITEM_SECTION) {
        if (!currentInvoice) {
          warnings.push({
            level: 'warning',
            message: `Pozycja bez nadrzędnej faktury (wiersz ${rowIndex + 1})`
          })
          continue
        }

        // Merge invoice + item fields into a single row
        const cells = headers.map((key) => {
          if (currentInvoice!.fields[key] !== undefined) return currentInvoice!.fields[key]
          if (section.fields[key] !== undefined) return section.fields[key]
          return ''
        })

        rows.push({ index: rowIndex++, cells })
      } else if (section.name === END_SECTION) {
        currentInvoice = null
      }
    }

    return { headers, rows }
  }
}
