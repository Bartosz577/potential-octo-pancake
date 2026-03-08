// ── JPK_KR_PD(1) XML Generator ──
// Księgi rachunkowe raportowane na podstawie ustaw o podatkach dochodowych (PIT/CIT)
// Schema: http://jpk.mf.gov.pl/wzor/2024/09/04/09041/

import {
  escapeXml,
  formatAmount,
  formatDateTime,
  buildElement,
  parseAmount,
  XmlGenerator,
  generatorRegistry,
} from './XmlGeneratorEngine'
import { sumAmounts } from '../utils/mathUtils'
import { validateGeneratorInput } from '../utils/inputValidator'

// ── Constants ──

export const KR_PD_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2024/09/04/09041/'
export const ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/'
const SCHEMA_VERSION = '1-1'
const KOD_SYSTEMOWY = 'JPK_KR_PD (1)'
const WARIANT = '1'

// ── TMapKontaPD enum (28 values) — income tax account markers ──

export const MAP_KONTA_PD = [
  // Bilansowe (on-balance)
  'PD1', 'PD1_1', 'PD1_2', 'PD1_3',
  'PD2',
  'PD4', 'PD4_1', 'PD4_2', 'PD4_3',
  'PD5', 'PD7',
  'PD8_1', 'PD8_2',
  // Pozabilansowe (off-balance)
  'PD1_PB', 'PD1_PB_1', 'PD1_PB_2', 'PD1_PB_3',
  'PD2_PB', 'PD3_PB',
  'PD4_PB', 'PD4_PB_1', 'PD4_PB_2', 'PD4_PB_3',
  'PD5_PB', 'PD6_PB', 'PD7_PB',
  'PD8_PB_1', 'PD8_PB_2',
] as const

export type MapKontaPD = typeof MAP_KONTA_PD[number]

// ── Input types ──

export interface KrPdNaglowek {
  celZlozenia: number       // 1 or 2
  dataOd: string            // YYYY-MM-DD period start
  dataDo: string            // YYYY-MM-DD period end
  rokDataOd: string         // YYYY-MM-DD fiscal year start
  rokDataDo: string         // YYYY-MM-DD fiscal year end
  rokPdDataOd?: string      // tax year start (when differs from fiscal)
  rokPdDataDo?: string      // tax year end
  domyslnyKodWaluty?: string // default PLN
  kodUrzedu: string
}

