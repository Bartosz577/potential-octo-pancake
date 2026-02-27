import { detectEncoding, decodeBuffer } from '../encoding/EncodingDetector'
import type {
  FileReaderPlugin,
  FileReadResult,
  RawSheet,
  ParsedRow,
  ParseWarning,
  SeparatorResult,
  FileEncoding
} from '../models/types'

/** Number of metadata columns at the start of each row in NAMOS/ESO format */
const META_COLUMNS = 6

/** Candidate separators in order of priority */
const SEPARATOR_CANDIDATES = ['|', '\t', ';', ',']

/** Maximum number of lines to sample for separator detection */
const SAMPLE_LINES = 20

/**
 * Detect the most likely field separator by analyzing line consistency.
 * For each candidate separator, count columns per line and pick the one
 * with the most consistent (and highest) column count.
 */
export function detectSeparator(lines: string[]): SeparatorResult {
  const sample = lines.slice(0, SAMPLE_LINES)

  let bestSeparator = '|'
  let bestScore = 0
  let bestConfidence = 0

  for (const sep of SEPARATOR_CANDIDATES) {
    const counts = sample.map((line) => line.split(sep).length)
    const maxCount = Math.max(...counts)

    // Skip separators that don't split at all
    if (maxCount <= 1) continue

    // Count how many lines have the same (max) column count
    const consistentLines = counts.filter((c) => c === maxCount).length
    const consistency = consistentLines / sample.length

    // Score: prefer high column count + high consistency
    const score = maxCount * consistency

    if (score > bestScore) {
      bestScore = score
      bestSeparator = sep
      bestConfidence = consistency
    }
  }

  return { separator: bestSeparator, confidence: bestConfidence }
}

/**
 * Check if lines follow the NAMOS/ESO metadata format:
 * cols[0] = point code, cols[1] = system name, cols[2] = JPK type, etc.
 */
function hasMetadataPrefix(lines: string[], separator: string): boolean {
  if (lines.length === 0) return false

  const KNOWN_SYSTEMS = ['NAMOS', 'ESO']
  const KNOWN_JPK_TYPES = ['JPK_VDEK', 'JPK_FA', 'JPK_MAG', 'JPK_WB', 'JPK_V7M']

  const sample = lines.slice(0, Math.min(5, lines.length))
  let matchCount = 0

  for (const line of sample) {
    const cols = line.split(separator)
    if (cols.length > META_COLUMNS) {
      const system = cols[1]
      const jpkType = cols[2]
      if (KNOWN_SYSTEMS.includes(system) && KNOWN_JPK_TYPES.some((t) => jpkType.startsWith(t))) {
        matchCount++
      }
    }
  }

  return matchCount >= sample.length * 0.8
}

/**
 * Extract metadata from the first row's metadata columns.
 */
function extractMetadata(firstRow: string[], separator: string): Record<string, string> {
  if (firstRow.length <= META_COLUMNS) return {}

  return {
    pointCode: firstRow[0],
    system: firstRow[1],
    jpkType: firstRow[2],
    subType: firstRow[3],
    dateFrom: firstRow[4],
    dateTo: firstRow[5]
  }
}

/**
 * TxtFileReader — reads delimited text files (pipe, tab, semicolon, comma).
 * Supports auto-detection of separator and encoding.
 * Handles NAMOS/ESO metadata prefix columns.
 */
export class TxtFileReader implements FileReaderPlugin {
  readonly name = 'TxtFileReader'
  readonly supportedExtensions = ['txt', 'csv', 'tsv', 'dat']

  canRead(buffer: Buffer, filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (!this.supportedExtensions.includes(ext)) return false

    // Quick check: is it text-like? (no null bytes in first 1024 bytes)
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

    // 2. Split into lines, skip empty
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)

    if (lines.length === 0) {
      return { sheets: [], encoding, warnings: [{ level: 'warning', message: 'Plik jest pusty' }] }
    }

    // 3. Detect separator
    const sepResult = detectSeparator(lines)
    const separator = sepResult.separator

    if (sepResult.confidence < 0.7) {
      warnings.push({
        level: 'warning',
        message: `Niska pewność detekcji separatora (${(sepResult.confidence * 100).toFixed(0)}%). Użyto: "${separator === '\t' ? 'TAB' : separator}"`
      })
    }

    // 4. Check for NAMOS/ESO metadata prefix
    const hasMeta = hasMetadataPrefix(lines, separator)
    const metaOffset = hasMeta ? META_COLUMNS : 0

    // 5. Extract metadata from first row
    const firstRowCols = lines[0].split(separator)
    const metadata = hasMeta ? extractMetadata(firstRowCols, separator) : {}

    // 6. Determine expected column count (data columns only)
    const expectedDataCols = firstRowCols.length - metaOffset

    // 7. Parse rows
    const rows: ParsedRow[] = []

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(separator)
      const dataCols = cols.slice(metaOffset)

      if (dataCols.length !== expectedDataCols) {
        warnings.push({
          level: 'warning',
          message: `Wiersz ${i + 1}: oczekiwano ${expectedDataCols} kolumn, znaleziono ${dataCols.length}`,
          row: i
        })
      }

      rows.push({ index: i, cells: dataCols })
    }

    const sheet: RawSheet = {
      name: filename,
      rows,
      metadata
    }

    return {
      sheets: [sheet],
      encoding,
      separator,
      warnings
    }
  }
}
