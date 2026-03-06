// ── JPK_PKPIR(3) XML Generator ──
// Podatkowa księga przychodów i rozchodów
// Schema: http://jpk.mf.gov.pl/wzor/2024/10/30/10302/

import {
  escapeXml,
  formatAmount,
  formatDateTime,
  buildElement,
  parseAmount,
  XmlGenerator,
  generatorRegistry,
} from './XmlGeneratorEngine'

// ── Constants ──

export const PKPIR_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2024/10/30/10302/'
export const ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/'
const SCHEMA_VERSION = '1-0'
const KOD_SYSTEMOWY = 'JPK_PKPIR (3)'
const WARIANT = '3'

// ── Input types ──

export interface PkpirNaglowek {
  celZlozenia: number  // 0, 1, or 2
  dataOd: string       // YYYY-MM-DD
  dataDo: string       // YYYY-MM-DD
  kodUrzedu: string
}

export interface PkpirPodmiot {
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

export interface PkpirInfo {
  spisPoczatek: string | number  // P_1: spis z natury na początek roku
  spisKoniec: string | number    // P_2: spis z natury na koniec roku
  kosztyRazem: string | number   // P_3: razem koszty uzyskania przychodu
  dochod: string | number        // P_4: dochód w roku podatkowym
}

export interface PkpirSpis {
  data: string           // P_5A: date
  wartosc: string | number  // P_5B: amount
}

export interface PkpirGeneratorInput {
  naglowek: PkpirNaglowek
  podmiot: PkpirPodmiot
  pkpirInfo: PkpirInfo
  spisy?: PkpirSpis[]
  wiersze: Record<string, string>[]
}

// ── XML helpers ──

function tag(name: string, value: string, attrs?: Record<string, string>): string {
  return buildElement(name, value, attrs)
}

function amountTag(name: string, value: string | number | undefined): string {
  if (value === undefined || value === '') return ''
  return `<${name}>${formatAmount(value)}</${name}>`
}

function optionalAmountTag(name: string, value: string | undefined, indent: string): string {
  if (!value || value === '') return ''
  return `${indent}<${name}>${formatAmount(value)}</${name}>`
}

function optionalStringTag(name: string, value: string | undefined, indent: string): string {
  if (!value || value === '') return ''
  return `${indent}${tag(name, value)}`
}

// ── Main generator function ──

export function generateJpkPkpir(input: PkpirGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${PKPIR_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))
  lines.push(generatePkpirInfo(input.pkpirInfo))

  if (input.spisy && input.spisy.length > 0) {
    for (const spis of input.spisy) {
      lines.push(generatePkpirSpis(spis))
    }
  }

  for (const wiersz of input.wiersze) {
    lines.push(generatePkpirWiersz(wiersz))
  }

