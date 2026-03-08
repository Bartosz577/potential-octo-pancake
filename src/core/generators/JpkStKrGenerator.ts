// ── JPK_ST_KR(1) XML Generator ──
// Ewidencja środków trwałych oraz wartości niematerialnych i prawnych
// dla podmiotów prowadzących księgi rachunkowe
// Schema: http://jpk.mf.gov.pl/wzor/2024/04/24/04242/

import {
  escapeXml,
  formatAmount,
  formatDateTime,
  buildElement,
  XmlGenerator,
  generatorRegistry,
} from './XmlGeneratorEngine'

// ── Constants ──

export const ST_KR_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2024/04/24/04242/'
export const ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/'
const SCHEMA_VERSION = '1-0'
const KOD_SYSTEMOWY = 'JPK_ST_KR (1)'
const WARIANT = '1'

// ── Enums per XSD ──

export const VALID_NABYCIA = ['S', 'D', 'N', 'W', 'F', 'I'] as const
export type TNabycia = typeof VALID_NABYCIA[number]

// ST_KR has 7 values (adds 'A' for reclassification to another asset group)
export const VALID_WYKRESLENIE_KR = ['A', 'S', 'X', 'K', 'D', 'N', 'I'] as const
export type TWykreslenieKr = typeof VALID_WYKRESLENIE_KR[number]

// Note: XSD has a typo "TMetodaAmoryzacji" (missing 't')
export const VALID_METODA_AMORTYZACJI = ['D', 'L', 'J', 'I', 'X'] as const
export type TMetodaAmortyzacji = typeof VALID_METODA_AMORTYZACJI[number]

// Write-off frequency — unique to ST_KR
export const VALID_ODPIS = ['M', 'K', 'R', 'J', 'S', 'I', 'X'] as const
export type TOdpis = typeof VALID_ODPIS[number]

// ── Input types ──

export interface StKrNaglowek {
  celZlozenia: number          // 1 or 2 (no 0)
  rokDataOd: string            // YYYY-MM-DD fiscal year start
  rokDataDo: string            // YYYY-MM-DD fiscal year end
  rokPdDataOd?: string         // tax year start (when differs)
  rokPdDataDo?: string         // tax year end
  domyslnyKodWaluty?: string   // default PLN
  kodUrzedu: string
}

export interface StKrAdres {
  kodKraju?: string
  wojewodztwo?: string
  powiat?: string
  gmina?: string
  ulica?: string
  nrDomu?: string
  nrLokalu?: string
  miejscowosc?: string
  kodPocztowy?: string
  poczta?: string
}

export interface StKrPodmiot {
  nip: string
  pelnaNazwa: string
  regon?: string
  adres: StKrAdres
  adresTyp?: 'polski' | 'zagraniczny'  // default 'polski'
}

export interface StKrWiersz {
  E_1: string                         // Inventory number
  E_2?: string                        // Date: acquisition of fixed asset (choice with E_3)
  E_3?: string                        // Date: acquisition of intangible (choice with E_2)
  E_4: string                         // Date accepted for use
  E_5: string                         // OT document number (required)
  E_6: TNabycia                       // Acquisition type
  E_7: string                         // Asset name
  E_8?: string                        // KST classification symbol
  E_9_1: TMetodaAmortyzacji           // Tax depreciation method (required)
  E_9_2?: TMetodaAmortyzacji          // Secondary method
  E_9_3?: TMetodaAmortyzacji          // Tertiary method
  E_10A: string | number              // Base tax depreciation rate (%)
  E_10B: string | number              // Base tax depreciation rate (amount)
  E_11?: string | number              // Corrected tax depreciation rate (%)
  E_12: string | number               // Initial tax value
  E_13?: string | number              // Updated initial tax value
  E_14?: string | number              // Updated tax depreciation amount
  E_15?: string | number              // Change in initial tax value (+/-)
  E_16?: string | number              // Depreciation as of last day before registry start
  E_17: TOdpis                        // Write-off frequency
  E_18?: string | number              // Non-deductible depreciation for current year
  E_19: string | number               // Sum of tax depreciation for current year
  E_20: string | number               // Cumulative tax depreciation (total)
  // Accounting (rachunkowe) fields
  E_21: string | number               // Initial accounting value
  E_22?: string | number              // Updated initial accounting value
  E_23?: string | number              // Updated accounting depreciation amount
  E_24?: string | number              // Change in initial accounting value (+/-)
  E_25A: string | number              // Accounting depreciation rate (%)
  E_25B: string | number              // Accounting depreciation rate (amount)
  E_26: string | number               // Sum of accounting depreciation for current year
  E_27: string | number               // Cumulative accounting depreciation (total)
  // Deregistration group (all three or none)
  E_28?: string                       // Deregistration date
  E_29?: TWykreslenieKr               // Deregistration reason
  E_30?: string                       // Deregistration document number
  KSeF?: string[]                     // KSeF numbers for disposal
  E_32: number                        // Reclassification: 1=yes, 2=no
}

