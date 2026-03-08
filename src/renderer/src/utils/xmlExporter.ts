// XML export utility — bridges ParsedFile + mappings → core generators

import { generatorRegistry } from '../../../core/generators/XmlGeneratorEngine'
// Import generators to trigger auto-registration in the registry
import '../../../core/generators/JpkV7mGenerator'
import '../../../core/generators/JpkV7kGenerator'
import '../../../core/generators/JpkFaGenerator'
import '../../../core/generators/JpkMagGenerator'
import '../../../core/generators/JpkWbGenerator'
import '../../../core/generators/JpkPkpirGenerator'
import '../../../core/generators/JpkEwpGenerator'
import '../../../core/generators/JpkKrPdGenerator'
import '../../../core/generators/JpkStGenerator'
import '../../../core/generators/JpkStKrGenerator'
import '../../../core/generators/JpkFaRrGenerator'
import '../../../core/generators/JpkKrGenerator'
import type { V7mGeneratorInput } from '../../../core/generators/JpkV7mGenerator'
import type { V7kGeneratorInput } from '../../../core/generators/JpkV7kGenerator'
import type { FaGeneratorInput } from '../../../core/generators/JpkFaGenerator'
import type { MagGeneratorInput, MagDokument } from '../../../core/generators/JpkMagGenerator'
import type { WbGeneratorInput, WbWiersz } from '../../../core/generators/JpkWbGenerator'
import type { PkpirGeneratorInput } from '../../../core/generators/JpkPkpirGenerator'
import type { EwpGeneratorInput } from '../../../core/generators/JpkEwpGenerator'
import type { KrPdGeneratorInput } from '../../../core/generators/JpkKrPdGenerator'
import type { StGeneratorInput } from '../../../core/generators/JpkStGenerator'
import type { StKrGeneratorInput } from '../../../core/generators/JpkStKrGenerator'
import type { FaRrGeneratorInput } from '../../../core/generators/JpkFaRrGenerator'
import type { KrGeneratorInput } from '../../../core/generators/JpkKrGenerator'
import type { ColumnMapping } from '../../../core/mapping/AutoMapper'
import type { ParsedFile, JpkType } from '../types'
import type { CompanyData, PeriodData } from '../stores/companyStore'
import type { JpkSubtype } from '../stores/appStore'
import { normalizeNip } from './nipValidator'

export interface XmlExportResult {
  xml: string
  filename: string
  jpkType: string
  schemaVersion: string
  namespace: string
  rowCount: number
  fileSize: number
}

const JPK_REGISTRY_KEYS: Record<JpkType, string> = {
  V7M: 'JPK_V7M',
  FA: 'JPK_FA',
  MAG: 'JPK_MAG',
  WB: 'JPK_WB',
  PKPIR: 'JPK_PKPIR',
  EWP: 'JPK_EWP',
  KR_PD: 'JPK_KR_PD',
  ST: 'JPK_ST',
  ST_KR: 'JPK_ST_KR',
  FA_RR: 'JPK_FA_RR',
  KR: 'JPK_KR'
}

const JPK_FILE_PREFIXES: Record<JpkType, string> = {
  V7M: 'JPK_V7M',
  FA: 'JPK_FA',
  MAG: 'JPK_MAG',
  WB: 'JPK_WB',
  PKPIR: 'JPK_PKPIR',
  EWP: 'JPK_EWP',
  KR_PD: 'JPK_KR_PD',
  ST: 'JPK_ST',
  ST_KR: 'JPK_ST_KR',
  FA_RR: 'JPK_FA_RR',
  KR: 'JPK_KR'
}

// Convert file rows to Record<string, string>[] using column mappings
function rowsToRecords(rows: string[][], mappings: ColumnMapping[]): Record<string, string>[] {
  return rows.map((row) => {
    const record: Record<string, string> = {}
    for (const m of mappings) {
      record[m.targetField] = row[m.sourceColumn] || ''
    }
    return record
  })
}

