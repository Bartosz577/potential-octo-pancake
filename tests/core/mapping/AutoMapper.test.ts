import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { autoMap, applyPositionalMapping, detectProfileHint } from '../../../src/core/mapping/AutoMapper'
import { JPK_V7M_SPRZEDAZ_FIELDS, JPK_FA_FAKTURA_FIELDS, JPK_MAG_WZ_FIELDS } from '../../../src/core/mapping/JpkFieldDefinitions'
import { SYSTEM_PROFILES } from '../../../src/core/mapping/SystemProfiles'
import { TxtFileReader } from '../../../src/core/readers/TxtFileReader'
import type { RawSheet } from '../../../src/core/models/types'

const TEST_DATA_DIR = join(__dirname, '..', '..', '..', 'test-data')

/** Helper to create a simple RawSheet */
function makeSheet(opts: { headers?: string[]; rows: string[][]; metadata?: Record<string, string> }): RawSheet {
  return {
    name: 'test',
    headers: opts.headers,
    rows: opts.rows.map((cells, i) => ({ index: i, cells })),
    metadata: opts.metadata ?? {},
  }
}

describe('AutoMapper', () => {
  describe('autoMap — header-based matching', () => {
    it('maps exact field names in headers', () => {
      const sheet = makeSheet({
        headers: ['LpSprzedazy', 'NrKontrahenta', 'DowodSprzedazy', 'DataWystawienia'],
        rows: [['1', '1234567890', 'FV/001', '2026-01-15']],
      })
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)

      expect(result.mappings.length).toBeGreaterThanOrEqual(4)
      const mapped = Object.fromEntries(result.mappings.map((m) => [m.targetField, m]))

      expect(mapped['LpSprzedazy'].confidence).toBe(1.0)
      expect(mapped['LpSprzedazy'].method).toBe('exact')
      expect(mapped['NrKontrahenta'].confidence).toBe(1.0)
      expect(mapped['DowodSprzedazy'].confidence).toBe(1.0)
    })

    it('maps synonyms (nip → NrKontrahenta)', () => {
      const sheet = makeSheet({
        headers: ['nip', 'nr_faktury', 'data_wystawienia'],
        rows: [['1234567890', 'FV/001', '2026-01-15']],
      })
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)

      const mapped = Object.fromEntries(result.mappings.map((m) => [m.targetField, m]))

      expect(mapped['NrKontrahenta']).toBeDefined()
      expect(mapped['NrKontrahenta'].confidence).toBeGreaterThanOrEqual(0.9)
      expect(mapped['NrKontrahenta'].method).toBe('synonym')

      expect(mapped['DowodSprzedazy']).toBeDefined()
      expect(mapped['DowodSprzedazy'].confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('maps label-based matches', () => {
      const sheet = makeSheet({
        headers: ['Lp.', 'Nr dokumentu', 'Data wystawienia'],
        rows: [['1', 'FV/001', '2026-01-15']],
      })
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)

      const fieldNames = result.mappings.map((m) => m.targetField)
      expect(fieldNames).toContain('LpSprzedazy')
      expect(fieldNames).toContain('DowodSprzedazy')
    })

    it('maps FA fields by synonyms', () => {
      const sheet = makeSheet({
        headers: ['waluta', 'data_wystawienia', 'numer_faktury', 'nabywca', 'brutto'],
        rows: [['PLN', '2026-01-15', 'FV/001', 'Firma ABC', '123,00']],
      })
      const result = autoMap(sheet, JPK_FA_FAKTURA_FIELDS)

      const fieldNames = result.mappings.map((m) => m.targetField)
      expect(fieldNames).toContain('KodWaluty')
      expect(fieldNames).toContain('P_1')
      expect(fieldNames).toContain('P_2')
      expect(fieldNames).toContain('P_15')
    })

    it('handles case-insensitive matching', () => {
      const sheet = makeSheet({
        headers: ['LPSPRZEDAZY', 'dowodsprzedazy', 'DataWystawienia'],
        rows: [['1', 'FV/001', '2026-01-15']],
      })
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)
      expect(result.mappings.length).toBeGreaterThanOrEqual(3)
    })

    it('handles diacritics in headers (ilość → qty synonym)', () => {
      const sheet = makeSheet({
        headers: ['kod', 'nazwa', 'ilość', 'cena'],
        rows: [['1234', 'Produkt', '10', '25,50']],
      })
      const result = autoMap(sheet, JPK_MAG_WZ_FIELDS)

      const fieldNames = result.mappings.map((m) => m.targetField)
      expect(fieldNames).toContain('KodTowaru')
      expect(fieldNames).toContain('NazwaTowaru')
      expect(fieldNames).toContain('IloscWydana')
    })
  })

  describe('autoMap — no headers (type-based)', () => {
    it('infers date columns from sample values', () => {
      const sheet = makeSheet({
        rows: [
          ['1', '2026-01-15', 'FV/001', '100,50'],
          ['2', '2026-01-16', 'FV/002', '200,00'],
          ['3', '2026-01-17', 'FV/003', '350,75'],
        ],
      })
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)

      // Should identify col 1 as a date type
      const dateMapping = result.mappings.find(
        (m) => m.sourceColumn === 1 && m.confidence > 0
      )
      expect(dateMapping).toBeDefined()
    })

    it('reports unmapped fields', () => {
      const sheet = makeSheet({
        rows: [['1', '2', '3']],
      })
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)
      expect(result.unmappedFields.length).toBeGreaterThan(0)
    })

    it('reports unmapped columns', () => {
      const sheet = makeSheet({
        rows: [['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']],
      })
      const result = autoMap(sheet, JPK_MAG_WZ_FIELDS)
      expect(result.unmappedColumns.length).toBeGreaterThan(0)
    })
  })

  describe('autoMap — edge cases', () => {
    it('handles empty sheet', () => {
      const sheet = makeSheet({ rows: [] })
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)
      expect(result.mappings).toHaveLength(0)
      expect(result.unmappedFields.length).toBe(JPK_V7M_SPRZEDAZ_FIELDS.length)
    })

    it('handles empty field definitions', () => {
      const sheet = makeSheet({ rows: [['a', 'b']] })
      const result = autoMap(sheet, [])
      expect(result.mappings).toHaveLength(0)
      expect(result.unmappedColumns).toEqual([0, 1])
    })

    it('does not map same column to two fields', () => {
      const sheet = makeSheet({
        headers: ['nip'],
        rows: [['1234567890']],
      })
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)

      const col0Mappings = result.mappings.filter((m) => m.sourceColumn === 0)
      expect(col0Mappings).toHaveLength(1)
    })

    it('does not map same field to two columns', () => {
      const sheet = makeSheet({
        headers: ['NrKontrahenta', 'NrKontrahenta'],
        rows: [['111', '222']],
      })
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)

      const nipMappings = result.mappings.filter((m) => m.targetField === 'NrKontrahenta')
      expect(nipMappings).toHaveLength(1)
    })
  })

  describe('autoMap — real NAMOS VDEK file (heuristic, no profile)', () => {
    it('matches some fields from an unknown format via type inference', () => {
      const reader = new TxtFileReader()
      const buffer = readFileSync(
        join(TEST_DATA_DIR, '0P549_NAMOS_JPK_VDEK_SprzedazWiersz_2026-01-01_2026-01-31_20260207020039.txt')
      )
      const fileResult = reader.read(buffer, 'namos_vdek.txt')
      const sheet = fileResult.sheets[0]

      // AutoMap without profile — heuristic only
      const result = autoMap(sheet, JPK_V7M_SPRZEDAZ_FIELDS)

      // Should find at least some matches via type inference
      expect(result.mappings.length).toBeGreaterThan(0)
    })
  })

  describe('detectProfileHint — Comarch Optima TXT', () => {
    it('detects Comarch VAT TXT from 14-col pipe data with NIP in col 3', () => {
      const sheet = makeSheet({
        rows: [
          ['FV/001', '2026-01-15', '2026-01-15', '5213456789', 'Firma', '1000,00', '230,00', '0,00', '0,00', '0,00', '0,00', '0,00', '1230,00', 'PLN'],
          ['FV/002', '2026-01-16', '2026-01-16', '7891234560', 'Handel', '500,00', '115,00', '0,00', '0,00', '0,00', '0,00', '0,00', '615,00', 'PLN'],
        ],
      })
      const hint = detectProfileHint(sheet)
      expect(hint).not.toBeNull()
      expect(hint!.profileId).toBe('COMARCH_OPTIMA_VAT_TXT')
      expect(hint!.confidence).toBe(0.92)
    })

    it('detects Comarch VAT TXT with "brak" as NIP', () => {
      const sheet = makeSheet({
        rows: [
          ['FV/001', '2026-01-15', '2026-01-15', 'brak', 'Osoba', '100,00', '23,00', '0,00', '0,00', '0,00', '0,00', '0,00', '123,00', 'PLN'],
          ['FV/002', '2026-01-16', '2026-01-16', 'brak', 'Inna', '200,00', '46,00', '0,00', '0,00', '0,00', '0,00', '0,00', '246,00', 'PLN'],
        ],
      })
      const hint = detectProfileHint(sheet)
      expect(hint).not.toBeNull()
      expect(hint!.profileId).toBe('COMARCH_OPTIMA_VAT_TXT')
    })

    it('detects Comarch VAT TXT with NIP dashes format', () => {
      const sheet = makeSheet({
        rows: [
          ['FV/001', '2026-01-15', '2026-01-15', '521-345-67-89', 'Firma', '1000,00', '230,00', '0,00', '0,00', '0,00', '0,00', '0,00', '1230,00', 'PLN'],
        ],
      })
      const hint = detectProfileHint(sheet)
      expect(hint).not.toBeNull()
      expect(hint!.profileId).toBe('COMARCH_OPTIMA_VAT_TXT')
    })

    it('returns null for sheets with too few columns', () => {
      const sheet = makeSheet({
        rows: [['a', 'b', 'c']],
      })
      expect(detectProfileHint(sheet)).toBeNull()
    })

    it('returns null for sheets with too many columns (NAMOS-like)', () => {
      const sheet = makeSheet({
        rows: [Array.from({ length: 64 }, (_, i) => `val_${i}`)],
      })
      expect(detectProfileHint(sheet)).toBeNull()
    })

    it('returns null when NIP ratio is too low', () => {
      const sheet = makeSheet({
        rows: [
          ['FV/001', '2026-01-15', '2026-01-15', 'not-a-nip', 'Firma', '100', '23', '0', '0', '0', '0', '0', '123', 'PLN'],
          ['FV/002', '2026-01-16', '2026-01-16', 'also-not', 'Firma2', '200', '46', '0', '0', '0', '0', '0', '246', 'PLN'],
        ],
      })
      expect(detectProfileHint(sheet)).toBeNull()
    })

    it('returns null when date ratio is too low', () => {
      const sheet = makeSheet({
        rows: [
          ['FV/001', 'not-a-date', '2026-01-15', '5213456789', 'Firma', '100', '23', '0', '0', '0', '0', '0', '123', 'PLN'],
          ['FV/002', 'also-not', '2026-01-16', '7891234560', 'Firma2', '200', '46', '0', '0', '0', '0', '0', '246', 'PLN'],
        ],
      })
      expect(detectProfileHint(sheet)).toBeNull()
    })

    it('returns null for empty sheet', () => {
      const sheet = makeSheet({ rows: [] })
      expect(detectProfileHint(sheet)).toBeNull()
    })
  })

  describe('detectProfileHint — Comarch Optima XML', () => {
    it('detects Comarch XML from headers with XML element names', () => {
      const sheet = makeSheet({
        headers: ['KodWaluty', 'DataWystawienia', 'NumerFaktury', 'NazwaKontrahenta', 'AdresKontrahenta', 'NIPNabywcy', 'BruttoRazem'],
        rows: [['PLN', '2026-01-10', 'FV/001', 'Firma', 'ul. Test 1', '5213456789', '1000.00']],
      })
      const hint = detectProfileHint(sheet)
      expect(hint).not.toBeNull()
      expect(hint!.profileId).toBe('COMARCH_OPTIMA_XML_FA')
      expect(hint!.confidence).toBe(0.95)
    })

    it('detects with minimum 3 Comarch XML markers', () => {
      const sheet = makeSheet({
        headers: ['NazwaKontrahenta', 'NIPNabywcy', 'BruttoRazem'],
        rows: [['Firma', '5213456789', '1000.00']],
      })
      const hint = detectProfileHint(sheet)
      expect(hint).not.toBeNull()
      expect(hint!.profileId).toBe('COMARCH_OPTIMA_XML_FA')
    })

    it('returns null with only 2 markers (insufficient)', () => {
      const sheet = makeSheet({
        headers: ['NazwaKontrahenta', 'BruttoRazem', 'SomeOtherField'],
        rows: [['Firma', '1000.00', 'abc']],
      })
      expect(detectProfileHint(sheet)).toBeNull()
    })

    it('XML detection takes priority over TXT detection', () => {
      // Headers suggest XML, but data could also match TXT pattern
      const sheet = makeSheet({
        headers: ['NazwaKontrahenta', 'AdresKontrahenta', 'NIPNabywcy', 'NIPSprzedawcy', 'BruttoRazem'],
        rows: [
          ['Firma', 'Adres', '5213456789', '6781234567', '1000.00'],
        ],
      })
      const hint = detectProfileHint(sheet)
      expect(hint).not.toBeNull()
      expect(hint!.profileId).toBe('COMARCH_OPTIMA_XML_FA')
      expect(hint!.confidence).toBe(0.95) // Higher than TXT 0.92
    })
  })

  describe('applyPositionalMapping', () => {
    it('creates mappings from position map', () => {
      const positionMap = { 0: 'LpSprzedazy', 1: 'KodKontrahenta', 2: 'NrKontrahenta' }
      const result = applyPositionalMapping(10, positionMap, JPK_V7M_SPRZEDAZ_FIELDS)

      expect(result.mappings).toHaveLength(3)
      expect(result.mappings[0].sourceColumn).toBe(0)
      expect(result.mappings[0].targetField).toBe('LpSprzedazy')
      expect(result.mappings[0].confidence).toBe(1.0)
      expect(result.mappings[0].method).toBe('position')
    })

    it('skips columns beyond column count', () => {
      const positionMap = { 0: 'LpSprzedazy', 100: 'NrKontrahenta' }
      const result = applyPositionalMapping(10, positionMap, JPK_V7M_SPRZEDAZ_FIELDS)
      expect(result.mappings).toHaveLength(1)
    })

    it('skips unknown field names', () => {
      const positionMap = { 0: 'NonExistentField' }
      const result = applyPositionalMapping(10, positionMap, JPK_V7M_SPRZEDAZ_FIELDS)
      expect(result.mappings).toHaveLength(0)
    })

    it('reports unmapped fields and columns', () => {
      const positionMap = { 0: 'LpSprzedazy' }
      const result = applyPositionalMapping(5, positionMap, JPK_V7M_SPRZEDAZ_FIELDS)

      expect(result.unmappedFields.length).toBe(JPK_V7M_SPRZEDAZ_FIELDS.length - 1)
      expect(result.unmappedColumns).toEqual([1, 2, 3, 4])
    })

    it('applies Comarch Optima VAT TXT positional mapping (14 columns)', () => {
      const profile = SYSTEM_PROFILES.find((p) => p.id === 'COMARCH_OPTIMA_VAT_TXT')!
      const result = applyPositionalMapping(14, profile.columnMap, profile.fields)

      expect(result.mappings.length).toBe(12) // 12 mapped out of 14

      const mapped = Object.fromEntries(result.mappings.map((m) => [m.targetField, m.sourceColumn]))
      expect(mapped['DowodSprzedazy']).toBe(0)
      expect(mapped['DataWystawienia']).toBe(1)
      expect(mapped['DataSprzedazy']).toBe(2)
      expect(mapped['NrKontrahenta']).toBe(3)
      expect(mapped['NazwaKontrahenta']).toBe(4)
      expect(mapped['K_10']).toBe(5)
      expect(mapped['K_11']).toBe(6)
      expect(mapped['K_17']).toBe(11)

      // Cols 12 and 13 should be unmapped
      expect(result.unmappedColumns).toContain(12)
      expect(result.unmappedColumns).toContain(13)
    })

    it('applies Comarch Optima XML FA positional mapping (19 columns)', () => {
      const profile = SYSTEM_PROFILES.find((p) => p.id === 'COMARCH_OPTIMA_XML_FA')!
      const result = applyPositionalMapping(19, profile.columnMap, profile.fields)

      expect(result.mappings.length).toBe(19)

      const mapped = Object.fromEntries(result.mappings.map((m) => [m.targetField, m.sourceColumn]))
      expect(mapped['KodWaluty']).toBe(0)
      expect(mapped['P_1']).toBe(1)
      expect(mapped['P_2']).toBe(2)
      expect(mapped['P_5']).toBe(8)
      expect(mapped['P_6']).toBe(10)
      expect(mapped['P_15']).toBe(17)
      expect(mapped['RodzajFaktury']).toBe(18)
    })
  })
})
