// ── JPK_FA_RR(1) XML Generator ──
// Faktury VAT RR (zakup od rolnika ryczaltowego)
// Schema: http://jpk.mf.gov.pl/wzor/2019/08/12/08121/

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

export const FA_RR_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2019/08/12/08121/'
export const FA_RR_ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2018/08/24/eD/DefinicjeTypy/'
export const FA_RR_KCK_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2013/05/23/eD/KodyCECHKRAJOW/'
const SCHEMA_VERSION = '1-0'
const KOD_SYSTEMOWY = 'JPK_FA_RR (1)'
const WARIANT = '1'

// ── Input types ──

export interface FaRrNaglowek {
  dataOd: string    // YYYY-MM-DD
  dataDo: string    // YYYY-MM-DD
  domyslnyKodWaluty?: string  // default PLN
  kodUrzedu: string
}

export interface FaRrPodmiot {
  nip: string
  pelnaNazwa: string
  adres: FaRrAdres
}

export interface FaRrAdres {
  typ: 'polski'
  wojewodztwo: string
  powiat: string
  gmina: string
  ulica?: string
  nrDomu: string
  nrLokalu?: string
  miejscowosc: string
  kodPocztowy: string
}

export interface FaRrPodpis {
  numerSeryjny: string
  wystawca: string
  posiadacz: string
}

export interface FaRrFaktura {
  p1a: string      // supplier name
  p1b: string      // supplier address
  p1c: string      // buyer name
  p1d: string      // buyer address
  p2a: string      // supplier NIP/PESEL
  p2b: string      // buyer NIP
  p3a: FaRrPodpis  // supplier e-signature
  p3b: FaRrPodpis  // buyer e-signature
  p4a: string      // date of purchase
  p4b: string      // invoice date
  p4c1: string     // invoice number
  p11_1: string | number  // value of agricultural products
  p11_2: string | number  // flat-rate VAT refund amount
  p12_1: string | number  // total amount with VAT
  p12_2: string    // total amount in words
  p116_3: boolean  // farmer declaration
  rodzajFaktury: 'VAT_RR' | 'KOREKTA_RR'
  przyczynaKorekty?: string
  nrFaKorygowanej?: string
  okresFaKorygowanej?: string
  dokument?: string
}

export interface FaRrWiersz {
  p4c2: string     // invoice number reference
  p5: string       // product name
  p6a: string      // unit of measure
  p6b: string | number  // quantity
  p6c: string      // quality class
  p7: string | number   // unit price
  p8: string | number   // line value
  p9: string | number   // VAT rate
  p10: string | number  // VAT amount
}

export interface FaRrOswiadczenie {
  p1a2: string     // supplier name
  p1b2: string     // supplier address
  p1c2: string     // buyer name
  p1d2: string     // buyer address
  p2a2: string     // supplier NIP/PESEL
  p2b2: string     // buyer NIP
  p116_4_1: string // agreement date
  p116_4_2: string // agreement subject
  p116_4_3: string // document date
  p3a2: FaRrPodpis // e-signature
}

export interface FaRrGeneratorInput {
  naglowek: FaRrNaglowek
  podmiot: FaRrPodmiot
  faktury: FaRrFaktura[]
  wiersze: FaRrWiersz[]
  oswiadczenia?: FaRrOswiadczenie[]
}

// ── XML helpers ──

function tag(name: string, value: string): string {
  return buildElement(name, value)
}

function amountTag(name: string, value: string | number | undefined): string {
  return `<${name}>${formatAmount(value)}</${name}>`
}

function quantityTag(name: string, value: string | number): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.')) || 0
  return `<${name}>${escapeXml(num)}</${name}>`
}

function generatePodpis(p: FaRrPodpis, indent: string): string {
  const lines: string[] = []
  lines.push(`${indent}${tag('NumerSeryjny', p.numerSeryjny)}`)
  lines.push(`${indent}${tag('Wystawca', p.wystawca)}`)
  lines.push(`${indent}${tag('Posiadacz', p.posiadacz)}`)
  return lines.join('\n')
}

// ── Main generator function ──

