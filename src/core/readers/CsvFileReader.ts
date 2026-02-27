import Papa from 'papaparse'
import { detectEncoding, decodeBuffer } from '../encoding/EncodingDetector'
import { detectSeparator } from './TxtFileReader'
import type {
  FileReaderPlugin,
  FileReadResult,
  RawSheet,
  ParsedRow,
  ParseWarning,
  FileEncoding
} from '../models/types'

/**
 * CsvFileReader — reads CSV files using PapaParse.
 * Supports auto-detection of separator (,;|\t) and encoding (UTF-8, windows-1250).
 * Handles quoted fields, multiline values, and Polish decimal separators.
 */
export class CsvFileReader implements FileReaderPlugin {
  readonly name = 'CsvFileReader'
  readonly supportedExtensions = ['csv']

  canRead(buffer: Buffer, filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'csv') return false

    // Quick check: no null bytes in first 1024 bytes (text file)
    const sample = buffer.subarray(0, Math.min(1024, buffer.length))
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0x00) return false
    }

    return true
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

    if (text.trim().length === 0) {
      return { sheets: [], encoding, warnings: [{ level: 'warning', message: 'Plik jest pusty' }] }
    }

    // 2. Pre-detect separator using line consistency analysis
    //    PapaParse can mis-detect when comma appears in decimal values (Polish format)
    const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const sepResult = detectSeparator(rawLines)

    // 3. Parse with PapaParse using detected delimiter
    const parsed = Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: sepResult.separator
    })

    if (parsed.errors.length > 0) {
      for (const err of parsed.errors) {
        warnings.push({
          level: 'warning',
          message: `PapaParse: ${err.message}`,
          row: err.row
        })
      }
    }

    const data = parsed.data as string[][]

    if (data.length === 0) {
      return { sheets: [], encoding, warnings: [{ level: 'warning', message: 'Plik jest pusty' }] }
    }

    // 3. Detect if first row is a header
    const firstRow = data[0]
    const isHeader = detectHeader(firstRow, data)

    let headers: string[] | undefined
    let dataStartIndex = 0

    if (isHeader) {
      headers = firstRow
      dataStartIndex = 1
    }

    // 4. Build rows
    const rows: ParsedRow[] = []
    const expectedCols = firstRow.length

    for (let i = dataStartIndex; i < data.length; i++) {
      const cells = data[i]

      if (cells.length !== expectedCols) {
        warnings.push({
          level: 'warning',
          message: `Wiersz ${i + 1}: oczekiwano ${expectedCols} kolumn, znaleziono ${cells.length}`,
          row: i
        })
      }

      rows.push({ index: i - dataStartIndex, cells })
    }

    const separator = sepResult.separator

    const sheet: RawSheet = {
      name: filename,
      headers,
      rows,
      metadata: {}
    }

    return {
      sheets: [sheet],
      encoding,
      separator,
      warnings
    }
  }
}

/**
 * Heuristic to detect if the first row is a header.
 * A row is likely a header if:
 * - All cells are non-empty strings
 * - No cell looks like a number (with comma or dot decimal)
 * - At least 2 data rows exist for comparison
 */
function detectHeader(firstRow: string[], allData: string[][]): boolean {
  if (allData.length < 2) return false

  const NUMBER_PATTERN = /^-?\d+([.,]\d+)?$/

  // Check if first row has all non-empty, non-numeric values
  const firstRowAllText = firstRow.every(
    (cell) => cell.trim().length > 0 && !NUMBER_PATTERN.test(cell.trim())
  )

  if (!firstRowAllText) return false

  // Check if second row has at least one numeric value
  const secondRow = allData[1]
  const secondRowHasNumbers = secondRow.some((cell) => NUMBER_PATTERN.test(cell.trim()))

  return secondRowHasNumbers
}
