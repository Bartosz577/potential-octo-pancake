import { describe, it, expect } from 'vitest'
import { DbfFileReader } from '../../../src/core/readers/DbfFileReader'
import { createDefaultRegistry } from '../../../src/core/readers/FileReaderRegistry'

// ── DBF binary builder helpers ──

/** Build a minimal dBASE III DBF file buffer from field definitions and records. */
function buildDbf(opts: {
  fields: Array<{ name: string; type: string; length: number; decimal?: number }>
  records: Array<string[]>
  ldid?: number
  deletedRows?: number[] // indices of records to mark as deleted
}): Buffer {
  const { fields, records, ldid = 0x00, deletedRows = [] } = opts

  // Field descriptors: 32 bytes each
  const fieldDescriptors: Buffer[] = fields.map((f) => {
    const desc = Buffer.alloc(32, 0)
    // Field name (up to 11 bytes, null-terminated)
    const nameBytes = Buffer.from(f.name, 'ascii')
    nameBytes.copy(desc, 0, 0, Math.min(nameBytes.length, 11))
    // Field type
    desc[11] = f.type.charCodeAt(0)
    // Field length
    desc[16] = f.length
    // Decimal count
    desc[17] = f.decimal ?? 0
    return desc
  })

  // Record length = 1 (delete flag) + sum of field lengths
  const recordLength = 1 + fields.reduce((sum, f) => sum + f.length, 0)

  // Header length = 32 (base) + 32 * fields + 1 (terminator)
  const headerLength = 32 + 32 * fields.length + 1

  // Build header (32 bytes)
  const header = Buffer.alloc(32, 0)
  header[0] = 0x03 // dBASE III version
  header[1] = 26   // year (2026 - 1900)
  header[2] = 1    // month
  header[3] = 15   // day
  header.writeUInt32LE(records.length, 4)
  header.writeUInt16LE(headerLength, 8)
  header.writeUInt16LE(recordLength, 10)
  header[29] = ldid // Language Driver ID

  // Terminator byte
  const terminator = Buffer.from([0x0d])

  // Build record data
  const recordBuffers: Buffer[] = records.map((rec, recIdx) => {
    const recBuf = Buffer.alloc(recordLength, 0x20) // fill with spaces
    recBuf[0] = deletedRows.includes(recIdx) ? 0x2a : 0x20 // delete flag

    let offset = 1
    for (let i = 0; i < fields.length; i++) {
      const value = rec[i] || ''
      const field = fields[i]
      const valBuf = Buffer.from(value, 'utf-8')
      valBuf.copy(recBuf, offset, 0, Math.min(valBuf.length, field.length))
      offset += field.length
    }
    return recBuf
  })

  // EOF marker
  const eof = Buffer.from([0x1a])

  return Buffer.concat([
    header,
    ...fieldDescriptors,
    terminator,
    ...recordBuffers,
    eof
  ])
}

const reader = new DbfFileReader()

// ═══════════════════════════════════════════════════════
//  canRead
// ═══════════════════════════════════════════════════════

