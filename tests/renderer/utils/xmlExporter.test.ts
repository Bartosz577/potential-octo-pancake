import { describe, it, expect } from 'vitest'
import { generateXmlForFile, getAvailableGenerators } from '../../../src/renderer/src/utils/xmlExporter'
import type { ParsedFile, JpkType, SubType } from '../../../src/renderer/src/types/index'
import type { CompanyData, PeriodData } from '../../../src/renderer/src/stores/companyStore'
import type { ColumnMapping } from '../../../src/core/mapping/AutoMapper'

// ── Fixtures ──

const company: CompanyData = {
  nip: '526-104-08-28',
  fullName: 'Test Sp. z o.o.',
  regon: '123456789',
  kodUrzedu: '1471',
  email: 'test@test.pl',
  phone: '123456789'
}

const period: PeriodData = {
  year: 2024,
  month: 3,
  celZlozenia: 1 as const
}

function makeParsedFile(
  jpkType: JpkType,
  subType: SubType,
  rows: string[][] = [['val1', 'val2', 'val3']],
  overrides: Partial<ParsedFile> = {}
): ParsedFile {
  return {
    id: 'test-1',
    filename: 'test.txt',
    system: 'NAMOS',
    jpkType,
    subType,
    pointCode: 'PP01',
    dateFrom: '',
    dateTo: '',
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

// ── generateXmlForFile ──

describe('generateXmlForFile', () => {
  // ── JPK_VDEK (V7M and V7K) ──

  describe('JPK_VDEK', () => {
    it('generates XML for JPK_VDEK with V7M subtype', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [
        ['1', 'PL', '9876543210', 'Kontrahent', 'FV/001', '2024-03-15', '2024-03-15']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'LpSprzedazy' },
        { source: 1, target: 'KodKontrahenta' },
        { source: 2, target: 'NrKontrahenta' }
      ])

      const result = generateXmlForFile(file, mappings, company, period, 'V7M')
      expect(result).not.toBeNull()
      expect(result!.xml).toContain('<?xml')
      expect(result!.filename).toBe('JPK_V7M_5261040828_2024-03.xml')
      expect(result!.rowCount).toBe(1)
      expect(result!.fileSize).toBeGreaterThan(0)
    })

    it('generates XML for JPK_VDEK with V7K subtype', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [
        ['1', 'PL', '9876543210']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'LpSprzedazy' },
        { source: 1, target: 'KodKontrahenta' }
      ])

      const result = generateXmlForFile(file, mappings, company, period, 'V7K')
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_V7K_5261040828_2024-03.xml')
      expect(result!.jpkType).toContain('V7K')
    })

    it('uses default V7M subtype when not specified', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1']])
      const mappings = makeMappings([{ source: 0, target: 'LpSprzedazy' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toContain('JPK_V7M')
    })

    it('normalizes NIP (removes dashes) in filename and input', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1']])
      const mappings = makeMappings([{ source: 0, target: 'LpSprzedazy' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result!.filename).toContain('5261040828')
    })

    it('pads month to two digits in filename', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1']])
      const mappings = makeMappings([{ source: 0, target: 'LpSprzedazy' }])
      const p = { ...period, month: 1 as const }

      const result = generateXmlForFile(file, mappings, company, p as PeriodData)
      expect(result!.filename).toContain('2024-01')
    })
  })

  // ── JPK_FA ──

  describe('JPK_FA', () => {
    it('generates XML for JPK_FA', () => {
      const file = makeParsedFile('JPK_FA', 'Faktura', [
        ['FV/001', '2024-03-15', '100.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'P_2A' },
        { source: 1, target: 'P_1' },
        { source: 2, target: 'P_15' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_FA_5261040828_2024-03.xml')
      expect(result!.jpkType).toContain('FA')
    })

    it('uses file dateFrom/dateTo when provided', () => {
      const file = makeParsedFile('JPK_FA', 'Faktura', [['val']], {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      })
      const mappings = makeMappings([{ source: 0, target: 'P_2A' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.xml).toContain('2024-01-01')
      expect(result!.xml).toContain('2024-01-31')
    })

    it('uses fallback dates when file has no dateFrom/dateTo', () => {
      const file = makeParsedFile('JPK_FA', 'Faktura', [['val']])
      const mappings = makeMappings([{ source: 0, target: 'P_2A' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      // Fallback: YYYY-MM-01 and YYYY-MM-28
      expect(result!.xml).toContain('2024-03-01')
      expect(result!.xml).toContain('2024-03-28')
    })
  })

  // ── JPK_MAG ──

  describe('JPK_MAG', () => {
    it('generates XML for JPK_MAG with WZ subtype', () => {
      const file = makeParsedFile('JPK_MAG', 'WZ', [
        ['WZ/001', 'Item1', '10.00', 'MAG1']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'NumerWZ' },
        { source: 1, target: 'NazwaTowaru' },
        { source: 2, target: 'WartoscPozycji' },
        { source: 3, target: 'NazwaMagazynu' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_MAG_5261040828_2024-03.xml')
    })

    it('generates XML for JPK_MAG with PZ subtype', () => {
      const file = makeParsedFile('JPK_MAG', 'PZ', [
        ['PZ/001', 'Item1', '20.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'NumerPZ' },
        { source: 1, target: 'NazwaTowaru' },
        { source: 2, target: 'WartoscPozycji' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('generates XML for JPK_MAG with RW subtype', () => {
      const file = makeParsedFile('JPK_MAG', 'RW' as SubType, [
        ['RW/001', 'Item1', '30.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'NumerRW' },
        { source: 1, target: 'NazwaTowaru' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('generates XML for JPK_MAG with MM subtype', () => {
      const file = makeParsedFile('JPK_MAG', 'MM', [
        ['MM/001', 'Item1', '40.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'NumerMM' },
        { source: 1, target: 'NazwaTowaru' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('uses fallback WZ config for unknown MAG subtype', () => {
      // Testing the `MAG_CONFIG[file.subType] || MAG_CONFIG['WZ']` branch
      const file = makeParsedFile('JPK_MAG', 'WZ', [
        ['WZ/001', 'Item1']
      ])
      // Force an unrecognized subType to test the fallback
      ;(file as unknown as Record<string, unknown>).subType = 'UNKNOWN_SUB'

      const mappings = makeMappings([
        { source: 0, target: 'NumerWZ' },
        { source: 1, target: 'NazwaTowaru' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('groups MAG records by document number', () => {
      const file = makeParsedFile('JPK_MAG', 'WZ', [
        ['WZ/001', 'Item1', '10.00'],
        ['WZ/001', 'Item2', '20.00'],
        ['WZ/002', 'Item3', '30.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'NumerWZ' },
        { source: 1, target: 'NazwaTowaru' },
        { source: 2, target: 'WartoscPozycji' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('uses "UNKNOWN" for missing document number in MAG grouping', () => {
      const file = makeParsedFile('JPK_MAG', 'WZ', [
        ['', 'Item1', '10.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'NumerWZ' },
        { source: 1, target: 'NazwaTowaru' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('reads magazine name from NazwaMagazynu or Magazyn column', () => {
      const file = makeParsedFile('JPK_MAG', 'WZ', [
        ['WZ/001', 'Item1', '10.00', '', 'WAREHOUSE_A']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'NumerWZ' },
        { source: 1, target: 'NazwaTowaru' },
        { source: 4, target: 'Magazyn' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('uses file dates when available', () => {
      const file = makeParsedFile('JPK_MAG', 'WZ', [['WZ/001', 'Item1']], {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      })
      const mappings = makeMappings([
        { source: 0, target: 'NumerWZ' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.xml).toContain('2024-01-01')
    })
  })

  // ── JPK_WB ──

  describe('JPK_WB', () => {
    it('generates XML for JPK_WB', () => {
      const file = makeParsedFile('JPK_WB', 'SprzedazWiersz' as SubType, [
        ['2024-03-01', 'Kontrahent A', 'Przelew', '100.00', '500.00', 'PL12345678901234567890123456', '1000.00', '1100.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'DataOperacji' },
        { source: 1, target: 'NazwaKontrahenta' },
        { source: 2, target: 'OpisOperacji' },
        { source: 3, target: 'KwotaOperacji' },
        { source: 4, target: 'SaldoOperacji' },
        { source: 5, target: 'NumerRachunku' },
        { source: 6, target: 'SaldoPoczatkowe' },
        { source: 7, target: 'SaldoKoncowe' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_WB_5261040828_2024-03.xml')
    })

    it('uses NazwaPodmiotu as fallback for NazwaKontrahenta', () => {
      const file = makeParsedFile('JPK_WB', 'SprzedazWiersz' as SubType, [
        ['2024-03-01', '', 'Przelew', '100.00', '500.00', '', '', '', 'Kontrahent B']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'DataOperacji' },
        { source: 2, target: 'OpisOperacji' },
        { source: 3, target: 'KwotaOperacji' },
        { source: 4, target: 'SaldoOperacji' },
        { source: 8, target: 'NazwaPodmiotu' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('uses default bank account when NumerRachunku is not mapped', () => {
      const file = makeParsedFile('JPK_WB', 'SprzedazWiersz' as SubType, [
        ['2024-03-01', 'Kontrahent', 'Przelew', '100.00', '500.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'DataOperacji' },
        { source: 3, target: 'KwotaOperacji' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('includes regon when provided', () => {
      const file = makeParsedFile('JPK_WB', 'SprzedazWiersz' as SubType, [
        ['2024-03-01', 'K', 'O', '100', '500']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'DataOperacji' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })
  })

  // ── JPK_PKPIR ──

  describe('JPK_PKPIR', () => {
    it('generates XML for JPK_PKPIR', () => {
      const file = makeParsedFile('JPK_PKPIR', 'PKPIRWiersz', [
        ['1', '2024-03-01', '100.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'K_1' },
        { source: 1, target: 'K_2' },
        { source: 2, target: 'K_9' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_PKPIR_5261040828_2024-03.xml')
    })

    it('uses file dates with dataDo fallback to year-end', () => {
      const file = makeParsedFile('JPK_PKPIR', 'PKPIRWiersz', [['1']])
      const mappings = makeMappings([{ source: 0, target: 'K_1' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      // Fallback dataDo is YYYY-12-31
      expect(result!.xml).toContain('2024-12-31')
    })
  })

  // ── JPK_EWP ──

  describe('JPK_EWP', () => {
    it('generates XML for JPK_EWP', () => {
      const file = makeParsedFile('JPK_EWP', 'EWPWiersz', [
        ['1', '2024-03-01', '200.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'K_1' },
        { source: 1, target: 'K_2' },
        { source: 2, target: 'K_8' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_EWP_5261040828_2024-03.xml')
    })

    it('uses file dateFrom if present', () => {
      const file = makeParsedFile('JPK_EWP', 'EWPWiersz', [['1']], {
        dateFrom: '2024-06-01',
        dateTo: '2024-06-30'
      })
      const mappings = makeMappings([{ source: 0, target: 'K_1' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.xml).toContain('2024-06-01')
    })
  })

  // ── JPK_KR_PD ──

  describe('JPK_KR_PD', () => {
    it('generates XML for JPK_KR_PD', () => {
      const file = makeParsedFile('JPK_KR_PD', 'Dziennik', [
        ['1', '2024-03-01', '100.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'D_1' },
        { source: 1, target: 'D_2' },
        { source: 2, target: 'D_11' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_KR_PD_5261040828_2024-03.xml')
    })

    it('includes regon in podmiot when provided', () => {
      const file = makeParsedFile('JPK_KR_PD', 'Dziennik', [['1']])
      const mappings = makeMappings([{ source: 0, target: 'D_1' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('excludes regon when empty', () => {
      const file = makeParsedFile('JPK_KR_PD', 'Dziennik', [['1']])
      const mappings = makeMappings([{ source: 0, target: 'D_1' }])
      const companyNoRegon = { ...company, regon: '' }

      const result = generateXmlForFile(file, mappings, companyNoRegon, period)
      expect(result).not.toBeNull()
    })
  })

  // ── JPK_ST ──

  describe('JPK_ST', () => {
    it('generates XML for JPK_ST', () => {
      const file = makeParsedFile('JPK_ST', 'STWiersz', [
        ['1', 'Komputer', '5000.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'K_1' },
        { source: 1, target: 'K_2' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_ST_5261040828_2024-03.xml')
    })
  })

  // ── JPK_ST_KR ──

  describe('JPK_ST_KR', () => {
    it('generates XML for JPK_ST_KR', () => {
      const file = makeParsedFile('JPK_ST_KR', 'STKrWiersz', [
        ['1', 'Budynek', '100000.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'K_1' },
        { source: 1, target: 'K_2' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_ST_KR_5261040828_2024-03.xml')
    })

    it('uses file date range when provided', () => {
      const file = makeParsedFile('JPK_ST_KR', 'STKrWiersz', [['1']], {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31'
      })
      const mappings = makeMappings([{ source: 0, target: 'K_1' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.xml).toContain('2024-01-01')
      expect(result!.xml).toContain('2024-12-31')
    })

    it('uses fallback dates when file has no dates', () => {
      const file = makeParsedFile('JPK_ST_KR', 'STKrWiersz', [['1']])
      const mappings = makeMappings([{ source: 0, target: 'K_1' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      // Fallback: YYYY-01-01 to YYYY-12-31
      expect(result!.xml).toContain('2024-01-01')
      expect(result!.xml).toContain('2024-12-31')
    })
  })

  // ── JPK_FA_RR ──

  describe('JPK_FA_RR', () => {
    it('generates XML for JPK_FA_RR', () => {
      const file = makeParsedFile('JPK_FA_RR', 'FaRrFaktura', [
        ['FV-RR/001', '2024-03-15', '100.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'P_1' },
        { source: 1, target: 'P_2' },
        { source: 2, target: 'P_12_1' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_FA_RR_5261040828_2024-03.xml')
    })
  })

  // ── JPK_KR ──

  describe('JPK_KR', () => {
    it('generates XML for JPK_KR', () => {
      const file = makeParsedFile('JPK_KR', 'KrDziennik', [
        ['1', '2024-03-01', '100.00']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'DziennikNumerZapisu' },
        { source: 1, target: 'DziennikDataOperacji' },
        { source: 2, target: 'DziennikKwotaOperacji' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.filename).toBe('JPK_KR_5261040828_2024-03.xml')
    })

    it('uses fallback dataDo YYYY-12-31 for KR', () => {
      const file = makeParsedFile('JPK_KR', 'KrDziennik', [['1']])
      const mappings = makeMappings([{ source: 0, target: 'DziennikNumerZapisu' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.xml).toContain('2024-12-31')
    })
  })

  // ── Edge cases ──

  describe('edge cases', () => {
    it('returns null when no generator is registered for the JPK type', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1']])
      // Force an unrecognized jpkType to test null return
      ;(file as unknown as Record<string, unknown>).jpkType = 'JPK_UNKNOWN'

      const mappings = makeMappings([{ source: 0, target: 'LpSprzedazy' }])
      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).toBeNull()
    })

    it('rowsToRecords maps source columns to target fields', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [
        ['1', 'PL', '9876543210'],
        ['2', 'DE', '1234567890']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'LpSprzedazy' },
        { source: 1, target: 'KodKontrahenta' },
        { source: 2, target: 'NrKontrahenta' }
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      // Both rows should be present
      expect(result!.rowCount).toBe(2)
    })

    it('handles empty source column gracefully (defaults to empty string)', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [
        ['1', '', '']
      ])
      const mappings = makeMappings([
        { source: 0, target: 'LpSprzedazy' },
        { source: 5, target: 'DataWystawienia' }  // column 5 doesn't exist
      ])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
    })

    it('returns schemaVersion and namespace from generator', () => {
      const file = makeParsedFile('JPK_VDEK', 'SprzedazWiersz', [['1']])
      const mappings = makeMappings([{ source: 0, target: 'LpSprzedazy' }])

      const result = generateXmlForFile(file, mappings, company, period)
      expect(result).not.toBeNull()
      expect(result!.schemaVersion).toBeTruthy()
      expect(result!.namespace).toBeTruthy()
    })
  })
})

// ── getAvailableGenerators ──

describe('getAvailableGenerators', () => {
  it('returns a non-empty list of generators', () => {
    const generators = getAvailableGenerators()
    expect(generators.length).toBeGreaterThan(0)
  })

  it('each generator has jpkType and version', () => {
    const generators = getAvailableGenerators()
    for (const g of generators) {
      expect(g.jpkType).toBeTruthy()
      expect(g.version).toBeTruthy()
    }
  })

  it('includes V7M generator', () => {
    const generators = getAvailableGenerators()
    const v7m = generators.find((g) => g.jpkType.includes('V7M'))
    expect(v7m).toBeDefined()
  })

  it('includes FA generator', () => {
    const generators = getAvailableGenerators()
    const fa = generators.find((g) => g.jpkType.includes('FA') && !g.jpkType.includes('FA_RR'))
    expect(fa).toBeDefined()
  })

  it('includes all major JPK types', () => {
    const generators = getAvailableGenerators()
    const types = generators.map((g) => g.jpkType)
    expect(types).toContain('JPK_V7M')
    expect(types).toContain('JPK_FA')
    expect(types).toContain('JPK_MAG')
    expect(types).toContain('JPK_WB')
  })
})
