// ── JPK_MAG(2) XML Generator ──
// Generates XML conforming to schema: http://jpk.mf.gov.pl/wzor/2025/11/24/11242/

import {
  escapeXml,
  formatAmount,
  formatQuantity,
  formatDateTime,
  buildElement,
  buildAmountElement,
  buildQuantityElement,
  XmlGenerator,
  generatorRegistry,
} from './XmlGeneratorEngine'

// ── Constants ──

export const MAG_NAMESPACE = 'http://jpk.mf.gov.pl/wzor/2025/11/24/11242/'
export const MAG_ETD_NAMESPACE = 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/'
const SCHEMA_VERSION = '1-0'
const KOD_SYSTEMOWY = 'JPK_MAG (2)'
const WARIANT = '2'

// ── Input types ──

export interface MagNaglowek {
  dataOd: string    // YYYY-MM-DD
  dataDo: string    // YYYY-MM-DD
  domyslnyKodWaluty?: string  // ISO-4217, default PLN
  kodUrzedu: string
}

export interface MagAdresPolski {
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

export interface MagAdresZagraniczny {
  typ: 'zagraniczny'
  kodKraju: string
  kodPocztowy?: string
  miejscowosc: string
  ulica?: string
}

export type MagAdres = MagAdresPolski | MagAdresZagraniczny

export interface MagPodmiot {
  nip: string
  pelnaNazwa: string
  regon?: string
  adres: MagAdres
}

export interface MagDokument {
  header: Record<string, string>
  wiersze: Record<string, string>[]
}

export interface MagInwentaryzacja {
  dataInwentaryzacji: string   // YYYY-MM-DD
  dataCzasOd: string           // ISO datetime
  dataCzasDo: string           // ISO datetime
  tabela1?: Record<string, string>[]
  tabela2?: Record<string, string>[]
}

export interface MagGeneratorInput {
  naglowek: MagNaglowek
  podmiot: MagPodmiot
  magazyn: string
  metoda: number  // 1-4
  pz?: MagDokument[]
  pw?: MagDokument[]
  wz?: MagDokument[]
  rw?: MagDokument[]
  mmwe?: MagDokument[]
  mmwy?: MagDokument[]
  inw?: MagInwentaryzacja[]
}

// ── XML helpers ──

function tag(name: string, value: string): string {
  return buildElement(name, value)
}

function amountTag(name: string, value: string | undefined): string {
  return buildAmountElement(name, value)
}

function quantityTag(name: string, value: string | undefined): string {
  return buildQuantityElement(name, value)
}

function push(lines: string[], indent: string, content: string): void {
  lines.push(`${indent}${content}`)
}

function pushOpt(lines: string[], indent: string, name: string, value: string | undefined): void {
  if (value !== undefined && value !== '') {
    lines.push(`${indent}${tag(name, value)}`)
  }
}

function pushOptAmount(lines: string[], indent: string, name: string, value: string | undefined): void {
  if (value !== undefined && value !== '') {
    lines.push(`${indent}${amountTag(name, value)}`)
  }
}

function pushOptQuantity(lines: string[], indent: string, name: string, value: string | undefined): void {
  if (value !== undefined && value !== '') {
    lines.push(`${indent}${quantityTag(name, value)}`)
  }
}

// ── Main generator function ──

export function generateJpkMag(input: MagGeneratorInput): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(`<JPK xmlns="${MAG_NAMESPACE}" xmlns:etd="${MAG_ETD_NAMESPACE}">`)

  lines.push(generateNaglowek(input.naglowek))
  lines.push(generatePodmiot(input.podmiot))

  // Magazyn and Metoda (required)
  lines.push(`  ${tag('Magazyn', input.magazyn)}`)
  lines.push(`  <Metoda>${input.metoda}</Metoda>`)

  // Document sections (all optional, 0..unbounded)
  if (input.pz) for (const doc of input.pz) lines.push(generatePZ(doc))
  if (input.pw) for (const doc of input.pw) lines.push(generatePW(doc))
  if (input.wz) for (const doc of input.wz) lines.push(generateWZ(doc))
  if (input.rw) for (const doc of input.rw) lines.push(generateRW(doc))
  if (input.mmwe) for (const doc of input.mmwe) lines.push(generateMMWE(doc))
  if (input.mmwy) for (const doc of input.mmwy) lines.push(generateMMWY(doc))
  if (input.inw) for (const inv of input.inw) lines.push(generateINW(inv))

