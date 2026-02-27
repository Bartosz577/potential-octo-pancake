import type { JpkFieldDef } from './JpkFieldDefinitions'
import {
  JPK_V7M_SPRZEDAZ_FIELDS,
  JPK_FA_FAKTURA_FIELDS,
  JPK_MAG_WZ_FIELDS,
  JPK_MAG_WZ_DOC_FIELDS,
} from './JpkFieldDefinitions'
import { applyPositionalMapping, type MappingResult } from './AutoMapper'
import type { RawSheet } from '../models/types'

/** A system profile defines exact column mappings for a known ERP/format combination */
export interface SystemProfile {
  /** Unique profile identifier */
  id: string
  /** Display name */
  name: string
  /** ERP system name */
  system: string
  /** JPK type this profile maps to */
  jpkType: string
  /** JPK sub-type */
  subType: string
  /** Column position → JPK field name (data columns, 0-based after meta strip) */
  columnMap: Record<number, string>
  /** Field definitions for validation */
  fields: JpkFieldDef[]
}

// ═══════════════════════════════════════════════════════
//  NAMOS — JPK_VDEK SprzedazWiersz
// ═══════════════════════════════════════════════════════
// Verified from test-data: 64 data columns after 6 meta
// Cols 0-7: header fields
// Col 8: (reserved / CelZlozenia)
// Col 9: GTU_01
// Cols 10-21: GTU_02..GTU_13
// Cols 22-35: procedures (SW, EE, TP, TT_WNT, TT_D, MR_T, MR_UZ, I_42, I_63, B_SPV, B_SPV_DOSTAWA, B_MPV_PROWIZJA, MPP, IED)
// Cols 36-44: additional flags (WSTO_EE, KorektaPodstawyOpodt, NumerKSeF, OznaczenieKSeF, etc.)
// Cols 45-63: K_10..K_28 (19 K-value fields)

const NAMOS_VDEK_SPRZEDAZ_MAP: Record<number, string> = {
  0: 'LpSprzedazy',
  1: 'KodKontrahenta',
  2: 'NrKontrahenta',
  3: 'NazwaKontrahenta',
  4: 'DowodSprzedazy',
  5: 'DataWystawienia',
  6: 'DataSprzedazy',
  7: 'TypDokumentu',
  9: 'GTU_01',
  10: 'GTU_02',
  11: 'GTU_03',
  12: 'GTU_04',
  13: 'GTU_05',
  14: 'GTU_06',
  15: 'GTU_07',
  16: 'GTU_08',
  17: 'GTU_09',
  18: 'GTU_10',
  19: 'GTU_11',
  20: 'GTU_12',
  21: 'GTU_13',
  22: 'SW',
  23: 'EE',
  24: 'TP',
  25: 'TT_WNT',
  26: 'TT_D',
  27: 'MR_T',
  28: 'MR_UZ',
  29: 'I_42',
  30: 'I_63',
  31: 'B_SPV',
  32: 'B_SPV_DOSTAWA',
  33: 'B_MPV_PROWIZJA',
  34: 'MPP',
  35: 'IED',
  // K values: verified K_10 at col 45, K_11 at col 46 via VAT 23% math
  45: 'K_10',
  46: 'K_11',
  47: 'K_12',
  48: 'K_13',
  49: 'K_14',
  50: 'K_15',
  51: 'K_16',
  52: 'K_17',
  53: 'K_18',
  54: 'K_19',
  55: 'K_20',
  56: 'K_21',
  57: 'K_22',
  58: 'K_23',
  59: 'K_24',
  60: 'K_25',
  61: 'K_26',
  62: 'K_27',
  63: 'K_28',
}

// ═══════════════════════════════════════════════════════
//  NAMOS — JPK_FA Faktura
// ═══════════════════════════════════════════════════════
// Verified from test-data: 56 data columns after 6 meta
// Col 0: KodWaluty (PLN)
// Col 1: P_1 (data wystawienia)
// Col 2: P_2 (numer faktury)
// Col 3: P_3A (nabywca nazwa)
// Col 4: P_3B (nabywca adres)
// Col 5: P_3C (sprzedawca nazwa)
// Col 6: P_3D (sprzedawca adres)
// Col 7: P_4A (sprzedawca kraj PL)
// Col 8: P_5 (NIP sprzedawcy)
// Col 9: P_4B (nabywca kraj — often empty)
// Col 10: P_6 (NIP nabywcy)
// Col 11: DataSprzedazy
// Col 12: P_13_1 (netto 23%)
// Col 13: P_14_1 (VAT 23%)
// Cols 14-26: remaining P_13_x/P_14_x pairs
// Col 27: P_15 (brutto razem) — verified: 16.39+3.77=20.16
// Cols 28+: boolean flags, RodzajFaktury at col 51