// Stub address for types that require it (company store doesn't have address yet)
const STUB_ADRES = {
  typ: 'polski' as const,
  wojewodztwo: '-',
  powiat: '-',
  gmina: '-',
  nrDomu: '-',
  miejscowosc: '-',
  kodPocztowy: '00-000'
}

function buildV7mInput(
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): V7mGeneratorInput {
  return {
    naglowek: {
      celZlozenia: period.celZlozenia,
      kodUrzedu: company.kodUrzedu,
      rok: period.year,
      miesiac: (period.month ?? 1),
      nazwaSystemu: 'JPK Converter 2.0'
    },
    podmiot: {
      typ: 'niefizyczna',
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      email: company.email
    },
    sprzedazWiersze: records,
    zakupWiersze: []
  }
}

function buildV7kInput(
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): V7kGeneratorInput {
  const kwartal = Math.ceil((period.month ?? 1) / 3)
  return {
    naglowek: {
      celZlozenia: period.celZlozenia,
      kodUrzedu: company.kodUrzedu,
      rok: period.year,
      miesiac: (period.month ?? 1),
      nazwaSystemu: 'JPK Converter 2.0'
    },
    podmiot: {
      typ: 'niefizyczna',
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      email: company.email
    },
    sprzedazWiersze: records,
    zakupWiersze: [],
    kwartal
  }
}

function buildFaInput(
  file: ParsedFile,
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): FaGeneratorInput {
  const mm = String((period.month ?? 1)).padStart(2, '0')
  return {
    naglowek: {
      dataOd: file.dateFrom || `${period.year}-${mm}-01`,
      dataDo: file.dateTo || `${period.year}-${mm}-28`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      adres: STUB_ADRES
    },
    faktury: records,
    wiersze: []
  }
}

// Group MAG records by document number into MagDokument[]
function groupMagDocuments(
  records: Record<string, string>[],
  docNumField: string
): MagDokument[] {
  const groups = new Map<string, Record<string, string>[]>()
  for (const r of records) {
    const num = r[docNumField] || 'UNKNOWN'
    if (!groups.has(num)) groups.set(num, [])
    groups.get(num)!.push(r)
  }

  return Array.from(groups.entries()).map(([, rows]) => ({
    header: rows[0],
    wiersze: rows
  }))
}

// MAG subtype → document number field + input key
const MAG_CONFIG: Record<string, { numField: string; inputKey: string }> = {
  WZ: { numField: 'NumerWZ', inputKey: 'wz' },
  PZ: { numField: 'NumerPZ', inputKey: 'pz' },
  RW: { numField: 'NumerRW', inputKey: 'rw' },
  MM: { numField: 'NumerMM', inputKey: 'mmwy' }
}

function buildMagInput(
  file: ParsedFile,
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): MagGeneratorInput {
  const mm = String((period.month ?? 1)).padStart(2, '0')
  const config = MAG_CONFIG[file.subType] || MAG_CONFIG['WZ']
  const documents = groupMagDocuments(records, config.numField)

  const input: MagGeneratorInput = {
    naglowek: {
      dataOd: file.dateFrom || `${period.year}-${mm}-01`,
      dataDo: file.dateTo || `${period.year}-${mm}-28`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      regon: company.regon || undefined,
      adres: STUB_ADRES
    },
    magazyn: records[0]?.['NazwaMagazynu'] || records[0]?.['Magazyn'] || 'MAG1',
    metoda: 1
  }

  // Set the documents on the correct subtype key
  ;(input as unknown as Record<string, unknown>)[config.inputKey] = documents

  return input
}