export function generateJpkFaRr(input: FaRrGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${FA_RR_NAMESPACE}" xmlns:etd="${FA_RR_ETD_NAMESPACE}" xmlns:kck="${FA_RR_KCK_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))

  for (const faktura of input.faktury) {
    lines.push(generateFaktura(faktura))
  }
  lines.push(generateFakturaCtrl(input.faktury))

  for (const wiersz of input.wiersze) {
    lines.push(generateWiersz(wiersz))
  }
  lines.push(generateWierszCtrl(input.wiersze))

  if (input.oswiadczenia && input.oswiadczenia.length > 0) {
    for (const osw of input.oswiadczenia) {
      lines.push(generateOswiadczenie(osw))
    }
    lines.push(generateOswiadczenieCtrl(input.oswiadczenia))
  }

  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: FaRrNaglowek): string {
  const iso = formatDateTime()
  const waluta = n.domyslnyKodWaluty || 'PLN'

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_FA_RR</KodFormularza>`)
  lines.push(`    <WariantFormularza>${WARIANT}</WariantFormularza>`)
  lines.push('    <CelZlozenia>1</CelZlozenia>')
  lines.push(`    <DataWytworzeniaJPK>${iso}</DataWytworzeniaJPK>`)
  lines.push(`    ${tag('DataOd', n.dataOd)}`)
  lines.push(`    ${tag('DataDo', n.dataDo)}`)
  lines.push(`    ${tag('DomyslnyKodWaluty', waluta)}`)
  lines.push(`    ${tag('KodUrzedu', n.kodUrzedu)}`)
  lines.push('  </Naglowek>')
  return lines.join('\n')
}

function generatePodmiot(p: FaRrPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1>')
  lines.push('    <IdentyfikatorPodmiotu>')
  lines.push(`      ${tag('etd:NIP', p.nip)}`)
  lines.push(`      ${tag('etd:PelnaNazwa', p.pelnaNazwa)}`)
  lines.push('    </IdentyfikatorPodmiotu>')

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
  lines.push('    </AdresPodmiotu>')

  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

function generateFaktura(f: FaRrFaktura): string {
  const lines: string[] = []
  const ind = '    '
  lines.push('  <FakturaRR typ="G">')

  lines.push(`${ind}${tag('P_1A', f.p1a)}`)
  lines.push(`${ind}${tag('P_1B', f.p1b)}`)
  lines.push(`${ind}${tag('P_1C', f.p1c)}`)
  lines.push(`${ind}${tag('P_1D', f.p1d)}`)
  lines.push(`${ind}${tag('P_2A', f.p2a)}`)
  lines.push(`${ind}${tag('P_2B', f.p2b)}`)

  // P_3A — supplier e-signature
  lines.push(`${ind}<P_3A>`)
  lines.push(generatePodpis(f.p3a, ind + '  '))
  lines.push(`${ind}</P_3A>`)

  // P_3B — buyer e-signature
  lines.push(`${ind}<P_3B>`)
  lines.push(generatePodpis(f.p3b, ind + '  '))
  lines.push(`${ind}</P_3B>`)

  lines.push(`${ind}${tag('P_4A', f.p4a)}`)
  lines.push(`${ind}${tag('P_4B', f.p4b)}`)
  lines.push(`${ind}${tag('P_4C1', f.p4c1)}`)

  lines.push(`${ind}${amountTag('P_11_1', f.p11_1)}`)
  lines.push(`${ind}${amountTag('P_11_2', f.p11_2)}`)

  lines.push(`${ind}${amountTag('P_12_1', f.p12_1)}`)
  lines.push(`${ind}${tag('P_12_2', f.p12_2)}`)
  lines.push(`${ind}<P_116_3>${f.p116_3 ? 'true' : 'false'}</P_116_3>`)
  lines.push(`${ind}${tag('RodzajFaktury', f.rodzajFaktury)}`)

  // Correction group (optional, all-or-nothing for required pair)
  if (f.przyczynaKorekty && f.nrFaKorygowanej) {
    lines.push(`${ind}${tag('PrzyczynaKorekty', f.przyczynaKorekty)}`)
    lines.push(`${ind}${tag('NrFaKorygowanej', f.nrFaKorygowanej)}`)
    if (f.okresFaKorygowanej) {
      lines.push(`${ind}${tag('OkresFaKorygowanej', f.okresFaKorygowanej)}`)
    }
  }

  if (f.dokument) {
    lines.push(`${ind}${tag('Dokument', f.dokument)}`)
  }

  lines.push('  </FakturaRR>')
  return lines.join('\n')
}

function generateFakturaCtrl(faktury: FaRrFaktura[]): string {
  const lines: string[] = []
  lines.push('  <FakturaRRCtrl>')
  lines.push(`    <LiczbaFakturRR>${faktury.length}</LiczbaFakturRR>`)

  const suma = sumAmounts(faktury.map(f => parseAmount(String(f.p12_1))))
  lines.push(`    ${amountTag('WartoscFakturRR', suma)}`)

  lines.push('  </FakturaRRCtrl>')
  return lines.join('\n')
}

function generateWiersz(w: FaRrWiersz): string {
  const lines: string[] = []
  const ind = '    '
  lines.push('  <FakturaRRWiersz typ="G">')

  lines.push(`${ind}${tag('P_4C2', w.p4c2)}`)
  lines.push(`${ind}${tag('P_5', w.p5)}`)
  lines.push(`${ind}${tag('P_6A', w.p6a)}`)
  lines.push(`${ind}${quantityTag('P_6B', w.p6b)}`)
  lines.push(`${ind}${tag('P_6C', w.p6c)}`)
  lines.push(`${ind}${amountTag('P_7', w.p7)}`)
  lines.push(`${ind}${amountTag('P_8', w.p8)}`)
  lines.push(`${ind}<P_9>${escapeXml(String(w.p9))}</P_9>`)
  lines.push(`${ind}${amountTag('P_10', w.p10)}`)

  lines.push('  </FakturaRRWiersz>')
  return lines.join('\n')
}

function generateWierszCtrl(wiersze: FaRrWiersz[]): string {
  const lines: string[] = []
  lines.push('  <FakturaRRWierszCtrl>')
  lines.push(`    <LiczbaWierszyFakturRR>${wiersze.length}</LiczbaWierszyFakturRR>`)

  const suma = sumAmounts(wiersze.map(w => parseAmount(String(w.p8))))
  lines.push(`    ${amountTag('WartoscWierszyFakturRR', suma)}`)

  lines.push('  </FakturaRRWierszCtrl>')
  return lines.join('\n')
}

function generateOswiadczenie(o: FaRrOswiadczenie): string {
  const lines: string[] = []
  const ind = '    '
  lines.push('  <Oswiadczenie>')

  lines.push(`${ind}${tag('P_1A2', o.p1a2)}`)
  lines.push(`${ind}${tag('P_1B2', o.p1b2)}`)
  lines.push(`${ind}${tag('P_1C2', o.p1c2)}`)
  lines.push(`${ind}${tag('P_1D2', o.p1d2)}`)
  lines.push(`${ind}${tag('P_2A2', o.p2a2)}`)
  lines.push(`${ind}${tag('P_2B2', o.p2b2)}`)
  lines.push(`${ind}${tag('P_116_4_1', o.p116_4_1)}`)
  lines.push(`${ind}${tag('P_116_4_2', o.p116_4_2)}`)
  lines.push(`${ind}${tag('P_116_4_3', o.p116_4_3)}`)

  lines.push(`${ind}<P_3A2>`)
  lines.push(generatePodpis(o.p3a2, ind + '  '))
  lines.push(`${ind}</P_3A2>`)

  lines.push('  </Oswiadczenie>')
  return lines.join('\n')
}

function generateOswiadczenieCtrl(oswiadczenia: FaRrOswiadczenie[]): string {
  const lines: string[] = []
  lines.push('  <OswiadczenieCtrl>')
  lines.push(`    <LiczbaOswiadczen>${oswiadczenia.length}</LiczbaOswiadczen>`)
  lines.push('  </OswiadczenieCtrl>')
  return lines.join('\n')
}

// ── XmlGenerator implementation ──

export const jpkFaRrGenerator: XmlGenerator = {
  jpkType: 'JPK_FA_RR',
  version: WARIANT,
  namespace: FA_RR_NAMESPACE,
  generate: (input: unknown) => {
    const data = validateGeneratorInput<FaRrGeneratorInput>(
      input,
      ['naglowek', 'podmiot', 'faktury', 'wiersze'],
      'JPK_FA_RR',
    )
    return generateJpkFaRr(data)
  },
}

generatorRegistry.register(jpkFaRrGenerator)

export { escapeXml, formatAmount }