const NAMOS_FA_FAKTURA_MAP: Record<number, string> = {
  0: 'KodWaluty',
  1: 'P_1',
  2: 'P_2',
  3: 'P_3A',
  4: 'P_3B',
  5: 'P_3C',
  6: 'P_3D',
  7: 'P_4A',
  8: 'P_5',
  9: 'P_4B',
  10: 'P_6',
  11: 'DataSprzedazy',
  12: 'P_13_1',
  13: 'P_14_1',
  14: 'P_13_2',
  15: 'P_14_2',
  16: 'P_13_3',
  17: 'P_14_3',
  18: 'P_13_4',
  19: 'P_13_5',
  20: 'P_13_6',
  21: 'P_14_4',
  22: 'P_14_5',
  23: 'P_13_7',
  24: 'P_14_6',
  25: 'P_13_8',
  26: 'P_13_9',
  27: 'P_15',
  51: 'RodzajFaktury',
}

// ═══════════════════════════════════════════════════════
//  ESO — JPK_MAG WZ
// ═══════════════════════════════════════════════════════
// Verified from test-data: 15 data columns after 6 meta
// Cols 0-7: document-level fields (repeated per row)
// Cols 8-14: line-item fields

const ESO_MAG_WZ_MAP: Record<number, string> = {
  // Document-level (repeated on each row)
  0: 'MagazynNadawcy',
  1: 'NumerDokumentu',
  2: 'DataDokumentu',
  3: 'WartoscDokumentu',
  4: 'DataOperacji',
  5: 'MagazynOdbiorcy',
  // Cols 6-7: empty / reserved
  8: 'NumerDokumentu',  // repeated doc number (parent ref)
  9: 'KodTowaru',
  10: 'NazwaTowaru',
  11: 'IloscWydana',
  12: 'JednostkaMiary',
  13: 'CenaJednostkowa',
  14: 'WartoscPozycji',
}

// ═══════════════════════════════════════════════════════
//  Profile registry
// ═══════════════════════════════════════════════════════

export const SYSTEM_PROFILES: SystemProfile[] = [
  {
    id: 'NAMOS_JPK_VDEK_SprzedazWiersz',
    name: 'NAMOS → JPK_V7M Sprzedaż',
    system: 'NAMOS',
    jpkType: 'JPK_VDEK',
    subType: 'SprzedazWiersz',
    columnMap: NAMOS_VDEK_SPRZEDAZ_MAP,
    fields: JPK_V7M_SPRZEDAZ_FIELDS,
  },
  {
    id: 'NAMOS_JPK_FA_Faktura',
    name: 'NAMOS → JPK_FA Faktura',
    system: 'NAMOS',
    jpkType: 'JPK_FA',
    subType: 'Faktura',
    columnMap: NAMOS_FA_FAKTURA_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  {
    id: 'ESO_JPK_MAG_WZ',
    name: 'ESO → JPK_MAG WZ',
    system: 'ESO',
    jpkType: 'JPK_MAG',
    subType: 'WZ',
    columnMap: ESO_MAG_WZ_MAP,
    fields: [...JPK_MAG_WZ_DOC_FIELDS, ...JPK_MAG_WZ_FIELDS],
  },
]

/**
 * Find a system profile matching the given system, JPK type, and sub-type.
 */
export function findProfile(system: string, jpkType: string, subType: string): SystemProfile | null {
  return SYSTEM_PROFILES.find(
    (p) => p.system === system && p.jpkType === jpkType && p.subType === subType
  ) ?? null
}

/**
 * Auto-detect and apply the best profile for a RawSheet.
 * Uses sheet metadata (system, jpkType, subType) when available.
 */
export function applyProfile(sheet: RawSheet): MappingResult | null {
  const { system, jpkType, subType } = sheet.metadata

  if (!system || !jpkType || !subType) return null

  const profile = findProfile(system, jpkType, subType)
  if (!profile) return null

  const columnCount = sheet.rows.length > 0 ? sheet.rows[0].cells.length : 0
  return applyPositionalMapping(columnCount, profile.columnMap, profile.fields)
}