function buildWbInput(
  file: ParsedFile,
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): WbGeneratorInput {
  const mm = String((period.month ?? 1)).padStart(2, '0')
  const wiersze: WbWiersz[] = records.map((r) => ({
    dataOperacji: r['DataOperacji'] || '',
    nazwaPodmiotu: r['NazwaKontrahenta'] || r['NazwaPodmiotu'] || '',
    opisOperacji: r['OpisOperacji'] || '',
    kwotaOperacji: r['KwotaOperacji'] || '0',
    saldoOperacji: r['SaldoOperacji'] || '0'
  }))

  return {
    naglowek: {
      dataOd: file.dateFrom || `${period.year}-${mm}-01`,
      dataDo: file.dateTo || `${period.year}-${mm}-28`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      regon: company.regon || undefined,
      adres: { ...STUB_ADRES, poczta: '-' }
    },
    numerRachunku: records[0]?.['NumerRachunku'] || 'PL00000000000000000000000000',
    saldoPoczatkowe: records[0]?.['SaldoPoczatkowe'] || '0',
    saldoKoncowe: records[records.length - 1]?.['SaldoKoncowe'] || '0',
    wiersze
  }
}

function buildPkpirInput(
  file: ParsedFile,
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): PkpirGeneratorInput {
  const mm = String((period.month ?? 1)).padStart(2, '0')
  return {
    naglowek: {
      celZlozenia: period.celZlozenia,
      dataOd: file.dateFrom || `${period.year}-${mm}-01`,
      dataDo: file.dateTo || `${period.year}-12-31`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      typ: 'niefizyczna',
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      email: company.email
    },
    pkpirInfo: {
      spisPoczatek: 0,
      spisKoniec: 0,
      kosztyRazem: 0,
      dochod: 0
    },
    wiersze: records
  }
}

function buildEwpInput(
  file: ParsedFile,
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): EwpGeneratorInput {
  const mm = String((period.month ?? 1)).padStart(2, '0')
  return {
    naglowek: {
      celZlozenia: period.celZlozenia,
      dataOd: file.dateFrom || `${period.year}-${mm}-01`,
      dataDo: file.dateTo || `${period.year}-12-31`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      typ: 'niefizyczna',
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      email: company.email
    },
    wiersze: records
  }
}

function buildKrPdInput(
  file: ParsedFile,
  _records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): KrPdGeneratorInput {
  const mm = String((period.month ?? 1)).padStart(2, '0')
  return {
    naglowek: {
      celZlozenia: period.celZlozenia,
      dataOd: file.dateFrom || `${period.year}-${mm}-01`,
      dataDo: file.dateTo || `${period.year}-12-31`,
      rokDataOd: `${period.year}-01-01`,
      rokDataDo: `${period.year}-12-31`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      regon: company.regon || undefined,
      adres: {
        kodKraju: 'PL',
        nrDomu: '-',
        miejscowosc: '-',
        kodPocztowy: '00-000'
      }
    },
    zpisSald: [],
    dziennik: [],
    rpd: { k1: 0, k2: 0, k3: 0, k4: 0, k5: 0, k6: 0, k7: 0, k8: 0 }
  }
}

function buildStInput(
  file: ParsedFile,
  _records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): StGeneratorInput {
  const mm = String((period.month ?? 1)).padStart(2, '0')
  return {
    naglowek: {
      celZlozenia: period.celZlozenia,
      dataOd: file.dateFrom || `${period.year}-${mm}-01`,
      dataDo: file.dateTo || `${period.year}-12-31`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      typ: 'niefizyczna',
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      email: company.email,
      znacznikSt: '2'  // default PKPIR
    },
    pkpirWiersze: []
  }
}

function buildStKrInput(
  file: ParsedFile,
  _records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): StKrGeneratorInput {
  return {
    naglowek: {
      celZlozenia: period.celZlozenia,
      rokDataOd: file.dateFrom || `${period.year}-01-01`,
      rokDataDo: file.dateTo || `${period.year}-12-31`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      regon: company.regon || undefined,
      adres: {
        kodKraju: 'PL',
        nrDomu: '-',
        miejscowosc: '-',
        kodPocztowy: '00-000'
      }
    },
    wiersze: []
  }
}

