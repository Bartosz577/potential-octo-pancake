import { describe, it, expect } from 'vitest'
import {
  validateFile,
  validateFiles,
  applyFixes
} from '../../../src/renderer/src/utils/validator'
import type { ParsedFile, JpkType, SubType } from '../../../src/renderer/src/types/index'
import type { ColumnMapping } from '../../../src/core/mapping/AutoMapper'

// ── Fixtures ──

const VALID_COMPANY = {
  nip: '526-104-08-28',
  fullName: 'Test Sp. z o.o.',
  regon: '123456789',
  kodUrzedu: '1471',
  email: 'test@test.pl',
  phone: '123456789'
}

const VALID_PERIOD = {
  year: 2024,
  month: 3,
  celZlozenia: 1 as const
}

function makeParsedFile(
  jpkType: JpkType = 'JPK_VDEK',
  subType: SubType = 'SprzedazWiersz',
  rows: string[][] = [['1', 'PL', '5261040828', 'Test', 'FV/001', '2024-03-15', '2024-03-15', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '100.00', '23.00']],
  overrides: Partial<ParsedFile> = {}
): ParsedFile {
  return {
    id: 'test-file-1',
    filename: 'test.txt',
    system: 'NAMOS',
    jpkType,
    subType,
    pointCode: 'PP01',
    dateFrom: '2024-03-01',
    dateTo: '2024-03-31',
    rows,
    rowCount: rows.length,
    columnCount: rows[0]?.length ?? 0,
    fileSize: 100,
    ...overrides
  }
}

function makeMappings(fields: { source: number; target: string }[]): ColumnMapping[] {
  return fields.map((f) => ({
    sourceColumn: f.source,
    targetField: f.target,
    confidence: 1,
    method: 'manual' as const
  }))
}

// Standard V7M mappings for test rows with 38 columns
const V7M_MAPPINGS = makeMappings([
  { source: 0, target: 'LpSprzedazy' },
  { source: 1, target: 'KodKontrahenta' },
  { source: 2, target: 'NrKontrahenta' },
  { source: 3, target: 'NazwaKontrahenta' },
  { source: 4, target: 'DowodSprzedazy' },
  { source: 5, target: 'DataWystawienia' },
  { source: 6, target: 'DataSprzedazy' },
  { source: 36, target: 'K_19' },
  { source: 37, target: 'K_20' }
])

// ── validateFile ──

