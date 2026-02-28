import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import { FileReaderRegistry, createDefaultRegistry } from '../../../src/core/readers/FileReaderRegistry'
import { TxtFileReader } from '../../../src/core/readers/TxtFileReader'
import { CsvFileReader } from '../../../src/core/readers/CsvFileReader'

const TEST_DATA_DIR = join(__dirname, '..', '..', '..', 'test-data')

describe('FileReaderRegistry', () => {
  describe('register and getReaders', () => {
    it('starts empty', () => {
      const registry = new FileReaderRegistry()
      expect(registry.getReaders()).toHaveLength(0)
    })

    it('registers readers', () => {
      const registry = new FileReaderRegistry()
      registry.register(new TxtFileReader())
      registry.register(new CsvFileReader())
      expect(registry.getReaders()).toHaveLength(2)
    })
  })

  describe('getSupportedExtensions', () => {
    it('returns all unique extensions', () => {
      const registry = createDefaultRegistry()
      const exts = registry.getSupportedExtensions()
      expect(exts).toContain('txt')
      expect(exts).toContain('csv')
      expect(exts).toContain('xlsx')
      expect(exts).toContain('xls')
      expect(exts).toContain('json')
      expect(exts).toContain('xml')
      expect(exts).toContain('tsv')
      expect(exts).toContain('dat')
    })
  })

  describe('findReader', () => {
    let registry: FileReaderRegistry

    beforeAll(() => {
      registry = createDefaultRegistry()
    })

    it('finds TxtFileReader for .txt files', () => {
      const buf = Buffer.from('a|b|c\n1|2|3')
      const reader = registry.findReader(buf, 'data.txt')
      expect(reader).not.toBeNull()
      expect(reader!.name).toBe('TxtFileReader')
    })

    it('finds CsvFileReader for .csv files', () => {
      const buf = Buffer.from('a,b,c\n1,2,3')
      const reader = registry.findReader(buf, 'data.csv')
      expect(reader).not.toBeNull()
      expect(reader!.name).toBe('CsvFileReader')
    })

    it('finds XlsxFileReader for .xlsx files', () => {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([['a', 'b'], ['1', '2']])
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

      const reader = registry.findReader(buf, 'data.xlsx')
      expect(reader).not.toBeNull()
      expect(reader!.name).toBe('XlsxFileReader')
    })

    it('finds JsonFileReader for .json files', () => {
      const buf = Buffer.from('[{"a": 1}]')
      const reader = registry.findReader(buf, 'data.json')
      expect(reader).not.toBeNull()
      expect(reader!.name).toBe('JsonFileReader')
    })

    it('finds XmlFileReader for .xml files', () => {
      const buf = Buffer.from('<?xml version="1.0"?><root><item><a>1</a></item></root>')
      const reader = registry.findReader(buf, 'data.xml')
      expect(reader).not.toBeNull()
      expect(reader!.name).toBe('XmlFileReader')
    })

    it('returns null for unsupported extension', () => {
      const buf = Buffer.from('some data')
      const reader = registry.findReader(buf, 'data.xyz')
      expect(reader).toBeNull()
    })

    it('returns null for binary file with text extension', () => {
      // Buffer with null bytes — no text reader should accept it
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x00, 0x03])
      const reader = registry.findReader(buf, 'data.txt')
      expect(reader).toBeNull()
    })

    it('finds TxtFileReader for .tsv files', () => {
      const buf = Buffer.from('a\tb\tc\n1\t2\t3')
      const reader = registry.findReader(buf, 'data.tsv')
      expect(reader).not.toBeNull()
      expect(reader!.name).toBe('TxtFileReader')
    })

    it('finds TxtFileReader for .dat files', () => {
      const buf = Buffer.from('a|b|c\n1|2|3')
      const reader = registry.findReader(buf, 'data.dat')
      expect(reader).not.toBeNull()
      expect(reader!.name).toBe('TxtFileReader')
    })
  })

  describe('read', () => {
    let registry: FileReaderRegistry

    beforeAll(() => {
      registry = createDefaultRegistry()
    })

    it('reads a CSV file end-to-end', () => {
      const csv = 'Name,Value\nAlice,100\nBob,200'
      const buf = Buffer.from(csv, 'utf-8')
      const result = registry.read(buf, 'test.csv')

      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows).toHaveLength(2)
      expect(result.encoding).toBe('utf-8')
    })

    it('reads a JSON file end-to-end', () => {
      const json = JSON.stringify([{ a: 1, b: 2 }, { a: 3, b: 4 }])
      const buf = Buffer.from(json, 'utf-8')
      const result = registry.read(buf, 'test.json')

      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows).toHaveLength(2)
    })

    it('reads an XML file end-to-end', () => {
      const xml = '<Root><Item><X>1</X></Item><Item><X>2</X></Item></Root>'
      const buf = Buffer.from(xml, 'utf-8')
      const result = registry.read(buf, 'test.xml')

      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows).toHaveLength(2)
    })

    it('reads an XLSX file end-to-end', () => {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([['Col1', 'Col2'], ['A', '1'], ['B', '2']])
      XLSX.utils.book_append_sheet(wb, ws, 'Data')
      const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

      const result = registry.read(buf, 'test.xlsx')
      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows).toHaveLength(2)
    })

    it('throws for unsupported format', () => {
      const buf = Buffer.from('some data')
      expect(() => registry.read(buf, 'data.xyz')).toThrow('Nieobsługiwany format pliku')
    })

    it('includes supported extensions in error message', () => {
      const buf = Buffer.from('data')
      try {
        registry.read(buf, 'file.abc')
      } catch (e) {
        expect((e as Error).message).toContain('.csv')
        expect((e as Error).message).toContain('.xlsx')
        expect((e as Error).message).toContain('.json')
        expect((e as Error).message).toContain('.xml')
        expect((e as Error).message).toContain('.txt')
      }
    })
  })

  describe('read — real test-data files', () => {
    let registry: FileReaderRegistry

    beforeAll(() => {
      registry = createDefaultRegistry()
    })

    it('reads NAMOS VDEK .txt file', () => {
      const buf = readFileSync(
        join(TEST_DATA_DIR, '0P549_NAMOS_JPK_VDEK_SprzedazWiersz_2026-01-01_2026-01-31_20260207020039.txt')
      )
      const result = registry.read(buf, '0P549_NAMOS_JPK_VDEK_SprzedazWiersz.txt')

      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows).toHaveLength(1107)
      expect(result.sheets[0].metadata.system).toBe('NAMOS')
    })

    it('reads NAMOS FA .txt file', () => {
      const buf = readFileSync(
        join(TEST_DATA_DIR, '0P549_NAMOS_JPK_FA_Faktura_2026-01-01_2026-01-31_20260207020039.txt')
      )
      const result = registry.read(buf, '0P549_NAMOS_JPK_FA_Faktura.txt')

      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows).toHaveLength(1107)
      expect(result.sheets[0].metadata.jpkType).toBe('JPK_FA')
    })

    it('reads ESO MAG .txt file', () => {
      const buf = readFileSync(
        join(TEST_DATA_DIR, '0P549_ESO_JPK_MAG_WZ_2026-01-31_2026-01-31_20260202043950.txt')
      )
      const result = registry.read(buf, '0P549_ESO_JPK_MAG_WZ.txt')

      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows).toHaveLength(171)
      expect(result.sheets[0].metadata.system).toBe('ESO')
    })
  })
})
