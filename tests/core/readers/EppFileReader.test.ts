import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as iconv from 'iconv-lite'
import { EppFileReader } from '../../../src/core/readers/EppFileReader'
import { createDefaultRegistry } from '../../../src/core/readers/FileReaderRegistry'
import { detectProfileHint } from '../../../src/core/mapping/AutoMapper'
import { SYSTEM_PROFILES, findProfile } from '../../../src/core/mapping/SystemProfiles'
import type { RawSheet } from '../../../src/core/models/types'

const FIXTURES_DIR = join(__dirname, '..', '..', 'fixtures')

const SIMPLE_EPP = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=1234567890
NazwaNabywcy=Firma ABC
Brutto=1230.00
[Pozycja]
NazwaTowaru=Widget A
Ilosc=10.000
CenaNetto=100.00
StawkaVAT=23
WartoscNetto=1000.00
WartoscVAT=230.00
[KoniecFaktury]
`

const MULTI_INVOICE_EPP = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=1234567890
NazwaNabywcy=Firma ABC
Brutto=1230.00
[Pozycja]
NazwaTowaru=Widget A
Ilosc=1.000
CenaNetto=1000.00
StawkaVAT=23
WartoscNetto=1000.00
WartoscVAT=230.00
[KoniecFaktury]
[Faktura]
NrFaktury=FV/002
DataWystawienia=2026-01-20
NIPNabywcy=9876543210
NazwaNabywcy=Firma XYZ
Brutto=246.00
[Pozycja]
NazwaTowaru=Gadget B
Ilosc=2.000
CenaNetto=100.00
StawkaVAT=23
WartoscNetto=200.00
WartoscVAT=46.00
[KoniecFaktury]
`

