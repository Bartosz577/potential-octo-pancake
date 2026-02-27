// XML export utility — bridges ParsedFile + mappings → core generators

import { generatorRegistry } from '../../../core/generators/XmlGeneratorEngine'
// Import generators to trigger auto-registration in the registry
import '../../../core/generators/JpkV7mGenerator'
import '../../../core/generators/JpkFaGenerator'
import '../../../core/generators/JpkMagGenerator'
import '../../../core/generators/JpkWbGenerator'
import type { V7mGeneratorInput } from '../../../core/generators/JpkV7mGenerator'
import type { FaGeneratorInput } from '../../../core/generators/JpkFaGenerator'
import type { MagGeneratorInput, MagDokument } from '../../../core/generators/JpkMagGenerator'
import type { WbGeneratorInput, WbWiersz } from '../../../core/generators/JpkWbGenerator'
import type { ColumnMapping } from '../../../core/mapping/AutoMapper'
import type { ParsedFile, JpkType } from '../types'
import type { CompanyData, PeriodData } from '../stores/companyStore'
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
  JPK_VDEK: 'JPK_V7M',
  JPK_FA: 'JPK_FA',
  JPK_MAG: 'JPK_MAG',
  JPK_WB: 'JPK_WB'
}

const JPK_FILE_PREFIXES: Record<JpkType, string> = {
  JPK_VDEK: 'JPK_V7M',
  JPK_FA: 'JPK_FA',
  JPK_MAG: 'JPK_MAG',
  JPK_WB: 'JPK_WB'
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
      miesiac: period.month,
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

function buildFaInput(
  file: ParsedFile,
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): FaGeneratorInput {
  const mm = String(period.month).padStart(2, '0')
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
  const mm = String(period.month).padStart(2, '0')
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
  const mm = String(period.month).padStart(2, '0')
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

function buildGeneratorInput(
  file: ParsedFile,
  records: Record<string, string>[],
  company: CompanyData,
  period: PeriodData
): unknown {
  switch (file.jpkType) {
    case 'JPK_VDEK':
      return buildV7mInput(records, company, period)
    case 'JPK_FA':
      return buildFaInput(file, records, company, period)
    case 'JPK_MAG':
      return buildMagInput(file, records, company, period)
    case 'JPK_WB':
      return buildWbInput(file, records, company, period)
  }
}

export function generateXmlForFile(
  file: ParsedFile,
  mappings: ColumnMapping[],
  company: CompanyData,
  period: PeriodData
): XmlExportResult | null {
  const registryKey = JPK_REGISTRY_KEYS[file.jpkType]
  const generator = generatorRegistry.get(registryKey)
  if (!generator) return null

  const records = rowsToRecords(file.rows, mappings)
  const input = buildGeneratorInput(file, records, company, period)

  const xml = generator.generate(input)
  const nip = normalizeNip(company.nip)
  const mm = String(period.month).padStart(2, '0')
  const prefix = JPK_FILE_PREFIXES[file.jpkType]
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
