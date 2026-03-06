import AdmZip from 'adm-zip'
import { XMLParser } from 'fast-xml-parser'
import type {
  FileReaderPlugin,
  FileReadResult,
  RawSheet,
  ParsedRow,
  ParseWarning
} from '../models/types'

/** ZIP magic bytes: PK\x03\x04 */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/**
 * OdsFileReader — reads OpenDocument Spreadsheet (.ods) files.
 *
 * ODS files are ZIP archives containing content.xml with table data.
 * Supports:
 * - Multiple sheets (<table:table>)
 * - Value types: string, float, date, boolean
 * - number-columns-repeated for merged/empty cells
 * - number-rows-repeated for empty rows (skipped)
 * - First row as headers
 */
export class OdsFileReader implements FileReaderPlugin {
  readonly name = 'OdsFileReader'
  readonly supportedExtensions = ['ods']

  canRead(buffer: Buffer, filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'ods') return false
    if (buffer.length < 4) return false
    return buffer.subarray(0, 4).equals(ZIP_MAGIC)
  }

  read(buffer: Buffer, _filename: string): FileReadResult {
    const warnings: ParseWarning[] = []

    // 1. Extract content.xml from ZIP
    let contentXml: string
    try {
      const zip = new AdmZip(buffer)
      const entry = zip.getEntry('content.xml')
      if (!entry) {
        return {
          sheets: [],
          encoding: 'utf-8',
          warnings: [{ level: 'warning', message: 'Brak content.xml w pliku ODS — uszkodzony plik' }]
        }
      }
      contentXml = entry.getData().toString('utf-8')
    } catch (err) {
      return {
        sheets: [],
        encoding: 'utf-8',
        warnings: [{
          level: 'warning',
          message: `Błąd odczytu ZIP: ${err instanceof Error ? err.message : String(err)}`
        }]
      }
    }

    // 2. Parse XML with namespace-aware settings
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      trimValues: true,
      // Preserve arrays for repeated elements
      isArray: (name: string) => {
        return name === 'table:table' ||
               name === 'table:table-row' ||
               name === 'table:table-cell' ||
               name === 'table:covered-table-cell' ||
               name === 'text:p'
      }
    })

    let parsed: Record<string, unknown>
    try {
      parsed = parser.parse(contentXml)
    } catch (err) {
      return {
        sheets: [],
        encoding: 'utf-8',
        warnings: [{
          level: 'warning',
          message: `Błąd parsowania content.xml: ${err instanceof Error ? err.message : String(err)}`
        }]
      }
    }

    // 3. Navigate to table data: office:document-content → office:body → office:spreadsheet → table:table
    const docContent = (parsed as Record<string, unknown>)['office:document-content'] as Record<string, unknown> | undefined
    if (!docContent) {
      return { sheets: [], encoding: 'utf-8', warnings: [{ level: 'warning', message: 'Nie znaleziono office:document-content' }] }
    }

    const body = docContent['office:body'] as Record<string, unknown> | undefined
    if (!body) {
      return { sheets: [], encoding: 'utf-8', warnings: [{ level: 'warning', message: 'Nie znaleziono office:body' }] }
    }

    const spreadsheet = body['office:spreadsheet'] as Record<string, unknown> | undefined
    if (!spreadsheet) {
      return { sheets: [], encoding: 'utf-8', warnings: [{ level: 'warning', message: 'Nie znaleziono office:spreadsheet' }] }
    }

    const tables = spreadsheet['table:table']
    const tableList = Array.isArray(tables) ? tables : tables ? [tables] : []

    if (tableList.length === 0) {
      return { sheets: [], encoding: 'utf-8', warnings: [{ level: 'info', message: 'Plik ODS nie zawiera arkuszy' }] }
    }

    // 4. Convert each table to RawSheet
    const sheets: RawSheet[] = []

    for (const table of tableList) {
      const tbl = table as Record<string, unknown>
      const sheetName = String(tbl['@_table:name'] || `Sheet${sheets.length + 1}`)
      const rows = parseTableRows(tbl)

      // Skip empty sheets
      if (rows.length === 0) continue

      // First row as headers
      const headers = rows[0].cells.slice()
      const dataRows: ParsedRow[] = rows.slice(1).map((r, i) => ({
        index: i,
        cells: r.cells
      }))

      sheets.push({
        name: sheetName,
        headers,
        rows: dataRows,
        metadata: {}
      })
    }

    return { sheets, encoding: 'utf-8', warnings }
  }
}

