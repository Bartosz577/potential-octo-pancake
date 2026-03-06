// ── JPK_KR(1) XML Generator ──
// Księgi rachunkowe (legacy, pre-KR_PD)
// Schema: http://jpk.mf.gov.pl/wzor/2016/03/09/03091/

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

export const KR_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2016/03/09/03091/'
export const KR_ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2016/01/25/eD/DefinicjeTypy/'
export const KR_KCK_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2013/05/23/eD/KodyCECHKRAJOW/'
const SCHEMA_VERSION = '1-0'
const KOD_SYSTEMOWY = 'JPK_KR (1)'
const WARIANT = '1'

// ── Input types ──

export interface KrNaglowek {
  dataOd: string            // YYYY-MM-DD period start
  dataDo: string            // YYYY-MM-DD period end
  domyslnyKodWaluty?: string // default PLN
  kodUrzedu: string
}

export interface KrAdres {
  kodKraju?: string
  wojewodztwo?: string
  powiat?: string
  gmina?: string
  ulica?: string
  nrDomu?: string
  nrLokalu?: string
  miejscowosc?: string
  kodPocztowy?: string
}

export interface KrPodmiot {
  nip: string
  pelnaNazwa: string
  regon?: string
  adres: KrAdres
}

export interface KrZOiSEntry {
  kodKonta: string           // account code
  opisKonta: string          // account name
  typKonta: string           // bilansowe/pozabilansowe/rozliczeniowe/wynikowe
  kodZespolu: string         // account group code
  opisZespolu: string        // account group description
  kodKategorii: string       // category code
  opisKategorii: string      // category description
  kodPodkategorii?: string   // sub-category code (optional)
  opisPodkategorii?: string  // sub-category description (optional)
  bilansOtwarciaWinien: string | number
  bilansOtwarciaMa: string | number
  obrotyWinien: string | number
  obrotyMa: string | number
  obrotyWinienNarast: string | number
  obrotyMaNarast: string | number
  saldoWinien: string | number
  saldoMa: string | number
}

export interface KrDziennik {
  lpZapisuDziennika: string | number   // sequential number
  nrZapisuDziennika: string            // journal entry number
  opisDziennika: string                // journal description
  nrDowoduKsiegowego: string           // source document number
  rodzajDowodu: string                 // document type
  dataOperacji: string                 // operation date
  dataDowodu: string                   // document date
  dataKsiegowania: string              // posting date
  kodOperatora: string                 // operator code
  opisOperacji: string                 // operation description
  dziennikKwotaOperacji: string | number // operation amount
}

export interface KrKontoZapis {
  lpZapisu: string | number            // sequential number
  nrZapisu: string                     // links to NrZapisuDziennika
  kodKontaWinien: string               // debit account code (or "null")
  kwotaWinien: string | number         // debit amount
  kwotaWinienWaluta?: string | number  // debit in foreign currency
  kodWalutyWinien?: string             // debit currency
  opisZapisuWinien?: string            // debit description
  kodKontaMa: string                   // credit account code (or "null")
  kwotaMa: string | number             // credit amount
  kwotaMaWaluta?: string | number      // credit in foreign currency
  kodWalutyMa?: string                 // credit currency
  opisZapisuMa?: string               // credit description
}

export interface KrGeneratorInput {
  naglowek: KrNaglowek
  podmiot: KrPodmiot
  zpisSald: KrZOiSEntry[]
  dziennik: KrDziennik[]
  kontoZapisy: KrKontoZapis[]
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

export function generateJpkKr(input: KrGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${KR_NAMESPACE}" xmlns:etd="${KR_ETD_NAMESPACE}" xmlns:kck="${KR_KCK_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))

  for (const entry of input.zpisSald) {
    lines.push(generateZOiS(entry))
  }

  for (const d of input.dziennik) {
    lines.push(generateDziennik(d))
  }
  lines.push(generateDziennikCtrl(input.dziennik))

