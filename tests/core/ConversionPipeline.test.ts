import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ConversionPipeline, type PipelineConfig } from '../../src/core/ConversionPipeline'
import { createDefaultRegistry } from '../../src/core/readers/FileReaderRegistry'
import type { RawSheet } from '../../src/core/models/types'

const TEST_DATA_DIR = join(__dirname, '..', '..', 'test-data')
const registry = createDefaultRegistry()

/** Helper to make a sheet with specific data */
function makeSheet(opts: {
  rows: string[][]
  headers?: string[]
  metadata?: Record<string, string>
}): RawSheet {
  return {
    name: 'test',
    headers: opts.headers,
    rows: opts.rows.map((cells, i) => ({ index: i, cells })),
    metadata: opts.metadata ?? {},
  }
}

describe('ConversionPipeline', () => {
  describe('full flow — NAMOS VDEK TXT', () => {
    const pipeline = new ConversionPipeline(registry)

    it('parses, maps, transforms, and validates NAMOS VDEK file', () => {
      const buffer = readFileSync(
        join(TEST_DATA_DIR, '0P549_NAMOS_JPK_VDEK_SprzedazWiersz_2026-01-01_2026-01-31_20260207020039.txt')
      )
      const config: PipelineConfig = {
        jpkType: 'JPK_VDEK',
        subType: 'SprzedazWiersz',
      }

      const result = pipeline.run(buffer, 'namos_vdek.txt', config)

      // Should have transformed rows
      expect(result.transformedRows.length).toBeGreaterThan(0)

      // Should have mapping
      expect(result.mapping).not.toBeNull()
      expect(result.mapping!.mappings.length).toBeGreaterThan(0)

      // Check K_10 value is transformed (comma → dot)
      const firstRow = result.transformedRows[0]
      expect(firstRow.values['K_10']).toBe('102.95')

      // K_11 should also be transformed
      expect(firstRow.values['K_11']).toBeDefined()
    })

    it('transforms dates in NAMOS VDEK file', () => {
      const buffer = readFileSync(
        join(TEST_DATA_DIR, '0P549_NAMOS_JPK_VDEK_SprzedazWiersz_2026-01-01_2026-01-31_20260207020039.txt')
      )
      const config: PipelineConfig = {
        jpkType: 'JPK_VDEK',
        subType: 'SprzedazWiersz',
      }

      const result = pipeline.run(buffer, 'namos_vdek.txt', config)

      // DataWystawienia should be in YYYY-MM-DD format
      const firstRow = result.transformedRows[0]
      const dateValue = firstRow.values['DataWystawienia']
      if (dateValue) {
        expect(dateValue).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })
  })

  describe('full flow — NAMOS FA TXT', () => {
    const pipeline = new ConversionPipeline(registry)

    it('parses, maps, transforms NAMOS FA file', () => {
      const buffer = readFileSync(
        join(TEST_DATA_DIR, '0P549_NAMOS_JPK_FA_Faktura_2026-01-01_2026-01-31_20260207020039.txt')
      )
      const config: PipelineConfig = {
        jpkType: 'JPK_FA',
        subType: 'Faktura',
      }

      const result = pipeline.run(buffer, 'namos_fa.txt', config)

      expect(result.transformedRows.length).toBeGreaterThan(0)

      // P_15 (brutto) should be transformed from "20,16" → "20.16"
      const firstRow = result.transformedRows[0]
      expect(firstRow.values['P_15']).toBe('20.16')
    })
  })

  describe('full flow — ESO MAG WZ TXT', () => {
    const pipeline = new ConversionPipeline(registry)

    it('parses, maps, transforms ESO MAG WZ file', () => {
      const buffer = readFileSync(
        join(TEST_DATA_DIR, '0P549_ESO_JPK_MAG_WZ_2026-01-31_2026-01-31_20260202043950.txt')
      )
      const config: PipelineConfig = {
        jpkType: 'JPK_MAG',
        subType: 'WZ',
      }

      const result = pipeline.run(buffer, 'eso_mag.txt', config)

      expect(result.transformedRows.length).toBeGreaterThan(0)

      // KodTowaru from first row
      const firstRow = result.transformedRows[0]
      expect(firstRow.values['KodTowaru']).toBe('1004115')
    })
  })

  describe('runOnSheet', () => {
    const pipeline = new ConversionPipeline(registry)

    it('processes a pre-parsed sheet', () => {
      const sheet = makeSheet({
        headers: ['LpSprzedazy', 'DowodSprzedazy', 'DataWystawienia', 'K_10'],
        rows: [
          ['1', 'FV/001', '15.01.2026', '100,50'],
          ['2', 'FV/002', '16.01.2026', '200,00'],
        ],
      })

      const result = pipeline.runOnSheet(sheet, {
        jpkType: 'JPK_VDEK',
        subType: 'SprzedazWiersz',
      })

      expect(result.transformedRows).toHaveLength(2)
      expect(result.transformedRows[0].values['DataWystawienia']).toBe('2026-01-15')
      expect(result.transformedRows[0].values['K_10']).toBe('100.50')
      expect(result.transformedRows[1].values['K_10']).toBe('200.00')
    })

    it('reports empty sheet error', () => {
      const sheet = makeSheet({ rows: [] })

      const result = pipeline.runOnSheet(sheet, {
        jpkType: 'JPK_VDEK',
        subType: 'SprzedazWiersz',
      })

      expect(result.transformedRows).toHaveLength(0)
      const errors = result.issues.filter((i) => i.severity === 'error')
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain('nie zawiera wierszy')
    })
  })

  describe('validation — NIP checksum', () => {
    const pipeline = new ConversionPipeline(registry)

    it('validates NIP checksum in FA data', () => {
      const sheet = makeSheet({
        headers: ['KodWaluty', 'P_1', 'P_2', 'P_3A', 'P_3B', 'P_3C', 'P_5', 'P_15', 'RodzajFaktury'],
        rows: [
          ['PLN', '2026-01-15', 'FV/001', 'Firma', 'Adres', 'Sprzedawca', '1234567890', '100,00', 'VAT'],
        ],
      })

      const result = pipeline.runOnSheet(sheet, {
        jpkType: 'JPK_FA',
        subType: 'Faktura',
      })

      // 1234567890 has invalid NIP checksum
      const nipErrors = result.issues.filter(
        (i) => i.stage === 'validate' && i.field === 'P_5' && i.message.includes('suma kontrolna NIP')
      )
      expect(nipErrors.length).toBe(1)
    })

    it('passes valid NIP checksum', () => {
      const sheet = makeSheet({
        headers: ['KodWaluty', 'P_1', 'P_2', 'P_3A', 'P_3B', 'P_3C', 'P_5', 'P_15', 'RodzajFaktury'],
        rows: [
          ['PLN', '2026-01-15', 'FV/001', 'Firma', 'Adres', 'Sprzedawca', '5261040828', '100,00', 'VAT'],
        ],
      })

      const result = pipeline.runOnSheet(sheet, {
        jpkType: 'JPK_FA',
        subType: 'Faktura',
      })

      const nipErrors = result.issues.filter(
        (i) => i.stage === 'validate' && i.field === 'P_5' && i.message.includes('suma kontrolna NIP')
      )
      expect(nipErrors).toHaveLength(0)
    })
  })

  describe('validation — required fields', () => {
    const pipeline = new ConversionPipeline(registry)

    it('reports missing required fields', () => {
      const sheet = makeSheet({
        headers: ['LpSprzedazy', 'DowodSprzedazy', 'DataWystawienia'],
        rows: [
          ['1', '', '2026-01-15'], // DowodSprzedazy is empty
        ],
      })

      const result = pipeline.runOnSheet(sheet, {
        jpkType: 'JPK_VDEK',
        subType: 'SprzedazWiersz',
      })

      const requiredErrors = result.issues.filter(
        (i) => i.stage === 'validate' && i.field === 'DowodSprzedazy'
      )
      expect(requiredErrors.length).toBe(1)
      expect(requiredErrors[0].message).toContain('brak wymaganego pola')
    })

    it('passes when required fields are present', () => {
      const sheet = makeSheet({
        headers: ['LpSprzedazy', 'DowodSprzedazy', 'DataWystawienia'],
        rows: [
          ['1', 'FV/001', '2026-01-15'],
        ],
      })

      const result = pipeline.runOnSheet(sheet, {
        jpkType: 'JPK_VDEK',
        subType: 'SprzedazWiersz',
      })

      const requiredRowErrors = result.issues.filter(
        (i) => i.stage === 'validate' && i.message.includes('brak wymaganego pola')
      )
      // All mapped required fields should be present — no row-level required errors for mapped fields
      expect(requiredRowErrors).toHaveLength(0)
    })
  })

  describe('validation — skip option', () => {
    const pipeline = new ConversionPipeline(registry)

    it('skips validation when skipValidation=true', () => {
      const sheet = makeSheet({
        headers: ['P_5'],
        rows: [['1234567890']], // Invalid NIP
      })

      const result = pipeline.runOnSheet(sheet, {
        jpkType: 'JPK_FA',
        subType: 'Faktura',
        skipValidation: true,
      })

      const validateErrors = result.issues.filter((i) => i.stage === 'validate')
      expect(validateErrors).toHaveLength(0)
    })
  })

  describe('error handling', () => {
    const pipeline = new ConversionPipeline(registry)

    it('handles unparseable file', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]) // garbage
      const result = pipeline.run(buffer, 'garbage.xyz', {
        jpkType: 'JPK_VDEK',
        subType: 'SprzedazWiersz',
      })

      const parseErrors = result.issues.filter((i) => i.stage === 'parse' && i.severity === 'error')
      expect(parseErrors.length).toBeGreaterThan(0)
      expect(result.transformedRows).toHaveLength(0)
    })

    it('handles sheet with no mappable columns', () => {
      const sheet = makeSheet({
        headers: ['xxx', 'yyy', 'zzz'],
        rows: [['a', 'b', 'c']],
      })

      const result = pipeline.runOnSheet(sheet, {
        jpkType: 'JPK_VDEK',
        subType: 'SprzedazWiersz',
      })

      // May have some type-inference matches, or may have 0 mappings
      // Either way should not crash
      expect(result.issues).toBeDefined()
    })
  })

  describe('custom mapping', () => {
    const pipeline = new ConversionPipeline(registry)

    it('uses custom mapping when provided', () => {
      const sheet = makeSheet({
        rows: [
          ['FV/001', '2026-01-15', '100,50'],
        ],
      })

      const customMapping = {
        mappings: [
          { sourceColumn: 0, targetField: 'DowodSprzedazy', confidence: 1.0, method: 'manual' as const },
          { sourceColumn: 1, targetField: 'DataWystawienia', confidence: 1.0, method: 'manual' as const },
          { sourceColumn: 2, targetField: 'K_10', confidence: 1.0, method: 'manual' as const },
        ],
        unmappedFields: [],
        unmappedColumns: [],
      }

      const result = pipeline.runOnSheet(sheet, {
        jpkType: 'JPK_VDEK',
        subType: 'SprzedazWiersz',
        customMapping,
      })

      expect(result.transformedRows).toHaveLength(1)
      expect(result.transformedRows[0].values['DowodSprzedazy']).toBe('FV/001')
      expect(result.transformedRows[0].values['DataWystawienia']).toBe('2026-01-15')
      expect(result.transformedRows[0].values['K_10']).toBe('100.50')
    })
  })
})
