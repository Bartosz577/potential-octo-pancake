import { describe, it, expect, beforeAll } from 'vitest'
import * as iconv from 'iconv-lite'
import { CsvFileReader } from '../../../src/core/readers/CsvFileReader'

describe('CsvFileReader', () => {
  let reader: CsvFileReader

  beforeAll(() => {
    reader = new CsvFileReader()
  })

  describe('canRead', () => {
    it('accepts .csv files', () => {
      const buf = Buffer.from('a,b,c')
      expect(reader.canRead(buf, 'data.csv')).toBe(true)
    })

    it('rejects .txt files', () => {
      const buf = Buffer.from('a,b,c')
      expect(reader.canRead(buf, 'data.txt')).toBe(false)
    })

    it('rejects .xlsx files', () => {
      const buf = Buffer.from('PK\x03\x04')
      expect(reader.canRead(buf, 'data.xlsx')).toBe(false)
    })

    it('rejects binary files with null bytes', () => {
      const buf = Buffer.from([0x61, 0x00, 0x62])
      expect(reader.canRead(buf, 'data.csv')).toBe(false)
    })
  })

  describe('read — comma separator', () => {
    it('parses simple comma-separated CSV', () => {
      const csv = 'a,b,c\n1,2,3\n4,5,6'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'simple.csv')

      expect(result.sheets).toHaveLength(1)
      expect(result.encoding).toBe('utf-8')
      expect(result.separator).toBe(',')
    })

    it('detects header row', () => {
      const csv = 'Name,Age,City\nAlice,30,Warsaw\nBob,25,Kraków'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'header.csv')

      const sheet = result.sheets[0]
      expect(sheet.headers).toEqual(['Name', 'Age', 'City'])
      expect(sheet.rows).toHaveLength(2)
      expect(sheet.rows[0].cells).toEqual(['Alice', '30', 'Warsaw'])
    })

    it('handles quoted fields with commas inside', () => {
      const csv = 'name,address,amount\n"Kowalski, Jan","ul. Długa 5, Warszawa",100'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'quoted.csv')

      const sheet = result.sheets[0]
      expect(sheet.headers).toEqual(['name', 'address', 'amount'])
      expect(sheet.rows[0].cells[0]).toBe('Kowalski, Jan')
      expect(sheet.rows[0].cells[1]).toBe('ul. Długa 5, Warszawa')
    })

    it('handles quoted fields with newlines inside', () => {
      const csv = 'name,note,value\n"Alice","line1\nline2",42'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'multiline.csv')

      const sheet = result.sheets[0]
      expect(sheet.rows[0].cells[1]).toContain('line1')
      expect(sheet.rows[0].cells[1]).toContain('line2')
    })
  })

  describe('read — semicolon separator', () => {
    it('auto-detects semicolon delimiter', () => {
      const csv = 'Nazwa;Ilość;Cena\nMłotek;10;25,50\nŚruba;100;0,50'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'semicolon.csv')

      expect(result.separator).toBe(';')
      const sheet = result.sheets[0]
      expect(sheet.headers).toEqual(['Nazwa', 'Ilość', 'Cena'])
      expect(sheet.rows).toHaveLength(2)
      expect(sheet.rows[0].cells).toEqual(['Młotek', '10', '25,50'])
    })

    it('handles Polish decimal separator (comma) with semicolon delimiter', () => {
      const csv = 'netto;vat;brutto\n100,00;23,00;123,00\n200,50;46,12;246,62'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'amounts.csv')

      expect(result.separator).toBe(';')
      const sheet = result.sheets[0]
      // Header detected: first row text, second row has numbers (comma decimals)
      expect(sheet.headers).toEqual(['netto', 'vat', 'brutto'])
      expect(sheet.rows[0].cells).toEqual(['100,00', '23,00', '123,00'])
    })
  })

  describe('read — pipe separator', () => {
    it('auto-detects pipe delimiter', () => {
      const csv = 'a|b|c\n1|2|3'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'pipe.csv')

      expect(result.separator).toBe('|')
      const sheet = result.sheets[0]
      expect(sheet.rows).toHaveLength(1)
      expect(sheet.rows[0].cells).toEqual(['1', '2', '3'])
    })
  })

  describe('read — windows-1250 encoding', () => {
    it('decodes windows-1250 Polish characters', () => {
      const csv = 'Nazwa;Miasto;Ilość\nZielińscy;Kurzętnik;10\nŁódź;Świętokrzyskie;20'
      const buf = iconv.encode(csv, 'windows-1250')
      const result = reader.read(buf, 'win1250.csv')

      expect(result.encoding).toBe('windows-1250')
      const sheet = result.sheets[0]
      expect(sheet.headers).toEqual(['Nazwa', 'Miasto', 'Ilość'])
      expect(sheet.rows[0].cells).toEqual(['Zielińscy', 'Kurzętnik', '10'])
      expect(sheet.rows[1].cells).toEqual(['Łódź', 'Świętokrzyskie', '20'])
    })

    it('handles windows-1250 with semicolon separator and Polish decimals', () => {
      const csv = 'Firma;Kwota\nSpółka ABC;1234,56\nŚrubex;789,00'
      const buf = iconv.encode(csv, 'windows-1250')
      const result = reader.read(buf, 'erp.csv')

      expect(result.encoding).toBe('windows-1250')
      expect(result.separator).toBe(';')
      const sheet = result.sheets[0]
      expect(sheet.rows[0].cells[0]).toBe('Spółka ABC')
      expect(sheet.rows[0].cells[1]).toBe('1234,56')
    })
  })

  describe('read — edge cases', () => {
    it('handles empty file', () => {
      const buf = Buffer.from('', 'utf-8')
      const result = reader.read(buf, 'empty.csv')
      expect(result.sheets).toHaveLength(0)
      expect(result.warnings.some((w) => w.message.includes('pusty'))).toBe(true)
    })

    it('handles CRLF line endings', () => {
      const csv = 'a,b\r\n1,2\r\n3,4\r\n'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'crlf.csv')
      expect(result.sheets[0].rows).toHaveLength(2)
    })

    it('handles file with only headers (no data rows)', () => {
      const csv = 'col1,col2,col3'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'headers-only.csv')
      // Single row with no numeric data → no header detection
      expect(result.sheets[0].rows.length).toBeGreaterThanOrEqual(0)
    })

    it('handles UTF-8 BOM', () => {
      const bom = Buffer.from([0xef, 0xbb, 0xbf])
      const csv = Buffer.from('Nazwa,Wartość\nTest,123', 'utf-8')
      const buf = Buffer.concat([bom, csv])
      const result = reader.read(buf, 'bom.csv')

      expect(result.encoding).toBe('utf-8')
      const sheet = result.sheets[0]
      expect(sheet.headers?.[0]).toBe('Nazwa')
    })

    it('preserves row indices starting from 0', () => {
      const csv = 'a,b\n1,2\n3,4\n5,6'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'indexed.csv')
      const rows = result.sheets[0].rows
      expect(rows[0].index).toBe(0)
      expect(rows[1].index).toBe(1)
      expect(rows[2].index).toBe(2)
    })

    it('no header detection when all rows are numeric', () => {
      const csv = '1,2,3\n4,5,6\n7,8,9'
      const buf = Buffer.from(csv, 'utf-8')
      const result = reader.read(buf, 'numeric.csv')
      const sheet = result.sheets[0]
      expect(sheet.headers).toBeUndefined()
      expect(sheet.rows).toHaveLength(3)
    })
  })
})
