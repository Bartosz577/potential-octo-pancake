import { describe, it, expect, beforeAll } from 'vitest'
import * as XLSX from 'xlsx'
import { XlsxFileReader, excelDateToString } from '../../../src/core/readers/XlsxFileReader'

/**
 * Helper: create an in-memory XLSX buffer from sheet data.
 */
function createXlsxBuffer(
  sheets: { name: string; data: unknown[][]; dateColumns?: number[] }[]
): Buffer {
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data)

    // Mark date columns with date format
    if (sheet.dateColumns) {
      const range = XLSX.utils.decode_range(ws['!ref']!)
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (const c of sheet.dateColumns) {
          const cellRef = XLSX.utils.encode_cell({ r, c })
          const cell = ws[cellRef]
          if (cell && typeof cell.v === 'number') {
            cell.z = 'yyyy-mm-dd'
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, ws, sheet.name)
  }

  const xlsxData = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(xlsxData)
}

describe('excelDateToString', () => {
  it('converts serial 1 to 1900-01-01', () => {
    expect(excelDateToString(1)).toBe('1900-01-01')
  })

  it('converts serial 44927 to 2023-01-01', () => {
    // 2023-01-01 = serial 44927
    expect(excelDateToString(44927)).toBe('2023-01-01')
  })

  it('converts serial 46054 to 2026-02-01', () => {
    // 2026-02-01 = serial 46054
    expect(excelDateToString(46054)).toBe('2026-02-01')
  })

  it('returns empty string for serial < 1', () => {
    expect(excelDateToString(0)).toBe('')
    expect(excelDateToString(-1)).toBe('')
  })

  it('handles the Lotus 1-2-3 bug (serial 60)', () => {
    // Serial 59 = 1900-02-28 (correct)
    // Serial 60 = phantom Feb 29 1900 (Lotus bug) — after adjustment → 1900-02-28 (duplicate, acceptable)
    // Serial 61 = 1900-03-01 (correct)
    expect(excelDateToString(61)).toBe('1900-03-01')
  })
})

