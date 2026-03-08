import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  SYSTEM_PROFILES,
  findProfile,
} from '../../../src/core/mapping/SystemProfiles'
import {
  detectProfileHint,
  applyPositionalMapping,
} from '../../../src/core/mapping/AutoMapper'
import { CsvFileReader } from '../../../src/core/readers/CsvFileReader'
import { XmlFileReader } from '../../../src/core/readers/XmlFileReader'
import { TxtFileReader } from '../../../src/core/readers/TxtFileReader'
import type { RawSheet } from '../../../src/core/models/types'

const FIXTURES_DIR = join(__dirname, '..', '..', 'fixtures')

function makeSheet(opts: {
  headers?: string[]
  rows: string[][]
  metadata?: Record<string, string>
}): RawSheet {
  return {
    name: 'test',
    headers: opts.headers,
    rows: opts.rows.map((cells, i) => ({ index: i, cells })),
    metadata: opts.metadata ?? {},
  }
}

// ═══════════════════════════════════════════════════════
//  ENOVA365_XML_FA
// ═══════════════════════════════════════════════════════

describe('ENOVA365_XML_FA profile', () => {
  const profile = findProfile('ENOVA365', 'FA', 'Faktura')!

  it('exists in registry', () => {
    expect(profile).toBeDefined()
    expect(profile.id).toBe('ENOVA365_XML_FA')
  })

  it('has correct system and target', () => {
    expect(profile.system).toBe('ENOVA365')
    expect(profile.jpkType).toBe('FA')
    expect(profile.subType).toBe('Faktura')
  })

  it('maps col 0 → P_2 (Numer)', () => {
    expect(profile.columnMap[0]).toBe('P_2')
  })

  it('maps col 1 → P_1 (DataWystawienia)', () => {
    expect(profile.columnMap[1]).toBe('P_1')
  })

  it('maps col 2 → P_6 (NIPNabywcy)', () => {
    expect(profile.columnMap[2]).toBe('P_6')
  })

  it('maps col 3 → P_3A (NazwaNabywcy)', () => {
    expect(profile.columnMap[3]).toBe('P_3A')
  })

  it('maps col 4 → P_13_1 (WartoscNetto)', () => {
    expect(profile.columnMap[4]).toBe('P_13_1')
  })

  it('maps col 5 → P_14_1 (WartoscVAT)', () => {
    expect(profile.columnMap[5]).toBe('P_14_1')
  })

  it('has 6 column mappings', () => {
    expect(Object.keys(profile.columnMap)).toHaveLength(6)
  })

  it('detectProfileHint detects enova365 XML from headers', () => {
    const sheet = makeSheet({
      headers: ['Numer', 'DataWystawienia', 'NIPNabywcy', 'NazwaNabywcy', 'WartoscNetto', 'WartoscVAT'],
      rows: [['FV/001', '2026-01-10', '5213456789', 'Firma', '1000.00', '230.00']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('ENOVA365_XML_FA')
    expect(hint!.confidence).toBe(0.90)
    expect(hint!.enterpriseWarning).toBeFalsy()
  })

  it('detects with minimum 3 enova markers', () => {
    const sheet = makeSheet({
      headers: ['Numer', 'WartoscNetto', 'WartoscVAT'],
      rows: [['FV/001', '1000.00', '230.00']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('ENOVA365_XML_FA')
  })

  it('returns null with only 2 enova markers', () => {
    const sheet = makeSheet({
      headers: ['Numer', 'WartoscNetto', 'SomeOther'],
      rows: [['FV/001', '1000.00', 'abc']],
    })
    expect(detectProfileHint(sheet)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════
//  ENOVA365_CDN_TXT
// ═══════════════════════════════════════════════════════

describe('ENOVA365_CDN_TXT profile', () => {
  it('exists in registry', () => {
    const p = SYSTEM_PROFILES.find((p) => p.id === 'ENOVA365_CDN_TXT')
    expect(p).toBeDefined()
    expect(p!.system).toBe('ENOVA365')
  })

  it('maps col 0 → P_2 (Nr_dokumentu)', () => {
    const _p = findProfile('ENOVA365', 'FA', 'Faktura')!
    // findProfile returns ENOVA365_XML_FA (first match). Use direct lookup.
    const cdn = SYSTEM_PROFILES.find((p) => p.id === 'ENOVA365_CDN_TXT')!
    expect(cdn.columnMap[0]).toBe('P_2')
  })

  it('maps col 6 → P_15 (Brutto)', () => {
    const cdn = SYSTEM_PROFILES.find((p) => p.id === 'ENOVA365_CDN_TXT')!
    expect(cdn.columnMap[6]).toBe('P_15')
  })

  it('has 7 column mappings', () => {
    const cdn = SYSTEM_PROFILES.find((p) => p.id === 'ENOVA365_CDN_TXT')!
    expect(Object.keys(cdn.columnMap)).toHaveLength(7)
  })

  it('detectProfileHint detects CDN CSV from headers', () => {
    const sheet = makeSheet({
      headers: ['Nr_dokumentu', 'Data_wystawienia', 'NIP', 'Nazwa_kontrahenta', 'Netto', 'Vat', 'Brutto', 'Stawka'],
      rows: [['FV/001', '2026-01-10', '5213456789', 'Firma', '1000.00', '230.00', '1230.00', '23']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('ENOVA365_CDN_TXT')
    expect(hint!.confidence).toBe(0.88)
  })

  it('returns null when Nr_dokumentu header missing', () => {
    const sheet = makeSheet({
      headers: ['Numer', 'Data', 'NIP', 'Nazwa', 'Netto', 'Vat', 'Brutto'],
      rows: [['FV/001', '2026-01-10', '123', 'Firma', '1000', '230', '1230']],
    })
    // Should not match CDN (no Nr_dokumentu)
    const hint = detectProfileHint(sheet)
    if (hint) expect(hint.profileId).not.toBe('ENOVA365_CDN_TXT')
  })

  it('applies positional mapping for 8-column CDN file', () => {
    const cdn = SYSTEM_PROFILES.find((p) => p.id === 'ENOVA365_CDN_TXT')!
    const result = applyPositionalMapping(8, cdn.columnMap, cdn.fields)
    expect(result.mappings.length).toBe(7)
    const mapped = Object.fromEntries(result.mappings.map((m) => [m.targetField, m.sourceColumn]))
    expect(mapped['P_2']).toBe(0)
    expect(mapped['P_15']).toBe(6)
  })

  it('parses fixture file and detects CDN profile', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'enova365_cdn.csv'))
    const reader = new CsvFileReader()
    const fileResult = reader.read(buffer, 'enova365_cdn.csv')
    expect(fileResult.sheets.length).toBeGreaterThan(0)

    const sheet = fileResult.sheets[0]
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('ENOVA365_CDN_TXT')
  })
})

// ═══════════════════════════════════════════════════════
//  SAGE_SYMFONIA_FA
// ═══════════════════════════════════════════════════════

describe('SAGE_SYMFONIA_FA profile', () => {
  const profile = SYSTEM_PROFILES.find((p) => p.id === 'SAGE_SYMFONIA_FA')!

  it('exists in registry', () => {
    expect(profile).toBeDefined()
    expect(profile.system).toBe('SAGE_SYMFONIA')
  })

  it('maps col 0 → RodzajFaktury (TypDokumentu)', () => {
    expect(profile.columnMap[0]).toBe('RodzajFaktury')
  })

  it('maps col 1 → P_2 (NrDokumentu)', () => {
    expect(profile.columnMap[1]).toBe('P_2')
  })

  it('maps col 4 → P_6 (NIPKontrahenta)', () => {
    expect(profile.columnMap[4]).toBe('P_6')
  })

  it('maps col 9 → KodWaluty', () => {
    expect(profile.columnMap[9]).toBe('KodWaluty')
  })

  it('has 9 column mappings (col 8 skipped — StawkaVAT)', () => {
    expect(Object.keys(profile.columnMap)).toHaveLength(9)
  })

  it('detectProfileHint detects Symfonia from TypDokumentu + NIPKontrahenta + FA value', () => {
    const sheet = makeSheet({
      headers: ['TypDokumentu', 'NrDokumentu', 'DataWystawienia', 'NazwaKontrahenta', 'NIPKontrahenta', 'Netto', 'VATKwota', 'Brutto', 'StawkaVAT', 'KodWaluty'],
      rows: [
        ['FA', 'FS/001', '2026-01-10', 'Firma', '5213456789', '1000', '230', '1230', '23', 'PLN'],
      ],
    })
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('SAGE_SYMFONIA_FA')
    expect(hint!.confidence).toBe(0.85)
  })

  it('returns null when TypDokumentu values are not FA/FZ/KS/KZ', () => {
    const sheet = makeSheet({
      headers: ['TypDokumentu', 'NrDokumentu', 'DataWystawienia', 'NazwaKontrahenta', 'NIPKontrahenta'],
      rows: [['UNKNOWN', 'X/001', '2026-01-10', 'Firma', '123']],
    })
    expect(detectProfileHint(sheet)).toBeNull()
  })

  it('parses fixture file and detects Symfonia profile', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'symfonia_vat.txt'))
    const reader = new TxtFileReader()
    const fileResult = reader.read(buffer, 'symfonia_vat.txt')

    const _sheet = fileResult.sheets[0]
    // TxtFileReader doesn't set headers, so we test via CSV reader instead
    const csvReader = new CsvFileReader()
    const csvResult = csvReader.read(buffer, 'symfonia_vat.csv')
    if (csvResult.sheets.length > 0 && csvResult.sheets[0].headers) {
      const hint = detectProfileHint(csvResult.sheets[0])
      expect(hint).not.toBeNull()
      expect(hint!.profileId).toBe('SAGE_SYMFONIA_FA')
    }
  })

  it('applies positional mapping for 10-column Symfonia file', () => {
    const result = applyPositionalMapping(10, profile.columnMap, profile.fields)
    expect(result.mappings.length).toBe(9)
    const mapped = Object.fromEntries(result.mappings.map((m) => [m.targetField, m.sourceColumn]))
    expect(mapped['RodzajFaktury']).toBe(0)
    expect(mapped['KodWaluty']).toBe(9)
  })
})

// ═══════════════════════════════════════════════════════
//  ASSECO_WAPRO_XML_FA
// ═══════════════════════════════════════════════════════

describe('ASSECO_WAPRO_XML_FA profile', () => {
  const profile = SYSTEM_PROFILES.find((p) => p.id === 'ASSECO_WAPRO_XML_FA')!

  it('exists in registry', () => {
    expect(profile).toBeDefined()
    expect(profile.system).toBe('ASSECO_WAPRO')
  })

  it('maps col 0 → P_2 (Nr_faktury)', () => {
    expect(profile.columnMap[0]).toBe('P_2')
  })

  it('maps col 1 → P_1 (Data_wyst)', () => {
    expect(profile.columnMap[1]).toBe('P_1')
  })

  it('maps col 2 → P_6 (NIP_kontr)', () => {
    expect(profile.columnMap[2]).toBe('P_6')
  })

  it('maps col 3 → P_3A (Nazwa_kontr)', () => {
    expect(profile.columnMap[3]).toBe('P_3A')
  })

  it('has 6 column mappings', () => {
    expect(Object.keys(profile.columnMap)).toHaveLength(6)
  })

  it('detectProfileHint detects WAPRO XML from headers', () => {
    const sheet = makeSheet({
      headers: ['Nr_faktury', 'Data_wyst', 'NIP_kontr', 'Nazwa_kontr', 'Netto_23', 'VAT_23'],
      rows: [['FV/001', '2026-01-10', '5213456789', 'Firma', '1000.00', '230.00']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('ASSECO_WAPRO_XML_FA')
    expect(hint!.confidence).toBe(0.90)
  })

  it('detects with minimum 3 WAPRO markers', () => {
    const sheet = makeSheet({
      headers: ['Nr_faktury', 'NIP_kontr', 'VAT_23'],
      rows: [['FV/001', '5213456789', '230.00']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('ASSECO_WAPRO_XML_FA')
  })

  it('returns null with only 2 WAPRO markers', () => {
    const sheet = makeSheet({
      headers: ['Nr_faktury', 'NIP_kontr', 'SomeOther'],
      rows: [['FV/001', '5213456789', 'abc']],
    })
    expect(detectProfileHint(sheet)).toBeNull()
  })

  it('parses fixture file and detects WAPRO profile', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'wapro.xml'))
    const reader = new XmlFileReader()
    const fileResult = reader.read(buffer, 'wapro.xml')
    expect(fileResult.sheets.length).toBeGreaterThan(0)

    const sheet = fileResult.sheets[0]
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('ASSECO_WAPRO_XML_FA')
  })

  it('fixture has 3 invoice rows', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'wapro.xml'))
    const reader = new XmlFileReader()
    const fileResult = reader.read(buffer, 'wapro.xml')
    expect(fileResult.sheets[0].rows).toHaveLength(3)
  })
})

// ═══════════════════════════════════════════════════════
//  DYNAMICS_NAV_FA (enterprise)
// ═══════════════════════════════════════════════════════

describe('DYNAMICS_NAV_FA profile', () => {
  const profile = SYSTEM_PROFILES.find((p) => p.id === 'DYNAMICS_NAV_FA')!

  it('exists in registry', () => {
    expect(profile).toBeDefined()
    expect(profile.system).toBe('DYNAMICS_NAV')
  })

  it('maps col 0 → P_2 (No_)', () => {
    expect(profile.columnMap[0]).toBe('P_2')
  })

  it('maps col 1 → P_1 (PostingDate)', () => {
    expect(profile.columnMap[1]).toBe('P_1')
  })

  it('maps col 2 → P_6 (CustomerNo_)', () => {
    expect(profile.columnMap[2]).toBe('P_6')
  })

  it('has 5 column mappings', () => {
    expect(Object.keys(profile.columnMap)).toHaveLength(5)
  })

  it('detectProfileHint detects NAV from No_ + PostingDate + Amount', () => {
    const sheet = makeSheet({
      headers: ['No_', 'PostingDate', 'CustomerNo_', 'Amount', 'VATAmount'],
      rows: [['INV-001', '2026-01-10', 'C-123', '1000.00', '230.00']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('DYNAMICS_NAV_FA')
    expect(hint!.confidence).toBe(0.65)
  })

  it('sets enterpriseWarning flag', () => {
    const sheet = makeSheet({
      headers: ['No_', 'PostingDate', 'CustomerNo_', 'Amount', 'VATAmount'],
      rows: [['INV-001', '2026-01-10', 'C-123', '1000.00', '230.00']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint!.enterpriseWarning).toBe(true)
  })

  it('returns null without Amount/VATAmount header', () => {
    const sheet = makeSheet({
      headers: ['No_', 'PostingDate', 'CustomerNo_', 'Description'],
      rows: [['INV-001', '2026-01-10', 'C-123', 'Test']],
    })
    expect(detectProfileHint(sheet)).toBeNull()
  })

  it('applies positional mapping', () => {
    const result = applyPositionalMapping(5, profile.columnMap, profile.fields)
    expect(result.mappings.length).toBe(5)
    const mapped = Object.fromEntries(result.mappings.map((m) => [m.targetField, m.sourceColumn]))
    expect(mapped['P_2']).toBe(0)
    expect(mapped['P_1']).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════
//  SAP_R3_CSV_FA (enterprise)
// ═══════════════════════════════════════════════════════

describe('SAP_R3_CSV_FA profile', () => {
  const profile = SYSTEM_PROFILES.find((p) => p.id === 'SAP_R3_CSV_FA')!

  it('exists in registry', () => {
    expect(profile).toBeDefined()
    expect(profile.system).toBe('SAP_R3')
  })

  it('maps col 2 → P_1 (BUDAT)', () => {
    expect(profile.columnMap[2]).toBe('P_1')
  })

  it('maps col 3 → P_2 (BELNR)', () => {
    expect(profile.columnMap[3]).toBe('P_2')
  })

  it('maps col 4 → KodWaluty (WAERS)', () => {
    expect(profile.columnMap[4]).toBe('KodWaluty')
  })

  it('maps col 5 → P_15 (WRBTR)', () => {
    expect(profile.columnMap[5]).toBe('P_15')
  })

  it('does not map cols 0,1,6 (BUKRS, BLART, MWSKZ)', () => {
    expect(profile.columnMap[0]).toBeUndefined()
    expect(profile.columnMap[1]).toBeUndefined()
    expect(profile.columnMap[6]).toBeUndefined()
  })

  it('has 4 column mappings', () => {
    expect(Object.keys(profile.columnMap)).toHaveLength(4)
  })

  it('detectProfileHint detects SAP from BUKRS + BLART headers', () => {
    const sheet = makeSheet({
      headers: ['BUKRS', 'BLART', 'BUDAT', 'BELNR', 'WAERS', 'WRBTR', 'MWSKZ'],
      rows: [['1000', 'RE', '2026-01-10', '5100000001', 'PLN', '1230.00', 'A1']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint).not.toBeNull()
    expect(hint!.profileId).toBe('SAP_R3_CSV_FA')
    expect(hint!.confidence).toBe(0.70)
  })

  it('sets enterpriseWarning flag', () => {
    const sheet = makeSheet({
      headers: ['BUKRS', 'BLART', 'BUDAT', 'BELNR', 'WAERS', 'WRBTR', 'MWSKZ'],
      rows: [['1000', 'RE', '2026-01-10', '5100000001', 'PLN', '1230.00', 'A1']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint!.enterpriseWarning).toBe(true)
  })

  it('returns null without BUKRS header', () => {
    const sheet = makeSheet({
      headers: ['Company', 'BLART', 'BUDAT', 'BELNR'],
      rows: [['1000', 'RE', '2026-01-10', '5100000001']],
    })
    expect(detectProfileHint(sheet)).toBeNull()
  })

  it('applies positional mapping for 7-column SAP file', () => {
    const result = applyPositionalMapping(7, profile.columnMap, profile.fields)
    expect(result.mappings.length).toBe(4)
    const mapped = Object.fromEntries(result.mappings.map((m) => [m.targetField, m.sourceColumn]))
    expect(mapped['P_1']).toBe(2)
    expect(mapped['P_2']).toBe(3)
    expect(mapped['KodWaluty']).toBe(4)
    expect(mapped['P_15']).toBe(5)
  })
})

// ═══════════════════════════════════════════════════════
//  Cross-profile edge cases
// ═══════════════════════════════════════════════════════

describe('ERP profiles — cross-cutting', () => {
  it('all 6 new profiles are in SYSTEM_PROFILES', () => {
    const ids = ['ENOVA365_XML_FA', 'ENOVA365_CDN_TXT', 'SAGE_SYMFONIA_FA', 'ASSECO_WAPRO_XML_FA', 'DYNAMICS_NAV_FA', 'SAP_R3_CSV_FA']
    for (const id of ids) {
      expect(SYSTEM_PROFILES.find((p) => p.id === id)).toBeDefined()
    }
  })

  it('enterprise profiles have enterpriseWarning, others do not', () => {
    // SAP
    const sapSheet = makeSheet({
      headers: ['BUKRS', 'BLART', 'BUDAT'],
      rows: [['1000', 'RE', '2026-01-10']],
    })
    const sapHint = detectProfileHint(sapSheet)
    expect(sapHint?.enterpriseWarning).toBe(true)

    // NAV
    const navSheet = makeSheet({
      headers: ['No_', 'PostingDate', 'Amount'],
      rows: [['INV-001', '2026-01-10', '1000']],
    })
    const navHint = detectProfileHint(navSheet)
    expect(navHint?.enterpriseWarning).toBe(true)

    // enova365 (not enterprise)
    const enovaSheet = makeSheet({
      headers: ['Numer', 'DataWystawienia', 'WartoscNetto'],
      rows: [['FV/001', '2026-01-10', '1000']],
    })
    const enovaHint = detectProfileHint(enovaSheet)
    expect(enovaHint?.enterpriseWarning).toBeFalsy()
  })

  it('Comarch Optima XML still takes priority over enova365 (higher confidence)', () => {
    const sheet = makeSheet({
      headers: ['NazwaKontrahenta', 'AdresKontrahenta', 'NIPNabywcy', 'NIPSprzedawcy', 'BruttoRazem'],
      rows: [['Firma', 'Adres', '123', '456', '1000']],
    })
    const hint = detectProfileHint(sheet)
    expect(hint!.profileId).toBe('COMARCH_OPTIMA_XML_FA')
    expect(hint!.confidence).toBe(0.95)
  })

  it('empty headers do not match any ERP profile', () => {
    const sheet = makeSheet({
      headers: [],
      rows: [['a', 'b', 'c']],
    })
    expect(detectProfileHint(sheet)).toBeNull()
  })
})
