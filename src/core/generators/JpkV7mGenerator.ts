// ── JPK_V7M(3) XML Generator ──
// Generates XML conforming to schema: http://crd.gov.pl/wzor/2025/12/19/14090/

// ── Constants ──

export const V7M_NAMESPACE = 'http://crd.gov.pl/wzor/2025/12/19/14090/'
export const ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/09/13/eD/DefinicjeTypy/'
const SCHEMA_VERSION = '1-0E'
const KOD_SYSTEMOWY = 'JPK_V7M (3)'
const WARIANT = '3'

// Deklaracja constants
const DEKL_KOD_SYSTEMOWY = 'VAT-7 (23)'
const DEKL_KOD_PODATKU = 'VAT'
const DEKL_RODZAJ_ZOBOWIAZANIA = 'Z'
const DEKL_WARIANT = '23'

// ── Input types ──

export interface V7mNaglowek {
  celZlozenia: number
  kodUrzedu: string
  rok: number
  miesiac: number
  nazwaSystemu?: string
}

export interface V7mPodmiot {
  typ: 'fizyczna' | 'niefizyczna'
  nip: string
  imie?: string
  nazwisko?: string
  dataUrodzenia?: string
  pelnaNazwa?: string
  email: string
  telefon?: string
}

export interface V7mGeneratorInput {
  naglowek: V7mNaglowek
  podmiot: V7mPodmiot
  sprzedazWiersze: Record<string, string>[]
  zakupWiersze: Record<string, string>[]
  deklaracja?: Record<string, string | number | undefined>
}

// ── XML helpers ──

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function formatAmount(value: string | number | undefined): string {
  if (value === undefined || value === '' || value === null) return '0.00'
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return '0.00'
  return num.toFixed(2)
}

export function formatDeclAmount(value: string | number | undefined): string {
  if (value === undefined || value === '' || value === null) return '0'
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return '0'
  return String(Math.round(num))
}

function parseAmount(value: string | undefined): number {
  if (!value || value === '') return 0
  const num = parseFloat(value)
  return isNaN(num) ? 0 : num
}

function tag(name: string, value: string, attrs?: Record<string, string>): string {
  const attrStr = attrs
    ? ' ' + Object.entries(attrs).map(([k, v]) => `${k}="${escapeXml(v)}"`).join(' ')
    : ''
  return `<${name}${attrStr}>${escapeXml(value)}</${name}>`
}

function boolTag(name: string, value: string | undefined): string {
  if (!value || value === '' || value === '0' || value === 'false') return ''
  return `<${name}>1</${name}>`
}

// ── Field ordering per XSD ──

const GTU_CODES = Array.from({ length: 13 }, (_, i) => `GTU_${String(i + 1).padStart(2, '0')}`)

const SPRZEDAZ_PROCEDURES = [
  'WSTO_EE', 'IED', 'TP', 'TT_WNT', 'TT_D',
  'MR_T', 'MR_UZ', 'I_42', 'I_63',
  'B_SPV', 'B_SPV_DOSTAWA', 'B_MPV_PROWIZJA',
]

// Sprzedaz K fields: standalone optionals and required pairs
const SPRZEDAZ_K_STANDALONE = ['K_10', 'K_11', 'K_12', 'K_13', 'K_14']
const SPRZEDAZ_K_PAIRS: [string, string][] = [
  ['K_15', 'K_16'], ['K_17', 'K_18'], ['K_19', 'K_20'],
]
const SPRZEDAZ_K_STANDALONE_MID = ['K_21', 'K_22']
const SPRZEDAZ_K_PAIRS2: [string, string][] = [
  ['K_23', 'K_24'], ['K_25', 'K_26'], ['K_27', 'K_28'],
  ['K_29', 'K_30'], ['K_31', 'K_32'],
]
const SPRZEDAZ_K_STANDALONE_END = ['K_33', 'K_34', 'K_35', 'K_36', 'K_360']