export interface KrPdAdres {
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

export interface KrPdPodmiot {
  nip: string
  pelnaNazwa: string
  regon?: string
  adres: KrPdAdres
  znacznikEst?: boolean
  znacznikMssf?: boolean
}

export interface KrPdKontrahent {
  kod: string          // T_1: unique contractor code
  kodKraju?: string    // T_2: country code
  nip?: string         // T_3: tax ID
}

export interface KrPdZOiSEntry {
  numerKonta: string    // S_1: account identifier
  nazwaKonta: string    // S_2: account name
  kontoNadrzedne: string // S_3: parent account
  saldoPoczatkoweWn: string | number  // S_4
  saldoPoczatkoweMa: string | number  // S_5
  obrotyBiezaceWn: string | number    // S_6
  obrotyBiezaceMa: string | number    // S_7
  obrotyNarastajaceWn: string | number // S_8
  obrotyNarastajaceMa: string | number // S_9
  saldoKoncoweWn: string | number     // S_10
  saldoKoncoweMa: string | number     // S_11
  mapKonta1?: string    // S_12_1: entity-type-specific mapping
  mapKonta2?: string    // S_12_2: secondary mapping
  mapKontaPd?: string   // S_12_3: income tax mapping (TMapKontaPD)
}

export interface KrPdKontoZapis {
  lp: string             // Z_1: sequential posting number
  opis: string           // Z_2: posting description
  numerKonta: string     // Z_3: account identifier
  kwotaWn?: string | number  // Z_4: debit amount (choice)
  kwotaWnWaluta?: string | number // Z_5: debit in foreign currency
  kodWalutyWn?: string   // Z_6: debit currency
  kwotaMa?: string | number  // Z_7: credit amount (choice)
  kwotaMaWaluta?: string | number // Z_8: credit in foreign currency
  kodWalutyMa?: string   // Z_9: credit currency
}

export interface KrPdDziennik {
  numerZapisu: string     // D_1: journal entry number
  opisDziennika: string   // D_2: journal name/section
  kodKontrahenta?: string // D_3: contractor code (→ T_1)
  numerDowodu: string     // D_4: source document number
  rodzajDowodu: string    // D_5: accounting document type
  dataOperacji: string    // D_6: date of business operation
  dataDowodu: string      // D_7: date of document creation
  dataKsiegowania: string // D_8: date of posting
  osobaOdpowiedzialna: string // D_9: person responsible
  opisOperacji: string    // D_10: operation description
  kwotaOperacji: string | number // D_11: operation amount
  nrKsef?: string         // D_12: KSeF number
  kontoZapisy: KrPdKontoZapis[]
}

export interface KrPdRpd {
  k1: string | number  // revenues exempt from taxation (permanent)
  k2: string | number  // revenues not taxable in current year
  k3: string | number  // revenues taxable now, booked in prior years
  k4: string | number  // costs not deductible (permanent)
  k5: string | number  // costs not recognized in current year
  k6: string | number  // costs deductible now, booked in prior years
  k7: string | number  // taxable revenues not in books
  k8: string | number  // deductible costs not in books
}

export interface KrPdGeneratorInput {
  naglowek: KrPdNaglowek
  podmiot: KrPdPodmiot
  kontrahenci?: KrPdKontrahent[]
  zpisSald: KrPdZOiSEntry[]       // ZOiS entries (uses ZOiS7 variant)
  dziennik: KrPdDziennik[]
  rpd: KrPdRpd
}

// ── XML helpers ──

function tag(name: string, value: string): string {
  return buildElement(name, value)
}

function amountTag(name: string, value: string | number | undefined): string {
  return `<${name}>${formatAmount(value)}</${name}>`
}

function optionalTag(name: string, value: string | undefined, indent: string): string {
  if (!value || value === '') return ''
  return `${indent}${tag(name, value)}`
}

// ── Main generator function ──

export function generateJpkKrPd(input: KrPdGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${KR_PD_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))

  if (input.kontrahenci) {
    for (const k of input.kontrahenci) {
      lines.push(generateKontrahent(k))
    }
  }

  lines.push(generateZOiS(input.zpisSald))

  for (const d of input.dziennik) {
    lines.push(generateDziennik(d))
  }

