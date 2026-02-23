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

// --- JPK_FA Column Mappings ---
//
// data[0]  = KodWaluty
// data[1]  = P_1 (data wystawienia)
// data[2]  = P_2A (numer faktury)
// data[3]  = P_3A (nazwa nabywcy)
// data[4]  = P_3B (adres nabywcy)
// data[5]  = P_3C (nazwa sprzedawcy)
// data[6]  = P_3D (adres sprzedawcy)
// data[7]  = P_4A (prefix kraju — sprzedawca)
// data[8]  = P_4B (NIP sprzedawcy)
// data[9]  = P_5A (prefix kraju — nabywca, opcjonalny)
// data[10] = P_5B (NIP nabywcy, może mieć myślniki)
// data[11] = P_6 (data sprzedaży/usługi, opcjonalna)
// data[12] = P_13_1 (netto 23%)
// data[13] = P_14_1 (VAT 23%)
// data[14] = P_13_2 (netto 8%)
// data[15] = P_14_2 (VAT 8%)
// data[16] = P_13_3 (netto 5%)
// data[17] = P_14_3 (VAT 5%)
// data[18] = P_13_4
// data[19] = P_14_4
// data[20] = P_13_5
// data[21] = P_14_5
// data[22] = P_13_6 (netto 0%)
// data[23] = P_13_7 (netto zw.)
// data[24] = P_13_8
// data[25] = P_13_9
// data[26] = P_13_10
// data[27] = P_15 (kwota brutto — używana w FakturaCtrl)
// data[28] = P_16 (metoda kasowa) boolean
// data[29] = P_17 (samofakturowanie) boolean
// data[30] = P_18 boolean
// data[31] = P_18A boolean
// data[32] = P_19 boolean
// data[33] = P_19A string
// data[34] = P_19B string
// data[35] = P_19C string
// data[36] = P_20 boolean
// data[37] = P_20A string
// data[38] = P_20B string
// data[39] = P_21 boolean
// data[40] = P_21A string
// data[41] = P_21B string
// data[42] = P_21C string
// data[43] = P_22 boolean
// data[44] = P_22A string
// data[45] = P_22B string
// data[46] = P_22C string
// data[47] = P_23 boolean
// data[48] = P_106E_2 boolean
// data[49] = P_106E_3A boolean
// data[50] = ZALiczka string
// data[51] = RodzajFaktury string
// data[52] = PrzyczynaKorekty string
// data[53] = NrFaKorygowanej string
// data[54] = OkresFaKorygowanej string

// Decimal amount fields: [dataIndex, xmlFieldName]
const DECIMAL_FIELDS: [number, string][] = [
  [12, 'P_13_1'],
  [13, 'P_14_1'],
  [14, 'P_13_2'],
  [15, 'P_14_2'],
  [16, 'P_13_3'],
  [17, 'P_14_3'],
  [18, 'P_13_4'],
  [19, 'P_14_4'],
  [20, 'P_13_5'],
  [21, 'P_14_5'],
  [22, 'P_13_6'],
  [23, 'P_13_7'],
  [24, 'P_13_8'],
  [25, 'P_13_9'],
  [26, 'P_13_10']
]

// Boolean fields: [dataIndex, xmlFieldName]
const BOOLEAN_FIELDS: [number, string][] = [
  [28, 'P_16'],
  [29, 'P_17'],
  [30, 'P_18'],
  [31, 'P_18A'],
  [32, 'P_19'],
  [36, 'P_20'],
  [39, 'P_21'],
  [43, 'P_22'],
  [47, 'P_23'],
  [48, 'P_106E_2'],
  [49, 'P_106E_3A']
]

