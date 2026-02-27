import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as iconv from 'iconv-lite'
import { TxtFileReader, detectSeparator } from '../../../src/core/readers/TxtFileReader'

const TEST_DATA_DIR = join(__dirname, '..', '..', '..', 'test-data')

const NAMOS_VDEK_FILE = '0P549_NAMOS_JPK_VDEK_SprzedazWiersz_2026-01-01_2026-01-31_20260207020039.txt'
const NAMOS_FA_FILE = '0P549_NAMOS_JPK_FA_Faktura_2026-01-01_2026-01-31_20260207020039.txt'
const ESO_MAG_FILE = '0P549_ESO_JPK_MAG_WZ_2026-01-31_2026-01-31_20260202043950.txt'

describe('detectSeparator', () => {
  it('detects pipe separator', () => {
    const lines = ['a|b|c|d', 'e|f|g|h', 'i|j|k|l']
    const result = detectSeparator(lines)
    expect(result.separator).toBe('|')
    expect(result.confidence).toBe(1.0)
  })

  it('detects semicolon separator', () => {
    const lines = ['a;b;c', 'd;e;f', 'g;h;i']
    const result = detectSeparator(lines)
    expect(result.separator).toBe(';')
    expect(result.confidence).toBe(1.0)
  })

  it('detects tab separator', () => {
    const lines = ['a\tb\tc\td', 'e\tf\tg\th']
    const result = detectSeparator(lines)
    expect(result.separator).toBe('\t')
    expect(result.confidence).toBe(1.0)
  })

  it('detects comma separator', () => {
    const lines = ['a,b,c', 'd,e,f']
    const result = detectSeparator(lines)
    expect(result.separator).toBe(',')
    expect(result.confidence).toBe(1.0)
  })

  it('prefers pipe over comma when both present but pipe gives more columns', () => {
    // "a|b,c|d" — pipe gives 3 cols, comma gives 2
    const lines = ['a|b,c|d', 'e|f,g|h']
    const result = detectSeparator(lines)
    expect(result.separator).toBe('|')
  })

  it('handles single-line input', () => {
    const lines = ['a|b|c']
    const result = detectSeparator(lines)
    expect(result.separator).toBe('|')
    expect(result.confidence).toBe(1.0)
  })

  it('handles inconsistent column counts with low confidence', () => {
    const lines = ['a|b|c', 'a|b', 'a|b|c|d']
    const result = detectSeparator(lines)
    expect(result.separator).toBe('|')
    // Only 1 of 3 lines matches the max count of 4
    expect(result.confidence).toBeLessThan(0.5)
  })
})

