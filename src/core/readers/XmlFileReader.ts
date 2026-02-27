import { XMLParser } from 'fast-xml-parser'
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
 * XmlFileReader — reads generic XML files and converts repeating elements to tabular data.
 *
 * Strategy:
 * 1. Parse XML into a JS object tree using fast-xml-parser
 * 2. Find the deepest array of repeating elements (the "data rows")
 * 3. Flatten each element's properties into columns
 * 4. Return as RawSheet with headers derived from property names
 */
export class XmlFileReader implements FileReaderPlugin {
  readonly name = 'XmlFileReader'
  readonly supportedExtensions = ['xml']

  canRead(buffer: Buffer, filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'xml') return false

    // Quick check: starts with < or BOM + <
    const sample = buffer.subarray(0, Math.min(64, buffer.length)).toString('utf-8').trim()
    return sample.startsWith('<?xml') || sample.startsWith('<')
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

    // 2. Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false, // keep everything as strings
      trimValues: true,
      isArray: (_tagName: string, _jPath: string, _isLeafNode: boolean, isAttribute: boolean) => {
        // Don't force arrays — let the parser auto-detect repeating elements
        return !isAttribute && false
      }
    })

    let parsed: Record<string, unknown>
    try {
      parsed = parser.parse(text)
    } catch (err) {
      return {
        sheets: [],
        encoding,
        warnings: [
          {
            level: 'warning',
            message: `Błąd parsowania XML: ${err instanceof Error ? err.message : String(err)}`
          }
        ]
      }
    }

    // 3. Find repeating element arrays in the parsed tree
    const arrays = findAllArrays(parsed)

    if (arrays.length === 0) {
      return {
        sheets: [],
        encoding,
        warnings: [{ level: 'warning', message: 'Nie znaleziono powtarzających się elementów w XML' }]
      }
    }

    // 4. Convert each array to a RawSheet
    const sheets: RawSheet[] = []

    for (const { path, items } of arrays) {
      if (items.length === 0) continue

      // Only process arrays of objects (not arrays of primitives)
      const objectItems = items.filter(
        (item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item)
      )
      if (objectItems.length === 0) continue

      const sheet = objectArrayToSheet(objectItems, path, warnings)
      sheets.push(sheet)
    }

    if (sheets.length === 0) {
      return {
        sheets: [],
        encoding,
        warnings: [{ level: 'warning', message: 'Nie znaleziono tabelarycznych danych w XML' }]
      }
    }

    return { sheets, encoding, warnings }
  }
}

interface FoundArray {
  path: string
  items: unknown[]
}

/**
 * Recursively find all arrays of objects in the parsed XML tree.
 * Returns them sorted by size (largest first).
 */
function findAllArrays(obj: unknown, currentPath = ''): FoundArray[] {
  const results: FoundArray[] = []

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return results

  const record = obj as Record<string, unknown>

  for (const key of Object.keys(record)) {
    const value = record[key]
    const path = currentPath ? `${currentPath}.${key}` : key

    if (Array.isArray(value) && value.length > 0) {
      // Check if it's an array of objects
      const hasObjects = value.some(
        (item) => item !== null && typeof item === 'object' && !Array.isArray(item)
      )
      if (hasObjects) {
        results.push({ path, items: value })
      }
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      results.push(...findAllArrays(value, path))
    }
  }

  // Sort by array size descending — the largest array is likely the main data
  results.sort((a, b) => b.items.length - a.items.length)

  return results
}

/**
 * Convert an array of XML-parsed objects into a RawSheet.
 * Flattens nested properties using dot notation for column names.
 */
function objectArrayToSheet(
  items: Record<string, unknown>[],
  sheetName: string,
  warnings: ParseWarning[]
): RawSheet {
  // Collect all unique keys (flattened) across all items
  const keySet = new Set<string>()
  const flatItems: Record<string, string>[] = []

  for (const item of items) {
    const flat = flattenObject(item)
    flatItems.push(flat)
    for (const key of Object.keys(flat)) {
      keySet.add(key)
    }
  }

  const headers = Array.from(keySet)

  const rows: ParsedRow[] = flatItems.map((flat, i) => ({
    index: i,
    cells: headers.map((key) => flat[key] ?? '')
  }))

  // Extract the element name from the path (last segment)
  const name = sheetName.split('.').pop() ?? sheetName

  return { name, headers, rows, metadata: { xmlPath: sheetName } }
}

/**
 * Flatten a nested object into a single-level record with dot-notation keys.
 * XML attributes (prefixed with @_) are included with the prefix stripped.
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}

  for (const key of Object.keys(obj)) {
    const value = obj[key]
    // Strip the @_ prefix from XML attributes
    const cleanKey = key.startsWith('@_') ? key.slice(2) : key
    const fullKey = prefix ? `${prefix}.${cleanKey}` : cleanKey

    if (value === null || value === undefined) {
      result[fullKey] = ''
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey))
    } else if (Array.isArray(value)) {
      // Arrays within a row — serialize as JSON
      result[fullKey] = JSON.stringify(value)
    } else {
      result[fullKey] = String(value)
    }
  }

  return result
}