function buildFaRrInput(
  file: ParsedFile,
  _records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): FaRrGeneratorInput {
  const mm = String((period.month ?? 1)).padStart(2, '0')
  return {
    naglowek: {
      dataOd: file.dateFrom || `${period.year}-${mm}-01`,
      dataDo: file.dateTo || `${period.year}-${mm}-28`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      adres: {
        typ: 'polski' as const,
        wojewodztwo: '-',
        powiat: '-',
        gmina: '-',
        nrDomu: '-',
        miejscowosc: '-',
        kodPocztowy: '00-000'
      }
    },
    faktury: [],
    wiersze: []
  }
}

function buildKrInput(
  file: ParsedFile,
  _records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): KrGeneratorInput {
  const mm = String((period.month ?? 1)).padStart(2, '0')
  return {
    naglowek: {
      dataOd: file.dateFrom || `${period.year}-${mm}-01`,
      dataDo: file.dateTo || `${period.year}-12-31`,
      kodUrzedu: company.kodUrzedu
    },
    podmiot: {
      nip: normalizeNip(company.nip),
      pelnaNazwa: company.fullName,
      regon: company.regon || undefined,
      adres: {
        kodKraju: 'PL',
        nrDomu: '-',
        miejscowosc: '-',
        kodPocztowy: '00-000'
      }
    },
    zpisSald: [],
    dziennik: [],
    kontoZapisy: []
  }
}

function buildGeneratorInput(
  file: ParsedFile,
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData,
  jpkSubtype: JpkSubtype = 'V7M'
): unknown {
  switch (file.jpkType) {
    case 'V7M':
      return jpkSubtype === 'V7K'
        ? buildV7kInput(records, company, period)
        : buildV7mInput(records, company, period)
    case 'FA':
      return buildFaInput(file, records, company, period)
    case 'MAG':
      return buildMagInput(file, records, company, period)
    case 'WB':
      return buildWbInput(file, records, company, period)
    case 'PKPIR':
      return buildPkpirInput(file, records, company, period)
    case 'EWP':
      return buildEwpInput(file, records, company, period)
    case 'KR_PD':
      return buildKrPdInput(file, records, company, period)
    case 'ST':
      return buildStInput(file, records, company, period)
    case 'ST_KR':
      return buildStKrInput(file, records, company, period)
    case 'FA_RR':
      return buildFaRrInput(file, records, company, period)
    case 'KR':
      return buildKrInput(file, records, company, period)
  }
}

export function generateXmlForFile(
  file: ParsedFile,
  mappings: ColumnMapping[],
  company: CompanyData,
  period: PeriodData,
  jpkSubtype: JpkSubtype = 'V7M'
): XmlExportResult | null {
  const baseKey = JPK_REGISTRY_KEYS[file.jpkType]
  const registryKey = file.jpkType === 'V7M' && jpkSubtype === 'V7K' ? 'JPK_V7K' : baseKey
  const generator = generatorRegistry.get(registryKey)
  if (!generator) return null

  const records = rowsToRecords(file.rows, mappings)
  const input = buildGeneratorInput(file, records, company, period, jpkSubtype)

  const xml = generator.generate(input)
  const nip = normalizeNip(company.nip)
  const mm = String(period.month ?? 1).padStart(2, '0')
  const prefix = file.jpkType === 'V7M' && jpkSubtype === 'V7K' ? 'JPK_V7K' : JPK_FILE_PREFIXES[file.jpkType]
  const filename = `${prefix}_${nip}_${period.year}-${mm}.xml`

  return {
    xml,
    filename,
    jpkType: generator.jpkType,
    schemaVersion: generator.version,
    namespace: generator.namespace,
    rowCount: file.rowCount,
    fileSize: new Blob([xml]).size
  }
}

export function getAvailableGenerators(): { jpkType: string; version: string }[] {
  return generatorRegistry.getAll().map((g) => ({
    jpkType: g.jpkType,
    version: g.version
  }))
}