describe('XlsxFileReader', () => {
  let reader: XlsxFileReader

  beforeAll(() => {
    reader = new XlsxFileReader()
  })

  describe('canRead', () => {
    it('accepts .xlsx files with ZIP signature', () => {
      const buf = createXlsxBuffer([{ name: 'Sheet1', data: [['a']] }])
      expect(reader.canRead(buf, 'data.xlsx')).toBe(true)
    })

    it('rejects .xlsx files without ZIP signature', () => {
      const buf = Buffer.from('not a zip file')
      expect(reader.canRead(buf, 'data.xlsx')).toBe(false)
    })

    it('rejects .csv files', () => {
      const buf = Buffer.from('a,b,c')
      expect(reader.canRead(buf, 'data.csv')).toBe(false)
    })

    it('rejects .txt files', () => {
      const buf = Buffer.from('hello')
      expect(reader.canRead(buf, 'data.txt')).toBe(false)
    })
  })

  describe('read — single sheet', () => {
    it('reads a simple single-sheet workbook', () => {
      const buf = createXlsxBuffer([
        { name: 'Dane', data: [['Nazwa', 'Wartość'], ['A', '100'], ['B', '200']] }
      ])
      const result = reader.read(buf, 'simple.xlsx')

      expect(result.sheets).toHaveLength(1)
      expect(result.encoding).toBe('utf-8')

      const sheet = result.sheets[0]
      expect(sheet.name).toBe('Dane')
      expect(sheet.headers).toEqual(['Nazwa', 'Wartość'])
      expect(sheet.rows).toHaveLength(2)
      expect(sheet.rows[0].cells).toEqual(['A', '100'])
      expect(sheet.rows[1].cells).toEqual(['B', '200'])
    })

    it('handles numeric-only data without headers', () => {
      const buf = createXlsxBuffer([
        { name: 'Numbers', data: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }
      ])
      const result = reader.read(buf, 'numbers.xlsx')

      const sheet = result.sheets[0]
      expect(sheet.headers).toBeUndefined()
      expect(sheet.rows).toHaveLength(3)
      expect(sheet.rows[0].cells).toEqual(['1', '2', '3'])
    })

    it('handles empty cells', () => {
      const buf = createXlsxBuffer([
        { name: 'Sparse', data: [['A', '', 'C'], ['', 'B', '']] }
      ])
      const result = reader.read(buf, 'sparse.xlsx')

      const sheet = result.sheets[0]
      expect(sheet.rows[0].cells[1]).toBe('')
      expect(sheet.rows[1].cells[0]).toBe('')
      expect(sheet.rows[1].cells[2]).toBe('')
    })
  })

  describe('read — multiple sheets', () => {
    it('reads all sheets from a workbook', () => {
      const buf = createXlsxBuffer([
        { name: 'Sprzedaż', data: [['Numer', 'Kwota'], ['FV/001', '100']] },
        { name: 'Zakupy', data: [['Numer', 'Kwota'], ['FZ/001', '50']] },
        { name: 'Podsumowanie', data: [['Typ', 'Suma'], ['Sprzedaż', '100'], ['Zakupy', '50']] }
      ])
      const result = reader.read(buf, 'multi.xlsx')

      expect(result.sheets).toHaveLength(3)
      expect(result.sheets[0].name).toBe('Sprzedaż')
      expect(result.sheets[1].name).toBe('Zakupy')
      expect(result.sheets[2].name).toBe('Podsumowanie')
    })

    it('each sheet has independent rows and headers', () => {
      const buf = createXlsxBuffer([
        { name: 'Sheet1', data: [['A', 'B'], ['1', '2']] },
        { name: 'Sheet2', data: [['X', 'Y', 'Z'], ['10', '20', '30']] }
      ])
      const result = reader.read(buf, 'independent.xlsx')

      expect(result.sheets[0].headers).toEqual(['A', 'B'])
      expect(result.sheets[0].rows[0].cells).toHaveLength(2)
      expect(result.sheets[1].headers).toEqual(['X', 'Y', 'Z'])
      expect(result.sheets[1].rows[0].cells).toHaveLength(3)
    })

    it('skips empty sheets with info warning', () => {
      const wb = XLSX.utils.book_new()
      const ws1 = XLSX.utils.aoa_to_sheet([['data', 'here'], ['1', '2']])
      XLSX.utils.book_append_sheet(wb, ws1, 'HasData')
      // Add a genuinely empty sheet
      const ws2 = XLSX.utils.aoa_to_sheet([])
      XLSX.utils.book_append_sheet(wb, ws2, 'Empty')

      const xlsxData = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      const buf = Buffer.from(xlsxData)

      const result = reader.read(buf, 'mixed.xlsx')
      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].name).toBe('HasData')
      expect(result.warnings.some((w) => w.message.includes('Empty'))).toBe(true)
    })
  })

  describe('read — date handling', () => {
    it('converts Excel date serials to YYYY-MM-DD when format is date', () => {
      // 46054 = 2026-02-01
      const buf = createXlsxBuffer([
        { name: 'Dates', data: [['Date', 'Value'], [46054, 100]], dateColumns: [0] }
      ])
      const result = reader.read(buf, 'dates.xlsx')

      const sheet = result.sheets[0]
      expect(sheet.rows[0].cells[0]).toBe('2026-02-01')
    })

    it('preserves non-date numbers as-is', () => {
      const buf = createXlsxBuffer([
        { name: 'Mixed', data: [['Amount', 'Count'], [1234.56, 42]] }
      ])
      const result = reader.read(buf, 'mixed.xlsx')

      const sheet = result.sheets[0]
      // Without date format, numbers stay as formatted values
      expect(sheet.rows[0].cells[1]).toBe('42')
    })
  })

  describe('read — edge cases', () => {
    it('handles corrupted file gracefully', () => {
      const buf = Buffer.from('PK\x03\x04not-a-real-xlsx-file')
      const result = reader.read(buf, 'corrupt.xlsx')
      expect(result.warnings.some((w) => w.message.includes('Błąd'))).toBe(true)
    })

    it('handles corrupted xlsx content gracefully', () => {
      // A file that starts with PK but isn't a valid XLSX
      const buf = Buffer.from('PK\x03\x04\x00\x00\x00\x00not-real-xlsx-data-at-all')
      const result = reader.read(buf, 'empty.xlsx')
      expect(result.warnings.some((w) => w.message.includes('Błąd'))).toBe(true)
    })

    it('preserves row indices starting from 0', () => {
      const buf = createXlsxBuffer([
        { name: 'S', data: [['H1', 'H2'], ['a', 'b'], ['c', 'd'], ['e', 'f']] }
      ])
      const result = reader.read(buf, 'indexed.xlsx')
      const rows = result.sheets[0].rows
      expect(rows[0].index).toBe(0)
      expect(rows[1].index).toBe(1)
      expect(rows[2].index).toBe(2)
    })

    it('handles Polish characters in cell values', () => {
      const buf = createXlsxBuffer([
        { name: 'PL', data: [['Nazwa'], ['Łódź'], ['Świętokrzyskie'], ['Zielińscy']] }
      ])
      const result = reader.read(buf, 'polish.xlsx')
      const cells = result.sheets[0].rows.map((r) => r.cells[0])
      expect(cells).toContain('Łódź')
      expect(cells).toContain('Świętokrzyskie')
      expect(cells).toContain('Zielińscy')
    })
  })
})