/** Parse all rows from a table:table element */
function parseTableRows(table: Record<string, unknown>): ParsedRow[] {
  const rawRows = table['table:table-row']
  const rowList = Array.isArray(rawRows) ? rawRows : rawRows ? [rawRows] : []

  const result: ParsedRow[] = []

  for (const rawRow of rowList) {
    const row = rawRow as Record<string, unknown>

    // Check rows-repeated (empty filler rows — skip)
    const rowsRepeated = parseInt(String(row['@_table:number-rows-repeated'] || '1'), 10)

    const cells = parseRowCells(row)

    // If all cells are empty and repeated many times, it's trailing filler — skip
    const allEmpty = cells.every((c) => c === '')
    if (allEmpty && rowsRepeated > 1) continue

    // For small repeats of non-empty rows, duplicate them
    const repeat = allEmpty ? 1 : Math.min(rowsRepeated, 1000) // safety cap
    for (let i = 0; i < repeat; i++) {
      result.push({ index: result.length, cells: [...cells] })
    }
  }

  // Trim trailing empty rows
  while (result.length > 0 && result[result.length - 1].cells.every((c) => c === '')) {
    result.pop()
  }

  return result
}

/** Parse cells from a table:table-row element */
function parseRowCells(row: Record<string, unknown>): string[] {
  const rawCells = row['table:table-cell']
  const cellList = Array.isArray(rawCells) ? rawCells : rawCells ? [rawCells] : []

  const result: string[] = []

  for (const rawCell of cellList) {
    const cell = rawCell as Record<string, unknown>

    const colsRepeated = parseInt(String(cell['@_table:number-columns-repeated'] || '1'), 10)
    const value = extractCellValue(cell)

    // Don't expand huge repeated empty cells (trailing padding)
    const repeat = value === '' ? Math.min(colsRepeated, 100) : colsRepeated
    for (let i = 0; i < repeat; i++) {
      result.push(value)
    }
  }

  // Trim trailing empty cells
  while (result.length > 0 && result[result.length - 1] === '') {
    result.pop()
  }

  return result
}

/** Extract the cell value based on office:value-type */
function extractCellValue(cell: Record<string, unknown>): string {
  const valueType = String(cell['@_office:value-type'] || '')

  switch (valueType) {
    case 'float':
    case 'currency':
    case 'percentage':
      return String(cell['@_office:value'] ?? '')

    case 'date':
      return String(cell['@_office:date-value'] ?? '')

    case 'boolean':
      return String(cell['@_office:boolean-value'] ?? '')

    case 'string':
    default: {
      // Text content is in <text:p> elements
      const textP = cell['text:p']
      if (textP === undefined || textP === null) return ''

      if (Array.isArray(textP)) {
        // Multiple <text:p> → join with newline
        return textP.map((p) => extractTextContent(p)).join('\n')
      }

      return extractTextContent(textP)
    }
  }
}

/** Extract text from a text:p element (can be string or object with mixed content) */
function extractTextContent(p: unknown): string {
  if (typeof p === 'string') return p
  if (typeof p === 'number') return String(p)
  if (p === null || p === undefined) return ''

  // Object with #text or nested spans
  if (typeof p === 'object') {
    const obj = p as Record<string, unknown>
    if ('#text' in obj) return String(obj['#text'])
    // Try to get any text content
    const values = Object.values(obj).filter((v) => typeof v === 'string' || typeof v === 'number')
    if (values.length > 0) return values.map(String).join('')
  }

  return String(p)
}
