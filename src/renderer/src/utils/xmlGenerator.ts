import type { ParsedFile } from '../types'
import type { CompanyData, PeriodData } from '../stores/companyStore'
import { normalizeNip } from './nipValidator'

// --- Helpers ---

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

// --- VDEK Column Mappings ---

// data[0]  = LpSprzedazy
// data[1]  = KodKrajuNadaniaTIN
// data[2]  = NrKontrahenta
// data[3]  = NazwaKontrahenta
// data[4]  = DowodSprzedazy
// data[5]  = DataWystawienia
// data[6]  = DataSprzedazy
// data[7]  = TypDokumentu
// data[8..20]  = GTU_01..GTU_13
// data[21] = KorektaPodstawyOpodt
// data[22..35] = SW, EE, TP, TT_WNT, TT_D, MR_T, MR_UZ, I_42, I_63, B_SPV, B_SPV_DOSTAWA, B_MPV_PROWIZJA, IED, WSTO_EE
// data[36..62] = K_10..K_36

const GTU_NAMES = [
  'GTU_01', 'GTU_02', 'GTU_03', 'GTU_04', 'GTU_05', 'GTU_06', 'GTU_07',
  'GTU_08', 'GTU_09', 'GTU_10', 'GTU_11', 'GTU_12', 'GTU_13'
]

const MARKER_NAMES = [
  'KorektaPodstawyOpodt',
  'SW', 'EE', 'TP', 'TT_WNT', 'TT_D', 'MR_T', 'MR_UZ',
  'I_42', 'I_63', 'B_SPV', 'B_SPV_DOSTAWA', 'B_MPV_PROWIZJA', 'IED', 'WSTO_EE'
]

const K_FIELDS = [
  'K_10', 'K_11', 'K_12', 'K_13', 'K_14', 'K_15', 'K_16', 'K_17', 'K_18',
  'K_19', 'K_20', 'K_21', 'K_22', 'K_23', 'K_24', 'K_25', 'K_26', 'K_27',
  'K_28', 'K_29', 'K_30', 'K_31', 'K_32', 'K_33', 'K_34', 'K_35', 'K_36'
]

// VAT fields for PodatekNalezny: K_20, K_22, K_24, K_26, K_28, K_30, K_33
const VAT_K_INDICES = [10, 12, 14, 16, 18, 20, 23] // offsets within K_FIELDS (K_10=0)

export function generateVdekXml(
  file: ParsedFile,
  company: CompanyData,
  period: PeriodData
): string {
  const rows = file.rows
  const nip = normalizeNip(company.nip)
  let xml = ''

  xml += '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<JPK xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">\n'

  // Naglowek
  xml += '  <Naglowek>\n'
  xml += tagAttr('KodFormularza', { kodSystemowy: 'JPK_V7M (3)', wersjaSchemy: '1-2E' }, 'JPK_VAT', 2)
  xml += tag('WariantFormularza', '3', 2)
  xml += tag('DataWytworzeniaJPK', new Date().toISOString(), 2)
  xml += tag('NazwaSystemu', 'JPK Converter 1.0', 2)
  xml += tagAttr('CelZlozenia', { poz: 'P_7' }, String(period.celZlozenia), 2)
  xml += tag('KodUrzedu', company.kodUrzedu, 2)
  xml += tag('Rok', String(period.year), 2)
  xml += tag('Miesiac', String(period.month), 2)
  xml += '  </Naglowek>\n'

  // Podmiot1
  xml += '  <Podmiot1>\n'
  xml += '    <OsobaNiefizyczna>\n'
  xml += tag('NIP', nip, 3)
  xml += tag('PelnaNazwa', company.fullName, 3)
  if (company.regon) xml += tag('REGON', company.regon, 3)
  xml += '    </OsobaNiefizyczna>\n'
  xml += '  </Podmiot1>\n'

  // Ewidencja
  xml += '  <Ewidencja>\n'

  let totalVat = 0

  for (const row of rows) {
    xml += '    <SprzedazWiersz>\n'

    // LpSprzedazy
    xml += tag('LpSprzedazy', row[0] || '', 3)

    // KodKrajuNadaniaTIN
    const kodKraju = (row[1] || '').trim()
    if (kodKraju) xml += tag('KodKrajuNadaniaTIN', kodKraju, 3)

    // NrKontrahenta — skip if "brak" or empty
    const nrKontrahenta = (row[2] || '').trim()
    if (nrKontrahenta && nrKontrahenta !== 'brak') {
      xml += tag('NrKontrahenta', nrKontrahenta, 3)
    }

    // NazwaKontrahenta
    xml += tag('NazwaKontrahenta', row[3] || '', 3)

    // DowodSprzedazy
    xml += tag('DowodSprzedazy', row[4] || '', 3)

    // DataWystawienia
    xml += tag('DataWystawienia', row[5] || '', 3)

    // DataSprzedazy — optional
    const dataSprzedazy = (row[6] || '').trim()
    if (dataSprzedazy) xml += tag('DataSprzedazy', dataSprzedazy, 3)

    // TypDokumentu — optional
    const typDok = (row[7] || '').trim()
    if (typDok) xml += tag('TypDokumentu', typDok, 3)

    // GTU markers (data[8..20]) — only if "1"
    for (let i = 0; i < GTU_NAMES.length; i++) {
      const val = (row[8 + i] || '').trim()
      if (val === '1') xml += tag(GTU_NAMES[i], '1', 3)
    }

    // Procedural markers (data[21..35]) — only if "1"
    for (let i = 0; i < MARKER_NAMES.length; i++) {
      const val = (row[21 + i] || '').trim()
      if (val === '1') xml += tag(MARKER_NAMES[i], '1', 3)
    }

    // K_10 through K_36 (data[36..62]) — only non-zero
    for (let i = 0; i < K_FIELDS.length; i++) {
      const dec = toDecimal(row[36 + i] || '')
      if (dec !== '0.00') {
        xml += tag(K_FIELDS[i], dec, 3)
      }
    }

    // Accumulate VAT for control sum
    for (const ki of VAT_K_INDICES) {
      totalVat += parseDecimal(row[36 + ki] || '')
    }

    xml += '    </SprzedazWiersz>\n'
  }

  // SprzedazCtrl
  xml += '    <SprzedazCtrl>\n'
  xml += tag('LiczbaWierszySprzedazy', String(rows.length), 3)
  xml += tag('PodatekNalezny', totalVat.toFixed(2), 3)
  xml += '    </SprzedazCtrl>\n'

  xml += '  </Ewidencja>\n'
  xml += '</JPK>\n'

  return xml
}

// --- Summary info for the export step ---

export interface XmlSummary {
  rowCount: number
  vatTotal: number
  fileSize: number
  filename: string
}

export function getVdekSummary(
  file: ParsedFile,
  company: CompanyData,
  period: PeriodData
): XmlSummary {
  const nip = normalizeNip(company.nip)
  const filename = `JPK_V7M_${nip}_${period.year}-${String(period.month).padStart(2, '0')}.xml`

  let vatTotal = 0
  for (const row of file.rows) {
    for (const ki of VAT_K_INDICES) {
      vatTotal += parseDecimal(row[36 + ki] || '')
    }
  }

  return {
    rowCount: file.rowCount,
    vatTotal,
    fileSize: 0, // computed after generation
    filename
  }
}
