// ── JPK_WB(1) XML Generator ──
// Generates XML conforming to schema: http://jpk.mf.gov.pl/wzor/2016/03/09/03092/

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

export const WB_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2016/03/09/03092/'
export const WB_ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2016/01/25/eD/DefinicjeTypy/'
const SCHEMA_VERSION = '1-0'
const KOD_SYSTEMOWY = 'JPK_WB (1)'
const WARIANT = '1'

// ── Input types ──

export interface WbNaglowek {
  dataOd: string    // YYYY-MM-DD
  dataDo: string    // YYYY-MM-DD
  domyslnyKodWaluty?: string  // ISO-4217, default PLN
  kodUrzedu: string
}

export interface WbAdres {
  wojewodztwo: string
  powiat: string
  gmina: string
  ulica?: string
  nrDomu: string
  nrLokalu?: string
  miejscowosc: string
  kodPocztowy: string
  poczta: string      // required in TAdresPolski (2016 ETD version)
}

export interface WbPodmiot {
  nip: string
  pelnaNazwa: string
  regon?: string
  adres: WbAdres
}

export interface WbWiersz {
  dataOperacji: string       // YYYY-MM-DD
  nazwaPodmiotu: string
  opisOperacji: string
  kwotaOperacji: string      // negative = debit, positive = credit
  saldoOperacji: string
}

export interface WbGeneratorInput {
  naglowek: WbNaglowek
  podmiot: WbPodmiot
  numerRachunku: string      // IBAN: [A-Z]{2}[0-9]{2}[0-9A-Z]{10,30}
  saldoPoczatkowe: string
  saldoKoncowe: string
  wiersze: WbWiersz[]
}

// ── XML helpers ──

function tag(name: string, value: string): string {
  return buildElement(name, value)
}

// ── Main generator function ──

export function generateJpkWb(input: WbGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${WB_NAMESPACE}" xmlns:etd="${WB_ETD_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))

  // NumerRachunku (IBAN)
  lines.push(`  ${tag('NumerRachunku', input.numerRachunku)}`)

  // Salda
  lines.push('  <Salda>')
  lines.push(`    <SaldoPoczatkowe>${formatAmount(input.saldoPoczatkowe)}</SaldoPoczatkowe>`)
  lines.push(`    <SaldoKoncowe>${formatAmount(input.saldoKoncowe)}</SaldoKoncowe>`)
  lines.push('  </Salda>')

  // WyciagWiersz (1..unbounded)
  for (let i = 0; i < input.wiersze.length; i++) {
    lines.push(generateWyciagWiersz(input.wiersze[i], i + 1))
  }

  // WyciagCtrl
  lines.push(generateWyciagCtrl(input.wiersze))

  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: WbNaglowek): string {
  const iso = formatDateTime()

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_WB</KodFormularza>`)
  lines.push(`    <WariantFormularza>${WARIANT}</WariantFormularza>`)
  lines.push('    <CelZlozenia>1</CelZlozenia>')
  lines.push(`    <DataWytworzeniaJPK>${iso}</DataWytworzeniaJPK>`)
  lines.push(`    ${tag('DataOd', n.dataOd)}`)
  lines.push(`    ${tag('DataDo', n.dataDo)}`)
  lines.push(`    ${tag('DomyslnyKodWaluty', n.domyslnyKodWaluty || 'PLN')}`)
  lines.push(`    ${tag('KodUrzedu', n.kodUrzedu)}`)
  lines.push('  </Naglowek>')
  return lines.join('\n')
}

function generatePodmiot(p: WbPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1>')

  // IdentyfikatorPodmiotu (etd:TIdentyfikatorOsobyNiefizycznej)
  lines.push('    <IdentyfikatorPodmiotu>')
  lines.push(`      ${tag('etd:NIP', p.nip)}`)
  lines.push(`      ${tag('etd:PelnaNazwa', p.pelnaNazwa)}`)
  if (p.regon) lines.push(`      ${tag('etd:REGON', p.regon)}`)
  lines.push('    </IdentyfikatorPodmiotu>')

  // AdresPodmiotu (etd:TAdresPolski)
  const a = p.adres
  lines.push('    <AdresPodmiotu>')
  lines.push('      <etd:KodKraju>PL</etd:KodKraju>')
  lines.push(`      ${tag('etd:Wojewodztwo', a.wojewodztwo)}`)
  lines.push(`      ${tag('etd:Powiat', a.powiat)}`)
  lines.push(`      ${tag('etd:Gmina', a.gmina)}`)
  if (a.ulica) lines.push(`      ${tag('etd:Ulica', a.ulica)}`)
  lines.push(`      ${tag('etd:NrDomu', a.nrDomu)}`)
  if (a.nrLokalu) lines.push(`      ${tag('etd:NrLokalu', a.nrLokalu)}`)
  lines.push(`      ${tag('etd:Miejscowosc', a.miejscowosc)}`)
  lines.push(`      ${tag('etd:KodPocztowy', a.kodPocztowy)}`)
  lines.push(`      ${tag('etd:Poczta', a.poczta)}`)
  lines.push('    </AdresPodmiotu>')

  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

function generateWyciagWiersz(w: WbWiersz, lp: number): string {
  const lines: string[] = []
  lines.push('  <WyciagWiersz typ="G">')
  lines.push(`    <NumerWiersza>${lp}</NumerWiersza>`)
  lines.push(`    ${tag('DataOperacji', w.dataOperacji)}`)
  lines.push(`    ${tag('NazwaPodmiotu', w.nazwaPodmiotu)}`)
  lines.push(`    ${tag('OpisOperacji', w.opisOperacji)}`)
  lines.push(`    <KwotaOperacji>${formatAmount(w.kwotaOperacji)}</KwotaOperacji>`)
  lines.push(`    <SaldoOperacji>${formatAmount(w.saldoOperacji)}</SaldoOperacji>`)
  lines.push('  </WyciagWiersz>')
  return lines.join('\n')
}

function generateWyciagCtrl(wiersze: WbWiersz[]): string {
  let sumaObciazen = 0
  let sumaUznan = 0

  for (const w of wiersze) {
    const kwota = parseAmount(w.kwotaOperacji)
    if (kwota < 0) {
      sumaObciazen += Math.abs(kwota)
    } else {
      sumaUznan += kwota
    }
  }

  const lines: string[] = []
  lines.push('  <WyciagCtrl>')
  lines.push(`    <LiczbaWierszy>${wiersze.length}</LiczbaWierszy>`)
  lines.push(`    <SumaObciazen>${formatAmount(sumaObciazen)}</SumaObciazen>`)
  lines.push(`    <SumaUznan>${formatAmount(sumaUznan)}</SumaUznan>`)
  lines.push('  </WyciagCtrl>')
  return lines.join('\n')
}

// ── XmlGenerator implementation ──

export const jpkWbGenerator: XmlGenerator = {
  jpkType: 'JPK_WB',
  version: WARIANT,
  namespace: WB_NAMESPACE,
  generate: (input: unknown) => generateJpkWb(input as WbGeneratorInput),
}

generatorRegistry.register(jpkWbGenerator)

// Re-export shared helpers from engine
export { escapeXml, formatAmount }