  lines.push('</JPK>')

  return lines.join('\n')
}

// ── Section generators ──

function generateNaglowek(n: MagNaglowek): string {
  const iso = formatDateTime()

  const lines: string[] = []
  lines.push('  <Naglowek>')
  lines.push(`    <KodFormularza kodSystemowy="${KOD_SYSTEMOWY}" wersjaSchemy="${SCHEMA_VERSION}">JPK_MAG</KodFormularza>`)
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

function generatePodmiot(p: MagPodmiot): string {
  const lines: string[] = []
  lines.push('  <Podmiot1>')
  lines.push('    <IdentyfikatorPodmiotu>')
  lines.push(`      ${tag('etd:NIP', p.nip)}`)
  lines.push(`      ${tag('etd:PelnaNazwa', p.pelnaNazwa)}`)
  if (p.regon) lines.push(`      ${tag('etd:REGON', p.regon)}`)
  lines.push('    </IdentyfikatorPodmiotu>')
  lines.push('    <Adres>')

  if (p.adres.typ === 'polski') {
    const a = p.adres
    lines.push('      <AdresPol>')
    lines.push('        <etd:KodKraju>PL</etd:KodKraju>')
    push(lines, '        ', tag('etd:Wojewodztwo', a.wojewodztwo))
    push(lines, '        ', tag('etd:Powiat', a.powiat))
    push(lines, '        ', tag('etd:Gmina', a.gmina))
    if (a.ulica) push(lines, '        ', tag('etd:Ulica', a.ulica))
    push(lines, '        ', tag('etd:NrDomu', a.nrDomu))
    if (a.nrLokalu) push(lines, '        ', tag('etd:NrLokalu', a.nrLokalu))
    push(lines, '        ', tag('etd:Miejscowosc', a.miejscowosc))
    push(lines, '        ', tag('etd:KodPocztowy', a.kodPocztowy))
    lines.push('      </AdresPol>')
  } else {
    const a = p.adres
    lines.push('      <AdresZagr>')
    push(lines, '        ', tag('etd:KodKraju', a.kodKraju))
    if (a.kodPocztowy) push(lines, '        ', tag('etd:KodPocztowy', a.kodPocztowy))
    push(lines, '        ', tag('etd:Miejscowosc', a.miejscowosc))
    if (a.ulica) push(lines, '        ', tag('etd:Ulica', a.ulica))
    lines.push('      </AdresZagr>')
  }

  lines.push('    </Adres>')
  lines.push('  </Podmiot1>')
  return lines.join('\n')
}

// ── PZ: Przyjęcie z zewnątrz ──

function generatePZ(doc: MagDokument): string {
  const h = doc.header
  const lines: string[] = []
  const ind = '        '

  lines.push('  <PZ>')
  lines.push('    <PZWartosc>')
  push(lines, '      ', tag('NumerPZ', h['NumerPZ'] || ''))
  push(lines, '      ', tag('DataPZ', h['DataPZ'] || ''))
  pushOptAmount(lines, '      ', 'WartoscPZ', h['WartoscPZ'])
  push(lines, '      ', tag('DataOtrzymaniaPZ', h['DataOtrzymaniaPZ'] || ''))
  push(lines, '      ', tag('Dostawca', h['Dostawca'] || ''))
  pushOpt(lines, '      ', 'NumerFaPZ', h['NumerFaPZ'])
  pushOpt(lines, '      ', 'NrKSeFPZ', h['NrKSeFPZ'])
  pushOpt(lines, '      ', 'DataFaPZ', h['DataFaPZ'])

  for (let i = 0; i < doc.wiersze.length; i++) {
    const w = doc.wiersze[i]
    lines.push('      <PZWiersz>')
    push(lines, ind, tag('NrWierszaPZ', String(w['NrWierszaPZ'] || i + 1)))
    pushOpt(lines, ind, 'KodTowaruPZ', w['KodTowaruPZ'])
    push(lines, ind, tag('NazwaTowaruPZ', w['NazwaTowaruPZ'] || ''))
    pushOptQuantity(lines, ind, 'IloscPrzyjetaPZ', w['IloscPrzyjetaPZ'])
    pushOpt(lines, ind, 'JednostkaMiaryPZ', w['JednostkaMiaryPZ'])
    pushOptAmount(lines, ind, 'CenaJednPZ', w['CenaJednPZ'])
    pushOptAmount(lines, ind, 'WartoscPozycjiPZ', w['WartoscPozycjiPZ'])
    lines.push('      </PZWiersz>')
  }

  lines.push('    </PZWartosc>')
  lines.push('  </PZ>')
  return lines.join('\n')
}

// ── PW: Przyjęcie wewnętrzne ──

function generatePW(doc: MagDokument): string {
  const h = doc.header
  const lines: string[] = []
  const ind = '        '

  lines.push('  <PW>')
  lines.push('    <PWWartosc>')
  push(lines, '      ', tag('NumerPW', h['NumerPW'] || ''))
  push(lines, '      ', tag('DataPW', h['DataPW'] || ''))
  pushOptAmount(lines, '      ', 'WartoscPW', h['WartoscPW'])
  push(lines, '      ', tag('DataOtrzymaniaPW', h['DataOtrzymaniaPW'] || ''))
  pushOpt(lines, '      ', 'Wydzial', h['Wydzial'])

  for (let i = 0; i < doc.wiersze.length; i++) {
    const w = doc.wiersze[i]
    lines.push('      <PWWiersz>')
    push(lines, ind, tag('NrWierszaPW', String(w['NrWierszaPW'] || i + 1)))
    pushOpt(lines, ind, 'KodProduktuPW', w['KodProduktuPW'])
    push(lines, ind, tag('NazwaProduktuPW', w['NazwaProduktuPW'] || ''))
    pushOptQuantity(lines, ind, 'IloscPrzyjetaPW', w['IloscPrzyjetaPW'])
    pushOpt(lines, ind, 'JednostkaMiaryPW', w['JednostkaMiaryPW'])
    pushOptAmount(lines, ind, 'CenaJednPW', w['CenaJednPW'])
    pushOptAmount(lines, ind, 'WartoscPozycjiPW', w['WartoscPozycjiPW'])
    lines.push('      </PWWiersz>')
  }

  lines.push('    </PWWartosc>')
  lines.push('  </PW>')
  return lines.join('\n')
}

// ── WZ: Wydanie na zewnątrz ──

function generateWZ(doc: MagDokument): string {
  const h = doc.header
  const lines: string[] = []
  const ind = '        '

  lines.push('  <WZ>')
  lines.push('    <WZWartosc>')
  push(lines, '      ', tag('NumerWZ', h['NumerWZ'] || ''))
  push(lines, '      ', tag('DataWZ', h['DataWZ'] || ''))
  pushOptAmount(lines, '      ', 'WartoscWZ', h['WartoscWZ'])
  push(lines, '      ', tag('DataWydaniaWZ', h['DataWydaniaWZ'] || ''))
  push(lines, '      ', tag('OdbiorcaWZ', h['OdbiorcaWZ'] || ''))
  pushOpt(lines, '      ', 'NumerFaWZ', h['NumerFaWZ'])
  pushOpt(lines, '      ', 'NrKSeFWZ', h['NrKSeFWZ'])
  pushOpt(lines, '      ', 'DataFaWZ', h['DataFaWZ'])

  for (let i = 0; i < doc.wiersze.length; i++) {
    const w = doc.wiersze[i]
    lines.push('      <WZWiersz>')
    push(lines, ind, tag('NrWierszaWZ', String(w['NrWierszaWZ'] || i + 1)))
    pushOpt(lines, ind, 'KodTowaruWZ', w['KodTowaruWZ'])
    push(lines, ind, tag('NazwaTowaruWZ', w['NazwaTowaruWZ'] || ''))
    pushOptQuantity(lines, ind, 'IloscWydanaWZ', w['IloscWydanaWZ'])
    pushOpt(lines, ind, 'JednostkaMiaryWZ', w['JednostkaMiaryWZ'])
    pushOptAmount(lines, ind, 'CenaJednWZ', w['CenaJednWZ'])
    pushOptAmount(lines, ind, 'WartoscPozycjiWZ', w['WartoscPozycjiWZ'])
    lines.push('      </WZWiersz>')
  }

  lines.push('    </WZWartosc>')
  lines.push('  </WZ>')
  return lines.join('\n')
}

// ── RW: Rozchód wewnętrzny ──

function generateRW(doc: MagDokument): string {
  const h = doc.header
  const lines: string[] = []
  const ind = '        '

  lines.push('  <RW>')
  lines.push('    <RWWartosc>')
  push(lines, '      ', tag('NumerRW', h['NumerRW'] || ''))
  push(lines, '      ', tag('DataRW', h['DataRW'] || ''))
  pushOptAmount(lines, '      ', 'WartoscRW', h['WartoscRW'])
  push(lines, '      ', tag('DataWydaniaRW', h['DataWydaniaRW'] || ''))
  pushOpt(lines, '      ', 'NumerFaRW', h['NumerFaRW'])
  pushOpt(lines, '      ', 'NrKSeFRW', h['NrKSeFRW'])
  pushOpt(lines, '      ', 'DataFaRW', h['DataFaRW'])
  pushOpt(lines, '      ', 'DokadRW', h['DokadRW'])

  for (let i = 0; i < doc.wiersze.length; i++) {
    const w = doc.wiersze[i]
    lines.push('      <RWWiersz>')
    push(lines, ind, tag('NrWierszaRW', String(w['NrWierszaRW'] || i + 1)))
    pushOpt(lines, ind, 'KodTowaruRW', w['KodTowaruRW'])
    push(lines, ind, tag('NazwaTowaruRW', w['NazwaTowaruRW'] || ''))
    pushOptQuantity(lines, ind, 'IloscWydanaRW', w['IloscWydanaRW'])
    pushOpt(lines, ind, 'JednostkaMiaryRW', w['JednostkaMiaryRW'])
    pushOptAmount(lines, ind, 'CenaJednRW', w['CenaJednRW'])
    pushOptAmount(lines, ind, 'WartoscPozycjiRW', w['WartoscPozycjiRW'])
    lines.push('      </RWWiersz>')
  }

  lines.push('    </RWWartosc>')
  lines.push('  </RW>')
  return lines.join('\n')
}

// ── MMWE: Przesunięcie międzymagazynowe — wejście ──

function generateMMWE(doc: MagDokument): string {
  const h = doc.header
  const lines: string[] = []
  const ind = '        '

  lines.push('  <MMWE>')
  lines.push('    <MMWEWartosc>')
  push(lines, '      ', tag('NumerMMWE', h['NumerMMWE'] || ''))
  push(lines, '      ', tag('DataMMWE', h['DataMMWE'] || ''))
  pushOptAmount(lines, '      ', 'WartoscMMWE', h['WartoscMMWE'])
  push(lines, '      ', tag('DataPrzyjeciaMMWE', h['DataPrzyjeciaMMWE'] || ''))
  pushOpt(lines, '      ', 'SkadMMWE', h['SkadMMWE'])

  for (let i = 0; i < doc.wiersze.length; i++) {
    const w = doc.wiersze[i]
    lines.push('      <MMWEWiersz>')
    push(lines, ind, tag('NrWierszaMMWE', String(w['NrWierszaMMWE'] || i + 1)))
    pushOpt(lines, ind, 'KodTowaruMMWE', w['KodTowaruMMWE'])
    push(lines, ind, tag('NazwaTowaruMMWE', w['NazwaTowaruMMWE'] || ''))
    pushOptQuantity(lines, ind, 'IloscPrzyjetaMMWE', w['IloscPrzyjetaMMWE'])
    pushOpt(lines, ind, 'JednostkaMiaryMMWE', w['JednostkaMiaryMMWE'])
    pushOptAmount(lines, ind, 'CenaJednMMWE', w['CenaJednMMWE'])
    pushOptAmount(lines, ind, 'WartoscPozycjiMMWE', w['WartoscPozycjiMMWE'])
    lines.push('      </MMWEWiersz>')
  }

  lines.push('    </MMWEWartosc>')
  lines.push('  </MMWE>')
  return lines.join('\n')
}

// ── MMWY: Przesunięcie międzymagazynowe — wyjście ──

function generateMMWY(doc: MagDokument): string {
  const h = doc.header
  const lines: string[] = []
  const ind = '        '

  lines.push('  <MMWY>')
  lines.push('    <MMWYWartosc>')
  push(lines, '      ', tag('NumerMMWY', h['NumerMMWY'] || ''))
  push(lines, '      ', tag('DataMMWY', h['DataMMWY'] || ''))
  pushOptAmount(lines, '      ', 'WartoscMMWY', h['WartoscMMWY'])
  push(lines, '      ', tag('DataWydaniaMMWY', h['DataWydaniaMMWY'] || ''))
  pushOpt(lines, '      ', 'DokadMMWY', h['DokadMMWY'])

  for (let i = 0; i < doc.wiersze.length; i++) {
    const w = doc.wiersze[i]
    lines.push('      <MMWYWiersz>')
    push(lines, ind, tag('NrWierszaMMWY', String(w['NrWierszaMMWY'] || i + 1)))
    pushOpt(lines, ind, 'KodTowaruMMWY', w['KodTowaruMMWY'])
    push(lines, ind, tag('NazwaTowaruMMWY', w['NazwaTowaruMMWY'] || ''))
    pushOptQuantity(lines, ind, 'IloscWydanaMMWY', w['IloscWydanaMMWY'])
    pushOpt(lines, ind, 'JednostkaMiaryMMWY', w['JednostkaMiaryMMWY'])
    pushOptAmount(lines, ind, 'CenaJednMMWY', w['CenaJednMMWY'])
    pushOptAmount(lines, ind, 'WartoscPozycjiMMWY', w['WartoscPozycjiMMWY'])
    lines.push('      </MMWYWiersz>')
  }

  lines.push('    </MMWYWartosc>')
  lines.push('  </MMWY>')
  return lines.join('\n')
}

// ── INW: Inwentaryzacja ──

function generateINW(inv: MagInwentaryzacja): string {
  const lines: string[] = []

  lines.push('  <INW>')
  lines.push('    <Termin>')
  push(lines, '      ', tag('DataInwentaryzacji', inv.dataInwentaryzacji))
  push(lines, '      ', tag('DataCzasOd', inv.dataCzasOd))
  push(lines, '      ', tag('DataCzasDo', inv.dataCzasDo))
  lines.push('    </Termin>')

  if (inv.tabela1 && inv.tabela1.length > 0) {
    lines.push('    <Tabela1>')
    for (const w of inv.tabela1) {
      lines.push('      <Wiersz>')
      push(lines, '        ', tag('Lp', w['Lp'] || ''))
      pushOpt(lines, '        ', 'Indeks', w['Indeks'])
      push(lines, '        ', tag('Nazwa', w['Nazwa'] || ''))
      push(lines, '        ', tag('Jednostka', w['Jednostka'] || ''))
      push(lines, '        ', quantityTag('Ilosc', w['Ilosc']))
      pushOptAmount(lines, '        ', 'Cena', w['Cena'])
      pushOptAmount(lines, '        ', 'Wartosc', w['Wartosc'])
      pushOpt(lines, '        ', 'Uwagi', w['Uwagi'])
      lines.push('      </Wiersz>')
    }
    lines.push('    </Tabela1>')
  }

  if (inv.tabela2 && inv.tabela2.length > 0) {
    lines.push('    <Tabela2>')
    for (const w of inv.tabela2) {
      lines.push('      <Wiersz>')
      push(lines, '        ', tag('Lp', w['Lp'] || ''))
      pushOpt(lines, '        ', 'Indeks', w['Indeks'])
      push(lines, '        ', tag('Nazwa', w['Nazwa'] || ''))
      push(lines, '        ', tag('Jednostka', w['Jednostka'] || ''))
      push(lines, '        ', quantityTag('Ilosc1', w['Ilosc1']))
      push(lines, '        ', quantityTag('Ilosc2', w['Ilosc2']))
      pushOptAmount(lines, '        ', 'Cena1', w['Cena1'])
      pushOptAmount(lines, '        ', 'Cena2', w['Cena2'])
      pushOptAmount(lines, '        ', 'Wartosc1', w['Wartosc1'])
      pushOptAmount(lines, '        ', 'Wartosc2', w['Wartosc2'])
      pushOpt(lines, '        ', 'Uwagi', w['Uwagi'])
      lines.push('      </Wiersz>')
    }
    lines.push('    </Tabela2>')
  }

  lines.push('  </INW>')
  return lines.join('\n')
}

// ── XmlGenerator implementation ──

export const jpkMagGenerator: XmlGenerator = {
  jpkType: 'JPK_MAG',
  version: WARIANT,
  namespace: MAG_NAMESPACE,
  generate: (input: unknown) => generateJpkMag(input as MagGeneratorInput),
}

generatorRegistry.register(jpkMagGenerator)

// Re-export shared helpers from engine
export { escapeXml, formatAmount, formatQuantity }