// Zakup K fields
const ZAKUP_K_PAIRS: [string, string][] = [
  ['K_40', 'K_41'], ['K_42', 'K_43'],
]
const ZAKUP_K_STANDALONE = ['K_44', 'K_45', 'K_46', 'K_47']

// ── Control sum formulas from XSD ──

const PODATEK_NALEZNY_PLUS = ['K_16', 'K_18', 'K_20', 'K_24', 'K_26', 'K_28', 'K_30', 'K_32', 'K_33', 'K_34']
const PODATEK_NALEZNY_MINUS = ['K_35', 'K_36', 'K_360']
const PODATEK_NALICZONY_FIELDS = ['K_41', 'K_43', 'K_44', 'K_45', 'K_46', 'K_47']

// ── Deklaracja field definitions ──

const DEKL_STANDALONE_FIELDS = ['P_10']
const DEKL_SEMI_PAIRS: [string, string][] = [['P_11', 'P_12'], ['P_13', 'P_14']]
const DEKL_PAIRS: [string, string][] = [
  ['P_15', 'P_16'], ['P_17', 'P_18'], ['P_19', 'P_20'],
]
const DEKL_STANDALONE_2 = ['P_21', 'P_22']
const DEKL_PAIRS_2: [string, string][] = [
  ['P_23', 'P_24'], ['P_25', 'P_26'], ['P_27', 'P_28'],
  ['P_29', 'P_30'], ['P_31', 'P_32'],
]
const DEKL_STANDALONE_3 = ['P_33', 'P_34', 'P_35', 'P_36', 'P_360']
const DEKL_STANDALONE_4 = ['P_37']
const DEKL_REQUIRED = ['P_38']
const DEKL_STANDALONE_5 = ['P_39']
const DEKL_PAIRS_3: [string, string][] = [['P_40', 'P_41'], ['P_42', 'P_43']]
const DEKL_STANDALONE_6 = ['P_44', 'P_45', 'P_46', 'P_47', 'P_48', 'P_49', 'P_50']
const DEKL_REQUIRED_2 = ['P_51']
const DEKL_STANDALONE_7 = ['P_52', 'P_53', 'P_54']
const DEKL_CHOICE = ['P_540', 'P_55', 'P_56', 'P_560', 'P_58']
const DEKL_OPTIONAL_GROUP = ['P_59', 'P_60', 'P_61']
const DEKL_STANDALONE_8 = ['P_62', 'P_63', 'P_64', 'P_65', 'P_66', 'P_660', 'P_67']
const DEKL_PAIRS_4: [string, string][] = [['P_68', 'P_69']]
const DEKL_STANDALONE_9 = ['P_ORDZU']

// ── K field output helpers ──

function outputKPair(
  lines: string[], row: Record<string, string>, f1: string, f2: string, indent: string,
): void {
  const v1 = row[f1], v2 = row[f2]
  const h1 = v1 !== undefined && v1 !== ''
  const h2 = v2 !== undefined && v2 !== ''
  if (h1 || h2) {
    lines.push(`${indent}<${f1}>${formatAmount(v1)}</${f1}>`)
    lines.push(`${indent}<${f2}>${formatAmount(v2)}</${f2}>`)
  }
}

function outputKStandalone(
  lines: string[], row: Record<string, string>, field: string, indent: string,
): void {
  const v = row[field]
  if (v !== undefined && v !== '') {
    lines.push(`${indent}<${field}>${formatAmount(v)}</${field}>`)
  }
}

// ── Deklaracja field output helpers ──

function outputDeklField(
  lines: string[], d: Record<string, string | number | undefined>, field: string, indent: string,
): void {
  const v = d[field]
  if (v !== undefined && v !== '') {
    lines.push(`${indent}${tag(field, formatDeclAmount(v))}`)
  }
}

function outputDeklFieldRaw(
  lines: string[], d: Record<string, string | number | undefined>, field: string, indent: string,
): void {
  const v = d[field]
  if (v !== undefined && v !== '') {
    lines.push(`${indent}${tag(field, String(v))}`)
  }
}

