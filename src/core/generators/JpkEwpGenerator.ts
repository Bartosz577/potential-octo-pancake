// ── JPK_EWP(4) XML Generator ──
// Ewidencja przychodów (ryczałt od przychodów ewidencjonowanych)
// Schema: http://jpk.mf.gov.pl/wzor/2024/10/30/10301/

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

export const EWP_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2024/10/30/10301/'
export const ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/'
const SCHEMA_VERSION = '1-0'
const KOD_SYSTEMOWY = 'JPK_EWP (4)'
const WARIANT = '4'

// Valid flat-rate tax brackets per XSD TStawkaPodatku enum
export const VALID_RATES = ['17', '15', '14', '12.5', '12', '10', '8.5', '5.5', '3']

// ── Input types ──

export interface EwpNaglowek {
  celZlozenia: number  // 0, 1, or 2
  dataOd: string       // YYYY-MM-DD
  dataDo: string       // YYYY-MM-DD
  kodUrzedu: string
}

export interface EwpPodmiot {
  typ: 'fizyczna' | 'niefizyczna'
  nip: string
  imie?: string
  nazwisko?: string
  dataUrodzenia?: string
  pelnaNazwa?: string
  email?: string
  telefon?: string
  kasowyPit?: boolean
}

export interface EwpGeneratorInput {
  naglowek: EwpNaglowek
  podmiot: EwpPodmiot
  wiersze: Record<string, string>[]
}

// ── XML helpers ──

function tag(name: string, value: string): string {
  return buildElement(name, value)
}

function optionalStringTag(name: string, value: string | undefined, indent: string): string {
  if (!value || value === '') return ''
  return `${indent}${tag(name, value)}`
}

// ── Main generator function ──

export function generateJpkEwp(input: EwpGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${EWP_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))

  for (const wiersz of input.wiersze) {
    lines.push(generateEwpWiersz(wiersz))
  }

  lines.push(generateEwpCtrl(input.wiersze))
  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: EwpNaglowek): string {
  const iso = formatDateTime()

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_EWP</KodFormularza>`)
  lines.push(`    <WariantFormularza>${WARIANT}</WariantFormularza>`)
  lines.push(`    <CelZlozenia>${n.celZlozenia}</CelZlozenia>`)
  lines.push(`    <DataWytworzeniaJPK>${iso}</DataWytworzeniaJPK>`)
  lines.push(`    ${tag('DataOd', n.dataOd)}`)
  lines.push(`    ${tag('DataDo', n.dataDo)}`)
  lines.push(`    ${tag('KodUrzedu', n.kodUrzedu)}`)
  lines.push('  </Naglowek>')
  return lines.join('\n')
}

function generatePodmiot(p: EwpPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1 rola="Podatnik">')

  if (p.typ === 'fizyczna') {
    lines.push('    <OsobaFizyczna>')
    lines.push(`      ${tag('etd:NIP', p.nip)}`)
    if (p.imie) lines.push(`      ${tag('etd:ImiePierwsze', p.imie)}`)
    if (p.nazwisko) lines.push(`      ${tag('etd:Nazwisko', p.nazwisko)}`)
    if (p.dataUrodzenia) lines.push(`      ${tag('etd:DataUrodzenia', p.dataUrodzenia)}`)
    if (p.email) lines.push(`      ${tag('Email', p.email)}`)
    if (p.telefon) lines.push(`      ${tag('Telefon', p.telefon)}`)
    lines.push('    </OsobaFizyczna>')
  } else {
    lines.push('    <OsobaNiefizyczna>')
    lines.push(`      ${tag('NIP', p.nip)}`)
    lines.push(`      ${tag('PelnaNazwa', p.pelnaNazwa || '')}`)
    if (p.email) lines.push(`      ${tag('Email', p.email)}`)
    if (p.telefon) lines.push(`      ${tag('Telefon', p.telefon)}`)
    lines.push('    </OsobaNiefizyczna>')
  }

  if (p.kasowyPit) {
    lines.push('    <Kasowy_PIT>1</Kasowy_PIT>')
  }

  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

// ── EWPWiersz per XSD ──
// Required: K_1 (int), K_2 (date), K_3 (date), K_4 (string), K_8 (amount), K_9 (rate)
// Optional: K_5 (KSeF), K_6 (country), K_7 (NIP), K_10 (uwagi)

function generateEwpWiersz(row: Record<string, string>): string {
  const lines: string[] = []
  const ind = '    '
  lines.push('  <EWPWiersz>')

  // K_1: Lp (required integer > 0)
  lines.push(`${ind}<K_1>${row['K_1'] || '1'}</K_1>`)

  // K_2: Data wpisu (required date)
  lines.push(`${ind}${tag('K_2', row['K_2'] || '')}`)

  // K_3: Data uzyskania przychodu (required date)
  lines.push(`${ind}${tag('K_3', row['K_3'] || '')}`)

  // K_4: Numer dowodu (required string)
  lines.push(`${ind}${tag('K_4', row['K_4'] || '')}`)

  // K_5: Nr KSeF (optional)
  const k5 = optionalStringTag('K_5', row['K_5'], ind)
  if (k5) lines.push(k5)

  // K_6: Kod kraju kontrahenta (optional)
  const k6 = optionalStringTag('K_6', row['K_6'], ind)
  if (k6) lines.push(k6)

  // K_7: NIP kontrahenta (optional)
  const k7 = optionalStringTag('K_7', row['K_7'], ind)
  if (k7) lines.push(k7)

  // K_8: Kwota przychodu (required amount)
  lines.push(`${ind}<K_8>${formatAmount(row['K_8'])}</K_8>`)

  // K_9: Stawka podatku (required enum)
  lines.push(`${ind}${tag('K_9', row['K_9'] || '')}`)

  // K_10: Uwagi (optional string)
  const k10 = optionalStringTag('K_10', row['K_10'], ind)
  if (k10) lines.push(k10)

  lines.push('  </EWPWiersz>')
  return lines.join('\n')
}

function generateEwpCtrl(rows: Record<string, string>[]): string {
  const lines: string[] = []
  lines.push('  <EWPCtrl>')
  lines.push(`    <LiczbaWierszy>${rows.length}</LiczbaWierszy>`)

  // SumaPrzychodow = sum of K_8 across all rows
  const sumaPrzychodow = sumAmounts(rows.map(row => parseAmount(row['K_8'])))
  lines.push(`    <SumaPrzychodow>${formatAmount(sumaPrzychodow)}</SumaPrzychodow>`)

  lines.push('  </EWPCtrl>')
  return lines.join('\n')
}

// ── XmlGenerator implementation ──

export const jpkEwpGenerator: XmlGenerator = {
  jpkType: 'JPK_EWP',
  version: WARIANT,
  namespace: EWP_NAMESPACE,
  generate: (input: unknown) => {
    const data = validateGeneratorInput<EwpGeneratorInput>(
      input,
      ['naglowek', 'podmiot', 'wiersze'],
      'JPK_EWP',
    )
    return generateJpkEwp(data)
  },
}

generatorRegistry.register(jpkEwpGenerator)

export { escapeXml, formatAmount }
