import { describe, it, expect } from 'vitest'
import {
  JPK_V7M_SPRZEDAZ_FIELDS,
  JPK_FA_FAKTURA_FIELDS,
  JPK_MAG_WZ_FIELDS,
  JPK_MAG_WZ_DOC_FIELDS,
  JPK_SECTIONS,
  getFieldDefinitions,
  type JpkFieldDef,
} from '../../../src/core/mapping/JpkFieldDefinitions'

describe('JpkFieldDefinitions', () => {
  describe('JPK_V7M_SPRZEDAZ_FIELDS', () => {
    it('contains required header fields', () => {
      const names = JPK_V7M_SPRZEDAZ_FIELDS.map((f) => f.name)
      expect(names).toContain('LpSprzedazy')
      expect(names).toContain('DowodSprzedazy')
      expect(names).toContain('DataWystawienia')
      expect(names).toContain('NrKontrahenta')
      expect(names).toContain('NazwaKontrahenta')
    })

    it('contains all 13 GTU fields', () => {
      const gtuFields = JPK_V7M_SPRZEDAZ_FIELDS.filter((f) => f.name.startsWith('GTU_'))
      expect(gtuFields).toHaveLength(13)
      expect(gtuFields.every((f) => f.type === 'boolean')).toBe(true)
    })

    it('contains K value fields with correct types', () => {
      const kFields = JPK_V7M_SPRZEDAZ_FIELDS.filter((f) => f.name.startsWith('K_'))
      expect(kFields.length).toBeGreaterThanOrEqual(19)
      expect(kFields.every((f) => f.type === 'decimal')).toBe(true)
    })

    it('contains KSeF fields for V7M(3)', () => {
      const names = JPK_V7M_SPRZEDAZ_FIELDS.map((f) => f.name)
      expect(names).toContain('NumerKSeF')
      expect(names).toContain('OznaczenieKSeF')
    })

    it('LpSprzedazy and DowodSprzedazy are required', () => {
      const lp = JPK_V7M_SPRZEDAZ_FIELDS.find((f) => f.name === 'LpSprzedazy')
      const dowod = JPK_V7M_SPRZEDAZ_FIELDS.find((f) => f.name === 'DowodSprzedazy')
      expect(lp!.required).toBe(true)
      expect(dowod!.required).toBe(true)
    })

    it('K fields are not required', () => {
      const kFields = JPK_V7M_SPRZEDAZ_FIELDS.filter((f) => f.name.startsWith('K_'))
      expect(kFields.every((f) => !f.required)).toBe(true)
    })

    it('fields have synonyms for auto-mapping', () => {
      const nip = JPK_V7M_SPRZEDAZ_FIELDS.find((f) => f.name === 'NrKontrahenta')
      expect(nip!.synonyms).toBeDefined()
      expect(nip!.synonyms!.length).toBeGreaterThan(0)
      expect(nip!.synonyms).toContain('nip')
    })
  })

  describe('JPK_FA_FAKTURA_FIELDS', () => {
    it('contains essential FA fields', () => {
      const names = JPK_FA_FAKTURA_FIELDS.map((f) => f.name)
      expect(names).toContain('KodWaluty')
      expect(names).toContain('P_1')
      expect(names).toContain('P_2')
      expect(names).toContain('P_3A')
      expect(names).toContain('P_5')
      expect(names).toContain('P_6')
      expect(names).toContain('P_15')
      expect(names).toContain('RodzajFaktury')
    })

    it('P_13 and P_14 rate-specific fields exist', () => {
      const names = JPK_FA_FAKTURA_FIELDS.map((f) => f.name)
      expect(names).toContain('P_13_1') // netto 23%
      expect(names).toContain('P_14_1') // VAT 23%
    })

    it('P_15 is required and decimal', () => {
      const p15 = JPK_FA_FAKTURA_FIELDS.find((f) => f.name === 'P_15')
      expect(p15!.required).toBe(true)
      expect(p15!.type).toBe('decimal')
    })

    it('NIP fields are typed as nip', () => {
      const p5 = JPK_FA_FAKTURA_FIELDS.find((f) => f.name === 'P_5')
      const p6 = JPK_FA_FAKTURA_FIELDS.find((f) => f.name === 'P_6')
      expect(p5!.type).toBe('nip')
      expect(p6!.type).toBe('nip')
    })
  })

  describe('JPK_MAG_WZ_FIELDS', () => {
    it('contains warehouse line-item fields', () => {
      const names = JPK_MAG_WZ_FIELDS.map((f) => f.name)
      expect(names).toContain('KodTowaru')
      expect(names).toContain('NazwaTowaru')
      expect(names).toContain('IloscWydana')
      expect(names).toContain('JednostkaMiary')
      expect(names).toContain('CenaJednostkowa')
      expect(names).toContain('WartoscPozycji')
    })

    it('all line-item fields are required', () => {
      expect(JPK_MAG_WZ_FIELDS.every((f) => f.required)).toBe(true)
    })
  })

  describe('JPK_MAG_WZ_DOC_FIELDS', () => {
    it('contains document-level fields', () => {
      const names = JPK_MAG_WZ_DOC_FIELDS.map((f) => f.name)
      expect(names).toContain('NumerDokumentu')
      expect(names).toContain('DataDokumentu')
      expect(names).toContain('WartoscDokumentu')
    })
  })

  describe('JPK_SECTIONS', () => {
    it('has sections for VDEK, FA, and MAG', () => {
      expect(JPK_SECTIONS['JPK_VDEK.SprzedazWiersz']).toBeDefined()
      expect(JPK_SECTIONS['JPK_FA.Faktura']).toBeDefined()
      expect(JPK_SECTIONS['JPK_MAG.WZ']).toBeDefined()
    })
  })

  describe('getFieldDefinitions', () => {
    it('returns fields for known JPK type + sub-type', () => {
      const fields = getFieldDefinitions('JPK_VDEK', 'SprzedazWiersz')
      expect(fields.length).toBeGreaterThan(0)
      expect(fields[0].name).toBe('LpSprzedazy')
    })

    it('returns empty array for unknown combination', () => {
      const fields = getFieldDefinitions('JPK_UNKNOWN', 'Unknown')
      expect(fields).toEqual([])
    })
  })
})