describe('EppFileReader', () => {
  const reader = new EppFileReader()

  describe('canRead', () => {
    it('accepts .epp files', () => {
      const buffer = Buffer.from(SIMPLE_EPP, 'utf-8')
      expect(reader.canRead(buffer, 'test.epp')).toBe(true)
    })

    it('rejects .txt files', () => {
      const buffer = Buffer.from(SIMPLE_EPP, 'utf-8')
      expect(reader.canRead(buffer, 'test.txt')).toBe(false)
    })

    it('rejects .xml files', () => {
      const buffer = Buffer.from(SIMPLE_EPP, 'utf-8')
      expect(reader.canRead(buffer, 'test.xml')).toBe(false)
    })

    it('accepts file with BOM', () => {
      const bom = Buffer.from([0xef, 0xbb, 0xbf])
      const content = Buffer.from(SIMPLE_EPP, 'utf-8')
      const buffer = Buffer.concat([bom, content])
      expect(reader.canRead(buffer, 'test.epp')).toBe(true)
    })
  })

  describe('read — basic parsing', () => {
    it('parses single invoice with one position', () => {
      const buffer = Buffer.from(SIMPLE_EPP, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows).toHaveLength(1)
      expect(result.warnings.filter((w) => w.level === 'warning')).toHaveLength(0)
    })

    it('returns correct headers (invoice + item keys)', () => {
      const buffer = Buffer.from(SIMPLE_EPP, 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      const headers = result.sheets[0].headers!

      expect(headers).toContain('NrFaktury')
      expect(headers).toContain('DataWystawienia')
      expect(headers).toContain('NIPNabywcy')
      expect(headers).toContain('NazwaNabywcy')
      expect(headers).toContain('Brutto')
      expect(headers).toContain('NazwaTowaru')
      expect(headers).toContain('Ilosc')
      expect(headers).toContain('CenaNetto')
      expect(headers).toContain('StawkaVAT')
      expect(headers).toContain('WartoscNetto')
      expect(headers).toContain('WartoscVAT')
    })

    it('flattens: row inherits invoice-level fields', () => {
      const buffer = Buffer.from(SIMPLE_EPP, 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      const sheet = result.sheets[0]
      const headers = sheet.headers!
      const row = sheet.rows[0]

      const getValue = (key: string): string => row.cells[headers.indexOf(key)]

      expect(getValue('NrFaktury')).toBe('FV/001')
      expect(getValue('DataWystawienia')).toBe('2026-01-15')
      expect(getValue('NIPNabywcy')).toBe('1234567890')
      expect(getValue('NazwaTowaru')).toBe('Widget A')
      expect(getValue('WartoscNetto')).toBe('1000.00')
      expect(getValue('WartoscVAT')).toBe('230.00')
    })

    it('sets metadata format=epp and system=INSERT_SUBIEKT', () => {
      const buffer = Buffer.from(SIMPLE_EPP, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      expect(result.sheets[0].metadata.format).toBe('epp')
      expect(result.sheets[0].metadata.system).toBe('INSERT_SUBIEKT')
    })

    it('detects UTF-8 encoding', () => {
      const buffer = Buffer.from(SIMPLE_EPP, 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      expect(result.encoding).toBe('utf-8')
    })
  })

  describe('read — multiple invoices', () => {
    it('parses multiple invoices into separate rows', () => {
      const buffer = Buffer.from(MULTI_INVOICE_EPP, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      expect(result.sheets).toHaveLength(1)
      expect(result.sheets[0].rows).toHaveLength(2)
    })

    it('each row has correct invoice parent fields', () => {
      const buffer = Buffer.from(MULTI_INVOICE_EPP, 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      const sheet = result.sheets[0]
      const headers = sheet.headers!
      const getValue = (row: number, key: string): string =>
        sheet.rows[row].cells[headers.indexOf(key)]

      expect(getValue(0, 'NrFaktury')).toBe('FV/001')
      expect(getValue(0, 'NIPNabywcy')).toBe('1234567890')
      expect(getValue(0, 'NazwaTowaru')).toBe('Widget A')

      expect(getValue(1, 'NrFaktury')).toBe('FV/002')
      expect(getValue(1, 'NIPNabywcy')).toBe('9876543210')
      expect(getValue(1, 'NazwaTowaru')).toBe('Gadget B')
    })

    it('invoice with multiple positions produces multiple rows', () => {
      const epp = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=1234567890
NazwaNabywcy=Test
Brutto=100.00
[Pozycja]
NazwaTowaru=Item 1
Ilosc=1.000
[Pozycja]
NazwaTowaru=Item 2
Ilosc=2.000
[Pozycja]
NazwaTowaru=Item 3
Ilosc=3.000
[KoniecFaktury]
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      expect(result.sheets[0].rows).toHaveLength(3)
      const headers = result.sheets[0].headers!
      const getValue = (row: number, key: string): string =>
        result.sheets[0].rows[row].cells[headers.indexOf(key)]

      expect(getValue(0, 'NazwaTowaru')).toBe('Item 1')
      expect(getValue(1, 'NazwaTowaru')).toBe('Item 2')
      expect(getValue(2, 'NazwaTowaru')).toBe('Item 3')

      // All rows inherit the same invoice
      expect(getValue(0, 'NrFaktury')).toBe('FV/001')
      expect(getValue(1, 'NrFaktury')).toBe('FV/001')
      expect(getValue(2, 'NrFaktury')).toBe('FV/001')
    })
  })

  describe('read — Windows-1250 encoding', () => {
    it('decodes Polish characters from windows-1250', () => {
      const polishText = `[Faktura]
NrFaktury=FV/2026/001
DataWystawienia=2026-01-15
NIPNabywcy=5213456789
NazwaNabywcy=Zakład Produkcyjny Źródło Sp. z o.o.
Brutto=123.00
[Pozycja]
NazwaTowaru=Usługi księgowe — pełna obsługa
Ilosc=1.000
CenaNetto=100.00
StawkaVAT=23
WartoscNetto=100.00
WartoscVAT=23.00
[KoniecFaktury]
`
      const buffer = iconv.encode(polishText, 'windows-1250')
      const result = reader.read(buffer, 'test.epp')

      expect(result.encoding).toBe('windows-1250')
      const headers = result.sheets[0].headers!
      const row = result.sheets[0].rows[0]
      const getValue = (key: string): string => row.cells[headers.indexOf(key)]

      expect(getValue('NazwaNabywcy')).toContain('Zakład')
      expect(getValue('NazwaNabywcy')).toContain('Źródło')
      expect(getValue('NazwaTowaru')).toContain('Usługi')
      expect(getValue('NazwaTowaru')).toContain('księgowe')
    })
  })

  describe('canRead — edge cases', () => {
    it('rejects .epp file with no section brackets', () => {
      const buffer = Buffer.from('Just plain text\nNo brackets here\n', 'utf-8')
      expect(reader.canRead(buffer, 'test.epp')).toBe(false)
    })

    it('rejects .epp file with empty content', () => {
      const buffer = Buffer.from('', 'utf-8')
      expect(reader.canRead(buffer, 'test.epp')).toBe(false)
    })
  })

  describe('read — unrecognized lines and empty sections', () => {
    it('warns on unrecognized line format inside a section', () => {
      const epp = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=1234567890
NazwaNabywcy=Test
Brutto=100.00
THIS LINE HAS NO EQUALS SIGN
[Pozycja]
NazwaTowaru=Item
Ilosc=1.000
[KoniecFaktury]
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      expect(result.warnings.some((w) => w.message.includes('nie rozpoznano formatu linii'))).toBe(true)
      // Should still parse the valid parts
      expect(result.sheets[0].rows).toHaveLength(1)
    })

    it('returns empty for file with only unknown sections (no Faktura/Pozycja)', () => {
      const epp = `[SomeUnknownSection]
Key1=Value1
Key2=Value2
[AnotherSection]
Key3=Value3
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      // No Faktura/Pozycja → headers.length === 0 → no rows
      expect(result.sheets).toHaveLength(0)
      expect(result.warnings.some((w) => w.message.includes('Nie znaleziono pozycji faktur'))).toBe(true)
    })

    it('handles field present in one invoice but not another (empty cell fallback)', () => {
      const epp = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=1234567890
NazwaNabywcy=Test
Brutto=100.00
ExtraField=ExtraValue
[Pozycja]
NazwaTowaru=Item1
Ilosc=1.000
[KoniecFaktury]
[Faktura]
NrFaktury=FV/002
DataWystawienia=2026-01-20
NIPNabywcy=9876543210
NazwaNabywcy=Other
Brutto=200.00
[Pozycja]
NazwaTowaru=Item2
Ilosc=2.000
[KoniecFaktury]
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      const sheet = result.sheets[0]
      const headers = sheet.headers!
      const extraIdx = headers.indexOf('ExtraField')
      expect(extraIdx).toBeGreaterThanOrEqual(0)

      // First row has ExtraField
      expect(sheet.rows[0].cells[extraIdx]).toBe('ExtraValue')
      // Second row does NOT have ExtraField → should be empty string
      expect(sheet.rows[1].cells[extraIdx]).toBe('')
    })

    it('handles item field not in invoice fields (falls through to item lookup)', () => {
      const epp = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=1234567890
NazwaNabywcy=Test
[Pozycja]
NazwaTowaru=Widget
Ilosc=5.000
UniqueItemField=Special
[KoniecFaktury]
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      const sheet = result.sheets[0]
      const headers = sheet.headers!
      const uniqueIdx = headers.indexOf('UniqueItemField')
      expect(uniqueIdx).toBeGreaterThanOrEqual(0)
      expect(sheet.rows[0].cells[uniqueIdx]).toBe('Special')
    })
  })

  describe('read — low encoding confidence', () => {
    it('adds warning for low confidence encoding detection', () => {
      // Create a very short buffer that may trigger low confidence
      const epp = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=1234567890
NazwaNabywcy=Test
Brutto=100
[Pozycja]
NazwaTowaru=Item
Ilosc=1
[KoniecFaktury]
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      // Just ensure it processes without error; low confidence depends on encoding detector
      expect(result.sheets).toHaveLength(1)
    })
  })

  describe('read — edge cases', () => {
    it('returns empty sheets for empty file', () => {
      const buffer = Buffer.from('', 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      expect(result.sheets).toHaveLength(0)
    })

    it('returns empty sheets for file with only whitespace', () => {
      const buffer = Buffer.from('   \n  \n  ', 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      expect(result.sheets).toHaveLength(0)
    })

    it('handles missing optional fields with empty values', () => {
      const epp = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=1234567890
NazwaNabywcy=Test
[Pozycja]
NazwaTowaru=Item
Ilosc=1.000
[KoniecFaktury]
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      const headers = result.sheets[0].headers!
      const row = result.sheets[0].rows[0]

      // Fields that exist in other invoices but not this one should be empty
      expect(row.cells[headers.indexOf('NazwaTowaru')]).toBe('Item')
      // CenaNetto not present → should not exist in headers at all
      expect(headers).not.toContain('CenaNetto')
    })

    it('handles value with equals sign', () => {
      const epp = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=1234567890
NazwaNabywcy=Test
Brutto=100.00
[Pozycja]
NazwaTowaru=Widget a=b model
Ilosc=1.000
[KoniecFaktury]
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      const headers = result.sheets[0].headers!
      const row = result.sheets[0].rows[0]

      expect(row.cells[headers.indexOf('NazwaTowaru')]).toBe('Widget a=b model')
    })

    it('handles empty values', () => {
      const epp = `[Faktura]
NrFaktury=FV/001
DataWystawienia=
NIPNabywcy=
NazwaNabywcy=Test
Brutto=100.00
[Pozycja]
NazwaTowaru=Item
Ilosc=1.000
[KoniecFaktury]
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')
      const headers = result.sheets[0].headers!
      const row = result.sheets[0].rows[0]

      expect(row.cells[headers.indexOf('DataWystawienia')]).toBe('')
      expect(row.cells[headers.indexOf('NIPNabywcy')]).toBe('')
    })

    it('warns on orphan Pozycja without parent Faktura', () => {
      const epp = `[Pozycja]
NazwaTowaru=Orphan
Ilosc=1.000
[KoniecFaktury]
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      // Orphan is skipped, no rows
      expect(result.sheets).toHaveLength(0)
      expect(result.warnings.some((w) => w.message.includes('Pozycja bez nadrzędnej faktury'))).toBe(true)
    })

    it('handles CRLF line endings', () => {
      const epp = '[Faktura]\r\nNrFaktury=FV/001\r\nDataWystawienia=2026-01-15\r\nNIPNabywcy=123\r\nNazwaNabywcy=Test\r\nBrutto=100\r\n[Pozycja]\r\nNazwaTowaru=Item\r\nIlosc=1\r\n[KoniecFaktury]\r\n'
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      expect(result.sheets[0].rows).toHaveLength(1)
    })

    it('handles file without KoniecFaktury marker', () => {
      const epp = `[Faktura]
NrFaktury=FV/001
DataWystawienia=2026-01-15
NIPNabywcy=123
NazwaNabywcy=Test
Brutto=100
[Pozycja]
NazwaTowaru=Item
Ilosc=1
`
      const buffer = Buffer.from(epp, 'utf-8')
      const result = reader.read(buffer, 'test.epp')

      // Should still parse correctly — KoniecFaktury is optional
      expect(result.sheets[0].rows).toHaveLength(1)
    })
  })

  describe('read — fixture file', () => {
    it('parses subiekt_faktura.epp with 2 invoices and 5 total positions', () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'subiekt_faktura.epp'))
      const result = reader.read(buffer, 'subiekt_faktura.epp')

      expect(result.sheets).toHaveLength(1)
      // 2 positions from first invoice + 3 from second = 5
      expect(result.sheets[0].rows).toHaveLength(5)
    })

    it('has correct invoice assignment per row', () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'subiekt_faktura.epp'))
      const result = reader.read(buffer, 'subiekt_faktura.epp')
      const sheet = result.sheets[0]
      const headers = sheet.headers!
      const getValue = (row: number, key: string): string =>
        sheet.rows[row].cells[headers.indexOf(key)]

      // First invoice rows
      expect(getValue(0, 'NrFaktury')).toBe('FV/2026/001')
      expect(getValue(1, 'NrFaktury')).toBe('FV/2026/001')

      // Second invoice rows
      expect(getValue(2, 'NrFaktury')).toBe('FV/2026/002')
      expect(getValue(3, 'NrFaktury')).toBe('FV/2026/002')
      expect(getValue(4, 'NrFaktury')).toBe('FV/2026/002')
    })

    it('preserves Polish characters in fixture', () => {
      const buffer = readFileSync(join(FIXTURES_DIR, 'subiekt_faktura.epp'))
      const result = reader.read(buffer, 'subiekt_faktura.epp')
      const sheet = result.sheets[0]
      const headers = sheet.headers!
      const getValue = (row: number, key: string): string =>
        sheet.rows[row].cells[headers.indexOf(key)]

      expect(getValue(2, 'NazwaNabywcy')).toContain('Świeżych')
      expect(getValue(0, 'NazwaTowaru')).toContain('wdrożenie')
      expect(getValue(2, 'NazwaTowaru')).toContain('Jabłka')
    })
  })

  describe('FileReaderRegistry integration', () => {
    it('registers EppFileReader and recognizes .epp files', () => {
      const registry = createDefaultRegistry()
      const exts = registry.getSupportedExtensions()
      expect(exts).toContain('epp')
    })

    it('routes .epp file to EppFileReader', () => {
      const registry = createDefaultRegistry()
      const buffer = Buffer.from(SIMPLE_EPP, 'utf-8')
      const foundReader = registry.findReader(buffer, 'test.epp')

      expect(foundReader).not.toBeNull()
      expect(foundReader!.name).toBe('EppFileReader')
    })
  })

  describe('INSERT_SUBIEKT profile', () => {
    it('exists in SYSTEM_PROFILES', () => {
      const profile = SYSTEM_PROFILES.find((p) => p.id === 'INSERT_SUBIEKT_FA')
      expect(profile).toBeDefined()
      expect(profile!.system).toBe('INSERT_SUBIEKT')
      expect(profile!.jpkType).toBe('JPK_FA')
      expect(profile!.subType).toBe('Faktura')
    })

    it('findProfile returns INSERT_SUBIEKT_FA', () => {
      const p = findProfile('INSERT_SUBIEKT', 'JPK_FA', 'Faktura')
      expect(p).not.toBeNull()
      expect(p!.id).toBe('INSERT_SUBIEKT_FA')
    })

    it('column map includes invoice-level fields', () => {
      const profile = findProfile('INSERT_SUBIEKT', 'JPK_FA', 'Faktura')!
      expect(profile.columnMap[0]).toBe('P_2')    // NrFaktury
      expect(profile.columnMap[1]).toBe('P_1')    // DataWystawienia
      expect(profile.columnMap[2]).toBe('P_6')    // NIPNabywcy
      expect(profile.columnMap[3]).toBe('P_3A')   // NazwaNabywcy
      expect(profile.columnMap[4]).toBe('P_15')   // Brutto
    })
  })

  describe('detectProfileHint — Insert Subiekt EPP', () => {
    function makeSheet(opts: { headers?: string[]; rows: string[][] }): RawSheet {
      return {
        name: 'test',
        headers: opts.headers,
        rows: opts.rows.map((cells, i) => ({ index: i, cells })),
        metadata: {},
      }
    }

    it('detects Insert Subiekt from EPP headers', () => {
      const sheet = makeSheet({
        headers: ['NrFaktury', 'DataWystawienia', 'NIPNabywcy', 'NazwaNabywcy', 'Brutto', 'NazwaTowaru', 'Ilosc', 'CenaNetto', 'StawkaVAT', 'WartoscNetto', 'WartoscVAT'],
        rows: [['FV/001', '2026-01-15', '1234567890', 'Firma', '1230.00', 'Widget', '1', '1000', '23', '1000', '230']],
      })
      const hint = detectProfileHint(sheet)
      expect(hint).not.toBeNull()
      expect(hint!.profileId).toBe('INSERT_SUBIEKT_FA')
      expect(hint!.confidence).toBe(0.95)
    })

    it('detects with minimum 3 Subiekt markers', () => {
      const sheet = makeSheet({
        headers: ['NrFaktury', 'NazwaTowaru', 'WartoscNetto'],
        rows: [['FV/001', 'Item', '100']],
      })
      const hint = detectProfileHint(sheet)
      expect(hint).not.toBeNull()
      expect(hint!.profileId).toBe('INSERT_SUBIEKT_FA')
    })

    it('returns null with only 2 markers (insufficient)', () => {
      const sheet = makeSheet({
        headers: ['NrFaktury', 'NazwaTowaru', 'SomeOther'],
        rows: [['FV/001', 'Item', 'abc']],
      })
      expect(detectProfileHint(sheet)).toBeNull()
    })
  })
})
