// ── JPK_FA(4) XML Generator ──
// Generates XML conforming to schema: http://jpk.mf.gov.pl/wzor/2022/02/17/02171/

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

export const FA_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2022/02/17/02171/'
export const FA_ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2018/08/24/eD/DefinicjeTypy/'
const SCHEMA_VERSION = '1-0'
const KOD_SYSTEMOWY = 'JPK_FA (4)'
const WARIANT = '4'

// ── Input types ──

export interface FaNaglowek {
  dataOd: string    // YYYY-MM-DD
  dataDo: string    // YYYY-MM-DD
  kodUrzedu: string
}

export interface FaAdresPolski {
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

export interface FaAdresZagraniczny {
  typ: 'zagraniczny'
  kodKraju: string
  kodPocztowy?: string
  miejscowosc: string
  ulica?: string
}

export type FaAdres = FaAdresPolski | FaAdresZagraniczny

export interface FaPodmiot {
  nip: string
  pelnaNazwa: string
  adres: FaAdres
}

export interface FaGeneratorInput {
  naglowek: FaNaglowek
  podmiot: FaPodmiot
  faktury: Record<string, string>[]
  wiersze: Record<string, string>[]
}

// ── XML helpers ──

function tag(name: string, value: string, attrs?: Record<string, string>): string {
  return buildElement(name, value, attrs)
}

function boolField(name: string, value: string | undefined): string {
  return `<${name}>${value === '1' || value === 'true' ? 'true' : 'false'}</${name}>`
}

// ── VAT rate pair definitions ──

const VAT_RATE_GROUPS: { netto: string; vat: string; vatW?: string }[] = [
  { netto: 'P_13_1', vat: 'P_14_1', vatW: 'P_14_1W' }, // 23%/22%
  { netto: 'P_13_2', vat: 'P_14_2', vatW: 'P_14_2W' }, // 8%/7%
  { netto: 'P_13_3', vat: 'P_14_3', vatW: 'P_14_3W' }, // 5%
  { netto: 'P_13_4', vat: 'P_14_4', vatW: 'P_14_4W' }, // reverse charge / taxi
  { netto: 'P_13_5', vat: 'P_14_5' },                   // outside territory (P_14_5 optional)
]

// Standalone optional amounts (after rate groups, before P_15)
const STANDALONE_AMOUNTS = ['P_13_6', 'P_13_7']

// ── Main generator function ──

export function generateJpkFa(input: FaGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${FA_NAMESPACE}" xmlns:etd="${FA_ETD_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))

  for (const faktura of input.faktury) {
    lines.push(generateFaktura(faktura))
  }
  lines.push(generateFakturaCtrl(input.faktury))

