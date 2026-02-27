import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { autoMap, applyPositionalMapping } from '../../../src/core/mapping/AutoMapper'
import { JPK_V7M_SPRZEDAZ_FIELDS, JPK_FA_FAKTURA_FIELDS, JPK_MAG_WZ_FIELDS } from '../../../src/core/mapping/JpkFieldDefinitions'
import { TxtFileReader } from '../../../src/core/readers/TxtFileReader'
import type { RawSheet, ParsedRow } from '../../../src/core/models/types'

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
  })
})
