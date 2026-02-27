import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  SYSTEM_PROFILES,
  findProfile,
  applyProfile,
} from '../../../src/core/mapping/SystemProfiles'
import { TxtFileReader } from '../../../src/core/readers/TxtFileReader'

const TEST_DATA_DIR = join(__dirname, '..', '..', '..', 'test-data')

describe('SystemProfiles', () => {
  describe('SYSTEM_PROFILES registry', () => {
    it('contains NAMOS VDEK SprzedazWiersz profile', () => {
      const p = SYSTEM_PROFILES.find((p) => p.id === 'NAMOS_JPK_VDEK_SprzedazWiersz')
      expect(p).toBeDefined()
      expect(p!.system).toBe('NAMOS')
      expect(p!.jpkType).toBe('JPK_VDEK')
      expect(p!.subType).toBe('SprzedazWiersz')
    })

    it('contains NAMOS FA Faktura profile', () => {
      const p = SYSTEM_PROFILES.find((p) => p.id === 'NAMOS_JPK_FA_Faktura')
      expect(p).toBeDefined()
      expect(p!.system).toBe('NAMOS')
      expect(p!.jpkType).toBe('JPK_FA')
    })

    it('contains ESO MAG WZ profile', () => {
      const p = SYSTEM_PROFILES.find((p) => p.id === 'ESO_JPK_MAG_WZ')
      expect(p).toBeDefined()
      expect(p!.system).toBe('ESO')
      expect(p!.jpkType).toBe('JPK_MAG')
      expect(p!.subType).toBe('WZ')
    })
  })

  describe('findProfile', () => {
    it('finds NAMOS VDEK profile', () => {
      const p = findProfile('NAMOS', 'JPK_VDEK', 'SprzedazWiersz')
      expect(p).not.toBeNull()
      expect(p!.id).toBe('NAMOS_JPK_VDEK_SprzedazWiersz')
    })

    it('finds ESO MAG WZ profile', () => {
      const p = findProfile('ESO', 'JPK_MAG', 'WZ')
      expect(p).not.toBeNull()
      expect(p!.id).toBe('ESO_JPK_MAG_WZ')
    })

    it('returns null for unknown combination', () => {
      expect(findProfile('UNKNOWN', 'JPK_X', 'Y')).toBeNull()
    })
  })

  describe('NAMOS VDEK SprzedazWiersz profile', () => {
    const profile = findProfile('NAMOS', 'JPK_VDEK', 'SprzedazWiersz')!

    it('maps col 0 → LpSprzedazy', () => {
      expect(profile.columnMap[0]).toBe('LpSprzedazy')
    })

    it('maps col 2 → NrKontrahenta (NIP)', () => {
      expect(profile.columnMap[2]).toBe('NrKontrahenta')
    })

    it('maps col 4 → DowodSprzedazy', () => {
      expect(profile.columnMap[4]).toBe('DowodSprzedazy')
    })

    it('maps col 5 → DataWystawienia', () => {
      expect(profile.columnMap[5]).toBe('DataWystawienia')
    })

    it('maps col 7 → TypDokumentu', () => {
      expect(profile.columnMap[7]).toBe('TypDokumentu')
    })

    it('maps col 45 → K_10 (netto 23%)', () => {
      expect(profile.columnMap[45]).toBe('K_10')
    })

    it('maps col 46 → K_11 (VAT 23%)', () => {
      expect(profile.columnMap[46]).toBe('K_11')
    })

    it('maps all 13 GTU fields at cols 9-21', () => {
      for (let i = 1; i <= 13; i++) {
        const colIdx = 8 + i // GTU_01 at col 9, GTU_13 at col 21
        expect(profile.columnMap[colIdx]).toBe(`GTU_${String(i).padStart(2, '0')}`)
      }
    })
  })

  describe('NAMOS FA Faktura profile', () => {
    const profile = findProfile('NAMOS', 'JPK_FA', 'Faktura')!

    it('maps col 0 → KodWaluty', () => {
      expect(profile.columnMap[0]).toBe('KodWaluty')
    })

    it('maps col 1 → P_1 (date)', () => {
      expect(profile.columnMap[1]).toBe('P_1')
    })

    it('maps col 2 → P_2 (invoice number)', () => {
      expect(profile.columnMap[2]).toBe('P_2')
    })

    it('maps col 8 → P_5 (NIP sprzedawcy)', () => {
      expect(profile.columnMap[8]).toBe('P_5')
    })

    it('maps col 10 → P_6 (NIP nabywcy)', () => {
      expect(profile.columnMap[10]).toBe('P_6')
    })

    it('maps col 12 → P_13_1 (netto 23%)', () => {
      expect(profile.columnMap[12]).toBe('P_13_1')
    })

    it('maps col 13 → P_14_1 (VAT 23%)', () => {
      expect(profile.columnMap[13]).toBe('P_14_1')
    })

    it('maps col 27 → P_15 (brutto razem)', () => {
      expect(profile.columnMap[27]).toBe('P_15')
    })

    it('maps col 51 → RodzajFaktury', () => {
      expect(profile.columnMap[51]).toBe('RodzajFaktury')
    })
  })

  describe('ESO MAG WZ profile', () => {
    const profile = findProfile('ESO', 'JPK_MAG', 'WZ')!

    it('maps col 9 → KodTowaru', () => {
      expect(profile.columnMap[9]).toBe('KodTowaru')
    })

    it('maps col 10 → NazwaTowaru', () => {
      expect(profile.columnMap[10]).toBe('NazwaTowaru')
    })

    it('maps col 11 → IloscWydana', () => {
      expect(profile.columnMap[11]).toBe('IloscWydana')
    })

    it('maps col 12 → JednostkaMiary', () => {
      expect(profile.columnMap[12]).toBe('JednostkaMiary')
    })

    it('maps col 14 → WartoscPozycji', () => {
      expect(profile.columnMap[14]).toBe('WartoscPozycji')
    })
  })

  describe('applyProfile — real test-data files', () => {
    const reader = new TxtFileReader()

    it('applies NAMOS VDEK profile and maps K_10/K_11 correctly', () => {
      const buffer = readFileSync(
        join(TEST_DATA_DIR, '0P549_NAMOS_JPK_VDEK_SprzedazWiersz_2026-01-01_2026-01-31_20260207020039.txt')
      )
      const fileResult = reader.read(buffer, 'namos_vdek.txt')
      const sheet = fileResult.sheets[0]

      const result = applyProfile(sheet)
      expect(result).not.toBeNull()

      // Verify K_10 mapping: col 45 should contain netto 23% values
      const k10 = result!.mappings.find((m) => m.targetField === 'K_10')
      expect(k10).toBeDefined()
      expect(k10!.sourceColumn).toBe(45)
      expect(k10!.confidence).toBe(1.0)

      // Verify the value at col 45 for first row is "102,95"
      expect(sheet.rows[0].cells[45]).toBe('102,95')
    })

    it('applies NAMOS FA profile and maps P_15 correctly', () => {
      const buffer = readFileSync(
        join(TEST_DATA_DIR, '0P549_NAMOS_JPK_FA_Faktura_2026-01-01_2026-01-31_20260207020039.txt')
      )
      const fileResult = reader.read(buffer, 'namos_fa.txt')
      const sheet = fileResult.sheets[0]

      const result = applyProfile(sheet)
      expect(result).not.toBeNull()

      // Verify P_15 (brutto razem) at col 27
      const p15 = result!.mappings.find((m) => m.targetField === 'P_15')
      expect(p15).toBeDefined()
      expect(p15!.sourceColumn).toBe(27)

      // First row brutto = 20,16
      expect(sheet.rows[0].cells[27]).toBe('20,16')
    })

    it('applies ESO MAG WZ profile and maps product fields correctly', () => {
      const buffer = readFileSync(
        join(TEST_DATA_DIR, '0P549_ESO_JPK_MAG_WZ_2026-01-31_2026-01-31_20260202043950.txt')
      )
      const fileResult = reader.read(buffer, 'eso_mag.txt')
      const sheet = fileResult.sheets[0]

      const result = applyProfile(sheet)
      expect(result).not.toBeNull()

      // Product code at col 9
      const kodTowaru = result!.mappings.find((m) => m.targetField === 'KodTowaru')
      expect(kodTowaru).toBeDefined()
      expect(sheet.rows[0].cells[9]).toBe('1004115')

      // Product name at col 10
      expect(sheet.rows[0].cells[10]).toBe('CREMA 1000G/1000')

      // Quantity at col 11
      expect(sheet.rows[0].cells[11]).toBe('80,000000')
    })

    it('returns null for sheet without metadata', () => {
      const sheet: import('../../../src/core/models/types').RawSheet = {
        name: 'test',
        rows: [{ index: 0, cells: ['a', 'b'] }],
        metadata: {},
      }
      expect(applyProfile(sheet)).toBeNull()
    })
  })
})