  for (const wiersz of input.wiersze) {
    lines.push(generateFakturaWiersz(wiersz))
  }
  lines.push(generateFakturaWierszCtrl(input.wiersze))

  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: FaNaglowek): string {
  const iso = formatDateTime()

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_FA</KodFormularza>`)
  lines.push(`    <WariantFormularza>${WARIANT}</WariantFormularza>`)
  lines.push('    <CelZlozenia>1</CelZlozenia>')
  lines.push(`    <DataWytworzeniaJPK>${iso}</DataWytworzeniaJPK>`)
  lines.push(`    ${tag('DataOd', n.dataOd)}`)
  lines.push(`    ${tag('DataDo', n.dataDo)}`)
  lines.push(`    ${tag('KodUrzedu', n.kodUrzedu)}`)
  lines.push('  </Naglowek>')
  return lines.join('\n')
}

function generatePodmiot(p: FaPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1>')
  lines.push('    <IdentyfikatorPodmiotu>')
  lines.push(`      ${tag('NIP', p.nip)}`)
  lines.push(`      ${tag('PelnaNazwa', p.pelnaNazwa)}`)
  lines.push('    </IdentyfikatorPodmiotu>')

  if (p.adres.typ === 'polski') {
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
  } else {
    const a = p.adres
    lines.push('    <AdresPodmiotu2>')
    lines.push(`      ${tag('etd:KodKraju', a.kodKraju)}`)
    if (a.kodPocztowy) lines.push(`      ${tag('etd:KodPocztowy', a.kodPocztowy)}`)
    lines.push(`      ${tag('etd:Miejscowosc', a.miejscowosc)}`)
    if (a.ulica) lines.push(`      ${tag('etd:Ulica', a.ulica)}`)
    lines.push('    </AdresPodmiotu2>')
  }

  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

function generateFaktura(f: Record<string, string>): string {
  const lines: string[] = []
  const ind = '    '
  lines.push('  <Faktura>')

  // 1. KodWaluty (required)
  lines.push(`${ind}${tag('KodWaluty', f['KodWaluty'] || 'PLN')}`)

  // 2. P_1 — issue date (required)
  lines.push(`${ind}${tag('P_1', f['P_1'] || '')}`)

  // 3. P_2A — invoice number (required)
  lines.push(`${ind}${tag('P_2A', f['P_2A'] || '')}`)

  // 4-5. P_3A, P_3B — buyer name/address (optional)
  if (f['P_3A']) lines.push(`${ind}${tag('P_3A', f['P_3A'])}`)
  if (f['P_3B']) lines.push(`${ind}${tag('P_3B', f['P_3B'])}`)

  // 6-7. P_3C, P_3D — seller name/address (required)
  lines.push(`${ind}${tag('P_3C', f['P_3C'] || '')}`)
  lines.push(`${ind}${tag('P_3D', f['P_3D'] || '')}`)

  // 8-9. P_4A, P_4B — seller tax IDs (optional)
  if (f['P_4A']) lines.push(`${ind}${tag('P_4A', f['P_4A'])}`)
  if (f['P_4B']) lines.push(`${ind}${tag('P_4B', f['P_4B'])}`)

  // 10-11. P_5A, P_5B — buyer tax IDs (optional)
  if (f['P_5A']) lines.push(`${ind}${tag('P_5A', f['P_5A'])}`)
  if (f['P_5B']) lines.push(`${ind}${tag('P_5B', f['P_5B'])}`)

  // 12. P_6 — delivery/service date (optional)
  if (f['P_6']) lines.push(`${ind}${tag('P_6', f['P_6'])}`)

  // 13-26. VAT rate groups (paired sequences, each optional)
  for (const group of VAT_RATE_GROUPS) {
    const hasNetto = f[group.netto] !== undefined && f[group.netto] !== ''
    const hasVat = f[group.vat] !== undefined && f[group.vat] !== ''
    if (hasNetto || hasVat) {
      lines.push(`${ind}<${group.netto}>${formatAmount(f[group.netto])}</${group.netto}>`)
      // P_14_5 is optional even within the sequence (group 5)
      if (group.netto === 'P_13_5') {
        if (hasVat) {
          lines.push(`${ind}<${group.vat}>${formatAmount(f[group.vat])}</${group.vat}>`)
        }
      } else {
        lines.push(`${ind}<${group.vat}>${formatAmount(f[group.vat])}</${group.vat}>`)
      }
      // P_14_xW — tax in PLN for foreign currency (optional)
      if (group.vatW && f[group.vatW]) {
        lines.push(`${ind}<${group.vatW}>${formatAmount(f[group.vatW])}</${group.vatW}>`)
      }
    }
  }

  // 27-28. P_13_6, P_13_7 — standalone optional amounts
  for (const field of STANDALONE_AMOUNTS) {
    if (f[field]) {
      lines.push(`${ind}<${field}>${formatAmount(f[field])}</${field}>`)
    }
  }

  // 29. P_15 — total amount due (required)
  lines.push(`${ind}<P_15>${formatAmount(f['P_15'])}</P_15>`)

  // 30. P_16 — cash method
  lines.push(`${ind}${boolField('P_16', f['P_16'])}`)
  // 31. P_17 — self-billing
  lines.push(`${ind}${boolField('P_17', f['P_17'])}`)
  // 32. P_18 — reverse charge
  lines.push(`${ind}${boolField('P_18', f['P_18'])}`)
  // 33. P_18A — split payment
  lines.push(`${ind}${boolField('P_18A', f['P_18A'])}`)

  // 34. P_19 — VAT exempt + conditional group P_19A/B/C
  lines.push(`${ind}${boolField('P_19', f['P_19'])}`)
  if (f['P_19A']) lines.push(`${ind}${tag('P_19A', f['P_19A'])}`)
  if (f['P_19B']) lines.push(`${ind}${tag('P_19B', f['P_19B'])}`)
  if (f['P_19C']) lines.push(`${ind}${tag('P_19C', f['P_19C'])}`)

  // 38. P_20 — enforcement organ + conditional group P_20A/B
  lines.push(`${ind}${boolField('P_20', f['P_20'])}`)
  if (f['P_20A'] && f['P_20B']) {
    lines.push(`${ind}${tag('P_20A', f['P_20A'])}`)
    lines.push(`${ind}${tag('P_20B', f['P_20B'])}`)
  }

  // 41. P_21 — tax representative + conditional group P_21A/B/C
  lines.push(`${ind}${boolField('P_21', f['P_21'])}`)
  if (f['P_21A'] && f['P_21B'] && f['P_21C']) {
    lines.push(`${ind}${tag('P_21A', f['P_21A'])}`)
    lines.push(`${ind}${tag('P_21B', f['P_21B'])}`)
    lines.push(`${ind}${tag('P_21C', f['P_21C'])}`)
  }

  // 45. P_22 — new transport + conditional group P_22A/B/C
  lines.push(`${ind}${boolField('P_22', f['P_22'])}`)
  if (f['P_22A']) {
    lines.push(`${ind}${tag('P_22A', f['P_22A'])}`)
    if (f['P_22B']) lines.push(`${ind}${tag('P_22B', f['P_22B'])}`)
    if (f['P_22C']) lines.push(`${ind}${tag('P_22C', f['P_22C'])}`)
  }

  // 49. P_23 — triangular procedure
  lines.push(`${ind}${boolField('P_23', f['P_23'])}`)

  // 50. P_106E_2 — tourism margin
  lines.push(`${ind}${boolField('P_106E_2', f['P_106E_2'])}`)

  // 51-52. P_106E_3 — used goods margin + optional P_106E_3A
  lines.push(`${ind}${boolField('P_106E_3', f['P_106E_3'])}`)
  if (f['P_106E_3A']) lines.push(`${ind}${tag('P_106E_3A', f['P_106E_3A'])}`)

  // RodzajFaktury (required: VAT, KOREKTA, ZAL)
  lines.push(`${ind}${tag('RodzajFaktury', f['RodzajFaktury'] || 'VAT')}`)

  // Correction fields (optional, for KOREKTA)
  if (f['PrzyczynaKorekty']) lines.push(`${ind}${tag('PrzyczynaKorekty', f['PrzyczynaKorekty'])}`)
  if (f['NrFaKorygowanej']) lines.push(`${ind}${tag('NrFaKorygowanej', f['NrFaKorygowanej'])}`)
  if (f['OkresFaKorygowanej']) lines.push(`${ind}${tag('OkresFaKorygowanej', f['OkresFaKorygowanej'])}`)

  // Advance invoice reference (optional)
  if (f['NrFaZaliczkowej']) lines.push(`${ind}${tag('NrFaZaliczkowej', f['NrFaZaliczkowej'])}`)

  lines.push('  </Faktura>')
  return lines.join('\n')
}

function generateFakturaCtrl(faktury: Record<string, string>[]): string {
  const lines: string[] = []
  lines.push('  <FakturaCtrl>')
  lines.push(`    <LiczbaFaktur>${faktury.length}</LiczbaFaktur>`)

  let wartoscFaktur = 0
  for (const f of faktury) {
    wartoscFaktur += parseAmount(f['P_15'])
  }
  lines.push(`    <WartoscFaktur>${formatAmount(wartoscFaktur)}</WartoscFaktur>`)

  lines.push('  </FakturaCtrl>')
  return lines.join('\n')
}

function generateFakturaWiersz(w: Record<string, string>): string {
  const lines: string[] = []
  const ind = '    '
  lines.push('  <FakturaWiersz>')

  // 1. P_2B — invoice number reference (required, links to P_2A)
  lines.push(`${ind}${tag('P_2B', w['P_2B'] || '')}`)

  // 2. P_7 — product/service name (optional for some correction types)
  if (w['P_7']) lines.push(`${ind}${tag('P_7', w['P_7'])}`)

  // 3. P_8A — unit of measure (optional)
  if (w['P_8A']) lines.push(`${ind}${tag('P_8A', w['P_8A'])}`)

  // 4. P_8B — quantity (optional, up to 6 decimal places)
  if (w['P_8B']) lines.push(`${ind}<P_8B>${escapeXml(w['P_8B'])}</P_8B>`)

  // 5. P_9A — unit price net (optional)
  if (w['P_9A']) lines.push(`${ind}<P_9A>${formatAmount(w['P_9A'])}</P_9A>`)

  // 6. P_9B — unit price gross (optional, for art. 106e ust. 7/8)
  if (w['P_9B']) lines.push(`${ind}<P_9B>${formatAmount(w['P_9B'])}</P_9B>`)

  // 7. P_10 — discount (optional)
  if (w['P_10']) lines.push(`${ind}<P_10>${formatAmount(w['P_10'])}</P_10>`)

  // 8. P_11 — net value (optional, used in FakturaWierszCtrl sum)
  if (w['P_11']) lines.push(`${ind}<P_11>${formatAmount(w['P_11'])}</P_11>`)

  // 9. P_11A — gross value (optional, for art. 106e ust. 7/8)
  if (w['P_11A']) lines.push(`${ind}<P_11A>${formatAmount(w['P_11A'])}</P_11A>`)

  // 10. P_12 — VAT rate (optional, enum: 23,22,8,7,5,4,3,0,zw,oo,np)
  if (w['P_12']) lines.push(`${ind}${tag('P_12', w['P_12'])}`)

  // 11. P_12_XII — special VAT rate for OSS/IOSS (optional)
  if (w['P_12_XII']) lines.push(`${ind}<P_12_XII>${escapeXml(w['P_12_XII'])}</P_12_XII>`)

  lines.push('  </FakturaWiersz>')
  return lines.join('\n')
}

function generateFakturaWierszCtrl(wiersze: Record<string, string>[]): string {
  const lines: string[] = []
  lines.push('  <FakturaWierszCtrl>')
  lines.push(`    <LiczbaWierszyFaktur>${wiersze.length}</LiczbaWierszyFaktur>`)

  let wartoscWierszy = 0
  for (const w of wiersze) {
    wartoscWierszy += parseAmount(w['P_11'])
  }
  lines.push(`    <WartoscWierszyFaktur>${formatAmount(wartoscWierszy)}</WartoscWierszyFaktur>`)

  lines.push('  </FakturaWierszCtrl>')
  return lines.join('\n')
}

// ── XmlGenerator implementation ──

export const jpkFaGenerator: XmlGenerator = {
  jpkType: 'JPK_FA',
  version: WARIANT,
  namespace: FA_NAMESPACE,
  generate: (input: unknown) => generateJpkFa(input as FaGeneratorInput),
}

generatorRegistry.register(jpkFaGenerator)

// Re-export shared helpers from engine
export { escapeXml, formatAmount }