export interface StKrGeneratorInput {
  naglowek: StKrNaglowek
  podmiot: StKrPodmiot
  wiersze: StKrWiersz[]               // at least 1 required per XSD
}

// ── XML helpers ──

function tag(name: string, value: string): string {
  return buildElement(name, value)
}

function optionalTag(name: string, value: string | undefined, indent: string): string {
  if (!value || value === '') return ''
  return `${indent}${tag(name, value)}`
}

function percentTag(name: string, value: string | number | undefined): string {
  if (value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (isNaN(num)) return ''
  return `<${name}>${escapeXml(num)}</${name}>`
}

function optionalAmountTag(name: string, value: string | number | undefined, indent: string): string {
  if (value === undefined || value === '') return ''
  return `${indent}<${name}>${escapeXml(formatAmount(value))}</${name}>`
}

// ── Main generator function ──

export function generateJpkStKr(input: StKrGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${ST_KR_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))

  for (const wiersz of input.wiersze) {
    lines.push(generateStKrWiersz(wiersz))
  }

  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: StKrNaglowek): string {
  const iso = formatDateTime()
  const waluta = n.domyslnyKodWaluty || 'PLN'

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_ST</KodFormularza>`)
  lines.push(`    <WariantFormularza>${WARIANT}</WariantFormularza>`)
  lines.push(`    <CelZlozenia>${n.celZlozenia}</CelZlozenia>`)
  lines.push(`    <DataWytworzeniaJPK>${iso}</DataWytworzeniaJPK>`)
  lines.push(`    ${tag('RokDataOd', n.rokDataOd)}`)
  lines.push(`    ${tag('RokDataDo', n.rokDataDo)}`)
  if (n.rokPdDataOd && n.rokPdDataDo) {
    lines.push(`    ${tag('RokPdDataOd', n.rokPdDataOd)}`)
    lines.push(`    ${tag('RokPdDataDo', n.rokPdDataDo)}`)
  }
  lines.push(`    ${tag('DomyslnyKodWaluty', waluta)}`)
  lines.push(`    ${tag('KodUrzedu', n.kodUrzedu)}`)
  lines.push('  </Naglowek>')
  return lines.join('\n')
}

function generatePodmiot(p: StKrPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1>')
  lines.push('    <IdentyfikatorPodmiotu>')
  lines.push(`      ${tag('etd:NIP', p.nip)}`)
  lines.push(`      ${tag('etd:PelnaNazwa', p.pelnaNazwa)}`)
  if (p.regon) lines.push(`      ${tag('etd:REGON', p.regon)}`)
  lines.push('    </IdentyfikatorPodmiotu>')

  const a = p.adres
  const isZagraniczny = p.adresTyp === 'zagraniczny'

  if (isZagraniczny) {
    lines.push('    <AdresZagr>')
    lines.push(`      ${tag('etd:KodKraju', a.kodKraju || 'DE')}`)
    if (a.ulica) lines.push(`      ${tag('etd:Ulica', a.ulica)}`)
    if (a.nrDomu) lines.push(`      ${tag('etd:NrDomu', a.nrDomu)}`)
    if (a.nrLokalu) lines.push(`      ${tag('etd:NrLokalu', a.nrLokalu)}`)
    if (a.miejscowosc) lines.push(`      ${tag('etd:Miejscowosc', a.miejscowosc)}`)
    if (a.kodPocztowy) lines.push(`      ${tag('etd:KodPocztowy', a.kodPocztowy)}`)
    lines.push('    </AdresZagr>')
  } else {
    lines.push('    <AdresPol>')
    lines.push(`      ${tag('etd:KodKraju', a.kodKraju || 'PL')}`)
    if (a.wojewodztwo) lines.push(`      ${tag('etd:Wojewodztwo', a.wojewodztwo)}`)
    if (a.powiat) lines.push(`      ${tag('etd:Powiat', a.powiat)}`)
    if (a.gmina) lines.push(`      ${tag('etd:Gmina', a.gmina)}`)
    if (a.ulica) lines.push(`      ${tag('etd:Ulica', a.ulica)}`)
    lines.push(`      ${tag('etd:NrDomu', a.nrDomu || '-')}`)
    if (a.nrLokalu) lines.push(`      ${tag('etd:NrLokalu', a.nrLokalu)}`)
    lines.push(`      ${tag('etd:Miejscowosc', a.miejscowosc || '-')}`)
    lines.push(`      ${tag('etd:KodPocztowy', a.kodPocztowy || '00-000')}`)
    if (a.poczta) lines.push(`      ${tag('etd:Poczta', a.poczta)}`)
    lines.push('    </AdresPol>')
  }

  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

function generateStKrWiersz(w: StKrWiersz): string {
  const lines: string[] = []
  lines.push('  <ST_KR>')
  const ind = '    '

  lines.push(`${ind}${tag('E_1', w.E_1)}`)

  // Choice: E_2 (fixed asset) or E_3 (intangible)
  if (w.E_2) {
    lines.push(`${ind}${tag('E_2', w.E_2)}`)
  } else if (w.E_3) {
    lines.push(`${ind}${tag('E_3', w.E_3)}`)
  }

  lines.push(`${ind}${tag('E_4', w.E_4)}`)
  lines.push(`${ind}${tag('E_5', w.E_5)}`)
  lines.push(`${ind}${tag('E_6', w.E_6)}`)
  lines.push(`${ind}${tag('E_7', w.E_7)}`)

  const e8 = optionalTag('E_8', w.E_8, ind)
  if (e8) lines.push(e8)

  // Depreciation methods (E_9_1 required, E_9_2, E_9_3 optional)
  lines.push(`${ind}${tag('E_9_1', w.E_9_1)}`)
  if (w.E_9_2) lines.push(`${ind}${tag('E_9_2', w.E_9_2)}`)
  if (w.E_9_3) lines.push(`${ind}${tag('E_9_3', w.E_9_3)}`)

  // Tax rates (both required)
  lines.push(`${ind}${percentTag('E_10A', w.E_10A)}`)
  lines.push(`${ind}<E_10B>${escapeXml(formatAmount(w.E_10B))}</E_10B>`)

  if (w.E_11 !== undefined && w.E_11 !== '') {
    lines.push(`${ind}${percentTag('E_11', w.E_11)}`)
  }

  lines.push(`${ind}<E_12>${escapeXml(formatAmount(w.E_12))}</E_12>`)

  const e13 = optionalAmountTag('E_13', w.E_13, ind)
  if (e13) lines.push(e13)
  const e14 = optionalAmountTag('E_14', w.E_14, ind)
  if (e14) lines.push(e14)
  const e15 = optionalAmountTag('E_15', w.E_15, ind)
  if (e15) lines.push(e15)
  const e16 = optionalAmountTag('E_16', w.E_16, ind)
  if (e16) lines.push(e16)

  lines.push(`${ind}${tag('E_17', w.E_17)}`)

  const e18 = optionalAmountTag('E_18', w.E_18, ind)
  if (e18) lines.push(e18)

  lines.push(`${ind}<E_19>${escapeXml(formatAmount(w.E_19))}</E_19>`)
  lines.push(`${ind}<E_20>${escapeXml(formatAmount(w.E_20))}</E_20>`)

  // Accounting fields
  lines.push(`${ind}<E_21>${escapeXml(formatAmount(w.E_21))}</E_21>`)
  const e22 = optionalAmountTag('E_22', w.E_22, ind)
  if (e22) lines.push(e22)
  const e23 = optionalAmountTag('E_23', w.E_23, ind)
  if (e23) lines.push(e23)
  const e24 = optionalAmountTag('E_24', w.E_24, ind)
  if (e24) lines.push(e24)
  lines.push(`${ind}${percentTag('E_25A', w.E_25A)}`)
  lines.push(`${ind}<E_25B>${escapeXml(formatAmount(w.E_25B))}</E_25B>`)
  lines.push(`${ind}<E_26>${escapeXml(formatAmount(w.E_26))}</E_26>`)
  lines.push(`${ind}<E_27>${escapeXml(formatAmount(w.E_27))}</E_27>`)

  // Deregistration group (all three or none)
  if (w.E_28 && w.E_29 && w.E_30) {
    lines.push(`${ind}${tag('E_28', w.E_28)}`)
    lines.push(`${ind}${tag('E_29', w.E_29)}`)
    lines.push(`${ind}${tag('E_30', w.E_30)}`)
  }

  // KSeF numbers
  if (w.KSeF) {
    for (const ksef of w.KSeF) {
      lines.push(`${ind}${tag('KSeF', ksef)}`)
    }
  }

  lines.push(`${ind}<E_32>${escapeXml(w.E_32)}</E_32>`)
  lines.push('  </ST_KR>')
  return lines.join('\n')
}

// ── Validation helpers ──

export function isValidNabycia(value: string): boolean {
  return (VALID_NABYCIA as readonly string[]).includes(value)
}

export function isValidWykreslenieKr(value: string): boolean {
  return (VALID_WYKRESLENIE_KR as readonly string[]).includes(value)
}

export function isValidMetodaAmortyzacji(value: string): boolean {
  return (VALID_METODA_AMORTYZACJI as readonly string[]).includes(value)
}

export function isValidOdpis(value: string): boolean {
  return (VALID_ODPIS as readonly string[]).includes(value)
}

// ── XmlGenerator implementation ──

export const jpkStKrGenerator: XmlGenerator = {
  jpkType: 'JPK_ST_KR',
  version: WARIANT,
  namespace: ST_KR_NAMESPACE,
  generate: (input: unknown) => generateJpkStKr(input as StKrGeneratorInput),
}

generatorRegistry.register(jpkStKrGenerator)

export { escapeXml, formatAmount }
