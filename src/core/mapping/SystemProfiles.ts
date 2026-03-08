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
//  COMARCH OPTIMA — JPK_VDEK SprzedazWiersz (VAT register TXT)
// ═══════════════════════════════════════════════════════
// Pipe-separated TXT export from Comarch Optima VAT register
// 14 data columns, no metadata prefix (unlike NAMOS/ESO)
// Header row: NrDokumentu|DataWystawienia|DataSprzedazy|NIPNabywcy|...

const COMARCH_OPTIMA_VAT_TXT_MAP: Record<number, string> = {
  0: 'DowodSprzedazy',     // NrDokumentu
  1: 'DataWystawienia',    // DataWystawienia
  2: 'DataSprzedazy',      // DataSprzedazy
  3: 'NrKontrahenta',      // NIPNabywcy
  4: 'NazwaKontrahenta',   // NazwaNabywcy
  5: 'K_10',               // NettoPodst23
  6: 'K_11',               // Vat23
  7: 'K_12',               // NettoPodst8
  8: 'K_13',               // Vat8
  9: 'K_14',               // NettoPodst5
  10: 'K_15',              // Vat5
  11: 'K_17',              // NettoZwolnione
  // Col 12: Brutto — sum field, not a direct JPK target
  // Col 13: KodWaluty — currency code
}

// ═══════════════════════════════════════════════════════
//  COMARCH OPTIMA — JPK_FA Faktura (XML export)
// ═══════════════════════════════════════════════════════
// XML export from Comarch Optima with <Faktura> root element
// Element names map directly to JPK_FA fields

const COMARCH_OPTIMA_XML_FA_MAP: Record<number, string> = {
  0: 'KodWaluty',
  1: 'P_1',           // DataWystawienia
  2: 'P_2',           // NumerFaktury
  3: 'P_3A',          // NazwaKontrahenta → nabywca nazwa
  4: 'P_3B',          // AdresKontrahenta → nabywca adres
  5: 'P_3C',          // NazwaSprzedawcy → sprzedawca nazwa
  6: 'P_3D',          // AdresSprzedawcy → sprzedawca adres
  7: 'P_4A',          // KrajSprzedawcy
  8: 'P_5',           // NIPSprzedawcy
  9: 'P_4B',          // KrajNabywcy
  10: 'P_6',          // NIPNabywcy
  11: 'P_13_1',       // Netto23
  12: 'P_14_1',       // VAT23
  13: 'P_13_2',       // Netto8
  14: 'P_14_2',       // VAT8
  15: 'P_13_3',       // Netto5
  16: 'P_14_3',       // VAT5
  17: 'P_15',         // BruttoRazem
  18: 'RodzajFaktury', // RodzajFaktury
}

// ═══════════════════════════════════════════════════════
//  INSERT SUBIEKT GT — JPK_FA Faktura (EPP format)
// ═══════════════════════════════════════════════════════
// EPP (EDI++) file from Insert Subiekt GT / Rachmistrz GT / Rewizor GT
// Section-based key=value pairs flattened to tabular data
// Invoice headers first, then item headers (deterministic order)
// Standard EPP fields:
//   Invoice: NrFaktury, DataWystawienia, NIPNabywcy, NazwaNabywcy, ...
//   Item:    NazwaTowaru, Ilosc, CenaNetto, StawkaVAT, WartoscNetto, WartoscVAT

const INSERT_SUBIEKT_FA_MAP: Record<number, string> = {
  0: 'P_2',           // NrFaktury
  1: 'P_1',           // DataWystawienia
  2: 'P_6',           // NIPNabywcy
  3: 'P_3A',          // NazwaNabywcy
  4: 'P_15',          // Brutto
  // Cols 5+: item fields — mapped via autoMap header matching
}

// ═══════════════════════════════════════════════════════
//  ENOVA365 — JPK_FA Faktura (XML export)
// ═══════════════════════════════════════════════════════
// XML with <Dokumenty> or <Ewidencja> root
// Child elements: <Numer>, <DataWystawienia>, <NIPNabywcy>, etc.

const ENOVA365_XML_FA_MAP: Record<number, string> = {
  0: 'P_2',           // Numer
  1: 'P_1',           // DataWystawienia
  2: 'P_6',           // NIPNabywcy
  3: 'P_3A',          // NazwaNabywcy
  4: 'P_13_1',        // WartoscNetto
  5: 'P_14_1',        // WartoscVAT
}

// ═══════════════════════════════════════════════════════
//  ENOVA365 — JPK_FA Faktura (CDN CSV export)
// ═══════════════════════════════════════════════════════
// Semicolon-separated CSV with header row
// Nr_dokumentu;Data_wystawienia;NIP;Nazwa_kontrahenta;Netto;Vat;Brutto;Stawka