  lines.push(generateCtrl(input.dziennik))
  lines.push(generateRpd(input.rpd))
  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: KrPdNaglowek): string {
  const iso = formatDateTime()
  const waluta = n.domyslnyKodWaluty || 'PLN'

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_KR_PD</KodFormularza>`)
  lines.push(`    <WariantFormularza>${WARIANT}</WariantFormularza>`)
  lines.push(`    <CelZlozenia>${n.celZlozenia}</CelZlozenia>`)
  lines.push(`    <DataWytworzeniaJPK>${iso}</DataWytworzeniaJPK>`)
  lines.push(`    ${tag('DataOd', n.dataOd)}`)
  lines.push(`    ${tag('DataDo', n.dataDo)}`)
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

function generatePodmiot(p: KrPdPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1>')
  lines.push('    <IdentyfikatorPodmiotu>')
  lines.push(`      ${tag('etd:NIP', p.nip)}`)
  lines.push(`      ${tag('etd:PelnaNazwa', p.pelnaNazwa)}`)
  if (p.regon) lines.push(`      ${tag('etd:REGON', p.regon)}`)
  lines.push('    </IdentyfikatorPodmiotu>')

  // Address — use AdresPol for Polish addresses
  const a = p.adres
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

  if (p.znacznikEst) lines.push(`    <Znacznik_EST>1</Znacznik_EST>`)
  if (p.znacznikMssf) lines.push(`    <Znacznik_MSSF>1</Znacznik_MSSF>`)

  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

function generateKontrahent(k: KrPdKontrahent): string {
  const lines: string[] = []
  lines.push('  <Kontrahent>')
  lines.push(`    ${tag('T_1', k.kod)}`)
  const t2 = optionalTag('T_2', k.kodKraju, '    ')
  if (t2) lines.push(t2)
  const t3 = optionalTag('T_3', k.nip, '    ')
  if (t3) lines.push(t3)
  lines.push('  </Kontrahent>')
  return lines.join('\n')
}

// Uses ZOiS7 variant (Jednostki pozostałe — general entities)
function generateZOiS(entries: KrPdZOiSEntry[]): string {
  const lines: string[] = []
  lines.push('  <ZOiS>')

  for (const e of entries) {
    lines.push('    <ZOiS7>')
    lines.push(`      ${tag('S_1', e.numerKonta)}`)
    lines.push(`      ${tag('S_2', e.nazwaKonta)}`)
    lines.push(`      ${tag('S_3', e.kontoNadrzedne)}`)
    lines.push(`      ${amountTag('S_4', e.saldoPoczatkoweWn)}`)
    lines.push(`      ${amountTag('S_5', e.saldoPoczatkoweMa)}`)
    lines.push(`      ${amountTag('S_6', e.obrotyBiezaceWn)}`)
    lines.push(`      ${amountTag('S_7', e.obrotyBiezaceMa)}`)
    lines.push(`      ${amountTag('S_8', e.obrotyNarastajaceWn)}`)
    lines.push(`      ${amountTag('S_9', e.obrotyNarastajaceMa)}`)
    lines.push(`      ${amountTag('S_10', e.saldoKoncoweWn)}`)
    lines.push(`      ${amountTag('S_11', e.saldoKoncoweMa)}`)
    // S_12_1: TMapKontaPOZ (required for ZOiS7)
    if (e.mapKonta1) lines.push(`      ${tag('S_12_1', e.mapKonta1)}`)
    // S_12_2: TMapKontaPOZ (optional)
    const s122 = optionalTag('S_12_2', e.mapKonta2, '      ')
    if (s122) lines.push(s122)
    // S_12_3: TMapKontaPD (optional)
    const s123 = optionalTag('S_12_3', e.mapKontaPd, '      ')
    if (s123) lines.push(s123)
    lines.push('    </ZOiS7>')
  }

  lines.push('  </ZOiS>')
  return lines.join('\n')
}

function generateKontoZapis(kz: KrPdKontoZapis, indent: string): string {
  const lines: string[] = []
  lines.push(`${indent}<KontoZapis>`)
  const ind2 = indent + '  '
  lines.push(`${ind2}${tag('Z_1', kz.lp)}`)
  lines.push(`${ind2}${tag('Z_2', kz.opis)}`)
  lines.push(`${ind2}${tag('Z_3', kz.numerKonta)}`)

  // Choice: debit (Z_4/Z_5/Z_6) or credit (Z_7/Z_8/Z_9)
  if (kz.kwotaWn !== undefined && kz.kwotaWn !== '') {
    lines.push(`${ind2}${amountTag('Z_4', kz.kwotaWn)}`)
    if (kz.kwotaWnWaluta !== undefined && kz.kwotaWnWaluta !== '') {
      lines.push(`${ind2}${amountTag('Z_5', kz.kwotaWnWaluta)}`)
    }
    if (kz.kodWalutyWn) lines.push(`${ind2}${tag('Z_6', kz.kodWalutyWn)}`)
  } else if (kz.kwotaMa !== undefined && kz.kwotaMa !== '') {
    lines.push(`${ind2}${amountTag('Z_7', kz.kwotaMa)}`)
    if (kz.kwotaMaWaluta !== undefined && kz.kwotaMaWaluta !== '') {
      lines.push(`${ind2}${amountTag('Z_8', kz.kwotaMaWaluta)}`)
    }
    if (kz.kodWalutyMa) lines.push(`${ind2}${tag('Z_9', kz.kodWalutyMa)}`)
  }

  lines.push(`${indent}</KontoZapis>`)
  return lines.join('\n')
}

function generateDziennik(d: KrPdDziennik): string {
  const lines: string[] = []
  lines.push('  <Dziennik>')
  lines.push(`    ${tag('D_1', d.numerZapisu)}`)
  lines.push(`    ${tag('D_2', d.opisDziennika)}`)
  const d3 = optionalTag('D_3', d.kodKontrahenta, '    ')
  if (d3) lines.push(d3)
  lines.push(`    ${tag('D_4', d.numerDowodu)}`)
  lines.push(`    ${tag('D_5', d.rodzajDowodu)}`)
  lines.push(`    ${tag('D_6', d.dataOperacji)}`)
  lines.push(`    ${tag('D_7', d.dataDowodu)}`)
  lines.push(`    ${tag('D_8', d.dataKsiegowania)}`)
  lines.push(`    ${tag('D_9', d.osobaOdpowiedzialna)}`)
  lines.push(`    ${tag('D_10', d.opisOperacji)}`)
  lines.push(`    ${amountTag('D_11', d.kwotaOperacji)}`)
  const d12 = optionalTag('D_12', d.nrKsef, '    ')
  if (d12) lines.push(d12)

  for (const kz of d.kontoZapisy) {
    lines.push(generateKontoZapis(kz, '    '))
  }

  lines.push('  </Dziennik>')
  return lines.join('\n')
}

function generateCtrl(dziennik: KrPdDziennik[]): string {
  // C_1: count of Dziennik entries
  const c1 = dziennik.length
  // C_2: sum of D_11 (operation amounts)
  const c2Values: number[] = []
  // C_3: total count of KontoZapis across all Dziennik
  let c3 = 0
  // C_4: sum of Z_4 (debit postings)
  const c4Values: number[] = []
  // C_5: sum of Z_7 (credit postings)
  const c5Values: number[] = []

  for (const d of dziennik) {
    c2Values.push(parseAmount(String(d.kwotaOperacji)))
    for (const kz of d.kontoZapisy) {
      c3++
      if (kz.kwotaWn !== undefined && kz.kwotaWn !== '') {
        c4Values.push(parseAmount(String(kz.kwotaWn)))
      }
      if (kz.kwotaMa !== undefined && kz.kwotaMa !== '') {
        c5Values.push(parseAmount(String(kz.kwotaMa)))
      }
    }
  }
  const c2 = sumAmounts(c2Values)
  const c4 = sumAmounts(c4Values)
  const c5 = sumAmounts(c5Values)

  const lines: string[] = []
  lines.push('  <Ctrl>')
  lines.push(`    <C_1>${c1}</C_1>`)
  lines.push(`    ${amountTag('C_2', c2)}`)
  lines.push(`    <C_3>${c3}</C_3>`)
  lines.push(`    ${amountTag('C_4', c4)}`)
  lines.push(`    ${amountTag('C_5', c5)}`)
  lines.push('  </Ctrl>')
  return lines.join('\n')
}

function generateRpd(rpd: KrPdRpd): string {
  const lines: string[] = []
  lines.push('  <RPD>')
  lines.push(`    ${amountTag('K_1', rpd.k1)}`)
  lines.push(`    ${amountTag('K_2', rpd.k2)}`)
  lines.push(`    ${amountTag('K_3', rpd.k3)}`)
  lines.push(`    ${amountTag('K_4', rpd.k4)}`)
  lines.push(`    ${amountTag('K_5', rpd.k5)}`)
  lines.push(`    ${amountTag('K_6', rpd.k6)}`)
  lines.push(`    ${amountTag('K_7', rpd.k7)}`)
  lines.push(`    ${amountTag('K_8', rpd.k8)}`)
  lines.push('  </RPD>')
  return lines.join('\n')
}

// ── Validation helper ──

export function isValidMapKontaPd(value: string): boolean {
  return (MAP_KONTA_PD as readonly string[]).includes(value)
}

// ── XmlGenerator implementation ──

export const jpkKrPdGenerator: XmlGenerator = {
  jpkType: 'JPK_KR_PD',
  version: WARIANT,
  namespace: KR_PD_NAMESPACE,
  generate: (input: unknown) => {
    const data = validateGeneratorInput<KrPdGeneratorInput>(
      input,
      ['naglowek', 'podmiot', 'zpisSald', 'dziennik', 'rpd'],
      'JPK_KR_PD',
    )
    return generateJpkKrPd(data)
  },
}

generatorRegistry.register(jpkKrPdGenerator)

export { escapeXml, formatAmount }