export function generateFaXml(
  file: ParsedFile,
  company: CompanyData,
  period: PeriodData
): string {
  const rows = file.rows
  const nip = normalizeNip(company.nip)
  let xml = ''

  xml += '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<JPK xmlns="http://crd.gov.pl/wzor/2021/09/27/11089/">\n'

  // Naglowek
  xml += '  <Naglowek>\n'
  xml += tagAttr('KodFormularza', { kodSystemowy: 'JPK_FA (4)', wersjaSchemy: '1-2' }, 'JPK_FA', 2)
  xml += tag('WariantFormularza', '4', 2)
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

  let wartoscFaktur = 0

  for (const row of rows) {
    xml += '  <Faktura>\n'

    // KodWaluty
    xml += tag('KodWaluty', row[0] || 'PLN', 2)

    // P_1 — data wystawienia
    xml += tag('P_1', row[1] || '', 2)

    // P_2A — numer faktury
    xml += tag('P_2A', row[2] || '', 2)

    // P_3A — nazwa nabywcy
    xml += tag('P_3A', row[3] || '', 2)

    // P_3B — adres nabywcy
    xml += tag('P_3B', row[4] || '', 2)

    // P_3C — nazwa sprzedawcy
    xml += tag('P_3C', row[5] || '', 2)

    // P_3D — adres sprzedawcy
    xml += tag('P_3D', row[6] || '', 2)

    // P_4A — prefix kraju sprzedawcy (opcjonalny)
    const p4a = (row[7] || '').trim()
    if (p4a) xml += tag('P_4A', p4a, 2)

    // P_4B — NIP sprzedawcy
    const p4b = normalizeNip(row[8] || '')
    if (p4b) xml += tag('P_4B', p4b, 2)

    // P_5A — prefix kraju nabywcy (opcjonalny)
    const p5a = (row[9] || '').trim()
    if (p5a) xml += tag('P_5A', p5a, 2)

    // P_5B — NIP nabywcy (opcjonalny — może być pusty lub "brak")
    const p5b = normalizeNip(row[10] || '')
    if (p5b && p5b !== 'brak') xml += tag('P_5B', p5b, 2)

    // P_6 — data sprzedaży (opcjonalna)
    const p6 = (row[11] || '').trim()
    if (p6) xml += tag('P_6', p6, 2)

    // Decimal amount fields — only non-zero
    for (const [idx, fieldName] of DECIMAL_FIELDS) {
      const dec = toDecimal(row[idx] || '')
      if (dec !== '0.00') xml += tag(fieldName, dec, 2)
    }

    // P_15 — kwota brutto (zawsze)
    const p15 = toDecimal(row[27] || '')
    xml += tag('P_15', p15, 2)
    wartoscFaktur += parseDecimal(row[27] || '')

    // Boolean fields — zawsze emituj
    for (const [idx, fieldName] of BOOLEAN_FIELDS) {
      const raw = (row[idx] || 'false').trim().toLowerCase()
      xml += tag(fieldName, raw === 'true' ? 'true' : 'false', 2)
    }

    // P_19A, P_19B, P_19C (opcjonalne string po P_19)
    const p19a = (row[33] || '').trim()
    if (p19a) xml += tag('P_19A', p19a, 2)
    const p19b = (row[34] || '').trim()
    if (p19b) xml += tag('P_19B', p19b, 2)
    const p19c = (row[35] || '').trim()
    if (p19c) xml += tag('P_19C', p19c, 2)

    // P_20A, P_20B (opcjonalne string po P_20)
    const p20a = (row[37] || '').trim()
    if (p20a) xml += tag('P_20A', p20a, 2)
    const p20b = (row[38] || '').trim()
    if (p20b) xml += tag('P_20B', p20b, 2)

    // P_21A, P_21B, P_21C (opcjonalne string po P_21)
    const p21a = (row[40] || '').trim()
    if (p21a) xml += tag('P_21A', p21a, 2)
    const p21b = (row[41] || '').trim()
    if (p21b) xml += tag('P_21B', p21b, 2)
    const p21c = (row[42] || '').trim()
    if (p21c) xml += tag('P_21C', p21c, 2)

    // P_22A, P_22B, P_22C (opcjonalne string po P_22)
    const p22a = (row[44] || '').trim()
    if (p22a) xml += tag('P_22A', p22a, 2)
    const p22b = (row[45] || '').trim()
    if (p22b) xml += tag('P_22B', p22b, 2)
    const p22c = (row[46] || '').trim()
    if (p22c) xml += tag('P_22C', p22c, 2)

    // ZALiczka (opcjonalny)
    const zaliczka = (row[50] || '').trim()
    if (zaliczka) xml += tag('ZALiczka', zaliczka, 2)

    // RodzajFaktury (zawsze)
    xml += tag('RodzajFaktury', row[51] || 'VAT', 2)

    // PrzyczynaKorekty (opcjonalna)
    const przyczyna = (row[52] || '').trim()
    if (przyczyna) xml += tag('PrzyczynaKorekty', przyczyna, 2)

    // NrFaKorygowanej (opcjonalny)
    const nrKor = (row[53] || '').trim()
    if (nrKor) xml += tag('NrFaKorygowanej', nrKor, 2)

    // OkresFaKorygowanej (opcjonalny)
    const okresKor = (row[54] || '').trim()
    if (okresKor) xml += tag('OkresFaKorygowanej', okresKor, 2)

    xml += '  </Faktura>\n'
  }

  // FakturaCtrl
  xml += '  <FakturaCtrl>\n'
  xml += tag('LiczbaFaktur', String(rows.length), 2)
  xml += tag('WartoscFaktur', wartoscFaktur.toFixed(2), 2)
  xml += '  </FakturaCtrl>\n'

  xml += '</JPK>\n'

  return xml
}

// --- Summary info for the export step ---

export function getFaSummary(
  file: ParsedFile,
  company: CompanyData,
  period: PeriodData
): XmlSummary {
  const nip = normalizeNip(company.nip)
  const filename = `JPK_FA_${nip}_${period.year}-${String(period.month).padStart(2, '0')}.xml`

  let vatTotal = 0
  for (const row of file.rows) {
    vatTotal += parseDecimal(row[27] || '')
  }

  return {
    rowCount: file.rowCount,
    vatTotal,
    fileSize: 0,
    filename
  }
}
