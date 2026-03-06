import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateJpkKr,
  KR_NAMESPACE,
  KR_ETD_NAMESPACE,
  KR_KCK_NAMESPACE,
  type KrGeneratorInput,
  type KrZOiSEntry,
  type KrDziennik,
  type KrKontoZapis,
} from '../../../src/core/generators/JpkKrGenerator'

function makeZOiS(overrides: Partial<KrZOiSEntry> = {}): KrZOiSEntry {
  return {
    kodKonta: '100-001',
    opisKonta: 'Kasa główna',
    typKonta: 'bilansowe',
    kodZespolu: '1',
    opisZespolu: 'Środki pieniężne',
    kodKategorii: '10',
    opisKategorii: 'Kasa',
    bilansOtwarciaWinien: 5000,
    bilansOtwarciaMa: 0,
    obrotyWinien: 12000,
    obrotyMa: 8000,
    obrotyWinienNarast: 50000,
    obrotyMaNarast: 45000,
    saldoWinien: 9000,
    saldoMa: 0,
    ...overrides,
  }
}

function makeDziennik(overrides: Partial<KrDziennik> = {}): KrDziennik {
  return {
    lpZapisuDziennika: 1,
    nrZapisuDziennika: 'DZ/001/2025',
    opisDziennika: 'Dziennik główny',
    nrDowoduKsiegowego: 'FV/001/2025',
    rodzajDowodu: 'Faktura',
    dataOperacji: '2025-03-01',
    dataDowodu: '2025-03-01',
    dataKsiegowania: '2025-03-02',
    kodOperatora: 'ADMIN',
    opisOperacji: 'Sprzedaż usługi',
    dziennikKwotaOperacji: 1230,
    ...overrides,
  }
}

function makeKontoZapis(overrides: Partial<KrKontoZapis> = {}): KrKontoZapis {
  return {
    lpZapisu: 1,
    nrZapisu: 'DZ/001/2025',
    kodKontaWinien: '201-001',
    kwotaWinien: 1230,
    kodKontaMa: 'null',
    kwotaMa: 0,
    ...overrides,
  }
}

function makeInput(overrides: Partial<KrGeneratorInput> = {}): KrGeneratorInput {
  return {
    naglowek: {
      dataOd: '2025-03-01',
      dataDo: '2025-03-31',
      kodUrzedu: '1471',
    },
    podmiot: {
      nip: '1234567890',
      pelnaNazwa: 'Test Sp. z o.o.',
      adres: {
        kodKraju: 'PL',
        nrDomu: '10',
        miejscowosc: 'Warszawa',
        kodPocztowy: '00-001',
      },
    },
    zpisSald: [makeZOiS()],
    dziennik: [makeDziennik()],
    kontoZapisy: [makeKontoZapis()],
    ...overrides,
  }
}

