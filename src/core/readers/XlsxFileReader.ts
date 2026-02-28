import * as XLSX from 'xlsx'
import type {
  FileReaderPlugin,
  FileReadResult,
  RawSheet,
  ParsedRow,
  ParseWarning
} from '../models/types'

/**
 * Convert an Excel serial date number to YYYY-MM-DD string.
 * Handles the Lotus 1-2-3 leap year bug (serial 60 = Feb 29, 1900 which doesn't exist).
 *
 * Excel serial: 1 = Jan 1 1900, 60 = phantom Feb 29 1900, 61 = Mar 1 1900.
 * We use JS Date(1900, 0, serial) with adjustment for serial > 59.
 */
export function excelDateToString(serial: number): string {
  if (serial < 1) return ''

  // Adjust for the Lotus bug: serial 60 is the phantom Feb 29 1900
  const adjusted = serial > 59 ? serial - 1 : serial

  // Use UTC to avoid timezone shifts
  const date = new Date(Date.UTC(1900, 0, adjusted))

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Check if a value looks like an Excel serial date.
 * Excel dates are numbers typically between 1 (1900-01-01) and 73050 (~2100).
 * We use a narrower range to avoid false positives with regular numbers.
 */
function isLikelyExcelDate(value: unknown, format?: string): boolean {
  if (typeof value !== 'number') return false
  if (!Number.isFinite(value) || value < 1 || value > 73050) return false

  // If we have a date format string, it's definitely a date
  if (format && /[ymdh]/i.test(format)) return true

  return false
}

/**
 * XlsxFileReader — reads Excel files (.xlsx, .xls) using SheetJS.
 * Supports multiple sheets, date conversion to YYYY-MM-DD, and header detection.
 */
export class XlsxFileReader implements FileReaderPlugin {
  readonly name = 'XlsxFileReader'
  readonly supportedExtensions = ['xlsx', 'xls']

  canRead(buffer: Buffer, filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (!this.supportedExtensions.includes(ext)) return false

    // XLSX files start with PK (ZIP signature)
    if (ext === 'xlsx') {
      return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
    }

    // XLS files start with the OLE2 compound document signature
    if (ext === 'xls') {
      return (
        buffer.length >= 8 &&
        buffer[0] === 0xd0 &&
        buffer[1] === 0xcf &&
        buffer[2] === 0x11 &&
        buffer[3] === 0xe0
      )
    }

    return false
  }

  read(buffer: Buffer, _filename: string): FileReadResult {
    const warnings: ParseWarning[] = []

    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: false, // keep raw numbers so we can format dates ourselves
        cellNF: true // include number format strings
      })
    } catch (err) {
      return {
        sheets: [],
        encoding: 'utf-8',
        warnings: [
          {
            level: 'warning',
            message: `Błąd odczytu pliku Excel: ${err instanceof Error ? err.message : String(err)}`
          }
        ]
      }
    }

    if (workbook.SheetNames.length === 0) {
      return {
        sheets: [],
        encoding: 'utf-8',
        warnings: [{ level: 'warning', message: 'Plik Excel nie zawiera arkuszy' }]
      }
    }

    const sheets: RawSheet[] = []

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) continue

      const ref = worksheet['!ref']
      if (!ref) {
        warnings.push({
          level: 'info',
          message: `Arkusz "${sheetName}" jest pusty`
        })
        continue
      }

      // Get range
      const range = XLSX.utils.decode_range(ref)
      const totalRows = range.e.r - range.s.r + 1
      const totalCols = range.e.c - range.s.c + 1

      if (totalRows === 0 || totalCols === 0) continue

      // Read all cells into string arrays
      const allRows: string[][] = []

      for (let r = range.s.r; r <= range.e.r; r++) {
        const row: string[] = []
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c })
          const cell = worksheet[cellRef]

          if (!cell) {
            row.push('')
            continue
          }

          // Convert dates to YYYY-MM-DD
          if (isLikelyExcelDate(cell.v, cell.z)) {
            row.push(excelDateToString(cell.v as number))
          } else if (cell.w !== undefined) {
            // Use formatted value if available
            row.push(String(cell.w))
          } else if (cell.v !== undefined) {
            row.push(String(cell.v))
          } else {
            row.push('')
          }
        }
        allRows.push(row)
      }

      if (allRows.length === 0) continue

      // Detect header
      const firstRow = allRows[0]
      const isHeader = detectExcelHeader(firstRow, allRows)

      let headers: string[] | undefined
      let dataStartIndex = 0

      if (isHeader) {
        headers = firstRow
        dataStartIndex = 1
      }

      const rows: ParsedRow[] = []
      for (let i = dataStartIndex; i < allRows.length; i++) {
        rows.push({ index: i - dataStartIndex, cells: allRows[i] })
      }

      sheets.push({
        name: sheetName,
        headers,
        rows,
        metadata: {}
      })
    }

    return {
      sheets,
      encoding: 'utf-8',
      warnings
    }
  }
}

/**
 * Heuristic: first row is a header if all cells are non-empty text
 * and the data rows contain at least some numeric values.
 */
function detectExcelHeader(firstRow: string[], allRows: string[][]): boolean {
  if (allRows.length < 2) return false

  const NUMBER_PATTERN = /^-?\d+([.,]\d+)?$/

  const allText = firstRow.every(
    (cell) => cell.trim().length > 0 && !NUMBER_PATTERN.test(cell.trim())
  )

  if (!allText) return false

  const secondRow = allRows[1]
  return secondRow.some((cell) => NUMBER_PATTERN.test(cell.trim()))
}