function outputDeklPair(
  lines: string[], d: Record<string, string | number | undefined>,
  f1: string, f2: string, indent: string,
): void {
  const v1 = d[f1], v2 = d[f2]
  const h1 = v1 !== undefined && v1 !== ''
  const h2 = v2 !== undefined && v2 !== ''
  if (h1 || h2) {
    lines.push(`${indent}${tag(f1, formatDeclAmount(v1))}`)
    lines.push(`${indent}${tag(f2, formatDeclAmount(v2))}`)
  }
}

// ── Main generator function ──

export function generateJpkV7m(input: V7mGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${V7M_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))
  if (input.deklaracja) {
    lines.push(generateDeklaracja(input.deklaracja))
  }
  lines.push(generateEwidencja(input.sprzedazWiersze, input.zakupWiersze))

  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: V7mNaglowek): string {
  const now = new Date()
  const iso = now.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_VAT</KodFormularza>`)
  lines.push(`    <WariantFormularza>${WARIANT}</WariantFormularza>`)
  lines.push(`    <DataWytworzeniaJPK>${iso}</DataWytworzeniaJPK>`)
  if (n.nazwaSystemu) {
    lines.push(`    ${tag('NazwaSystemu', n.nazwaSystemu)}`)
  }
  lines.push(`    <CelZlozenia poz="P_7">${n.celZlozenia}</CelZlozenia>`)
  lines.push(`    ${tag('KodUrzedu', n.kodUrzedu)}`)
  lines.push(`    <Rok>${n.rok}</Rok>`)
  lines.push(`    <Miesiac>${n.miesiac}</Miesiac>`)
  lines.push('  </Naglowek>')
  return lines.join('\n')
}

function generatePodmiot(p: V7mPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1 rola="Podatnik">')

  if (p.typ === 'fizyczna') {
    lines.push('    <OsobaFizyczna>')
    lines.push(`      ${tag('etd:NIP', p.nip)}`)
    if (p.imie) lines.push(`      ${tag('etd:ImiePierwsze', p.imie)}`)
    if (p.nazwisko) lines.push(`      ${tag('etd:Nazwisko', p.nazwisko)}`)
    if (p.dataUrodzenia) lines.push(`      ${tag('etd:DataUrodzenia', p.dataUrodzenia)}`)
    lines.push(`      ${tag('Email', p.email)}`)
    if (p.telefon) lines.push(`      ${tag('Telefon', p.telefon)}`)
    lines.push('    </OsobaFizyczna>')
  } else {
    lines.push('    <OsobaNiefizyczna>')
    lines.push(`      ${tag('NIP', p.nip)}`)
    lines.push(`      ${tag('PelnaNazwa', p.pelnaNazwa || '')}`)
    lines.push(`      ${tag('Email', p.email)}`)
    if (p.telefon) lines.push(`      ${tag('Telefon', p.telefon)}`)
    lines.push('    </OsobaNiefizyczna>')
  }

  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

function generateDeklaracja(d: Record<string, string | number | undefined>): string {
  const lines: string[] = []
  lines.push('  <Deklaracja>')
  lines.push('    <Naglowek>')
  lines.push(`      <KodFormularzaDekl kodSystemowy="${DEKL_KOD_SYSTEMOWY}" kodPodatku="${DEKL_KOD_PODATKU}" rodzajZobowiazania="${DEKL_RODZAJ_ZOBOWIAZANIA}" wersjaSchemy="${SCHEMA_VERSION}">VAT-7</KodFormularzaDekl>`)
  lines.push(`      <WariantFormularzaDekl>${DEKL_WARIANT}</WariantFormularzaDekl>`)
  lines.push('    </Naglowek>')
  lines.push('    <PozycjeSzczegolowe>')

  const indent = '      '

  // Standalone fields
  for (const f of DEKL_STANDALONE_FIELDS) outputDeklField(lines, d, f, indent)
  // Semi-pairs (P_11+P_12, P_13+P_14) — if P_12 has value, P_11 must also be output
  for (const [f1, f2] of DEKL_SEMI_PAIRS) outputDeklPair(lines, d, f1, f2, indent)
  // Full pairs
  for (const [f1, f2] of DEKL_PAIRS) outputDeklPair(lines, d, f1, f2, indent)
  for (const f of DEKL_STANDALONE_2) outputDeklField(lines, d, f, indent)
  for (const [f1, f2] of DEKL_PAIRS_2) outputDeklPair(lines, d, f1, f2, indent)
  for (const f of DEKL_STANDALONE_3) outputDeklField(lines, d, f, indent)
  for (const f of DEKL_STANDALONE_4) outputDeklField(lines, d, f, indent)
  // P_38 is required when Deklaracja is present
  for (const f of DEKL_REQUIRED) {
    lines.push(`${indent}${tag(f, formatDeclAmount(d[f]))}`)
  }
  for (const f of DEKL_STANDALONE_5) outputDeklField(lines, d, f, indent)
  for (const [f1, f2] of DEKL_PAIRS_3) outputDeklPair(lines, d, f1, f2, indent)
  for (const f of DEKL_STANDALONE_6) outputDeklField(lines, d, f, indent)
  // P_51 is required
  for (const f of DEKL_REQUIRED_2) {
    lines.push(`${indent}${tag(f, formatDeclAmount(d[f]))}`)
  }
  for (const f of DEKL_STANDALONE_7) outputDeklField(lines, d, f, indent)
  // P_54 choice: only one of P_540/P_55/P_56/P_560/P_58
  for (const f of DEKL_CHOICE) outputDeklField(lines, d, f, indent)
  // P_59 (TWybor1), P_60 (TKwotaCNieujemna) — amount-compatible
  outputDeklField(lines, d, 'P_59', indent)
  outputDeklField(lines, d, 'P_60', indent)
  // P_61 (TZnakowy) — text field
  outputDeklFieldRaw(lines, d, 'P_61', indent)
  for (const f of DEKL_STANDALONE_8) outputDeklField(lines, d, f, indent)
  for (const [f1, f2] of DEKL_PAIRS_4) outputDeklPair(lines, d, f1, f2, indent)
  // P_ORDZU (TTekstowy) — text field
  outputDeklFieldRaw(lines, d, 'P_ORDZU', indent)

  lines.push('    </PozycjeSzczegolowe>')

  // Pouczenia — always required, value 1
  const pouczenia = d['Pouczenia'] ?? '1'
  lines.push(`    ${tag('Pouczenia', String(pouczenia))}`)

  lines.push('  </Deklaracja>')
  return lines.join('\n')
}

function generateEwidencja(
  sprzedazWiersze: Record<string, string>[],
  zakupWiersze: Record<string, string>[],
): string {
  const lines: string[] = []
  lines.push('  <Ewidencja>')

  for (let i = 0; i < sprzedazWiersze.length; i++) {
    lines.push(generateSprzedazWiersz(sprzedazWiersze[i], i + 1))
  }
  lines.push(generateSprzedazCtrl(sprzedazWiersze))

  for (let i = 0; i < zakupWiersze.length; i++) {
    lines.push(generateZakupWiersz(zakupWiersze[i], i + 1))
  }
  lines.push(generateZakupCtrl(zakupWiersze))

  lines.push('  </Ewidencja>')
  return lines.join('\n')
}

function generateSprzedazWiersz(row: Record<string, string>, lp: number): string {
  const lines: string[] = []
  const ind = '      '
  lines.push('    <SprzedazWiersz>')

  // 1. LpSprzedazy
  lines.push(`${ind}<LpSprzedazy>${lp}</LpSprzedazy>`)

  // 2. KodKrajuNadaniaTIN (optional)
  if (row['KodKrajuNadaniaTIN']) {
    lines.push(`${ind}${tag('KodKrajuNadaniaTIN', row['KodKrajuNadaniaTIN'])}`)
  }

  // 3. NrKontrahenta (required)
  lines.push(`${ind}${tag('NrKontrahenta', row['NrKontrahenta'] || '')}`)

  // 4. NazwaKontrahenta (required)
  lines.push(`${ind}${tag('NazwaKontrahenta', row['NazwaKontrahenta'] || '')}`)

  // 5. DowodSprzedazy (required)
  lines.push(`${ind}${tag('DowodSprzedazy', row['DowodSprzedazy'] || '')}`)

  // 6. DataWystawienia (required)
  lines.push(`${ind}${tag('DataWystawienia', row['DataWystawienia'] || '')}`)

  // 7. DataSprzedazy (optional)
  if (row['DataSprzedazy']) {
    lines.push(`${ind}${tag('DataSprzedazy', row['DataSprzedazy'])}`)
  }

  // 8. KSeF choice: NrKSeF | OFF | BFK | DI (exactly one required)
  if (row['NrKSeF']) {
    lines.push(`${ind}${tag('NrKSeF', row['NrKSeF'])}`)
  } else if (row['OFF'] === '1' || row['OFF'] === 'true') {
    lines.push(`${ind}<OFF>1</OFF>`)
  } else if (row['DI'] === '1' || row['DI'] === 'true') {
    lines.push(`${ind}<DI>1</DI>`)
  } else {
    // Default: BFK (paper/electronic invoice outside KSeF)
    lines.push(`${ind}<BFK>1</BFK>`)
  }

  // 9. TypDokumentu (optional: RO, WEW, FP)
  if (row['TypDokumentu']) {
    lines.push(`${ind}${tag('TypDokumentu', row['TypDokumentu'])}`)
  }

  // 10. GTU codes (optional, each TWybor1)
  for (const gtu of GTU_CODES) {
    const v = boolTag(gtu, row[gtu])
    if (v) lines.push(`${ind}${v}`)
  }

  // 11. Procedure markers (optional)
  for (const proc of SPRZEDAZ_PROCEDURES) {
    const v = boolTag(proc, row[proc])
    if (v) lines.push(`${ind}${v}`)
  }

  // 12. KorektaPodstawyOpodt (optional, triggers TerminPlatnosci/DataZaplaty choice)
  if (row['KorektaPodstawyOpodt'] === '1' || row['KorektaPodstawyOpodt'] === 'true') {
    lines.push(`${ind}<KorektaPodstawyOpodt>1</KorektaPodstawyOpodt>`)
    if (row['TerminPlatnosci']) {
      lines.push(`${ind}${tag('TerminPlatnosci', row['TerminPlatnosci'])}`)
    } else if (row['DataZaplaty']) {
      lines.push(`${ind}${tag('DataZaplaty', row['DataZaplaty'])}`)
    }
  }

  // 13. K fields — standalone, then pairs, in XSD order
  for (const f of SPRZEDAZ_K_STANDALONE) outputKStandalone(lines, row, f, ind)
  for (const [f1, f2] of SPRZEDAZ_K_PAIRS) outputKPair(lines, row, f1, f2, ind)
  for (const f of SPRZEDAZ_K_STANDALONE_MID) outputKStandalone(lines, row, f, ind)
  for (const [f1, f2] of SPRZEDAZ_K_PAIRS2) outputKPair(lines, row, f1, f2, ind)
  for (const f of SPRZEDAZ_K_STANDALONE_END) outputKStandalone(lines, row, f, ind)

  // 14. SprzedazVAT_Marza (optional)
  if (row['SprzedazVAT_Marza']) {
    lines.push(`${ind}<SprzedazVAT_Marza>${formatAmount(row['SprzedazVAT_Marza'])}</SprzedazVAT_Marza>`)
  }

  lines.push('    </SprzedazWiersz>')
  return lines.join('\n')
}

function generateSprzedazCtrl(rows: Record<string, string>[]): string {
  const lines: string[] = []
  lines.push('    <SprzedazCtrl>')
  lines.push(`      <LiczbaWierszySprzedazy>${rows.length}</LiczbaWierszySprzedazy>`)

  // PodatekNalezny = SUM(K_16..K_34) - SUM(K_35,K_36,K_360), excluding FP rows
  let podatekNalezny = 0
  for (const row of rows) {
    if (row['TypDokumentu'] === 'FP') continue
    for (const f of PODATEK_NALEZNY_PLUS) podatekNalezny += parseAmount(row[f])
    for (const f of PODATEK_NALEZNY_MINUS) podatekNalezny -= parseAmount(row[f])
  }

  lines.push(`      <PodatekNalezny>${formatAmount(podatekNalezny)}</PodatekNalezny>`)
  lines.push('    </SprzedazCtrl>')
  return lines.join('\n')
}

function generateZakupWiersz(row: Record<string, string>, lp: number): string {
  const lines: string[] = []
  const ind = '      '
  lines.push('    <ZakupWiersz>')

  // 1. LpZakupu
  lines.push(`${ind}<LpZakupu>${lp}</LpZakupu>`)

  // 2. KodKrajuNadaniaTIN (optional)
  if (row['KodKrajuNadaniaTIN']) {
    lines.push(`${ind}${tag('KodKrajuNadaniaTIN', row['KodKrajuNadaniaTIN'])}`)
  }

  // 3. NrDostawcy (required)
  lines.push(`${ind}${tag('NrDostawcy', row['NrDostawcy'] || '')}`)

  // 4. NazwaDostawcy (required)
  lines.push(`${ind}${tag('NazwaDostawcy', row['NazwaDostawcy'] || '')}`)

  // 5. DowodZakupu (required)
  lines.push(`${ind}${tag('DowodZakupu', row['DowodZakupu'] || '')}`)

  // 6. DataZakupu (required)
  lines.push(`${ind}${tag('DataZakupu', row['DataZakupu'] || '')}`)

  // 7. DataWplywu (optional)
  if (row['DataWplywu']) {
    lines.push(`${ind}${tag('DataWplywu', row['DataWplywu'])}`)
  }

  // 8. KSeF choice: NrKSeF | OFF | BFK | DI
  if (row['NrKSeF']) {
    lines.push(`${ind}${tag('NrKSeF', row['NrKSeF'])}`)
  } else if (row['OFF'] === '1' || row['OFF'] === 'true') {
    lines.push(`${ind}<OFF>1</OFF>`)
  } else if (row['DI'] === '1' || row['DI'] === 'true') {
    lines.push(`${ind}<DI>1</DI>`)
  } else {
    lines.push(`${ind}<BFK>1</BFK>`)
  }

  // 9. DokumentZakupu (optional: MK, VAT_RR, WEW)
  if (row['DokumentZakupu']) {
    lines.push(`${ind}${tag('DokumentZakupu', row['DokumentZakupu'])}`)
  }

  // 10. IMP (optional)
  const imp = boolTag('IMP', row['IMP'])
  if (imp) lines.push(`${ind}${imp}`)

  // 11. K fields — pairs then standalone, in XSD order
  for (const [f1, f2] of ZAKUP_K_PAIRS) outputKPair(lines, row, f1, f2, ind)
  for (const f of ZAKUP_K_STANDALONE) outputKStandalone(lines, row, f, ind)

  // 12. ZakupVAT_Marza (optional)
  if (row['ZakupVAT_Marza']) {
    lines.push(`${ind}<ZakupVAT_Marza>${formatAmount(row['ZakupVAT_Marza'])}</ZakupVAT_Marza>`)
  }

  lines.push('    </ZakupWiersz>')
  return lines.join('\n')
}

function generateZakupCtrl(rows: Record<string, string>[]): string {
  const lines: string[] = []
  lines.push('    <ZakupCtrl>')
  lines.push(`      <LiczbaWierszyZakupow>${rows.length}</LiczbaWierszyZakupow>`)

  // PodatekNaliczony = SUM(K_41, K_43, K_44, K_45, K_46, K_47)
  let podatekNaliczony = 0
  for (const row of rows) {
    for (const f of PODATEK_NALICZONY_FIELDS) podatekNaliczony += parseAmount(row[f])
  }

  lines.push(`      <PodatekNaliczony>${formatAmount(podatekNaliczony)}</PodatekNaliczony>`)
  lines.push('    </ZakupCtrl>')
  return lines.join('\n')
}