  for (const kz of input.kontoZapisy) {
    lines.push(generateKontoZapis(kz))
  }
  lines.push(generateKontoZapisCtrl(input.kontoZapisy))

  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: KrNaglowek): string {
  const iso = formatDateTime()
  const waluta = n.domyslnyKodWaluty || 'PLN'

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_KR</KodFormularza>`)
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

function generatePodmiot(p: KrPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1>')
  lines.push('    <IdentyfikatorPodmiotu>')
  lines.push(`      ${tag('etd:NIP', p.nip)}`)
  lines.push(`      ${tag('etd:PelnaNazwa', p.pelnaNazwa)}`)
  if (p.regon) lines.push(`      ${tag('etd:REGON', p.regon)}`)
  lines.push('    </IdentyfikatorPodmiotu>')

  const a = p.adres
  lines.push('    <AdresPodmiotu>')
  lines.push(`      ${tag('etd:KodKraju', a.kodKraju || 'PL')}`)
  if (a.wojewodztwo) lines.push(`      ${tag('etd:Wojewodztwo', a.wojewodztwo)}`)
  if (a.powiat) lines.push(`      ${tag('etd:Powiat', a.powiat)}`)
  if (a.gmina) lines.push(`      ${tag('etd:Gmina', a.gmina)}`)
  if (a.ulica) lines.push(`      ${tag('etd:Ulica', a.ulica)}`)
  lines.push(`      ${tag('etd:NrDomu', a.nrDomu || '-')}`)
  if (a.nrLokalu) lines.push(`      ${tag('etd:NrLokalu', a.nrLokalu)}`)
  lines.push(`      ${tag('etd:Miejscowosc', a.miejscowosc || '-')}`)
  lines.push(`      ${tag('etd:KodPocztowy', a.kodPocztowy || '00-000')}`)
  lines.push('    </AdresPodmiotu>')

  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

function generateZOiS(e: KrZOiSEntry): string {
  const lines: string[] = []
  lines.push('  <ZOiS typ="G">')
  lines.push(`    ${tag('KodKonta', e.kodKonta)}`)
  lines.push(`    ${tag('OpisKonta', e.opisKonta)}`)
  lines.push(`    ${tag('TypKonta', e.typKonta)}`)
  lines.push(`    ${tag('KodZespolu', e.kodZespolu)}`)
  lines.push(`    ${tag('OpisZespolu', e.opisZespolu)}`)
  lines.push(`    ${tag('KodKategorii', e.kodKategorii)}`)
  lines.push(`    ${tag('OpisKategorii', e.opisKategorii)}`)
  const kp = optionalTag('KodPodkategorii', e.kodPodkategorii, '    ')
  if (kp) lines.push(kp)
  const op = optionalTag('OpisPodkategorii', e.opisPodkategorii, '    ')
  if (op) lines.push(op)
  lines.push(`    ${amountTag('BilansOtwarciaWinien', e.bilansOtwarciaWinien)}`)
  lines.push(`    ${amountTag('BilansOtwarciaMa', e.bilansOtwarciaMa)}`)
  lines.push(`    ${amountTag('ObrotyWinien', e.obrotyWinien)}`)
  lines.push(`    ${amountTag('ObrotyMa', e.obrotyMa)}`)
  lines.push(`    ${amountTag('ObrotyWinienNarast', e.obrotyWinienNarast)}`)
  lines.push(`    ${amountTag('ObrotyMaNarast', e.obrotyMaNarast)}`)
  lines.push(`    ${amountTag('SaldoWinien', e.saldoWinien)}`)
  lines.push(`    ${amountTag('SaldoMa', e.saldoMa)}`)
  lines.push('  </ZOiS>')
  return lines.join('\n')
}

function generateDziennik(d: KrDziennik): string {
  const lines: string[] = []
  lines.push('  <Dziennik typ="G">')
  lines.push(`    <LpZapisuDziennika>${escapeXml(String(d.lpZapisuDziennika))}</LpZapisuDziennika>`)
  lines.push(`    ${tag('NrZapisuDziennika', d.nrZapisuDziennika)}`)
  lines.push(`    ${tag('OpisDziennika', d.opisDziennika)}`)
  lines.push(`    ${tag('NrDowoduKsiegowego', d.nrDowoduKsiegowego)}`)
  lines.push(`    ${tag('RodzajDowodu', d.rodzajDowodu)}`)
  lines.push(`    ${tag('DataOperacji', d.dataOperacji)}`)
  lines.push(`    ${tag('DataDowodu', d.dataDowodu)}`)
  lines.push(`    ${tag('DataKsiegowania', d.dataKsiegowania)}`)
  lines.push(`    ${tag('KodOperatora', d.kodOperatora)}`)
  lines.push(`    ${tag('OpisOperacji', d.opisOperacji)}`)
  lines.push(`    ${amountTag('DziennikKwotaOperacji', d.dziennikKwotaOperacji)}`)
  lines.push('  </Dziennik>')
  return lines.join('\n')
}

function generateDziennikCtrl(dziennik: KrDziennik[]): string {
  let sumaKwot = 0
  for (const d of dziennik) {
    sumaKwot += parseAmount(String(d.dziennikKwotaOperacji))
  }

  const lines: string[] = []
  lines.push('  <DziennikCtrl>')
  lines.push(`    <LiczbaWierszyDziennika>${dziennik.length}</LiczbaWierszyDziennika>`)
  lines.push(`    ${amountTag('SumaKwotOperacji', sumaKwot)}`)
  lines.push('  </DziennikCtrl>')
  return lines.join('\n')
}

function generateKontoZapis(kz: KrKontoZapis): string {
  const lines: string[] = []
  lines.push('  <KontoZapis typ="G">')
  lines.push(`    <LpZapisu>${escapeXml(String(kz.lpZapisu))}</LpZapisu>`)
  lines.push(`    ${tag('NrZapisu', kz.nrZapisu)}`)

  // Debit side (always present, use "null" default per XSD)
  lines.push(`    ${tag('KodKontaWinien', kz.kodKontaWinien || 'null')}`)
  lines.push(`    ${amountTag('KwotaWinien', kz.kwotaWinien)}`)
  if (kz.kwotaWinienWaluta !== undefined && kz.kwotaWinienWaluta !== '') {
    lines.push(`    ${amountTag('KwotaWinienWaluta', kz.kwotaWinienWaluta)}`)
  }
  if (kz.kodWalutyWinien) {
    lines.push(`    ${tag('KodWalutyWinien', kz.kodWalutyWinien)}`)
  }
  if (kz.opisZapisuWinien) {
    lines.push(`    ${tag('OpisZapisuWinien', kz.opisZapisuWinien)}`)
  }

  // Credit side (always present, use "null" default per XSD)
  lines.push(`    ${tag('KodKontaMa', kz.kodKontaMa || 'null')}`)
  lines.push(`    ${amountTag('KwotaMa', kz.kwotaMa)}`)
  if (kz.kwotaMaWaluta !== undefined && kz.kwotaMaWaluta !== '') {
    lines.push(`    ${amountTag('KwotaMaWaluta', kz.kwotaMaWaluta)}`)
  }
  if (kz.kodWalutyMa) {
    lines.push(`    ${tag('KodWalutyMa', kz.kodWalutyMa)}`)
  }
  if (kz.opisZapisuMa) {
    lines.push(`    ${tag('OpisZapisuMa', kz.opisZapisuMa)}`)
  }

  lines.push('  </KontoZapis>')
  return lines.join('\n')
}

function generateKontoZapisCtrl(zapisy: KrKontoZapis[]): string {
  let sumaWinien = 0
  let sumaMa = 0
  for (const kz of zapisy) {
    sumaWinien += parseAmount(String(kz.kwotaWinien))
    sumaMa += parseAmount(String(kz.kwotaMa))
  }

  const lines: string[] = []
  lines.push('  <KontoZapisCtrl>')
  // Official typo in XSD: "LiczbaWierszyKontoZapisj" (missing 'y', extra 'j')
  lines.push(`    <LiczbaWierszyKontoZapisj>${zapisy.length}</LiczbaWierszyKontoZapisj>`)
  lines.push(`    ${amountTag('SumaWinien', sumaWinien)}`)
  lines.push(`    ${amountTag('SumaMa', sumaMa)}`)
  lines.push('  </KontoZapisCtrl>')
  return lines.join('\n')
}

// ── XmlGenerator implementation ──

export const jpkKrGenerator: XmlGenerator = {
  jpkType: 'JPK_KR',
  version: WARIANT,
  namespace: KR_NAMESPACE,
  generate: (input: unknown) => generateJpkKr(input as KrGeneratorInput),
}

generatorRegistry.register(jpkKrGenerator)

export { escapeXml, formatAmount }