  lines.push(generatePkpirCtrl(input.wiersze))
  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: PkpirNaglowek): string {
  const iso = formatDateTime()

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_PKPIR</KodFormularza>`)
  lines.push(`    <WariantFormularza>${WARIANT}</WariantFormularza>`)
  lines.push(`    <CelZlozenia>${n.celZlozenia}</CelZlozenia>`)
  lines.push(`    <DataWytworzeniaJPK>${iso}</DataWytworzeniaJPK>`)
  lines.push(`    ${tag('DataOd', n.dataOd)}`)
  lines.push(`    ${tag('DataDo', n.dataDo)}`)
  lines.push(`    ${tag('KodUrzedu', n.kodUrzedu)}`)
  lines.push('  </Naglowek>')
  return lines.join('\n')
}

function generatePodmiot(p: PkpirPodmiot): string {
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

function generatePkpirInfo(info: PkpirInfo): string {
  const lines: string[] = []
  lines.push('  <PKPIRInfo>')
  lines.push(`    ${amountTag('P_1', info.spisPoczatek)}`)
  lines.push(`    ${amountTag('P_2', info.spisKoniec)}`)
  lines.push(`    ${amountTag('P_3', info.kosztyRazem)}`)
  lines.push(`    ${amountTag('P_4', info.dochod)}`)
  lines.push('  </PKPIRInfo>')
  return lines.join('\n')
}

function generatePkpirSpis(spis: PkpirSpis): string {
  const lines: string[] = []
  lines.push('  <PKPIRSpis>')
  lines.push(`    ${tag('P_5A', spis.data)}`)
  lines.push(`    ${amountTag('P_5B', spis.wartosc)}`)
  lines.push('  </PKPIRSpis>')
  return lines.join('\n')
}

// ── PKPIRWiersz fields per XSD order ──
// Required: K_1 (int), K_2 (date), K_3A (string), K_5A (string), K_5B (string), K_6 (string)
// Optional: K_3B, K_4A, K_4B, K_7..K_15, K_9A, K_14A, K_16A+K_16B (pair), K_17

const OPTIONAL_AMOUNT_FIELDS = ['K_7', 'K_8', 'K_9', 'K_9A', 'K_10', 'K_11', 'K_12', 'K_13', 'K_14', 'K_14A', 'K_15']

function generatePkpirWiersz(row: Record<string, string>): string {
  const lines: string[] = []
  const ind = '    '
  lines.push('  <PKPIRWiersz>')

  // K_1: Lp (required integer)
  lines.push(`${ind}<K_1>${row['K_1'] || '1'}</K_1>`)

  // K_2: Data zdarzenia (required date)
  lines.push(`${ind}${tag('K_2', row['K_2'] || '')}`)

  // K_3A: Nr dowodu (required string)
  lines.push(`${ind}${tag('K_3A', row['K_3A'] || '')}`)

  // K_3B: Nr KSeF (optional)
  const k3b = optionalStringTag('K_3B', row['K_3B'], ind)
  if (k3b) lines.push(k3b)

  // K_4A: Kod kraju kontrahenta (optional)
  const k4a = optionalStringTag('K_4A', row['K_4A'], ind)
  if (k4a) lines.push(k4a)

  // K_4B: NIP kontrahenta (optional)
  const k4b = optionalStringTag('K_4B', row['K_4B'], ind)
  if (k4b) lines.push(k4b)

  // K_5A: Kontrahent - nazwa (required)
  lines.push(`${ind}${tag('K_5A', row['K_5A'] || '')}`)

  // K_5B: Kontrahent - adres (required)
  lines.push(`${ind}${tag('K_5B', row['K_5B'] || '')}`)

  // K_6: Opis zdarzenia (required)
  lines.push(`${ind}${tag('K_6', row['K_6'] || '')}`)

  // K_7..K_15, K_9A, K_14A (optional amounts)
  for (const f of OPTIONAL_AMOUNT_FIELDS) {
    const v = optionalAmountTag(f, row[f], ind)
    if (v) lines.push(v)
  }

  // K_16A + K_16B (optional pair — both required if either present)
  if (row['K_16A'] || row['K_16B']) {
    lines.push(`${ind}${tag('K_16A', row['K_16A'] || '')}`)
    lines.push(`${ind}${amountTag('K_16B', row['K_16B'] || '0')}`)
  }

  // K_17: Uwagi (optional string)
  const k17 = optionalStringTag('K_17', row['K_17'], ind)
  if (k17) lines.push(k17)

  lines.push('  </PKPIRWiersz>')
  return lines.join('\n')
}

function generatePkpirCtrl(rows: Record<string, string>[]): string {
  const lines: string[] = []
  lines.push('  <PKPIRCtrl>')
  lines.push(`    <LiczbaWierszy>${rows.length}</LiczbaWierszy>`)

  // SumaPrzychodow = sum of K_9 across all rows
  let sumaPrzychodow = 0
  for (const row of rows) {
    sumaPrzychodow += parseAmount(row['K_9'])
  }
  lines.push(`    <SumaPrzychodow>${formatAmount(sumaPrzychodow)}</SumaPrzychodow>`)

  lines.push('  </PKPIRCtrl>')
  return lines.join('\n')
}

// ── XmlGenerator implementation ──

export const jpkPkpirGenerator: XmlGenerator = {
  jpkType: 'JPK_PKPIR',
  version: WARIANT,
  namespace: PKPIR_NAMESPACE,
  generate: (input: unknown) => generateJpkPkpir(input as PkpirGeneratorInput),
}

generatorRegistry.register(jpkPkpirGenerator)

export { escapeXml, formatAmount }