describe('DbfFileReader — canRead', () => {
  it('returns true for .dbf with valid header', () => {
    const buf = buildDbf({
      fields: [{ name: 'NAME', type: 'C', length: 20 }],
      records: [['Test']]
    })
    expect(reader.canRead(buf, 'data.dbf')).toBe(true)
  })

  it('returns false for .txt extension', () => {
    const buf = buildDbf({
      fields: [{ name: 'NAME', type: 'C', length: 20 }],
      records: [['Test']]
    })
    expect(reader.canRead(buf, 'data.txt')).toBe(false)
  })

  it('returns false for .csv extension', () => {
    const buf = Buffer.from('a,b,c\n1,2,3')
    expect(reader.canRead(buf, 'data.csv')).toBe(false)
  })

  it('returns false for .xlsx extension', () => {
    const buf = Buffer.alloc(100)
    expect(reader.canRead(buf, 'data.xlsx')).toBe(false)
  })

  it('returns false for buffer too small', () => {
    const buf = Buffer.alloc(30)
    buf[0] = 0x03
    expect(reader.canRead(buf, 'data.dbf')).toBe(false)
  })

  it('returns false for invalid version byte', () => {
    const buf = Buffer.alloc(100)
    buf[0] = 0x00 // invalid version
    expect(reader.canRead(buf, 'data.dbf')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════
//  Field type parsing
// ═══════════════════════════════════════════════════════

describe('DbfFileReader — field types', () => {
  it('parses C (character) fields as trimmed strings', () => {
    const buf = buildDbf({
      fields: [{ name: 'NAZWA', type: 'C', length: 20 }],
      records: [['Firma ABC']]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows[0].cells[0]).toBe('Firma ABC')
  })

  it('parses N (numeric) fields as trimmed values', () => {
    const buf = buildDbf({
      fields: [{ name: 'KWOTA', type: 'N', length: 10, decimal: 2 }],
      records: [['   1234.56']]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows[0].cells[0]).toBe('1234.56')
  })

  it('parses D (date) fields as YYYY-MM-DD', () => {
    const buf = buildDbf({
      fields: [{ name: 'DATA', type: 'D', length: 8 }],
      records: [['20260115']]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows[0].cells[0]).toBe('2026-01-15')
  })

  it('parses L (logical) fields — T → true', () => {
    const buf = buildDbf({
      fields: [{ name: 'AKTYWNY', type: 'L', length: 1 }],
      records: [['T']]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows[0].cells[0]).toBe('true')
  })

  it('parses L (logical) fields — F → false', () => {
    const buf = buildDbf({
      fields: [{ name: 'AKTYWNY', type: 'L', length: 1 }],
      records: [['F']]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows[0].cells[0]).toBe('false')
  })

  it('parses L (logical) fields — space → empty', () => {
    const buf = buildDbf({
      fields: [{ name: 'AKTYWNY', type: 'L', length: 1 }],
      records: [[' ']]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows[0].cells[0]).toBe('')
  })

  it('handles empty D (date) fields gracefully', () => {
    const buf = buildDbf({
      fields: [{ name: 'DATA', type: 'D', length: 8 }],
      records: [['        ']]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows[0].cells[0]).toBe('')
  })

  it('parses F (float) fields as trimmed values', () => {
    const buf = buildDbf({
      fields: [{ name: 'CENA', type: 'F', length: 10, decimal: 4 }],
      records: [['  99.1234']]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows[0].cells[0]).toBe('99.1234')
  })
})

// ═══════════════════════════════════════════════════════
//  Deleted records
// ═══════════════════════════════════════════════════════

describe('DbfFileReader — deleted records', () => {
  it('skips records with delete flag (0x2A)', () => {
    const buf = buildDbf({
      fields: [{ name: 'ID', type: 'N', length: 5 }],
      records: [['1'], ['2'], ['3']],
      deletedRows: [1]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows).toHaveLength(2)
    expect(result.sheets[0].rows[0].cells[0]).toBe('1')
    expect(result.sheets[0].rows[1].cells[0]).toBe('3')
  })

  it('reports deleted record count in warnings', () => {
    const buf = buildDbf({
      fields: [{ name: 'ID', type: 'N', length: 5 }],
      records: [['1'], ['2'], ['3']],
      deletedRows: [0, 2]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows).toHaveLength(1)
    const delWarning = result.warnings.find((w) => w.message.includes('usuniętych'))
    expect(delWarning).toBeDefined()
    expect(delWarning!.message).toContain('2')
  })

  it('returns empty rows when all records are deleted', () => {
    const buf = buildDbf({
      fields: [{ name: 'ID', type: 'N', length: 5 }],
      records: [['1'], ['2']],
      deletedRows: [0, 1]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].rows).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════
//  Encoding
// ═══════════════════════════════════════════════════════

describe('DbfFileReader — encoding', () => {
  it('detects CP852 from LDID 0x64', () => {
    const buf = buildDbf({
      fields: [{ name: 'NAZWA', type: 'C', length: 20 }],
      records: [['Test']],
      ldid: 0x64
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.encoding).toBe('cp852')
  })

  it('detects windows-1250 from LDID 0xC8', () => {
    const buf = buildDbf({
      fields: [{ name: 'NAZWA', type: 'C', length: 20 }],
      records: [['Test']],
      ldid: 0xC8
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.encoding).toBe('windows-1250')
  })

  it('falls back to windows-1250 for unknown LDID and warns', () => {
    const buf = buildDbf({
      fields: [{ name: 'NAZWA', type: 'C', length: 20 }],
      records: [['Test']],
      ldid: 0x00
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.encoding).toBe('windows-1250')
    const ldidWarning = result.warnings.find((w) => w.message.includes('Language Driver'))
    expect(ldidWarning).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════
//  Edge cases
// ═══════════════════════════════════════════════════════

describe('DbfFileReader — edge cases', () => {
  it('returns empty sheets for buffer too small', () => {
    const buf = Buffer.alloc(30)
    const result = reader.read(buf, 'broken.dbf')
    expect(result.sheets).toHaveLength(0)
    expect(result.warnings[0].message).toContain('zbyt mały')
  })

  it('handles header-only file (0 records)', () => {
    const buf = buildDbf({
      fields: [{ name: 'ID', type: 'N', length: 5 }],
      records: []
    })
    const result = reader.read(buf, 'empty.dbf')
    expect(result.sheets[0].headers).toEqual(['ID'])
    expect(result.sheets[0].rows).toHaveLength(0)
  })

  it('extracts headers from field names', () => {
    const buf = buildDbf({
      fields: [
        { name: 'NR_FAKT', type: 'C', length: 20 },
        { name: 'DATA', type: 'D', length: 8 },
        { name: 'KWOTA', type: 'N', length: 10, decimal: 2 }
      ],
      records: [['FV/001', '20260110', '  1000.00']]
    })
    const result = reader.read(buf, 'fakt.dbf')
    expect(result.sheets[0].headers).toEqual(['NR_FAKT', 'DATA', 'KWOTA'])
  })

  it('stores dbfVersion and fieldCount in metadata', () => {
    const buf = buildDbf({
      fields: [{ name: 'A', type: 'C', length: 5 }, { name: 'B', type: 'N', length: 5 }],
      records: [['x', '1']]
    })
    const result = reader.read(buf, 'test.dbf')
    expect(result.sheets[0].metadata.dbfVersion).toBe('3')
    expect(result.sheets[0].metadata.fieldCount).toBe('2')
  })

  it('parses multi-row multi-field invoice-like DBF', () => {
    const buf = buildDbf({
      fields: [
        { name: 'NR_FAKT', type: 'C', length: 20 },
        { name: 'DATA', type: 'D', length: 8 },
        { name: 'NIP', type: 'C', length: 10 },
        { name: 'NETTO', type: 'N', length: 10, decimal: 2 },
        { name: 'VAT', type: 'N', length: 10, decimal: 2 },
        { name: 'AKTYWNA', type: 'L', length: 1 }
      ],
      records: [
        ['FV/2026/001', '20260110', '5213456789', '  1000.00', '   230.00', 'T'],
        ['FV/2026/002', '20260115', '7891234560', '   500.00', '   115.00', 'T'],
        ['FV/2026/003', '20260120', '1234567890', '  2500.00', '   575.00', 'F']
      ]
    })
    const result = reader.read(buf, 'faktury.dbf')
    const sheet = result.sheets[0]

    expect(sheet.headers).toEqual(['NR_FAKT', 'DATA', 'NIP', 'NETTO', 'VAT', 'AKTYWNA'])
    expect(sheet.rows).toHaveLength(3)

    expect(sheet.rows[0].cells).toEqual(['FV/2026/001', '2026-01-10', '5213456789', '1000.00', '230.00', 'true'])
    expect(sheet.rows[1].cells).toEqual(['FV/2026/002', '2026-01-15', '7891234560', '500.00', '115.00', 'true'])
    expect(sheet.rows[2].cells).toEqual(['FV/2026/003', '2026-01-20', '1234567890', '2500.00', '575.00', 'false'])
  })
})

// ═══════════════════════════════════════════════════════
//  Registry integration
// ═══════════════════════════════════════════════════════

describe('DbfFileReader — registry', () => {
  it('is registered in default registry', () => {
    const registry = createDefaultRegistry()
    expect(registry.getSupportedExtensions()).toContain('dbf')
  })

  it('is found by findReader for .dbf files', () => {
    const registry = createDefaultRegistry()
    const buf = buildDbf({
      fields: [{ name: 'ID', type: 'N', length: 5 }],
      records: [['1']]
    })
    const found = registry.findReader(buf, 'test.dbf')
    expect(found).not.toBeNull()
    expect(found!.name).toBe('DbfFileReader')
  })

  it('reads via registry.read()', () => {
    const registry = createDefaultRegistry()
    const buf = buildDbf({
      fields: [{ name: 'NAZWA', type: 'C', length: 20 }],
      records: [['Hello']]
    })
    const result = registry.read(buf, 'test.dbf')
    expect(result.sheets[0].rows[0].cells[0]).toBe('Hello')
  })
})
