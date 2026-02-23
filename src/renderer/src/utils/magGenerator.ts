import type { ParsedFile } from '../types'
import type { CompanyData, PeriodData } from '../stores/companyStore'
import { normalizeNip } from './nipValidator'
import type { XmlSummary } from './xmlGenerator'

// --- Helpers (mirrored from xmlGenerator.ts) ---

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toDecimal(value: string): string {
  if (!value || value.trim() === '') return '0.00'
  const num = parseFloat(value.replace(',', '.'))
  if (isNaN(num)) return '0.00'
  return num.toFixed(2)
}

function parseDecimal(value: string): number {
  if (!value || value.trim() === '') return 0
  return parseFloat(value.replace(',', '.')) || 0
}

function tag(name: string, value: string, indent: number): string {
  const pad = '  '.repeat(indent)
  return `${pad}<${name}>${escapeXml(value)}</${name}>\n`
}

function tagAttr(
  name: string,
  attrs: Record<string, string>,
  value: string,
  indent: number
): string {
  const pad = '  '.repeat(indent)
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeXml(v)}"`)
    .join(' ')
  return `${pad}<${name} ${attrStr}>${escapeXml(value)}</${name}>\n`
}

// --- JPK_MAG WZ Column Mappings ---
//
// data[0]  = NumerWZWartoscNadawcy (Magazyn / kod punktu)
// data[1]  = NumerWZ (klucz dokumentu — powtarza się dla każdej pozycji)
// data[2]  = DataWZ
// data[3]  = WartoscWZ (wartość nagłówkowa — powtarza się)
// data[4]  = DataOtrzymaniaWZ
// data[5]  = OdbiorcaWZ
// data[6]  = _(puste)_
// data[7]  = _(puste)_
// data[8]  = NumerWZ (referencja wiersza — identyczna jak data[1])
// data[9]  = KodTowaruWZ
// data[10] = NazwaTowaruWZ
// data[11] = IloscWZ (decimal, np. "80,000000")
// data[12] = JednostkaWZ
// data[13] = CenaWZ (decimal)
// data[14] = WartoscWZ wiersza (decimal)

export function generateMagXml(
  file: ParsedFile,
  company: CompanyData,
  period: PeriodData
): string {
  const rows = file.rows
  const nip = normalizeNip(company.nip)
  let xml = ''

  xml += '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<JPK xmlns="http://crd.gov.pl/wzor/2022/06/10/11618/">\n'

  // Naglowek
  xml += '  <Naglowek>\n'
  xml += tagAttr('KodFormularza', { kodSystemowy: 'JPK_MAG (1)', wersjaSchemy: '1-0' }, 'JPK_MAG', 2)
  xml += tag('WariantFormularza', '1', 2)
  xml += tag('DataWytworzeniaJPK', new Date().toISOString(), 2)
  xml += tag('NazwaSystemu', 'JPK Converter 1.0', 2)
  xml += tagAttr('CelZlozenia', { poz: 'P_2' }, String(period.celZlozenia), 2)
  xml += tag('DataOd', file.dateFrom, 2)
  xml += tag('DataDo', file.dateTo, 2)
  xml += '  </Naglowek>\n'

  // Podmiot1
  xml += '  <Podmiot1>\n'
  xml += '    <OsobaNiefizyczna>\n'
  xml += tag('NIP', nip, 3)
  xml += tag('PelnaNazwa', company.fullName, 3)
  if (company.regon) xml += tag('REGON', company.regon, 3)
  xml += '    </OsobaNiefizyczna>\n'
  xml += '  </Podmiot1>\n'

  // Deduplicate WZ headers — keep first occurrence per NumerWZ
  const wzHeaders = new Map<string, string[]>()
  for (const row of rows) {
    const numerWZ = (row[1] || '').trim()
    if (numerWZ && !wzHeaders.has(numerWZ)) {
      wzHeaders.set(numerWZ, row)
    }
  }

  // Emit <WZ> elements (one per unique document)
  for (const [, row] of wzHeaders) {
    xml += '  <WZ>\n'
    xml += tag('NumerWZWartoscNadawcy', row[0] || '', 2)
    xml += tag('NumerWZ', row[1] || '', 2)
    xml += tag('DataWZ', row[2] || '', 2)
    xml += tag('WartoscWZ', toDecimal(row[3] || ''), 2)
    xml += tag('DataOtrzymaniaWZ', row[4] || '', 2)
    xml += tag('OdbiorcaWZ', row[5] || '', 2)
    xml += '  </WZ>\n'
  }

  // Emit <WZWiersz> elements (one per TXT row)
  for (const row of rows) {
    xml += '  <WZWiersz>\n'
    xml += tag('NumerWZ', row[8] || row[1] || '', 2)
    xml += tag('KodTowaruWZ', row[9] || '', 2)
    xml += tag('NazwaTowaruWZ', row[10] || '', 2)
    xml += tag('IloscWZ', toDecimal(row[11] || ''), 2)
    xml += tag('JednostkaWZ', row[12] || '', 2)
    xml += tag('CenaWZ', toDecimal(row[13] || ''), 2)
    xml += tag('WartoscWZ', toDecimal(row[14] || ''), 2)
    xml += '  </WZWiersz>\n'
  }

  // WZCtrl — control sums
  let sumaWartoscWZ = 0
  for (const [, row] of wzHeaders) {
    sumaWartoscWZ += parseDecimal(row[3] || '')
  }

  xml += '  <WZCtrl>\n'
  xml += tag('LiczbaWZ', String(wzHeaders.size), 2)
  xml += tag('SumaWartoscWZ', sumaWartoscWZ.toFixed(2), 2)
  xml += '  </WZCtrl>\n'

  xml += '</JPK>\n'

  return xml
}

// --- Summary info for the export step ---

export function getMagSummary(
  file: ParsedFile,
  company: CompanyData,
  period: PeriodData
): XmlSummary {
  const nip = normalizeNip(company.nip)
  const filename = `JPK_MAG_${nip}_${period.year}-${String(period.month).padStart(2, '0')}.xml`

  // Deduplicate to compute SumaWartoscWZ
  const wzHeaders = new Map<string, string[]>()
  for (const row of file.rows) {
    const numerWZ = (row[1] || '').trim()
    if (numerWZ && !wzHeaders.has(numerWZ)) wzHeaders.set(numerWZ, row)
  }

  let vatTotal = 0
  for (const [, row] of wzHeaders) {
    vatTotal += parseDecimal(row[3] || '')
  }

  return {
    rowCount: file.rowCount,
    vatTotal,
    fileSize: 0,
    filename
  }
}