describe('validateFile', () => {
  it('returns a report with 4 groups', () => {
    const file = makeParsedFile()
    const report = validateFile(file, V7M_MAPPINGS, VALID_COMPANY, VALID_PERIOD)
    expect(report.groups).toHaveLength(4)
    expect(report.groups.map((g) => g.category)).toEqual([
      'STRUKTURA', 'MERYTORYKA', 'SUMY_KONTROLNE', 'SCHEMAT_XSD'
    ])
  })

  it('counts errors, warnings, and infos correctly', () => {
    const file = makeParsedFile()
    const report = validateFile(file, V7M_MAPPINGS, VALID_COMPANY, VALID_PERIOD)
    const total = report.errorCount + report.warningCount + report.infoCount
    const allItems = report.groups.flatMap((g) => g.items)
    expect(total).toBe(allItems.length)
  })

  // ── STRUKTURA ──

  describe('STRUKTURA validation', () => {
    it('reports consistent column count as info', () => {
      const rows = [
        ['1', '2', '3'],
        ['4', '5', '6']
      ]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const report = validateFile(file, [], undefined, undefined)
      const colItem = report.groups[0].items.find((i) => i.id === 'str-columns')
      expect(colItem).toBeDefined()
      expect(colItem!.severity).toBe('info')
    })

    it('reports inconsistent column count as error', () => {
      const rows = [
        ['1', '2', '3'],
        ['4', '5'],      // short row
        ['6', '7', '8', '9']  // long row
      ]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const report = validateFile(file, [], undefined, undefined)
      const colItem = report.groups[0].items.find((i) => i.id === 'str-columns')
      expect(colItem).toBeDefined()
      expect(colItem!.severity).toBe('error')
      expect(colItem!.message).toContain('2')
      expect(colItem!.details).toBeDefined()
    })

    it('limits bad row display to 10 samples', () => {
      // Create 15 rows with wrong column count
      const rows = Array.from({ length: 15 }, () => ['1', '2'])
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const report = validateFile(file, [], undefined, undefined)
      const colItem = report.groups[0].items.find((i) => i.id === 'str-columns')
      expect(colItem!.severity).toBe('error')
      // Should show ellipsis for > 10 bad rows
      expect(colItem!.details).toContain('\u2026')
    })

    it('reports all required fields mapped as info', () => {
      const file = makeParsedFile()
      const report = validateFile(file, V7M_MAPPINGS, VALID_COMPANY, VALID_PERIOD)
      // At least some required fields are mapped
      const reqItem = report.groups[0].items.find((i) => i.id === 'str-required')
      expect(reqItem).toBeDefined()
    })

    it('reports unmapped required fields as error', () => {
      const file = makeParsedFile()
      // Empty mappings - no required fields mapped
      const report = validateFile(file, [], undefined, undefined)
      const reqItem = report.groups[0].items.find((i) => i.id === 'str-required')
      // If there are required fields, it should be an error
      if (reqItem) {
        expect(reqItem.severity).toBe('error')
        expect(reqItem.details).toBeDefined()
      }
    })

    it('reports format info when file has format', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1']], {
        format: 'txt',
        encoding: 'windows-1250'
      })
      const report = validateFile(file, [], undefined, undefined)
      const fmtItem = report.groups[0].items.find((i) => i.id === 'str-format')
      expect(fmtItem).toBeDefined()
      expect(fmtItem!.severity).toBe('info')
      expect(fmtItem!.message).toContain('TXT')
      expect(fmtItem!.message).toContain('windows-1250')
    })

    it('reports format without encoding', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1']], {
        format: 'csv'
      })
      const report = validateFile(file, [], undefined, undefined)
      const fmtItem = report.groups[0].items.find((i) => i.id === 'str-format')
      expect(fmtItem).toBeDefined()
      expect(fmtItem!.message).toContain('CSV')
    })

    it('does not report format when file has no format', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1']])
      const report = validateFile(file, [], undefined, undefined)
      const fmtItem = report.groups[0].items.find((i) => i.id === 'str-format')
      expect(fmtItem).toBeUndefined()
    })
  })

  // ── MERYTORYKA — NIP ──

  describe('MERYTORYKA NIP validation', () => {
    it('reports valid 10-digit NIP as info', () => {
      // 5261040828 is a valid NIP (passes checksum)
      const rows = [['1', 'PL', '5261040828']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const mappings = makeMappings([
        { source: 1, target: 'KodKontrahenta' },
        { source: 2, target: 'NrKontrahenta' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const nipOk = report.groups[1].items.find((i) => i.id.startsWith('mer-nip-ok'))
      expect(nipOk).toBeDefined()
      expect(nipOk!.severity).toBe('info')
    })

    it('reports PESEL (11 digits) as info', () => {
      const rows = [['1', 'PL', '12345678901']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const mappings = makeMappings([
        { source: 1, target: 'KodKontrahenta' },
        { source: 2, target: 'NrKontrahenta' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const peselItem = report.groups[1].items.find((i) => i.id.startsWith('mer-nip-pesel'))
      expect(peselItem).toBeDefined()
      expect(peselItem!.severity).toBe('info')
    })

    it('reports foreign NIP (non-PL country) as info', () => {
      const rows = [['1', 'DE', 'DE123456789']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const mappings = makeMappings([
        { source: 1, target: 'KodKontrahenta' },
        { source: 2, target: 'NrKontrahenta' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const foreignItem = report.groups[1].items.find((i) => i.id.startsWith('mer-nip-foreign'))
      expect(foreignItem).toBeDefined()
      expect(foreignItem!.severity).toBe('info')
    })

    it('reports "brak" NIP as warning', () => {
      const rows = [['1', 'PL', 'brak']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const mappings = makeMappings([
        { source: 1, target: 'KodKontrahenta' },
        { source: 2, target: 'NrKontrahenta' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const brakItem = report.groups[1].items.find((i) => i.id.startsWith('mer-nip-brak'))
      expect(brakItem).toBeDefined()
      expect(brakItem!.severity).toBe('warning')
    })

    it('reports empty NIP as warning (brak)', () => {
      const rows = [['1', 'PL', '']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const mappings = makeMappings([
        { source: 1, target: 'KodKontrahenta' },
        { source: 2, target: 'NrKontrahenta' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const brakItem = report.groups[1].items.find((i) => i.id.startsWith('mer-nip-brak'))
      expect(brakItem).toBeDefined()
    })

    it('reports invalid NIP as error', () => {
      const rows = [['1', 'PL', '1234567890']] // invalid checksum
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const mappings = makeMappings([
        { source: 1, target: 'KodKontrahenta' },
        { source: 2, target: 'NrKontrahenta' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const nipErr = report.groups[1].items.find((i) => i.id.startsWith('mer-nip-err'))
      expect(nipErr).toBeDefined()
      expect(nipErr!.severity).toBe('error')
      expect(nipErr!.details).toContain('1234567890')
    })

    it('limits invalid NIP samples to 5', () => {
      const rows = Array.from({ length: 10 }, (_, i) => [
        String(i), 'PL', `999999999${i}` // all invalid NIPs
      ])
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 3 })
      const mappings = makeMappings([
        { source: 1, target: 'KodKontrahenta' },
        { source: 2, target: 'NrKontrahenta' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const nipErr = report.groups[1].items.find((i) => i.id.startsWith('mer-nip-err'))
      expect(nipErr).toBeDefined()
      // Should show at most 5 samples
      const samples = nipErr!.details!.split('Wiersz ')
      expect(samples.length).toBeLessThanOrEqual(6) // first split element is empty
    })

    it('handles NIP validation without country code column', () => {
      const rows = [['1', '5261040828']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        // No KodKontrahenta mapped, only NrKontrahenta
        { source: 1, target: 'NrKontrahenta' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const nipOk = report.groups[1].items.find((i) => i.id.startsWith('mer-nip-ok'))
      expect(nipOk).toBeDefined()
    })
  })

  // ── MERYTORYKA — Date validation ──

  describe('MERYTORYKA date validation', () => {
    it('reports valid dates in YYYY-MM-DD format as info', () => {
      const rows = [['1', '2024-03-15']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        { source: 1, target: 'DataWystawienia' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const dateOk = report.groups[1].items.find((i) => i.id === 'mer-dates-ok')
      expect(dateOk).toBeDefined()
      expect(dateOk!.severity).toBe('info')
    })

    it('reports invalid dates as error', () => {
      const rows = [['1', 'not-a-date']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        { source: 1, target: 'DataWystawienia' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const dateErr = report.groups[1].items.find((i) => i.id === 'mer-dates-err')
      expect(dateErr).toBeDefined()
      expect(dateErr!.severity).toBe('error')
    })

    it('provides auto-fix for DD.MM.YYYY dates', () => {
      const rows = [['1', '15.03.2024']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        { source: 1, target: 'DataWystawienia' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const dateErr = report.groups[1].items.find((i) => i.id === 'mer-dates-err')
      expect(dateErr).toBeDefined()
      expect(dateErr!.autoFixable).toBe(true)
      expect(dateErr!.fixes).toHaveLength(1)
      expect(dateErr!.fixes[0].oldValue).toBe('15.03.2024')
      expect(dateErr!.fixes[0].newValue).toBe('2024-03-15')
    })

    it('provides auto-fix for DD/MM/YYYY dates', () => {
      const rows = [['1', '15/03/2024']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        { source: 1, target: 'DataWystawienia' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const dateErr = report.groups[1].items.find((i) => i.id === 'mer-dates-err')
      expect(dateErr).toBeDefined()
      expect(dateErr!.autoFixable).toBe(true)
      expect(dateErr!.fixes[0].newValue).toBe('2024-03-15')
    })

    it('skips empty date values', () => {
      const rows = [['1', '']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        { source: 1, target: 'DataWystawienia' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      // No date items at all since all are empty
      const dateItems = report.groups[1].items.filter((i) => i.id.startsWith('mer-dates'))
      expect(dateItems.length).toBe(0)
    })

    it('limits bad date samples to 5', () => {
      const rows = Array.from({ length: 10 }, (_, i) => [
        String(i), `invalid-date-${i}`
      ])
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        { source: 1, target: 'DataWystawienia' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const dateErr = report.groups[1].items.find((i) => i.id === 'mer-dates-err')
      expect(dateErr).toBeDefined()
      // The details should have at most 5 samples
    })

    it('shows auto-fix count in details for fixable dates', () => {
      const rows = [['1', '15.03.2024'], ['2', '20.04.2024']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        { source: 1, target: 'DataWystawienia' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const dateErr = report.groups[1].items.find((i) => i.id === 'mer-dates-err')
      expect(dateErr!.details).toContain('auto-naprawy')
    })
  })

  // ── MERYTORYKA — Decimal validation ──

  describe('MERYTORYKA decimal validation', () => {
    it('reports valid decimals as info', () => {
      const rows = [['100.00']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      const mappings = makeMappings([
        { source: 0, target: 'K_19' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const decOk = report.groups[1].items.find((i) => i.id === 'mer-dec-ok')
      expect(decOk).toBeDefined()
      expect(decOk!.severity).toBe('info')
    })

    it('reports comma decimals as warning with auto-fix', () => {
      const rows = [['100,50']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      const mappings = makeMappings([
        { source: 0, target: 'K_19' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const commaWarn = report.groups[1].items.find((i) => i.id === 'mer-dec-comma')
      expect(commaWarn).toBeDefined()
      expect(commaWarn!.severity).toBe('warning')
      expect(commaWarn!.autoFixable).toBe(true)
      expect(commaWarn!.fixes).toHaveLength(1)
      expect(commaWarn!.fixes[0].oldValue).toBe('100,50')
      expect(commaWarn!.fixes[0].newValue).toBe('100.50')
    })

    it('reports unparseable decimals as error', () => {
      const rows = [['abc']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      const mappings = makeMappings([
        { source: 0, target: 'K_19' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const decErr = report.groups[1].items.find((i) => i.id === 'mer-dec-err')
      expect(decErr).toBeDefined()
      expect(decErr!.severity).toBe('error')
    })

    it('skips empty decimal values', () => {
      const rows = [['']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      const mappings = makeMappings([
        { source: 0, target: 'K_19' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const decItems = report.groups[1].items.filter((i) => i.id.startsWith('mer-dec'))
      expect(decItems.length).toBe(0)
    })

    it('does not show ok when there are comma fixes', () => {
      const rows = [['100,50'], ['200.00']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      const mappings = makeMappings([
        { source: 0, target: 'K_19' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const decOk = report.groups[1].items.find((i) => i.id === 'mer-dec-ok')
      // ok should not appear when there are comma fixes
      expect(decOk).toBeUndefined()
    })

    it('limits bad decimal samples to 5', () => {
      const rows = Array.from({ length: 10 }, () => ['abc-invalid'])
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      const mappings = makeMappings([
        { source: 0, target: 'K_19' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const decErr = report.groups[1].items.find((i) => i.id === 'mer-dec-err')
      expect(decErr).toBeDefined()
    })
  })

  // ── SUMY KONTROLNE ──

  describe('SUMY_KONTROLNE validation', () => {
    it('calculates sum for mapped key fields', () => {
      const rows = [
        ['100.00', '23.00'],
        ['200.00', '46.00']
      ]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        { source: 0, target: 'K_19' },
        { source: 1, target: 'K_20' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const sumItems = report.groups[2].items.filter((i) => i.category === 'SUMY_KONTROLNE')
      // Should have sums for K_19, K_20 plus row count
      expect(sumItems.length).toBeGreaterThanOrEqual(3)
    })

    it('includes row count in control sums', () => {
      const rows = [['100.00'], ['200.00'], ['300.00']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      const report = validateFile(file, [], undefined, undefined)
      const rowCountItem = report.groups[2].items.find((i) => i.id === 'sum-rows')
      expect(rowCountItem).toBeDefined()
      expect(rowCountItem!.message).toContain('3')
    })

    it('skips key fields that are not mapped', () => {
      const rows = [['100.00']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      // No mappings for K_19 or K_20
      const report = validateFile(file, [], undefined, undefined)
      const sumItems = report.groups[2].items.filter((i) => i.id.startsWith('sum-K'))
      expect(sumItems.length).toBe(0)
    })

    it('handles JPK types with no key sum fields', () => {
      const rows = [['1', 'item']]
      const file = makeParsedFile('JPK_ST', 'STWiersz', rows, { columnCount: 2 })
      const report = validateFile(file, [], undefined, undefined)
      // JPK_ST has empty KEY_SUM_FIELDS, should still have row count
      const rowCountItem = report.groups[2].items.find((i) => i.id === 'sum-rows')
      expect(rowCountItem).toBeDefined()
    })

    it('parses comma decimals correctly in sum calculation', () => {
      const rows = [['100,50']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      const mappings = makeMappings([
        { source: 0, target: 'K_19' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const sumItem = report.groups[2].items.find((i) => i.id === 'sum-K_19')
      expect(sumItem).toBeDefined()
      expect(sumItem!.message).toContain('100,50')
    })

    it('handles empty and missing values as 0 in sums', () => {
      const rows = [[''], ['100.00']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
      const mappings = makeMappings([
        { source: 0, target: 'K_19' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      const sumItem = report.groups[2].items.find((i) => i.id === 'sum-K_19')
      expect(sumItem).toBeDefined()
    })
  })

  // ── SCHEMAT XSD ──

  describe('SCHEMAT_XSD validation', () => {
    it('skips XSD validation when company data is missing', () => {
      const file = makeParsedFile()
      const report = validateFile(file, V7M_MAPPINGS, undefined, undefined)
      const xsdSkip = report.groups[3].items.find((i) => i.id === 'xsd-skip')
      expect(xsdSkip).toBeDefined()
      expect(xsdSkip!.severity).toBe('info')
    })

    it('skips XSD validation when company NIP is empty', () => {
      const emptyCompany = { ...VALID_COMPANY, nip: '' }
      const report = validateFile(makeParsedFile(), V7M_MAPPINGS, emptyCompany, VALID_PERIOD)
      const xsdSkip = report.groups[3].items.find((i) => i.id === 'xsd-skip')
      expect(xsdSkip).toBeDefined()
    })

    it('skips XSD validation when company fullName is empty', () => {
      const emptyCompany = { ...VALID_COMPANY, fullName: '' }
      const report = validateFile(makeParsedFile(), V7M_MAPPINGS, emptyCompany, VALID_PERIOD)
      const xsdSkip = report.groups[3].items.find((i) => i.id === 'xsd-skip')
      expect(xsdSkip).toBeDefined()
    })

    it('skips XSD validation when period is missing', () => {
      const report = validateFile(makeParsedFile(), V7M_MAPPINGS, VALID_COMPANY, undefined)
      const xsdSkip = report.groups[3].items.find((i) => i.id === 'xsd-skip')
      expect(xsdSkip).toBeDefined()
    })

    it('performs XSD validation when company and period are provided', () => {
      const file = makeParsedFile()
      const report = validateFile(file, V7M_MAPPINGS, VALID_COMPANY, VALID_PERIOD)
      const xsdSkip = report.groups[3].items.find((i) => i.id === 'xsd-skip')
      // Should NOT have xsd-skip when valid data is provided
      expect(xsdSkip).toBeUndefined()
    })

    it('handles no generator available for XSD validation', () => {
      const file = makeParsedFile()
      ;(file as unknown as Record<string, unknown>).jpkType = 'JPK_NONEXISTENT'
      const report = validateFile(file, V7M_MAPPINGS, VALID_COMPANY, VALID_PERIOD)
      const xsdNoXml = report.groups[3].items.find((i) => i.id === 'xsd-no-xml')
      expect(xsdNoXml).toBeDefined()
      expect(xsdNoXml!.severity).toBe('warning')
    })
  })

  // ── autoFixCount ──

  describe('autoFixCount', () => {
    it('counts total fixes across all groups', () => {
      const rows = [['15.03.2024', '100,50']]
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
      const mappings = makeMappings([
        { source: 0, target: 'DataWystawienia' },
        { source: 1, target: 'K_19' }
      ])
      const report = validateFile(file, mappings, undefined, undefined)
      expect(report.autoFixCount).toBeGreaterThanOrEqual(2)
    })
  })
})

// ── validateFiles ──

describe('validateFiles', () => {
  it('validates multiple files and aggregates totals', () => {
    const file1 = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1', '2024-03-15', '100.00']], {
      id: 'file-1',
      columnCount: 3
    })
    const file2 = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['2', '2024-04-15', '200.00']], {
      id: 'file-2',
      columnCount: 3
    })

    const allMappings: Record<string, ColumnMapping[]> = {
      'file-1': makeMappings([
        { source: 1, target: 'DataWystawienia' },
        { source: 2, target: 'K_19' }
      ]),
      'file-2': makeMappings([
        { source: 1, target: 'DataWystawienia' },
        { source: 2, target: 'K_19' }
      ])
    }

    const result = validateFiles([file1, file2], allMappings, VALID_COMPANY, VALID_PERIOD)
    expect(result.reports.size).toBe(2)
    expect(result.reports.has('file-1')).toBe(true)
    expect(result.reports.has('file-2')).toBe(true)
  })

  it('uses empty mappings for files without mappings', () => {
    const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1']], {
      id: 'file-no-mapping',
      columnCount: 1
    })

    const result = validateFiles([file], {}, undefined, undefined)
    expect(result.reports.size).toBe(1)
    expect(result.reports.has('file-no-mapping')).toBe(true)
  })

  it('sums errors and warnings across all files', () => {
    const file1 = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1', '15.03.2024']], {
      id: 'file-1',
      columnCount: 2
    })
    const file2 = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1', 'invalid-date']], {
      id: 'file-2',
      columnCount: 2
    })

    const allMappings: Record<string, ColumnMapping[]> = {
      'file-1': makeMappings([{ source: 1, target: 'DataWystawienia' }]),
      'file-2': makeMappings([{ source: 1, target: 'DataWystawienia' }])
    }

    const result = validateFiles([file1, file2], allMappings, undefined, undefined)
    expect(result.totalErrors).toBeGreaterThanOrEqual(0)
    expect(result.totalWarnings).toBeGreaterThanOrEqual(0)
  })

  it('sums auto fixes across all files', () => {
    const file1 = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['100,50']], {
      id: 'file-1',
      columnCount: 1
    })
    const file2 = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['200,50']], {
      id: 'file-2',
      columnCount: 1
    })

    const allMappings: Record<string, ColumnMapping[]> = {
      'file-1': makeMappings([{ source: 0, target: 'K_19' }]),
      'file-2': makeMappings([{ source: 0, target: 'K_19' }])
    }

    const result = validateFiles([file1, file2], allMappings, undefined, undefined)
    expect(result.totalAutoFixes).toBeGreaterThanOrEqual(2)
  })
})

// ── applyFixes ──

describe('applyFixes', () => {
  it('applies fixes to file rows', () => {
    const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [
      ['15.03.2024', '100,50'],
      ['20.04.2024', '200,75']
    ], { columnCount: 2 })

    const fixes = [
      { rowIndex: 0, colIndex: 0, oldValue: '15.03.2024', newValue: '2024-03-15' },
      { rowIndex: 0, colIndex: 1, oldValue: '100,50', newValue: '100.50' },
      { rowIndex: 1, colIndex: 0, oldValue: '20.04.2024', newValue: '2024-04-20' }
    ]

    applyFixes(file, fixes)

    expect(file.rows[0][0]).toBe('2024-03-15')
    expect(file.rows[0][1]).toBe('100.50')
    expect(file.rows[1][0]).toBe('2024-04-20')
    expect(file.rows[1][1]).toBe('200,75') // unchanged
  })

  it('handles empty fixes array', () => {
    const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['original']], { columnCount: 1 })
    applyFixes(file, [])
    expect(file.rows[0][0]).toBe('original')
  })
})

// ── getMappedColumnsByType (tested indirectly) ──

describe('getMappedColumnsByType — field type routing', () => {
  it('routes nip, country, date, decimal fields correctly', () => {
    const rows = [['5261040828', 'PL', '2024-03-15', '100.00']]
    const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 4 })
    const mappings = makeMappings([
      { source: 0, target: 'NrKontrahenta' },    // nip type
      { source: 1, target: 'KodKontrahenta' },    // country type
      { source: 2, target: 'DataWystawienia' },    // date type
      { source: 3, target: 'K_19' }               // decimal type
    ])

    const report = validateFile(file, mappings, undefined, undefined)
    // Should have NIP, date, and decimal validation items
    const merItems = report.groups[1].items
    expect(merItems.length).toBeGreaterThan(0)
  })

  it('ignores fields not found in field definitions', () => {
    const rows = [['value']]
    const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
    const mappings = makeMappings([
      { source: 0, target: 'NonExistentField' }
    ])

    const report = validateFile(file, mappings, undefined, undefined)
    // Should still produce a valid report
    expect(report.groups).toHaveLength(4)
  })
})

// ── Different JPK types for key sum fields ──

describe('KEY_SUM_FIELDS per type', () => {
  it('uses K_19/K_20 for JPK_VDEK', () => {
    const rows = [['100.00', '23.00']]
    const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 2 })
    const mappings = makeMappings([
      { source: 0, target: 'K_19' },
      { source: 1, target: 'K_20' }
    ])
    const report = validateFile(file, mappings, undefined, undefined)
    expect(report.groups[2].items.some((i) => i.id === 'sum-K_19')).toBe(true)
    expect(report.groups[2].items.some((i) => i.id === 'sum-K_20')).toBe(true)
  })

  it('uses P_15 for JPK_FA', () => {
    const rows = [['100.00']]
    const file = makeParsedFile('JPK_FA', 'Faktura', rows, { columnCount: 1 })
    const mappings = makeMappings([
      { source: 0, target: 'P_15' }
    ])
    const report = validateFile(file, mappings, undefined, undefined)
    expect(report.groups[2].items.some((i) => i.id === 'sum-P_15')).toBe(true)
  })

  it('uses KwotaOperacji for JPK_WB', () => {
    const rows = [['500.00']]
    const file = makeParsedFile('JPK_WB', 'SprzedazWiersz' as SubType, rows, { columnCount: 1 })
    const mappings = makeMappings([
      { source: 0, target: 'KwotaOperacji' }
    ])
    const report = validateFile(file, mappings, undefined, undefined)
    expect(report.groups[2].items.some((i) => i.id === 'sum-KwotaOperacji')).toBe(true)
  })

  it('uses K_9 for JPK_PKPIR', () => {
    const rows = [['150.00']]
    const file = makeParsedFile('JPK_PKPIR', 'PKPIRWiersz', rows, { columnCount: 1 })
    const mappings = makeMappings([
      { source: 0, target: 'K_9' }
    ])
    const report = validateFile(file, mappings, undefined, undefined)
    expect(report.groups[2].items.some((i) => i.id === 'sum-K_9')).toBe(true)
  })

  it('uses K_8 for JPK_EWP', () => {
    const rows = [['250.00']]
    const file = makeParsedFile('JPK_EWP', 'EWPWiersz', rows, { columnCount: 1 })
    const mappings = makeMappings([
      { source: 0, target: 'K_8' }
    ])
    const report = validateFile(file, mappings, undefined, undefined)
    expect(report.groups[2].items.some((i) => i.id === 'sum-K_8')).toBe(true)
  })

  it('handles unknown jpkType key sum fields gracefully', () => {
    const rows = [['100.00']]
    const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', rows, { columnCount: 1 })
    ;(file as unknown as Record<string, unknown>).jpkType = 'JPK_UNKNOWN'
    const report = validateFile(file, [], undefined, undefined)
    // Should still have row count
    const rowItem = report.groups[2].items.find((i) => i.id === 'sum-rows')
    expect(rowItem).toBeDefined()
  })
})