const ENOVA365_CDN_TXT_MAP: Record<number, string> = {
  0: 'P_2',           // Nr_dokumentu
  1: 'P_1',           // Data_wystawienia
  2: 'P_6',           // NIP
  3: 'P_3A',          // Nazwa_kontrahenta
  4: 'P_13_1',        // Netto
  5: 'P_14_1',        // Vat
  6: 'P_15',          // Brutto
  // Col 7: Stawka — VAT rate, not a direct JPK target
}

// ═══════════════════════════════════════════════════════
//  SAGE SYMFONIA — JPK_FA Faktura (TXT export)
// ═══════════════════════════════════════════════════════
// Semicolon-separated TXT
// TypDokumentu;NrDokumentu;DataWystawienia;NazwaKontrahenta;NIPKontrahenta;
// Netto;VATKwota;Brutto;StawkaVAT;KodWaluty

const SAGE_SYMFONIA_FA_MAP: Record<number, string> = {
  0: 'RodzajFaktury',  // TypDokumentu (FA/FZ/KS/KZ)
  1: 'P_2',           // NrDokumentu
  2: 'P_1',           // DataWystawienia
  3: 'P_3A',          // NazwaKontrahenta
  4: 'P_6',           // NIPKontrahenta
  5: 'P_13_1',        // Netto
  6: 'P_14_1',        // VATKwota
  7: 'P_15',          // Brutto
  // Col 8: StawkaVAT — rate, not a direct JPK target
  9: 'KodWaluty',     // KodWaluty
}

// ═══════════════════════════════════════════════════════
//  ASSECO WAPRO — JPK_FA Faktura (XML export)
// ═══════════════════════════════════════════════════════
// XML with <WaproExport> or <Faktury> root
// Child elements: <Nr_faktury>, <Data_wyst>, <NIP_kontr>, etc.

const ASSECO_WAPRO_XML_FA_MAP: Record<number, string> = {
  0: 'P_2',           // Nr_faktury
  1: 'P_1',           // Data_wyst
  2: 'P_6',           // NIP_kontr
  3: 'P_3A',          // Nazwa_kontr
  4: 'P_13_1',        // Netto_23
  5: 'P_14_1',        // VAT_23
}

// ═══════════════════════════════════════════════════════
//  DYNAMICS NAV — JPK_FA Faktura (XML export)
// ═══════════════════════════════════════════════════════
// XML with <NAVExport> or <GLEntry> root
// Enterprise system — non-standard exports

const DYNAMICS_NAV_FA_MAP: Record<number, string> = {
  0: 'P_2',           // No_
  1: 'P_1',           // PostingDate
  2: 'P_6',           // CustomerNo_
  3: 'P_13_1',        // Amount
  4: 'P_14_1',        // VATAmount
}

// ═══════════════════════════════════════════════════════
//  SAP R/3 — JPK_FA Faktura (CSV export)
// ═══════════════════════════════════════════════════════
// Semicolon-separated CSV with SAP-specific headers
// BUKRS;BLART;BUDAT;BELNR;WAERS;WRBTR;MWSKZ

const SAP_R3_CSV_FA_MAP: Record<number, string> = {
  // Col 0: BUKRS — company code, not direct JPK target
  // Col 1: BLART — document type
  2: 'P_1',           // BUDAT (posting date)
  3: 'P_2',           // BELNR (document number)
  4: 'KodWaluty',     // WAERS (currency)
  5: 'P_15',          // WRBTR (amount)
  // Col 6: MWSKZ — tax code, not a direct JPK target
}

// ═══════════════════════════════════════════════════════
//  Profile registry
// ═══════════════════════════════════════════════════════