describe('JpkKrGenerator', () => {
  let xml: string

  beforeEach(() => {
    xml = generateJpkKr(makeInput())
  })

  // ── XML declaration & root ──

  it('starts with XML declaration', () => {
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  })

  it('contains JPK root with correct namespaces', () => {
    expect(xml).toContain(`xmlns="${KR_NAMESPACE}"`)
    expect(xml).toContain(`xmlns:etd="${KR_ETD_NAMESPACE}"`)
    expect(xml).toContain(`xmlns:kck="${KR_KCK_NAMESPACE}"`)
  })

  // ── Naglowek ──

  it('generates KodFormularza with correct attributes', () => {
    expect(xml).toContain('kodSystemowy="JPK_KR (1)"')
    expect(xml).toContain('wersjaSchemy="1-0"')
    expect(xml).toContain('>JPK_KR</KodFormularza>')
  })

  it('generates WariantFormularza = 1', () => {
    expect(xml).toContain('<WariantFormularza>1</WariantFormularza>')
  })

  it('generates CelZlozenia = 1', () => {
    expect(xml).toContain('<CelZlozenia>1</CelZlozenia>')
  })

  it('generates DataWytworzeniaJPK as ISO datetime', () => {
    expect(xml).toMatch(/<DataWytworzeniaJPK>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?<\/DataWytworzeniaJPK>/)
  })

  it('generates period dates', () => {
    expect(xml).toContain('<DataOd>2025-03-01</DataOd>')
    expect(xml).toContain('<DataDo>2025-03-31</DataDo>')
  })

  it('defaults DomyslnyKodWaluty to PLN', () => {
    expect(xml).toContain('<DomyslnyKodWaluty>PLN</DomyslnyKodWaluty>')
  })

  it('uses custom DomyslnyKodWaluty', () => {
    const input = makeInput()
    input.naglowek.domyslnyKodWaluty = 'EUR'
    const result = generateJpkKr(input)
    expect(result).toContain('<DomyslnyKodWaluty>EUR</DomyslnyKodWaluty>')
  })

  it('generates KodUrzedu', () => {
    expect(xml).toContain('<KodUrzedu>1471</KodUrzedu>')
  })

  // ── Podmiot1 ──

  it('generates Podmiot1 with NIP and PelnaNazwa', () => {
    expect(xml).toContain('<etd:NIP>1234567890</etd:NIP>')
    expect(xml).toContain('<etd:PelnaNazwa>Test Sp. z o.o.</etd:PelnaNazwa>')
  })

  it('includes optional REGON when provided', () => {
    const input = makeInput()
    input.podmiot.regon = '123456789'
    const result = generateJpkKr(input)
    expect(result).toContain('<etd:REGON>123456789</etd:REGON>')
  })

  it('omits REGON when not provided', () => {
    expect(xml).not.toContain('<etd:REGON>')
  })

  it('generates AdresPodmiotu with address fields', () => {
    expect(xml).toContain('<etd:KodKraju>PL</etd:KodKraju>')
    expect(xml).toContain('<etd:NrDomu>10</etd:NrDomu>')
    expect(xml).toContain('<etd:Miejscowosc>Warszawa</etd:Miejscowosc>')
    expect(xml).toContain('<etd:KodPocztowy>00-001</etd:KodPocztowy>')
  })

  it('includes optional address fields when provided', () => {
    const input = makeInput()
    input.podmiot.adres.wojewodztwo = 'mazowieckie'
    input.podmiot.adres.ulica = 'Marszałkowska'
    input.podmiot.adres.nrLokalu = '3'
    const result = generateJpkKr(input)
    expect(result).toContain('<etd:Wojewodztwo>mazowieckie</etd:Wojewodztwo>')
    expect(result).toContain('<etd:Ulica>Marszałkowska</etd:Ulica>')
    expect(result).toContain('<etd:NrLokalu>3</etd:NrLokalu>')
  })

  // ── ZOiS ──

  it('generates ZOiS with typ="G" attribute', () => {
    expect(xml).toContain('<ZOiS typ="G">')
  })

  it('generates required ZOiS fields', () => {
    expect(xml).toContain('<KodKonta>100-001</KodKonta>')
    expect(xml).toContain('<OpisKonta>Kasa główna</OpisKonta>')
    expect(xml).toContain('<TypKonta>bilansowe</TypKonta>')
    expect(xml).toContain('<KodZespolu>1</KodZespolu>')
    expect(xml).toContain('<OpisZespolu>Środki pieniężne</OpisZespolu>')
    expect(xml).toContain('<KodKategorii>10</KodKategorii>')
    expect(xml).toContain('<OpisKategorii>Kasa</OpisKategorii>')
  })

  it('generates ZOiS balance amounts', () => {
    expect(xml).toContain('<BilansOtwarciaWinien>5000.00</BilansOtwarciaWinien>')
    expect(xml).toContain('<BilansOtwarciaMa>0.00</BilansOtwarciaMa>')
    expect(xml).toContain('<ObrotyWinien>12000.00</ObrotyWinien>')
    expect(xml).toContain('<ObrotyMa>8000.00</ObrotyMa>')
    expect(xml).toContain('<ObrotyWinienNarast>50000.00</ObrotyWinienNarast>')
    expect(xml).toContain('<ObrotyMaNarast>45000.00</ObrotyMaNarast>')
    expect(xml).toContain('<SaldoWinien>9000.00</SaldoWinien>')
    expect(xml).toContain('<SaldoMa>0.00</SaldoMa>')
  })

  it('includes optional KodPodkategorii and OpisPodkategorii', () => {
    const input = makeInput({
      zpisSald: [makeZOiS({
        kodPodkategorii: '100',
        opisPodkategorii: 'Kasa PLN',
      })],
    })
    const result = generateJpkKr(input)
    expect(result).toContain('<KodPodkategorii>100</KodPodkategorii>')
    expect(result).toContain('<OpisPodkategorii>Kasa PLN</OpisPodkategorii>')
  })

  it('omits optional ZOiS sub-category when not provided', () => {
    expect(xml).not.toContain('<KodPodkategorii>')
    expect(xml).not.toContain('<OpisPodkategorii>')
  })

  // ── Dziennik ──

  it('generates Dziennik with typ="G" attribute', () => {
    expect(xml).toContain('<Dziennik typ="G">')
  })

  it('generates all Dziennik fields', () => {
    expect(xml).toContain('<LpZapisuDziennika>1</LpZapisuDziennika>')
    expect(xml).toContain('<NrZapisuDziennika>DZ/001/2025</NrZapisuDziennika>')
    expect(xml).toContain('<OpisDziennika>Dziennik główny</OpisDziennika>')
    expect(xml).toContain('<NrDowoduKsiegowego>FV/001/2025</NrDowoduKsiegowego>')
    expect(xml).toContain('<RodzajDowodu>Faktura</RodzajDowodu>')
    expect(xml).toContain('<DataOperacji>2025-03-01</DataOperacji>')
    expect(xml).toContain('<DataDowodu>2025-03-01</DataDowodu>')
    expect(xml).toContain('<DataKsiegowania>2025-03-02</DataKsiegowania>')
    expect(xml).toContain('<KodOperatora>ADMIN</KodOperatora>')
    expect(xml).toContain('<OpisOperacji>Sprzedaż usługi</OpisOperacji>')
    expect(xml).toContain('<DziennikKwotaOperacji>1230.00</DziennikKwotaOperacji>')
  })

  // ── DziennikCtrl ──

  it('generates DziennikCtrl with count', () => {
    expect(xml).toContain('<LiczbaWierszyDziennika>1</LiczbaWierszyDziennika>')
  })

  it('generates DziennikCtrl with sum of DziennikKwotaOperacji', () => {
    expect(xml).toContain('<SumaKwotOperacji>1230.00</SumaKwotOperacji>')
  })

  it('sums DziennikKwotaOperacji across multiple entries', () => {
    const input = makeInput({
      dziennik: [
        makeDziennik({ dziennikKwotaOperacji: 1000 }),
        makeDziennik({ dziennikKwotaOperacji: 2500.50 }),
      ],
    })
    const result = generateJpkKr(input)
    expect(result).toContain('<LiczbaWierszyDziennika>2</LiczbaWierszyDziennika>')
    expect(result).toContain('<SumaKwotOperacji>3500.50</SumaKwotOperacji>')
  })

  // ── KontoZapis ──

  it('generates KontoZapis with typ="G" attribute', () => {
    expect(xml).toContain('<KontoZapis typ="G">')
  })

  it('generates both debit and credit sides (not choice)', () => {
    expect(xml).toContain('<KodKontaWinien>201-001</KodKontaWinien>')
    expect(xml).toContain('<KwotaWinien>1230.00</KwotaWinien>')
    expect(xml).toContain('<KodKontaMa>null</KodKontaMa>')
    expect(xml).toContain('<KwotaMa>0.00</KwotaMa>')
  })

  it('defaults KodKontaWinien and KodKontaMa to "null"', () => {
    const input = makeInput({
      kontoZapisy: [makeKontoZapis({ kodKontaWinien: '', kodKontaMa: '' })],
    })
    const result = generateJpkKr(input)
    expect(result).toContain('<KodKontaWinien>null</KodKontaWinien>')
    expect(result).toContain('<KodKontaMa>null</KodKontaMa>')
  })

  it('includes optional foreign currency debit fields', () => {
    const input = makeInput({
      kontoZapisy: [makeKontoZapis({
        kwotaWinienWaluta: 300,
        kodWalutyWinien: 'EUR',
        opisZapisuWinien: 'Wpłata w EUR',
      })],
    })
    const result = generateJpkKr(input)
    expect(result).toContain('<KwotaWinienWaluta>300.00</KwotaWinienWaluta>')
    expect(result).toContain('<KodWalutyWinien>EUR</KodWalutyWinien>')
    expect(result).toContain('<OpisZapisuWinien>Wpłata w EUR</OpisZapisuWinien>')
  })

  it('includes optional foreign currency credit fields', () => {
    const input = makeInput({
      kontoZapisy: [makeKontoZapis({
        kwotaMaWaluta: 500,
        kodWalutyMa: 'USD',
        opisZapisuMa: 'Wypłata w USD',
      })],
    })
    const result = generateJpkKr(input)
    expect(result).toContain('<KwotaMaWaluta>500.00</KwotaMaWaluta>')
    expect(result).toContain('<KodWalutyMa>USD</KodWalutyMa>')
    expect(result).toContain('<OpisZapisuMa>Wypłata w USD</OpisZapisuMa>')
  })

  it('omits optional currency fields when not provided', () => {
    expect(xml).not.toContain('<KwotaWinienWaluta>')
    expect(xml).not.toContain('<KodWalutyWinien>')
    expect(xml).not.toContain('<OpisZapisuWinien>')
    expect(xml).not.toContain('<KwotaMaWaluta>')
    expect(xml).not.toContain('<KodWalutyMa>')
    expect(xml).not.toContain('<OpisZapisuMa>')
  })

  // ── KontoZapisCtrl ──

  it('generates KontoZapisCtrl with official typo field name', () => {
    // XSD has "LiczbaWierszyKontoZapisj" (not "Zapisow") — official typo
    expect(xml).toContain('<LiczbaWierszyKontoZapisj>1</LiczbaWierszyKontoZapisj>')
  })

  it('generates SumaWinien and SumaMa', () => {
    expect(xml).toContain('<SumaWinien>1230.00</SumaWinien>')
    expect(xml).toContain('<SumaMa>0.00</SumaMa>')
  })

  it('sums debit and credit across multiple KontoZapis entries', () => {
    const input = makeInput({
      kontoZapisy: [
        makeKontoZapis({ kwotaWinien: 1000, kwotaMa: 0 }),
        makeKontoZapis({ kwotaWinien: 0, kwotaMa: 1000 }),
        makeKontoZapis({ kwotaWinien: 500, kwotaMa: 500 }),
      ],
    })
    const result = generateJpkKr(input)
    expect(result).toContain('<LiczbaWierszyKontoZapisj>3</LiczbaWierszyKontoZapisj>')
    expect(result).toContain('<SumaWinien>1500.00</SumaWinien>')
    expect(result).toContain('<SumaMa>1500.00</SumaMa>')
  })

  // ── XML escaping ──

  it('escapes XML special characters in text fields', () => {
    const input = makeInput({
      zpisSald: [makeZOiS({ opisKonta: 'Kasa "główna" & rezerwowa' })],
    })
    const result = generateJpkKr(input)
    expect(result).toContain('&quot;główna&quot;')
    expect(result).toContain('&amp;')
  })

  // ── Structure order ──

  it('maintains correct section order in output', () => {
    const naglIdx = xml.indexOf('<Naglowek>')
    const podmiotIdx = xml.indexOf('<Podmiot1>')
    const zoisIdx = xml.indexOf('<ZOiS ')
    const dziennikIdx = xml.indexOf('<Dziennik ')
    const dziennikCtrlIdx = xml.indexOf('<DziennikCtrl>')
    const kontoZapisIdx = xml.indexOf('<KontoZapis ')
    const kontoZapisCtrlIdx = xml.indexOf('<KontoZapisCtrl>')

    expect(naglIdx).toBeLessThan(podmiotIdx)
    expect(podmiotIdx).toBeLessThan(zoisIdx)
    expect(zoisIdx).toBeLessThan(dziennikIdx)
    expect(dziennikIdx).toBeLessThan(dziennikCtrlIdx)
    expect(dziennikCtrlIdx).toBeLessThan(kontoZapisIdx)
    expect(kontoZapisIdx).toBeLessThan(kontoZapisCtrlIdx)
  })

  // ── String amounts ──

  it('handles string amounts correctly', () => {
    const input = makeInput({
      dziennik: [makeDziennik({ dziennikKwotaOperacji: '2500.75' })],
    })
    const result = generateJpkKr(input)
    expect(result).toContain('<DziennikKwotaOperacji>2500.75</DziennikKwotaOperacji>')
  })

  // ── Multiple ZOiS entries ──

  it('generates multiple ZOiS entries', () => {
    const input = makeInput({
      zpisSald: [
        makeZOiS({ kodKonta: '100-001' }),
        makeZOiS({ kodKonta: '200-001' }),
        makeZOiS({ kodKonta: '700-001' }),
      ],
    })
    const result = generateJpkKr(input)
    expect(result).toContain('<KodKonta>100-001</KodKonta>')
    expect(result).toContain('<KodKonta>200-001</KodKonta>')
    expect(result).toContain('<KodKonta>700-001</KodKonta>')
  })

  // ── Registry ──

  it('registers in generator registry', async () => {
    const { generatorRegistry } = await import('../../../src/core/generators/XmlGeneratorEngine')
    const gen = generatorRegistry.get('JPK_KR')
    expect(gen).toBeDefined()
    expect(gen!.jpkType).toBe('JPK_KR')
    expect(gen!.version).toBe('1')
    expect(gen!.namespace).toBe(KR_NAMESPACE)
  })
})
