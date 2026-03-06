import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateJpkFaRr,
  FA_RR_NAMESPACE,
  FA_RR_ETD_NAMESPACE,
  FA_RR_KCK_NAMESPACE,
  type FaRrGeneratorInput,
  type FaRrFaktura,
  type FaRrWiersz,
  type FaRrOswiadczenie,
  type FaRrPodpis,
} from '../../../src/core/generators/JpkFaRrGenerator'

function makePodpis(prefix = 'TEST'): FaRrPodpis {
  return {
    numerSeryjny: '123456789',
    wystawca: `${prefix} CA`,
    posiadacz: `${prefix} Jan Kowalski`,
  }
}

function makeFaktura(overrides: Partial<FaRrFaktura> = {}): FaRrFaktura {
  return {
    p1a: 'Jan Rolnik',
    p1b: 'ul. Polna 1, 00-001 Wieś',
    p1c: 'Firma ABC Sp. z o.o.',
    p1d: 'ul. Miejska 10, 00-100 Warszawa',
    p2a: '12345678901',
    p2b: '1234567890',
    p3a: makePodpis('DOSTAWCA'),
    p3b: makePodpis('NABYWCA'),
    p4a: '2025-03-01',
    p4b: '2025-03-05',
    p4c1: 'RR/001/2025',
    p11_1: 10000,
    p11_2: 700,
    p12_1: 10700,
    p12_2: 'dziesięć tysięcy siedemset złotych',
    p116_3: true,
    rodzajFaktury: 'VAT_RR',
    ...overrides,
  }
}

function makeWiersz(overrides: Partial<FaRrWiersz> = {}): FaRrWiersz {
  return {
    p4c2: 'RR/001/2025',
    p5: 'Pszenica ozima',
    p6a: 'kg',
    p6b: 5000,
    p6c: 'klasa A',
    p7: 2,
    p8: 10000,
    p9: 7,
    p10: 700,
    ...overrides,
  }
}

function makeInput(overrides: Partial<FaRrGeneratorInput> = {}): FaRrGeneratorInput {
  return {
    naglowek: {
      dataOd: '2025-03-01',
      dataDo: '2025-03-31',
      kodUrzedu: '1471',
    },
    podmiot: {
      nip: '1234567890',
      pelnaNazwa: 'Firma ABC Sp. z o.o.',
      adres: {
        typ: 'polski',
        wojewodztwo: 'mazowieckie',
        powiat: 'Warszawa',
        gmina: 'Warszawa',
        nrDomu: '10',
        miejscowosc: 'Warszawa',
        kodPocztowy: '00-100',
      },
    },
    faktury: [makeFaktura()],
    wiersze: [makeWiersz()],
    ...overrides,
  }
}