export const SYSTEM_PROFILES: SystemProfile[] = [
  {
    id: 'NAMOS_JPK_VDEK_SprzedazWiersz',
    name: 'NAMOS → JPK_V7M Sprzedaż',
    system: 'NAMOS',
    jpkType: 'V7M',
    subType: 'SprzedazWiersz',
    columnMap: NAMOS_VDEK_SPRZEDAZ_MAP,
    fields: JPK_V7M_SPRZEDAZ_FIELDS,
  },
  {
    id: 'NAMOS_JPK_FA_Faktura',
    name: 'NAMOS → JPK_FA Faktura',
    system: 'NAMOS',
    jpkType: 'FA',
    subType: 'Faktura',
    columnMap: NAMOS_FA_FAKTURA_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  {
    id: 'ESO_JPK_MAG_WZ',
    name: 'ESO → JPK_MAG WZ',
    system: 'ESO',
    jpkType: 'MAG',
    subType: 'WZ',
    columnMap: ESO_MAG_WZ_MAP,
    fields: [...JPK_MAG_WZ_DOC_FIELDS, ...JPK_MAG_WZ_FIELDS],
  },
  {
    id: 'COMARCH_OPTIMA_VAT_TXT',
    name: 'Comarch Optima → JPK_V7M Sprzedaż (TXT)',
    system: 'COMARCH_OPTIMA',
    jpkType: 'V7M',
    subType: 'SprzedazWiersz',
    columnMap: COMARCH_OPTIMA_VAT_TXT_MAP,
    fields: JPK_V7M_SPRZEDAZ_FIELDS,
  },
  {
    id: 'COMARCH_OPTIMA_XML_FA',
    name: 'Comarch Optima → JPK_FA Faktura (XML)',
    system: 'COMARCH_OPTIMA',
    jpkType: 'FA',
    subType: 'Faktura',
    columnMap: COMARCH_OPTIMA_XML_FA_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  {
    id: 'INSERT_SUBIEKT_FA',
    name: 'Insert Subiekt GT → JPK_FA Faktura (EPP)',
    system: 'INSERT_SUBIEKT',
    jpkType: 'FA',
    subType: 'Faktura',
    columnMap: INSERT_SUBIEKT_FA_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  {
    id: 'ENOVA365_XML_FA',
    name: 'enova365 → JPK_FA Faktura (XML)',
    system: 'ENOVA365',
    jpkType: 'FA',
    subType: 'Faktura',
    columnMap: ENOVA365_XML_FA_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  {
    id: 'ENOVA365_CDN_TXT',
    name: 'enova365 CDN → JPK_FA Faktura (CSV)',
    system: 'ENOVA365',
    jpkType: 'FA',
    subType: 'Faktura',
    columnMap: ENOVA365_CDN_TXT_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  {
    id: 'SAGE_SYMFONIA_FA',
    name: 'Sage Symfonia → JPK_FA Faktura (TXT)',
    system: 'SAGE_SYMFONIA',
    jpkType: 'FA',
    subType: 'Faktura',
    columnMap: SAGE_SYMFONIA_FA_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  {
    id: 'ASSECO_WAPRO_XML_FA',
    name: 'Asseco WAPRO → JPK_FA Faktura (XML)',
    system: 'ASSECO_WAPRO',
    jpkType: 'FA',
    subType: 'Faktura',
    columnMap: ASSECO_WAPRO_XML_FA_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  {
    id: 'DYNAMICS_NAV_FA',
    name: 'Dynamics NAV → JPK_FA Faktura (XML)',
    system: 'DYNAMICS_NAV',
    jpkType: 'FA',
    subType: 'Faktura',
    columnMap: DYNAMICS_NAV_FA_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  {
    id: 'SAP_R3_CSV_FA',
    name: 'SAP R/3 → JPK_FA Faktura (CSV)',
    system: 'SAP_R3',
    jpkType: 'FA',
    subType: 'Faktura',
    columnMap: SAP_R3_CSV_FA_MAP,
    fields: JPK_FA_FAKTURA_FIELDS,
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
 * Find a profile by data structure (jpkType + subType), ignoring system name.
 *
 * This allows files from unknown ERP systems (e.g. SAP_RE) to be mapped
 * using a known profile if the column structure is compatible.
 * The jpkType comparison normalizes JPK_VDEK ↔ JPK_V7M equivalence.
 */
export function findProfileByStructure(jpkType: string, subType: string): SystemProfile | null {
  const normalizedType = normalizeJpkType(jpkType)
  return SYSTEM_PROFILES.find(
    (p) => normalizeJpkType(p.jpkType) === normalizedType && p.subType === subType
  ) ?? null
}

/** Normalize JPK type aliases to canonical unprefixed form */
function normalizeJpkType(jpkType: string): string {
  const upper = jpkType.toUpperCase().trim()
  if (upper === 'JPK_V7M' || upper === 'JPK_V7K' || upper === 'JPK_VDEK' || upper === 'VDEK' || upper === 'V7M' || upper === 'V7K') return 'V7M'
  if (upper.startsWith('JPK_')) return upper.slice(4)
  return upper
}

/**
 * Auto-detect and apply the best profile for a RawSheet.
 *
 * Matching is based on data STRUCTURE (jpkType + subType), not system name.
 * This means a file from SAP_RE with JPK_VDEK/SprzedazWiersz structure
 * will match the NAMOS VDEK profile automatically.
 */
export function applyProfile(sheet: RawSheet): { result: MappingResult; profile: SystemProfile } | null {
  const { jpkType, subType } = sheet.metadata

  if (!jpkType || !subType) return null

  const profile = findProfileByStructure(jpkType, subType)
  if (!profile) return null

  const columnCount = sheet.rows.length > 0 ? sheet.rows[0].cells.length : 0
  const result = applyPositionalMapping(columnCount, profile.columnMap, profile.fields)
  return { result, profile }
}
