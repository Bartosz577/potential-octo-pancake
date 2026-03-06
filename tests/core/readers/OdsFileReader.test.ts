import { describe, it, expect } from 'vitest'
import AdmZip from 'adm-zip'
import { OdsFileReader } from '../../../src/core/readers/OdsFileReader'
import { createDefaultRegistry } from '../../../src/core/readers/FileReaderRegistry'

// ── ODS builder helper ──

/** Build a minimal ODS file (ZIP with content.xml) from XML body content */
function buildOds(spreadsheetContent: string): Buffer {
  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  office:version="1.2">
  <office:body>
    <office:spreadsheet>
      ${spreadsheetContent}
    </office:spreadsheet>
  </office:body>
</office:document-content>`

  const zip = new AdmZip()
  zip.addFile('content.xml', Buffer.from(contentXml, 'utf-8'))
  zip.addFile('mimetype', Buffer.from('application/vnd.oasis.opendocument.spreadsheet', 'utf-8'))
  return zip.toBuffer()
}

/** Build a table XML element */
function buildTable(name: string, rows: string[]): string {
  return `<table:table table:name="${name}">${rows.join('\n')}</table:table>`
}

/** Build a row with string cells */
function buildStringRow(values: string[]): string {
  const cells = values.map((v) =>
    `<table:table-cell office:value-type="string"><text:p>${v}</text:p></table:table-cell>`
  ).join('')
  return `<table:table-row>${cells}</table:table-row>`
}

/** Build a row with typed cells */
function buildTypedRow(cells: Array<{ type: string; value: string; display?: string }>): string {
  const cellXml = cells.map((c) => {
    switch (c.type) {
      case 'float':
        return `<table:table-cell office:value-type="float" office:value="${c.value}"><text:p>${c.display || c.value}</text:p></table:table-cell>`
      case 'date':
        return `<table:table-cell office:value-type="date" office:date-value="${c.value}"><text:p>${c.display || c.value}</text:p></table:table-cell>`
      case 'boolean':
        return `<table:table-cell office:value-type="boolean" office:boolean-value="${c.value}"><text:p>${c.display || c.value}</text:p></table:table-cell>`
      default:
        return `<table:table-cell office:value-type="string"><text:p>${c.value}</text:p></table:table-cell>`
    }
  }).join('')
  return `<table:table-row>${cellXml}</table:table-row>`
}

const reader = new OdsFileReader()

// ═══════════════════════════════════════════════════════
//  canRead
// ═══════════════════════════════════════════════════════

describe('OdsFileReader — canRead', () => {
  it('returns true for .ods with ZIP magic', () => {
    const buf = buildOds(buildTable('Sheet1', [buildStringRow(['a'])]))
    expect(reader.canRead(buf, 'data.ods')).toBe(true)
  })

  it('returns false for .xlsx extension', () => {
    const buf = buildOds(buildTable('Sheet1', [buildStringRow(['a'])]))
    expect(reader.canRead(buf, 'data.xlsx')).toBe(false)
  })

  it('returns false for .csv extension', () => {
    const buf = Buffer.from('a,b,c\n1,2,3')
    expect(reader.canRead(buf, 'data.csv')).toBe(false)
  })

  it('returns false for non-ZIP buffer', () => {
    const buf = Buffer.from('not a zip file at all')
    expect(reader.canRead(buf, 'data.ods')).toBe(false)
  })

  it('returns false for buffer too small', () => {
    const buf = Buffer.alloc(2)
    expect(reader.canRead(buf, 'data.ods')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════
//  String parsing
// ═══════════════════════════════════════════════════════

describe('OdsFileReader — string values', () => {
  it('parses a simple sheet with headers and data', () => {
    const buf = buildOds(buildTable('Faktury', [
      buildStringRow(['Nr', 'Nazwa', 'Kwota']),
      buildStringRow(['FV/001', 'Firma ABC', '1000.00']),
      buildStringRow(['FV/002', 'Firma XYZ', '2500.00'])
    ]))
    const result = reader.read(buf, 'test.ods')

    expect(result.sheets).toHaveLength(1)
    expect(result.sheets[0].name).toBe('Faktury')
    expect(result.sheets[0].headers).toEqual(['Nr', 'Nazwa', 'Kwota'])
    expect(result.sheets[0].rows).toHaveLength(2)
    expect(result.sheets[0].rows[0].cells).toEqual(['FV/001', 'Firma ABC', '1000.00'])
    expect(result.sheets[0].rows[1].cells).toEqual(['FV/002', 'Firma XYZ', '2500.00'])
  })

  it('uses first row as headers', () => {
    const buf = buildOds(buildTable('T', [
      buildStringRow(['Col1', 'Col2']),
      buildStringRow(['val1', 'val2'])
    ]))
    const result = reader.read(buf, 'test.ods')
    expect(result.sheets[0].headers).toEqual(['Col1', 'Col2'])
    expect(result.sheets[0].rows[0].cells).toEqual(['val1', 'val2'])
  })
})

// ═══════════════════════════════════════════════════════
//  Typed values (float, date, boolean)
// ═══════════════════════════════════════════════════════

describe('OdsFileReader — typed values', () => {
  it('parses float values from office:value attribute', () => {
    const buf = buildOds(buildTable('T', [
      buildStringRow(['Kwota']),
      buildTypedRow([{ type: 'float', value: '1234.56' }])
    ]))
    const result = reader.read(buf, 'test.ods')
    expect(result.sheets[0].rows[0].cells[0]).toBe('1234.56')
  })

  it('parses date values from office:date-value attribute', () => {
    const buf = buildOds(buildTable('T', [
      buildStringRow(['Data']),
      buildTypedRow([{ type: 'date', value: '2026-01-15' }])
    ]))
    const result = reader.read(buf, 'test.ods')
    expect(result.sheets[0].rows[0].cells[0]).toBe('2026-01-15')
  })

  it('parses boolean values from office:boolean-value attribute', () => {
    const buf = buildOds(buildTable('T', [
      buildStringRow(['Aktywny']),
      buildTypedRow([{ type: 'boolean', value: 'true' }])
    ]))
    const result = reader.read(buf, 'test.ods')
    expect(result.sheets[0].rows[0].cells[0]).toBe('true')
  })

  it('parses mixed typed row', () => {
    const buf = buildOds(buildTable('T', [
      buildStringRow(['Nazwa', 'Kwota', 'Data', 'Aktywny']),
      buildTypedRow([
        { type: 'string', value: 'Firma' },
        { type: 'float', value: '999.99' },
        { type: 'date', value: '2026-03-01' },
        { type: 'boolean', value: 'false' }
      ])
    ]))
    const result = reader.read(buf, 'test.ods')
    expect(result.sheets[0].rows[0].cells).toEqual(['Firma', '999.99', '2026-03-01', 'false'])
  })
})

// ═══════════════════════════════════════════════════════
//  number-columns-repeated
// ═══════════════════════════════════════════════════════

describe('OdsFileReader — number-columns-repeated', () => {
  it('expands repeated cells', () => {
    const rowXml = `<table:table-row>
      <table:table-cell office:value-type="string"><text:p>A</text:p></table:table-cell>
      <table:table-cell table:number-columns-repeated="3" office:value-type="string"><text:p>X</text:p></table:table-cell>
      <table:table-cell office:value-type="string"><text:p>B</text:p></table:table-cell>
    </table:table-row>`
    const buf = buildOds(buildTable('T', [
      buildStringRow(['C1', 'C2', 'C3', 'C4', 'C5']),
      rowXml
    ]))
    const result = reader.read(buf, 'test.ods')
    expect(result.sheets[0].rows[0].cells).toEqual(['A', 'X', 'X', 'X', 'B'])
  })

  it('handles repeated empty cells (padding between values)', () => {
    const rowXml = `<table:table-row>
      <table:table-cell office:value-type="string"><text:p>Start</text:p></table:table-cell>
      <table:table-cell table:number-columns-repeated="2"/>
      <table:table-cell office:value-type="string"><text:p>End</text:p></table:table-cell>
    </table:table-row>`
    const buf = buildOds(buildTable('T', [
      buildStringRow(['A', 'B', 'C', 'D']),
      rowXml
    ]))
    const result = reader.read(buf, 'test.ods')
    expect(result.sheets[0].rows[0].cells).toEqual(['Start', '', '', 'End'])
  })

  it('trims trailing repeated empty cells', () => {
    const rowXml = `<table:table-row>
      <table:table-cell office:value-type="string"><text:p>Val</text:p></table:table-cell>
      <table:table-cell table:number-columns-repeated="256"/>
    </table:table-row>`
    const buf = buildOds(buildTable('T', [
      buildStringRow(['Col1']),
      rowXml
    ]))
    const result = reader.read(buf, 'test.ods')
    // Trailing empties should be trimmed
    expect(result.sheets[0].rows[0].cells).toEqual(['Val'])
  })
})

// ═══════════════════════════════════════════════════════
//  Multiple sheets
// ═══════════════════════════════════════════════════════

describe('OdsFileReader — multiple sheets', () => {
  it('returns multiple RawSheet objects', () => {
    const t1 = buildTable('Sprzedaz', [
      buildStringRow(['Nr', 'Kwota']),
      buildStringRow(['FV/001', '1000'])
    ])
    const t2 = buildTable('Zakupy', [
      buildStringRow(['Nr', 'Kwota']),
      buildStringRow(['FZ/001', '500'])
    ])
    const buf = buildOds(t1 + t2)
    const result = reader.read(buf, 'test.ods')

    expect(result.sheets).toHaveLength(2)
    expect(result.sheets[0].name).toBe('Sprzedaz')
    expect(result.sheets[1].name).toBe('Zakupy')
  })

  it('skips empty sheets', () => {
    const t1 = buildTable('Dane', [
      buildStringRow(['A']),
      buildStringRow(['val'])
    ])
    const t2 = buildTable('Pusty', []) // empty sheet
    const buf = buildOds(t1 + t2)
    const result = reader.read(buf, 'test.ods')

    expect(result.sheets).toHaveLength(1)
    expect(result.sheets[0].name).toBe('Dane')
  })
})

// ═══════════════════════════════════════════════════════
//  Edge cases
// ═══════════════════════════════════════════════════════

describe('OdsFileReader — edge cases', () => {
  it('returns warning for ZIP without content.xml', () => {
    const zip = new AdmZip()
    zip.addFile('other.xml', Buffer.from('<root/>'))
    const buf = zip.toBuffer()
    const result = reader.read(buf, 'broken.ods')
    expect(result.sheets).toHaveLength(0)
    expect(result.warnings[0].message).toContain('content.xml')
  })

  it('returns warning for invalid ZIP data', () => {
    const buf = Buffer.from('PK\x03\x04garbage data that is not a valid zip')
    const result = reader.read(buf, 'broken.ods')
    expect(result.sheets).toHaveLength(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('returns encoding as utf-8', () => {
    const buf = buildOds(buildTable('T', [buildStringRow(['a'])]))
    const result = reader.read(buf, 'test.ods')
    expect(result.encoding).toBe('utf-8')
  })

  it('handles sheet with only headers (no data rows)', () => {
    const buf = buildOds(buildTable('T', [
      buildStringRow(['A', 'B', 'C'])
    ]))
    const result = reader.read(buf, 'test.ods')
    expect(result.sheets).toHaveLength(1)
    expect(result.sheets[0].headers).toEqual(['A', 'B', 'C'])
    expect(result.sheets[0].rows).toHaveLength(0)
  })

  it('handles cells without value-type (empty cells)', () => {
    const rowXml = `<table:table-row>
      <table:table-cell/>
      <table:table-cell office:value-type="string"><text:p>data</text:p></table:table-cell>
    </table:table-row>`
    const buf = buildOds(buildTable('T', [
      buildStringRow(['A', 'B']),
      rowXml
    ]))
    const result = reader.read(buf, 'test.ods')
    expect(result.sheets[0].rows[0].cells).toEqual(['', 'data'])
  })
})

// ═══════════════════════════════════════════════════════
//  Registry integration
// ═══════════════════════════════════════════════════════

describe('OdsFileReader — registry', () => {
  it('is registered in default registry', () => {
    const registry = createDefaultRegistry()
    expect(registry.getSupportedExtensions()).toContain('ods')
  })

  it('is found by findReader for .ods files', () => {
    const registry = createDefaultRegistry()
    const buf = buildOds(buildTable('T', [buildStringRow(['a'])]))
    const found = registry.findReader(buf, 'test.ods')
    expect(found).not.toBeNull()
    expect(found!.name).toBe('OdsFileReader')
  })

  it('reads via registry.read()', () => {
    const registry = createDefaultRegistry()
    const buf = buildOds(buildTable('T', [
      buildStringRow(['Name']),
      buildStringRow(['Hello'])
    ]))
    const result = registry.read(buf, 'test.ods')
    expect(result.sheets[0].rows[0].cells[0]).toBe('Hello')
  })
})