describe('TxtFileReader', () => {
  let reader: TxtFileReader

  beforeAll(() => {
    reader = new TxtFileReader()
  })

  describe('canRead', () => {
    it('accepts .txt files', () => {
      const buf = Buffer.from('hello|world')
      expect(reader.canRead(buf, 'data.txt')).toBe(true)
    })

    it('accepts .csv files', () => {
      const buf = Buffer.from('a,b,c')
      expect(reader.canRead(buf, 'data.csv')).toBe(true)
    })

    it('accepts .tsv files', () => {
      const buf = Buffer.from('a\tb\tc')
      expect(reader.canRead(buf, 'data.tsv')).toBe(true)
    })

    it('rejects .xlsx files', () => {
      const buf = Buffer.from('PK\x03\x04')
      expect(reader.canRead(buf, 'data.xlsx')).toBe(false)
    })

    it('rejects binary files with null bytes', () => {
      const buf = Buffer.from([0x50, 0x4b, 0x00, 0x04])
      expect(reader.canRead(buf, 'data.txt')).toBe(false)
    })
  })

  describe('read — synthetic data', () => {
    it('parses simple pipe-separated text', () => {
      const text = 'a|b|c\nd|e|f\ng|h|i'
      const buf = Buffer.from(text, 'utf-8')
      const result = reader.read(buf, 'simple.txt')

      expect(result.sheets).toHaveLength(1)
      expect(result.separator).toBe('|')
      expect(result.encoding).toBe('utf-8')

      const sheet = result.sheets[0]
      expect(sheet.rows).toHaveLength(3)
      expect(sheet.rows[0].cells).toEqual(['a', 'b', 'c'])
      expect(sheet.rows[2].cells).toEqual(['g', 'h', 'i'])
    })

    it('parses NAMOS-style metadata prefix', () => {
      const lines = [
        '0P549|NAMOS|JPK_VDEK|SprzedazWiersz|2026-01-01|2026-01-31|1|PL|1234567890|Firma ABC|FV/001|2026-01-15',
        '0P549|NAMOS|JPK_VDEK|SprzedazWiersz|2026-01-01|2026-01-31|2|PL|9876543210|Firma XYZ|FV/002|2026-01-16'
      ]
      const buf = Buffer.from(lines.join('\n'), 'utf-8')
      const result = reader.read(buf, 'namos.txt')

      const sheet = result.sheets[0]
      expect(sheet.metadata.system).toBe('NAMOS')
      expect(sheet.metadata.jpkType).toBe('JPK_VDEK')
      expect(sheet.metadata.subType).toBe('SprzedazWiersz')
      expect(sheet.metadata.dateFrom).toBe('2026-01-01')
      expect(sheet.metadata.dateTo).toBe('2026-01-31')

      // Data columns should exclude the 6 metadata columns
      expect(sheet.rows[0].cells[0]).toBe('1')     // LpSprzedazy
      expect(sheet.rows[0].cells[1]).toBe('PL')    // KodKontrahenta
      expect(sheet.rows[0].cells[2]).toBe('1234567890')
    })

    it('handles empty file', () => {
      const buf = Buffer.from('', 'utf-8')
      const result = reader.read(buf, 'empty.txt')
      expect(result.sheets).toHaveLength(0)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain('pusty')
    })

    it('handles windows line endings (CRLF)', () => {
      const text = 'a|b|c\r\nd|e|f\r\n'
      const buf = Buffer.from(text, 'utf-8')
      const result = reader.read(buf, 'crlf.txt')
      expect(result.sheets[0].rows).toHaveLength(2)
    })

    it('skips blank lines', () => {
      const text = 'a|b|c\n\n\nd|e|f\n\n'
      const buf = Buffer.from(text, 'utf-8')
      const result = reader.read(buf, 'blanks.txt')
      expect(result.sheets[0].rows).toHaveLength(2)
    })

    it('warns about inconsistent column count', () => {
      const text = 'a|b|c\nd|e\nf|g|h'
      const buf = Buffer.from(text, 'utf-8')
      const result = reader.read(buf, 'inconsistent.txt')
      expect(result.warnings.some((w) => w.message.includes('kolumn'))).toBe(true)
      expect(result.warnings.find((w) => w.row === 1)).toBeDefined()
    })

    it('parses windows-1250 encoded text', () => {
      const text = '0P549|ESO|JPK_MAG|WZ|2026-01-31|2026-01-31|Kraków|Łódź|Świętokrzyskie'
      const buf = iconv.encode(text, 'windows-1250')
      const result = reader.read(buf, 'win1250.txt')

      expect(result.encoding).toBe('windows-1250')
      const cells = result.sheets[0].rows[0].cells
      expect(cells).toContain('Kraków')
      expect(cells).toContain('Łódź')
      expect(cells).toContain('Świętokrzyskie')
    })

    it('preserves row indices', () => {
      const text = 'a|b\nc|d\ne|f'
      const buf = Buffer.from(text, 'utf-8')
      const result = reader.read(buf, 'indexed.txt')
      const rows = result.sheets[0].rows
      expect(rows[0].index).toBe(0)
      expect(rows[1].index).toBe(1)
      expect(rows[2].index).toBe(2)
    })
  })

  describe('read — real NAMOS VDEK file', () => {
    let buffer: Buffer

    beforeAll(() => {
      buffer = readFileSync(join(TEST_DATA_DIR, NAMOS_VDEK_FILE))
    })

    it('reads without errors', () => {
      const result = reader.read(buffer, NAMOS_VDEK_FILE)
      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows.length).toBeGreaterThan(0)
    })

    it('detects pipe separator', () => {
      const result = reader.read(buffer, NAMOS_VDEK_FILE)
      expect(result.separator).toBe('|')
    })

    it('extracts NAMOS metadata', () => {
      const result = reader.read(buffer, NAMOS_VDEK_FILE)
      const meta = result.sheets[0].metadata
      expect(meta.system).toBe('NAMOS')
      expect(meta.jpkType).toBe('JPK_VDEK')
      expect(meta.subType).toBe('SprzedazWiersz')
      expect(meta.pointCode).toBe('0P549')
      expect(meta.dateFrom).toBe('2026-01-01')
      expect(meta.dateTo).toBe('2026-01-31')
    })

    it('parses all 1107 rows', () => {
      const result = reader.read(buffer, NAMOS_VDEK_FILE)
      expect(result.sheets[0].rows).toHaveLength(1107)
    })

    it('strips metadata columns from data cells', () => {
      const result = reader.read(buffer, NAMOS_VDEK_FILE)
      const firstRow = result.sheets[0].rows[0]
      // First data column should be LpSprzedazy = "1"
      expect(firstRow.cells[0]).toBe('1')
      // Should NOT contain point code in data cells
      expect(firstRow.cells).not.toContain('0P549')
    })

    it('handles Polish characters correctly', () => {
      const result = reader.read(buffer, NAMOS_VDEK_FILE)
      // Find a row with Polish characters in company name
      const text = result.sheets[0].rows.map((r) => r.cells.join('|')).join('\n')
      // The file contains names like "DĄBROWSKI", "SPÓŁKA"
      expect(text).toMatch(/[ĄĆĘŁŃÓŚŹŻ]/i)
    })

    it('data cells contain decimal values with comma separator', () => {
      const result = reader.read(buffer, NAMOS_VDEK_FILE)
      const firstRow = result.sheets[0].rows[0]
      // K_ value columns should have decimal values like "102,95"
      const decimalValues = firstRow.cells.filter((c) => /^\d+,\d+$/.test(c))
      expect(decimalValues.length).toBeGreaterThan(0)
    })
  })

  describe('read — real NAMOS FA file', () => {
    let buffer: Buffer

    beforeAll(() => {
      buffer = readFileSync(join(TEST_DATA_DIR, NAMOS_FA_FILE))
    })

    it('reads without errors', () => {
      const result = reader.read(buffer, NAMOS_FA_FILE)
      expect(result.sheets).toHaveLength(1)
    })

    it('extracts JPK_FA metadata', () => {
      const result = reader.read(buffer, NAMOS_FA_FILE)
      const meta = result.sheets[0].metadata
      expect(meta.system).toBe('NAMOS')
      expect(meta.jpkType).toBe('JPK_FA')
      expect(meta.subType).toBe('Faktura')
    })

    it('parses all 1107 rows', () => {
      const result = reader.read(buffer, NAMOS_FA_FILE)
      expect(result.sheets[0].rows).toHaveLength(1107)
    })

    it('first data column is currency code (PLN)', () => {
      const result = reader.read(buffer, NAMOS_FA_FILE)
      const firstRow = result.sheets[0].rows[0]
      expect(firstRow.cells[0]).toBe('PLN')
    })

    it('contains invoice numbers', () => {
      const result = reader.read(buffer, NAMOS_FA_FILE)
      const firstRow = result.sheets[0].rows[0]
      // P_2 invoice number like "I26549D03000001"
      const invoiceCol = firstRow.cells[2]
      expect(invoiceCol).toMatch(/^I\d+D\d+$/)
    })
  })

  describe('read — real ESO MAG file', () => {
    let buffer: Buffer

    beforeAll(() => {
      buffer = readFileSync(join(TEST_DATA_DIR, ESO_MAG_FILE))
    })

    it('reads without errors', () => {
      const result = reader.read(buffer, ESO_MAG_FILE)
      expect(result.sheets).toHaveLength(1)
    })

    it('detects ESO system', () => {
      const result = reader.read(buffer, ESO_MAG_FILE)
      const meta = result.sheets[0].metadata
      expect(meta.system).toBe('ESO')
      expect(meta.jpkType).toBe('JPK_MAG')
      expect(meta.subType).toBe('WZ')
    })

    it('parses all 171 rows', () => {
      const result = reader.read(buffer, ESO_MAG_FILE)
      expect(result.sheets[0].rows).toHaveLength(171)
    })

    it('data cells contain product codes and quantities', () => {
      const result = reader.read(buffer, ESO_MAG_FILE)
      const firstRow = result.sheets[0].rows[0]
      // ESO MAG WZ structure after metadata:
      // pointCode, docNumber, date, value, date2, pointCode, ...
      // Product code like "1004115", name like "CREMA 1000G/1000"
      const cells = firstRow.cells
      const hasProductCode = cells.some((c) => /^\d{6,}$/.test(c))
      expect(hasProductCode).toBe(true)
    })

    it('decimal values use comma separator', () => {
      const result = reader.read(buffer, ESO_MAG_FILE)
      const firstRow = result.sheets[0].rows[0]
      // Values like "80,000000", "0,06", "5,14"
      const commaDecimals = firstRow.cells.filter((c) => /^\d+,\d+$/.test(c))
      expect(commaDecimals.length).toBeGreaterThan(0)
    })
  })
})
