import { decodeBuffer } from '../encoding/EncodingDetector'
import type {
  FileReaderPlugin,
  FileReadResult,
  FileEncoding,
  RawSheet,
  ParsedRow,
  ParseWarning
} from '../models/types'

/** DBF field descriptor parsed from the header */
interface DbfField {
  name: string
  type: string    // C = character, N = numeric, D = date, L = logical, F = float
  length: number
  decimal: number
}

/** Minimum DBF header size: 32 bytes base + at least 1 field (32 bytes) + terminator (1 byte) */
const MIN_HEADER_SIZE = 32 + 32 + 1

/**
 * Detect encoding from DBF header byte 29 (Language Driver ID).
 * Common values for Polish ERP exports:
 *   0x64 (100) → CP852 (DOS Central European)
 *   0xC8 (200) → windows-1250
 *   0x01       → US-DOS codepage 437 → fallback
 *   0x00       → unknown → use EncodingDetector
 */
function encodingFromLdid(ldid: number): FileEncoding | null {
  switch (ldid) {
    case 0x64: return 'cp852'
    case 0x66: return 'cp852'     // CP866 alias (sometimes used)
    case 0xC8: return 'windows-1250'
    case 0x26: return 'windows-1250' // alternate LDID for Win-1250
    case 0x00: return null         // unknown — fallback to auto-detect
    default:   return null
  }
}

/**
 * Parse the DBF header and extract field descriptors.
 */
function parseHeader(buffer: Buffer): {
  version: number
  recordCount: number
  headerLength: number
  recordLength: number
  ldid: number
  fields: DbfField[]
} {
  const version = buffer[0]
  const recordCount = buffer.readUInt32LE(4)
  const headerLength = buffer.readUInt16LE(8)
  const recordLength = buffer.readUInt16LE(10)
  const ldid = buffer[29]

  // Parse field descriptors (each 32 bytes, starting at offset 32)
  const fields: DbfField[] = []
  let offset = 32

  while (offset < headerLength - 1) {
    // Field terminator
    if (buffer[offset] === 0x0d) break

    const nameBytes = buffer.subarray(offset, offset + 11)
    const nullIdx = nameBytes.indexOf(0x00)
    const name = nameBytes.subarray(0, nullIdx >= 0 ? nullIdx : 11).toString('ascii').trim()

    const type = String.fromCharCode(buffer[offset + 11])
    const length = buffer[offset + 16]
    const decimal = buffer[offset + 17]

    if (name.length > 0) {
      fields.push({ name, type, length, decimal })
    }

    offset += 32
  }

  return { version, recordCount, headerLength, recordLength, ldid, fields }
}

/**
 * Format a DBF date field (YYYYMMDD) → YYYY-MM-DD.
 */
function formatDate(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length !== 8 || !/^\d{8}$/.test(trimmed)) return trimmed
  return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
}

/**
 * Format a DBF logical field → 'true' / 'false' / ''.
 */
function formatLogical(raw: string): string {
  const ch = raw.trim().toUpperCase()
  if (ch === 'T' || ch === 'Y' || ch === '1') return 'true'
  if (ch === 'F' || ch === 'N' || ch === '0') return 'false'
  return ''
}

/**
 * DbfFileReader — reads dBASE III/IV/V .dbf files.
 *
 * Features:
 * - Parses binary DBF header for field descriptors
 * - Detects encoding from Language Driver ID (byte 29)
 * - Handles field types: C (string), N (numeric), D (date), L (logical), F (float)
 * - Skips records marked as deleted (flag byte = 0x2A)
 * - Falls back to EncodingDetector if LDID is unknown
 */
export class DbfFileReader implements FileReaderPlugin {
  readonly name = 'DbfFileReader'
  readonly supportedExtensions = ['dbf']

  canRead(buffer: Buffer, filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'dbf') return false
    if (buffer.length < MIN_HEADER_SIZE) return false

    // Check DBF version byte — valid versions: 0x03, 0x04, 0x05, 0x30, 0x31, 0x43, 0x83, 0x8B, 0x8E
    const version = buffer[0] & 0x07  // low 3 bits indicate base version
    return version === 0x03 || version === 0x04 || version === 0x05
  }

  read(buffer: Buffer, filename: string): FileReadResult {
    const warnings: ParseWarning[] = []

    if (buffer.length < MIN_HEADER_SIZE) {
      return {
        sheets: [],
        encoding: 'utf-8',
        warnings: [{ level: 'warning', message: 'Plik DBF jest zbyt mały — uszkodzony nagłówek' }]
      }
    }

    const header = parseHeader(buffer)

    if (header.fields.length === 0) {
      return {
        sheets: [{
          name: filename,
          headers: [],
          rows: [],
          metadata: {}
        }],
        encoding: 'utf-8',
        warnings: [{ level: 'info', message: 'Plik DBF zawiera tylko nagłówek — brak pól' }]
      }
    }

    // Determine encoding
    const ldidEncoding = encodingFromLdid(header.ldid)
    const encoding: FileEncoding = ldidEncoding ?? 'windows-1250'

    if (!ldidEncoding) {
      warnings.push({
        level: 'warning',
        message: `Nieznany Language Driver ID (0x${header.ldid.toString(16).toUpperCase()}) — użyto fallback ${encoding}`
      })
    }

    // Parse records
    const headers = header.fields.map((f) => f.name)
    const rows: ParsedRow[] = []
    let offset = header.headerLength
    let deletedCount = 0
    let rowIndex = 0

    for (let i = 0; i < header.recordCount; i++) {
      if (offset + header.recordLength > buffer.length) {
        warnings.push({
          level: 'warning',
          message: `Plik obcięty — oczekiwano ${header.recordCount} rekordów, odczytano ${i}`
        })
        break
      }

      // Delete flag: 0x20 = valid, 0x2A (*) = deleted
      const deleteFlag = buffer[offset]
      offset += 1  // skip flag byte

      if (deleteFlag === 0x2a) {
        deletedCount++
        offset += header.recordLength - 1
        continue
      }

      const cells: string[] = []

      for (const field of header.fields) {
        const rawBytes = buffer.subarray(offset, offset + field.length)
        const rawStr = decodeBuffer(Buffer.from(rawBytes), encoding)
        offset += field.length

        switch (field.type) {
          case 'D':
            cells.push(formatDate(rawStr))
            break
          case 'L':
            cells.push(formatLogical(rawStr))
            break
          case 'N':
          case 'F':
            cells.push(rawStr.trim())
            break
          default:
            cells.push(rawStr.trim())
            break
        }
      }

      rows.push({ index: rowIndex++, cells })
    }

    if (deletedCount > 0) {
      warnings.push({
        level: 'info',
        message: `Pominięto ${deletedCount} usuniętych rekordów`
      })
    }

    const sheet: RawSheet = {
      name: filename,
      headers,
      rows,
      metadata: {
        dbfVersion: String(header.version),
        fieldCount: String(header.fields.length)
      }
    }

    return {
      sheets: [sheet],
      encoding,
      warnings
    }
  }
}