describe('JpkFaRrGenerator', () => {
  let xml: string

  beforeEach(() => {
    xml = generateJpkFaRr(makeInput())
  })

  // ── XML declaration & root ──

  it('starts with XML declaration', () => {
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  })

  it('contains JPK root with correct namespaces', () => {
    expect(xml).toContain(`xmlns="${FA_RR_NAMESPACE}"`)
    expect(xml).toContain(`xmlns:etd="${FA_RR_ETD_NAMESPACE}"`)
    expect(xml).toContain(`xmlns:kck="${FA_RR_KCK_NAMESPACE}"`)
  })

  // ── Naglowek ──

  it('generates KodFormularza with correct attributes', () => {
    expect(xml).toContain('kodSystemowy="JPK_FA_RR (1)"')
    expect(xml).toContain('wersjaSchemy="1-0"')
    expect(xml).toContain('>JPK_FA_RR</KodFormularza>')
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

  it('uses custom DomyslnyKodWaluty when specified', () => {
    const input = makeInput()
    input.naglowek.domyslnyKodWaluty = 'EUR'
    const result = generateJpkFaRr(input)
    expect(result).toContain('<DomyslnyKodWaluty>EUR</DomyslnyKodWaluty>')
  })

  it('generates KodUrzedu', () => {
    expect(xml).toContain('<KodUrzedu>1471</KodUrzedu>')
  })

  // ── Podmiot1 ──

  it('generates Podmiot1 with NIP', () => {
    expect(xml).toContain('<etd:NIP>1234567890</etd:NIP>')
  })

  it('generates Podmiot1 with PelnaNazwa', () => {
    expect(xml).toContain('<etd:PelnaNazwa>Firma ABC Sp. z o.o.</etd:PelnaNazwa>')
  })

  it('generates AdresPodmiotu with Polish address', () => {
    expect(xml).toContain('<etd:KodKraju>PL</etd:KodKraju>')
    expect(xml).toContain('<etd:Wojewodztwo>mazowieckie</etd:Wojewodztwo>')
    expect(xml).toContain('<etd:Powiat>Warszawa</etd:Powiat>')
    expect(xml).toContain('<etd:Gmina>Warszawa</etd:Gmina>')
    expect(xml).toContain('<etd:NrDomu>10</etd:NrDomu>')
    expect(xml).toContain('<etd:Miejscowosc>Warszawa</etd:Miejscowosc>')
    expect(xml).toContain('<etd:KodPocztowy>00-100</etd:KodPocztowy>')
  })

  it('includes optional Ulica and NrLokalu when present', () => {
    const input = makeInput()
    input.podmiot.adres.ulica = 'Miejska'
    input.podmiot.adres.nrLokalu = '5A'
    const result = generateJpkFaRr(input)
    expect(result).toContain('<etd:Ulica>Miejska</etd:Ulica>')
    expect(result).toContain('<etd:NrLokalu>5A</etd:NrLokalu>')
  })

  // ── FakturaRR ──

  it('generates FakturaRR with typ="G" attribute', () => {
    expect(xml).toContain('<FakturaRR typ="G">')
  })

  it('generates supplier fields P_1A, P_1B', () => {
    expect(xml).toContain('<P_1A>Jan Rolnik</P_1A>')
    expect(xml).toContain('<P_1B>ul. Polna 1, 00-001 Wieś</P_1B>')
  })

  it('generates buyer fields P_1C, P_1D', () => {
    expect(xml).toContain('<P_1C>Firma ABC Sp. z o.o.</P_1C>')
    expect(xml).toContain('<P_1D>ul. Miejska 10, 00-100 Warszawa</P_1D>')
  })

  it('generates tax IDs P_2A and P_2B', () => {
    expect(xml).toContain('<P_2A>12345678901</P_2A>')
    expect(xml).toContain('<P_2B>1234567890</P_2B>')
  })

  it('generates TPodpis structure for P_3A', () => {
    expect(xml).toContain('<P_3A>')
    expect(xml).toContain('<NumerSeryjny>123456789</NumerSeryjny>')
    expect(xml).toContain('<Wystawca>DOSTAWCA CA</Wystawca>')
    expect(xml).toContain('<Posiadacz>DOSTAWCA Jan Kowalski</Posiadacz>')
    expect(xml).toContain('</P_3A>')
  })

  it('generates TPodpis structure for P_3B', () => {
    expect(xml).toContain('<P_3B>')
    expect(xml).toContain('<Wystawca>NABYWCA CA</Wystawca>')
    expect(xml).toContain('</P_3B>')
  })

  it('generates dates P_4A, P_4B', () => {
    expect(xml).toContain('<P_4A>2025-03-01</P_4A>')
    expect(xml).toContain('<P_4B>2025-03-05</P_4B>')
  })

  it('generates invoice number P_4C1', () => {
    expect(xml).toContain('<P_4C1>RR/001/2025</P_4C1>')
  })

  it('generates amounts P_11_1, P_11_2, P_12_1 with 2 decimal places', () => {
    expect(xml).toContain('<P_11_1>10000.00</P_11_1>')
    expect(xml).toContain('<P_11_2>700.00</P_11_2>')
    expect(xml).toContain('<P_12_1>10700.00</P_12_1>')
  })

  it('generates P_12_2 (amount in words)', () => {
    expect(xml).toContain('<P_12_2>dziesięć tysięcy siedemset złotych</P_12_2>')
  })

  it('generates P_116_3 as boolean true', () => {
    expect(xml).toContain('<P_116_3>true</P_116_3>')
  })

  it('generates P_116_3 as boolean false', () => {
    const input = makeInput({ faktury: [makeFaktura({ p116_3: false })] })
    const result = generateJpkFaRr(input)
    expect(result).toContain('<P_116_3>false</P_116_3>')
  })

  it('generates RodzajFaktury', () => {
    expect(xml).toContain('<RodzajFaktury>VAT_RR</RodzajFaktury>')
  })

  it('generates KOREKTA_RR with correction fields', () => {
    const input = makeInput({
      faktury: [makeFaktura({
        rodzajFaktury: 'KOREKTA_RR',
        przyczynaKorekty: 'Zmiana ilości',
        nrFaKorygowanej: 'RR/000/2025',
        okresFaKorygowanej: '2025-02',
      })],
    })
    const result = generateJpkFaRr(input)
    expect(result).toContain('<RodzajFaktury>KOREKTA_RR</RodzajFaktury>')
    expect(result).toContain('<PrzyczynaKorekty>Zmiana ilości</PrzyczynaKorekty>')
    expect(result).toContain('<NrFaKorygowanej>RR/000/2025</NrFaKorygowanej>')
    expect(result).toContain('<OkresFaKorygowanej>2025-02</OkresFaKorygowanej>')
  })

  it('omits correction fields when not a correction', () => {
    expect(xml).not.toContain('<PrzyczynaKorekty>')
    expect(xml).not.toContain('<NrFaKorygowanej>')
  })

  it('generates optional Dokument field', () => {
    const input = makeInput({
      faktury: [makeFaktura({ dokument: 'WB/2025/001' })],
    })
    const result = generateJpkFaRr(input)
    expect(result).toContain('<Dokument>WB/2025/001</Dokument>')
  })

  it('omits Dokument when not provided', () => {
    expect(xml).not.toContain('<Dokument>')
  })

  // ── FakturaRRCtrl ──

  it('generates FakturaRRCtrl with correct count', () => {
    expect(xml).toContain('<LiczbaFakturRR>1</LiczbaFakturRR>')
  })

  it('generates FakturaRRCtrl with sum of P_12_1', () => {
    expect(xml).toContain('<WartoscFakturRR>10700.00</WartoscFakturRR>')
  })

  it('sums P_12_1 across multiple invoices', () => {
    const input = makeInput({
      faktury: [
        makeFaktura({ p12_1: 5000 }),
        makeFaktura({ p12_1: 3000 }),
      ],
    })
    const result = generateJpkFaRr(input)
    expect(result).toContain('<LiczbaFakturRR>2</LiczbaFakturRR>')
    expect(result).toContain('<WartoscFakturRR>8000.00</WartoscFakturRR>')
  })

  // ── FakturaRRWiersz ──

  it('generates FakturaRRWiersz with typ="G"', () => {
    expect(xml).toContain('<FakturaRRWiersz typ="G">')
  })

  it('generates row reference P_4C2', () => {
    expect(xml).toContain('<P_4C2>RR/001/2025</P_4C2>')
  })

  it('generates product name P_5', () => {
    expect(xml).toContain('<P_5>Pszenica ozima</P_5>')
  })

  it('generates unit P_6A and quality P_6C', () => {
    expect(xml).toContain('<P_6A>kg</P_6A>')
    expect(xml).toContain('<P_6C>klasa A</P_6C>')
  })

  it('generates quantity P_6B as numeric', () => {
    expect(xml).toContain('<P_6B>5000</P_6B>')
  })

  it('generates amounts P_7, P_8, P_10', () => {
    expect(xml).toContain('<P_7>2.00</P_7>')
    expect(xml).toContain('<P_8>10000.00</P_8>')
    expect(xml).toContain('<P_10>700.00</P_10>')
  })

  it('generates VAT rate P_9', () => {
    expect(xml).toContain('<P_9>7</P_9>')
  })

  // ── FakturaRRWierszCtrl ──

  it('generates FakturaRRWierszCtrl with count', () => {
    expect(xml).toContain('<LiczbaWierszyFakturRR>1</LiczbaWierszyFakturRR>')
  })

  it('generates FakturaRRWierszCtrl with sum of P_8', () => {
    expect(xml).toContain('<WartoscWierszyFakturRR>10000.00</WartoscWierszyFakturRR>')
  })

  it('sums P_8 across multiple rows', () => {
    const input = makeInput({
      wiersze: [
        makeWiersz({ p8: 6000 }),
        makeWiersz({ p8: 4000 }),
      ],
    })
    const result = generateJpkFaRr(input)
    expect(result).toContain('<LiczbaWierszyFakturRR>2</LiczbaWierszyFakturRR>')
    expect(result).toContain('<WartoscWierszyFakturRR>10000.00</WartoscWierszyFakturRR>')
  })

  // ── Oswiadczenie (optional section) ──

  it('omits Oswiadczenie section when not provided', () => {
    expect(xml).not.toContain('<Oswiadczenie>')
    expect(xml).not.toContain('<OswiadczenieCtrl>')
  })

  it('generates Oswiadczenie section when provided', () => {
    const osw: FaRrOswiadczenie = {
      p1a2: 'Jan Rolnik',
      p1b2: 'ul. Polna 1',
      p1c2: 'Firma ABC',
      p1d2: 'ul. Miejska 10',
      p2a2: '12345678901',
      p2b2: '1234567890',
      p116_4_1: '2025-01-15',
      p116_4_2: 'Dostawa pszenicy',
      p116_4_3: '2025-01-15',
      p3a2: makePodpis('OSW'),
    }
    const input = makeInput({ oswiadczenia: [osw] })
    const result = generateJpkFaRr(input)

    expect(result).toContain('<Oswiadczenie>')
    expect(result).toContain('<P_1A2>Jan Rolnik</P_1A2>')
    expect(result).toContain('<P_116_4_1>2025-01-15</P_116_4_1>')
    expect(result).toContain('<P_116_4_2>Dostawa pszenicy</P_116_4_2>')
    expect(result).toContain('<P_3A2>')
    expect(result).toContain('<Wystawca>OSW CA</Wystawca>')
    expect(result).toContain('</P_3A2>')
    expect(result).toContain('</Oswiadczenie>')
  })

  it('generates OswiadczenieCtrl with count', () => {
    const osw: FaRrOswiadczenie = {
      p1a2: 'A', p1b2: 'B', p1c2: 'C', p1d2: 'D',
      p2a2: '11111111111', p2b2: '2222222222',
      p116_4_1: '2025-01-01', p116_4_2: 'test', p116_4_3: '2025-01-01',
      p3a2: makePodpis(),
    }
    const input = makeInput({ oswiadczenia: [osw, osw] })
    const result = generateJpkFaRr(input)

    expect(result).toContain('<LiczbaOswiadczen>2</LiczbaOswiadczen>')
  })

  // ── XML escaping ──

  it('escapes XML special characters', () => {
    const input = makeInput({
      faktury: [makeFaktura({ p1a: 'Firma "A&B" <test>' })],
    })
    const result = generateJpkFaRr(input)
    expect(result).toContain('&amp;')
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
    expect(result).toContain('&quot;')
  })

  // ── String amounts ──

  it('handles string amounts correctly', () => {
    const input = makeInput({
      faktury: [makeFaktura({ p12_1: '15000.50' })],
    })
    const result = generateJpkFaRr(input)
    expect(result).toContain('<P_12_1>15000.50</P_12_1>')
  })

  // ── Structure order ──

  it('maintains correct section order in output', () => {
    const naglIdx = xml.indexOf('<Naglowek>')
    const podmiotIdx = xml.indexOf('<Podmiot1>')
    const fakturaIdx = xml.indexOf('<FakturaRR ')
    const fakturaCtrlIdx = xml.indexOf('<FakturaRRCtrl>')
    const wierszIdx = xml.indexOf('<FakturaRRWiersz ')
    const wierszCtrlIdx = xml.indexOf('<FakturaRRWierszCtrl>')

    expect(naglIdx).toBeLessThan(podmiotIdx)
    expect(podmiotIdx).toBeLessThan(fakturaIdx)
    expect(fakturaIdx).toBeLessThan(fakturaCtrlIdx)
    expect(fakturaCtrlIdx).toBeLessThan(wierszIdx)
    expect(wierszIdx).toBeLessThan(wierszCtrlIdx)
  })

  it('places Oswiadczenie after FakturaRRWierszCtrl', () => {
    const osw: FaRrOswiadczenie = {
      p1a2: 'A', p1b2: 'B', p1c2: 'C', p1d2: 'D',
      p2a2: '11111111111', p2b2: '2222222222',
      p116_4_1: '2025-01-01', p116_4_2: 'test', p116_4_3: '2025-01-01',
      p3a2: makePodpis(),
    }
    const input = makeInput({ oswiadczenia: [osw] })
    const result = generateJpkFaRr(input)

    const wierszCtrlIdx = result.indexOf('<FakturaRRWierszCtrl>')
    const oswIdx = result.indexOf('<Oswiadczenie>')
    expect(wierszCtrlIdx).toBeLessThan(oswIdx)
  })

  // ── Registry ──

  it('registers in generator registry', async () => {
    const { generatorRegistry } = await import('../../../src/core/generators/XmlGeneratorEngine')
    const gen = generatorRegistry.get('JPK_FA_RR')
    expect(gen).toBeDefined()
    expect(gen!.jpkType).toBe('JPK_FA_RR')
    expect(gen!.version).toBe('1')
    expect(gen!.namespace).toBe(FA_RR_NAMESPACE)
  })
})
