import { detectEncoding, decodeBuffer } from '../encoding/EncodingDetector'
import type {
  FileReaderPlugin,
  FileReadResult,
  RawSheet,
  ParsedRow,
  ParseWarning,
  FileEncoding
} from '../models/types'

/**
 * JsonFileReader — reads JSON files containing tabular data.
 *
 * Supported structures:
 * 1. Array of objects: [{ "col1": "val1", "col2": "val2" }, ...]
 * 2. Array of arrays: [["a", "b"], ["c", "d"]]
 * 3. Nested object with data array: { "data": [...], "meta": {...} }
 *    (searches for the first array property)
 */
export class JsonFileReader implements FileReaderPlugin {
  readonly name = 'JsonFileReader'
  readonly supportedExtensions = ['json']

  canRead(buffer: Buffer, filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'json') return false

    // Quick check: starts with { or [
    const sample = buffer.subarray(0, Math.min(64, buffer.length))
    const text = sample.toString('utf-8').trim()
    return text.startsWith('{') || text.startsWith('[')
  }

  read(buffer: Buffer, filename: string): FileReadResult {
    const warnings: ParseWarning[] = []

    // 1. Detect and decode encoding
    const encodingResult = detectEncoding(buffer)
    const encoding: FileEncoding = encodingResult.encoding
    const text = decodeBuffer(buffer, encoding)

    if (text.trim().length === 0) {
      return { sheets: [], encoding, warnings: [{ level: 'warning', message: 'Plik jest pusty' }] }
    }

    // 2. Parse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      return {
        sheets: [],
        encoding,
        warnings: [
          {
            level: 'warning',
            message: `Błąd parsowania JSON: ${err instanceof Error ? err.message : String(err)}`
          }
        ]
      }
    }

    // 3. Find the data array
    const { dataArray, path } = findDataArray(parsed)

    if (!dataArray || dataArray.length === 0) {
      return {
        sheets: [],
        encoding,
        warnings: [
          {
            level: 'warning',
            message: 'Nie znaleziono tablicy danych w pliku JSON'
          }
        ]
      }
    }

    if (path) {
      warnings.push({
        level: 'info',
        message: `Dane znalezione w kluczu: "${path}"`
      })
    }

    // 4. Convert to tabular format
    const sheet = arrayToSheet(dataArray, filename, warnings)

    // 5. Extract top-level metadata (non-array properties)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      for (const key of Object.keys(obj)) {
        const val = obj[key]
        if (val !== null && typeof val !== 'object') {
          sheet.metadata[key] = String(val)
        }
      }
    }

    return {
      sheets: [sheet],
      encoding,
      warnings
    }
  }
}

/**
 * Find the data array in the parsed JSON.
 * Returns the array and the key path where it was found.
 */
function findDataArray(parsed: unknown): { dataArray: unknown[] | null; path: string | null } {
  // Top-level array
  if (Array.isArray(parsed)) {
    return { dataArray: parsed, path: null }
  }

  // Object — look for array properties
  if (parsed !== null && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>

    // Prefer well-known keys
    const preferredKeys = ['data', 'rows', 'records', 'items', 'results', 'entries']
    for (const key of preferredKeys) {
      if (Array.isArray(obj[key])) {
        return { dataArray: obj[key] as unknown[], path: key }
      }
    }

    // Fall back to first array property
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        return { dataArray: obj[key] as unknown[], path: key }
      }
    }
  }

  return { dataArray: null, path: null }
}

/**
 * Convert an array of items to a RawSheet.
 * Handles both array-of-objects and array-of-arrays.
 */
function arrayToSheet(dataArray: unknown[], filename: string, warnings: ParseWarning[]): RawSheet {
  const first = dataArray[0]

  // Array of objects → extract keys as headers, values as cells
  if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
    return objectArrayToSheet(dataArray as Record<string, unknown>[], filename, warnings)
  }

  // Array of arrays → use as-is
  if (Array.isArray(first)) {
    return arrayOfArraysToSheet(dataArray as unknown[][], filename, warnings)
  }

  // Array of primitives → single column
  const rows: ParsedRow[] = dataArray.map((item, i) => ({
    index: i,
    cells: [stringify(item)]
  }))

  return { name: filename, rows, metadata: {} }
}

/**
 * Convert array of objects to sheet with headers.
 */
function objectArrayToSheet(
  items: Record<string, unknown>[],
  filename: string,
  warnings: ParseWarning[]
): RawSheet {
  // Collect all unique keys across all objects (preserve order from first object)
  const keySet = new Set<string>()
  for (const item of items) {
    for (const key of Object.keys(item)) {
      keySet.add(key)
    }
  }
  const headers = Array.from(keySet)

  const rows: ParsedRow[] = items.map((item, i) => ({
    index: i,
    cells: headers.map((key) => stringify(item[key]))
  }))

  return { name: filename, headers, rows, metadata: {} }
}

/**
 * Convert array of arrays to sheet.
 */
function arrayOfArraysToSheet(
  items: unknown[][],
  filename: string,
  warnings: ParseWarning[]
): RawSheet {
  // Check if first row looks like a header (all strings, no numbers)
  const firstRow = items[0]
  const isHeader =
    items.length > 1 &&
    firstRow.every((v) => typeof v === 'string' && v.trim().length > 0)

  let headers: string[] | undefined
  let dataStart = 0

  if (isHeader) {
    headers = firstRow.map(String)
    dataStart = 1
  }

  const rows: ParsedRow[] = []
  for (let i = dataStart; i < items.length; i++) {
    rows.push({
      index: i - dataStart,
      cells: items[i].map(stringify)
    })
  }

  return { name: filename, headers, rows, metadata: {} }
}

/**
 * Convert any value to a string for cell storage.
 */
function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}
