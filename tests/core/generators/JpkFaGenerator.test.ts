import { describe, it, expect } from 'vitest'
import {
  generateJpkFa,
  FA_NAMESPACE,
  FA_ETD_NAMESPACE,
  type FaGeneratorInput,
  type FaNaglowek,
  type FaPodmiot,
} from '../../../src/core/generators/JpkFaGenerator'

// ── Test helpers ──

const BASE_NAGLOWEK: FaNaglowek = {
  dataOd: '2026-02-01',
  dataDo: '2026-02-28',
  kodUrzedu: '0271',
}

const BASE_PODMIOT: FaPodmiot = {
  nip: '5261040828',
  pelnaNazwa: 'ACME Sp. z o.o.',
  adres: {
    typ: 'polski',
    wojewodztwo: 'MAZOWIECKIE',
    powiat: 'Warszawa',
    gmina: 'Warszawa',
    ulica: 'Marszałkowska',
    nrDomu: '1',
    nrLokalu: '10',
    miejscowosc: 'Warszawa',
    kodPocztowy: '00-001',
  },
}

const SIMPLE_FAKTURA: Record<string, string> = {
  KodWaluty: 'PLN',
  P_1: '2026-02-15',
  P_2A: 'FV/2026/001',
  P_3A: 'Nabywca Sp. z o.o.',
  P_3B: 'ul. Testowa 1, 00-001 Warszawa',
  P_3C: 'ACME Sp. z o.o.',
  P_3D: 'ul. Marszałkowska 1, 00-001 Warszawa',
  P_5B: '7680002466',
  P_13_1: '1000.00',
  P_14_1: '230.00',
  P_15: '1230.00',
  RodzajFaktury: 'VAT',
}

const SIMPLE_WIERSZ: Record<string, string> = {
  P_2B: 'FV/2026/001',
  P_7: 'Usługa programistyczna',
  P_8A: 'godz.',
  P_8B: '10',
  P_9A: '100.00',
  P_11: '1000.00',
  P_12: '23',
}

function makeInput(overrides: Partial<FaGeneratorInput> = {}): FaGeneratorInput {
  return {
    naglowek: BASE_NAGLOWEK,
    podmiot: BASE_PODMIOT,
    faktury: [SIMPLE_FAKTURA],
    wiersze: [SIMPLE_WIERSZ],
    ...overrides,
  }
}

// ── Tests ──

describe('JpkFaGenerator', () => {
  // ── XML structure ──
  describe('basic XML structure', () => {
    it('generates valid XML header and root element with both namespaces', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`<JPK xmlns="${FA_NAMESPACE}" xmlns:etd="${FA_ETD_NAMESPACE}">`)
      expect(xml).toContain('</JPK>')
    })

    it('generates sections in correct order', () => {
      const xml = generateJpkFa(makeInput())
      const naglowekPos = xml.indexOf('<Naglowek>')
      const podmiotPos = xml.indexOf('<Podmiot1>')
      const fakturaPos = xml.indexOf('<Faktura>')
      const fakturaCtrlPos = xml.indexOf('<FakturaCtrl>')
      const wierszPos = xml.indexOf('<FakturaWiersz>')
      const wierszCtrlPos = xml.indexOf('<FakturaWierszCtrl>')

      expect(naglowekPos).toBeLessThan(podmiotPos)
      expect(podmiotPos).toBeLessThan(fakturaPos)
      expect(fakturaPos).toBeLessThan(fakturaCtrlPos)
      expect(fakturaCtrlPos).toBeLessThan(wierszPos)
      expect(wierszPos).toBeLessThan(wierszCtrlPos)
    })
  })

  // ── Naglowek ──
  describe('Naglowek', () => {
    it('generates KodFormularza with correct attributes', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('kodSystemowy="JPK_FA (4)"')
      expect(xml).toContain('wersjaSchemy="1-0"')
      expect(xml).toContain('>JPK_FA</KodFormularza>')
    })

    it('generates WariantFormularza = 4', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<WariantFormularza>4</WariantFormularza>')
    })

    it('generates CelZlozenia = 1', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<CelZlozenia>1</CelZlozenia>')
    })

    it('generates DataWytworzeniaJPK in ISO format', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toMatch(/<DataWytworzeniaJPK>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/DataWytworzeniaJPK>/)
    })

    it('generates period dates', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<DataOd>2026-02-01</DataOd>')
      expect(xml).toContain('<DataDo>2026-02-28</DataDo>')
    })

    it('generates KodUrzedu', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<KodUrzedu>0271</KodUrzedu>')
    })
  })

  // ── Podmiot1 ──
  describe('Podmiot1', () => {
    it('generates IdentyfikatorPodmiotu with NIP and PelnaNazwa', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<IdentyfikatorPodmiotu>')
      expect(xml).toContain('<NIP>5261040828</NIP>')
      expect(xml).toContain('<PelnaNazwa>ACME Sp. z o.o.</PelnaNazwa>')
    })

    it('generates Polish address with etd: prefixed elements', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<AdresPodmiotu>')
      expect(xml).toContain('<etd:KodKraju>PL</etd:KodKraju>')
      expect(xml).toContain('<etd:Wojewodztwo>MAZOWIECKIE</etd:Wojewodztwo>')
      expect(xml).toContain('<etd:Powiat>Warszawa</etd:Powiat>')
      expect(xml).toContain('<etd:Gmina>Warszawa</etd:Gmina>')
      expect(xml).toContain('<etd:Ulica>Marszałkowska</etd:Ulica>')
      expect(xml).toContain('<etd:NrDomu>1</etd:NrDomu>')
      expect(xml).toContain('<etd:NrLokalu>10</etd:NrLokalu>')
      expect(xml).toContain('<etd:Miejscowosc>Warszawa</etd:Miejscowosc>')
      expect(xml).toContain('<etd:KodPocztowy>00-001</etd:KodPocztowy>')
    })

    it('generates Polish address without optional fields', () => {
      const xml = generateJpkFa(makeInput({
        podmiot: {
          nip: '5261040828',
          pelnaNazwa: 'Test',
          adres: {
            typ: 'polski',
            wojewodztwo: 'MAZOWIECKIE',
            powiat: 'Warszawa',
            gmina: 'Warszawa',
            nrDomu: '5',
            miejscowosc: 'Warszawa',
            kodPocztowy: '00-001',
          },
        },
      }))
      expect(xml).not.toContain('<etd:Ulica>')
      expect(xml).not.toContain('<etd:NrLokalu>')
    })

    it('generates foreign address', () => {
      const xml = generateJpkFa(makeInput({
        podmiot: {
          nip: '5261040828',
          pelnaNazwa: 'German GmbH',
          adres: {
            typ: 'zagraniczny',
            kodKraju: 'DE',
            kodPocztowy: '10115',
            miejscowosc: 'Berlin',
            ulica: 'Berliner Str. 1',
          },
        },
      }))
      expect(xml).toContain('<AdresPodmiotu2>')
      expect(xml).toContain('<etd:KodKraju>DE</etd:KodKraju>')
      expect(xml).toContain('<etd:KodPocztowy>10115</etd:KodPocztowy>')
      expect(xml).toContain('<etd:Miejscowosc>Berlin</etd:Miejscowosc>')
      expect(xml).toContain('<etd:Ulica>Berliner Str. 1</etd:Ulica>')
      expect(xml).not.toContain('<AdresPodmiotu>')
    })
  })

  // ── Faktura ──
  describe('Faktura', () => {
    it('generates required fields', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<KodWaluty>PLN</KodWaluty>')
      expect(xml).toContain('<P_1>2026-02-15</P_1>')
      expect(xml).toContain('<P_2A>FV/2026/001</P_2A>')
      expect(xml).toContain('<P_3C>ACME Sp. z o.o.</P_3C>')
      expect(xml).toContain('<P_3D>ul. Marszałkowska 1, 00-001 Warszawa</P_3D>')
      expect(xml).toContain('<P_15>1230.00</P_15>')
      expect(xml).toContain('<RodzajFaktury>VAT</RodzajFaktury>')
    })

    it('generates buyer fields when provided', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<P_3A>Nabywca Sp. z o.o.</P_3A>')
      expect(xml).toContain('<P_3B>ul. Testowa 1, 00-001 Warszawa</P_3B>')
    })

    it('omits buyer fields when not provided', () => {
      const fakt = { ...SIMPLE_FAKTURA }
      delete fakt['P_3A']
      delete fakt['P_3B']
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).not.toContain('<P_3A>')
      expect(xml).not.toContain('<P_3B>')
    })

    it('generates seller and buyer tax IDs', () => {
      const fakt = { ...SIMPLE_FAKTURA, P_4A: 'PL', P_4B: '5261040828', P_5A: 'PL' }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<P_4A>PL</P_4A>')
      expect(xml).toContain('<P_4B>5261040828</P_4B>')
      expect(xml).toContain('<P_5A>PL</P_5A>')
    })

    it('generates delivery date when provided', () => {
      const fakt = { ...SIMPLE_FAKTURA, P_6: '2026-02-10' }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<P_6>2026-02-10</P_6>')
    })

    it('generates VAT rate group 1 (23%) as paired sequence', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<P_13_1>1000.00</P_13_1>')
      expect(xml).toContain('<P_14_1>230.00</P_14_1>')
    })

    it('generates multiple VAT rate groups', () => {
      const fakt = {
        ...SIMPLE_FAKTURA,
        P_13_2: '500.00', P_14_2: '40.00',
        P_13_3: '200.00', P_14_3: '10.00',
      }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<P_13_2>500.00</P_13_2>')
      expect(xml).toContain('<P_14_2>40.00</P_14_2>')
      expect(xml).toContain('<P_13_3>200.00</P_13_3>')
      expect(xml).toContain('<P_14_3>10.00</P_14_3>')
    })

    it('outputs paired VAT fields when only netto is provided', () => {
      const fakt: Record<string, string> = {
        ...SIMPLE_FAKTURA,
        P_13_2: '500.00',
      }
      delete fakt['P_14_2']
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<P_13_2>500.00</P_13_2>')
      expect(xml).toContain('<P_14_2>0.00</P_14_2>')
    })

    it('generates P_14_xW for foreign currency invoices', () => {
      const fakt = {
        ...SIMPLE_FAKTURA,
        KodWaluty: 'EUR',
        P_14_1W: '1058.10',
      }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<KodWaluty>EUR</KodWaluty>')
      expect(xml).toContain('<P_14_1W>1058.10</P_14_1W>')
    })

    it('generates P_13_5 without requiring P_14_5 (optional within group 5)', () => {
      const fakt: Record<string, string> = {
        KodWaluty: 'PLN',
        P_1: '2026-02-15',
        P_2A: 'FV/002',
        P_3C: 'Seller',
        P_3D: 'Addr',
        P_13_5: '3000.00',
        P_15: '3000.00',
        RodzajFaktury: 'VAT',
      }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<P_13_5>3000.00</P_13_5>')
      expect(xml).not.toContain('<P_14_5>')
    })

    it('generates standalone amounts P_13_6 and P_13_7', () => {
      const fakt = { ...SIMPLE_FAKTURA, P_13_6: '100.00', P_13_7: '200.00' }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<P_13_6>100.00</P_13_6>')
      expect(xml).toContain('<P_13_7>200.00</P_13_7>')
    })

    it('generates boolean flags with default false', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<P_16>false</P_16>')
      expect(xml).toContain('<P_17>false</P_17>')
      expect(xml).toContain('<P_18>false</P_18>')
      expect(xml).toContain('<P_18A>false</P_18A>')
      expect(xml).toContain('<P_19>false</P_19>')
      expect(xml).toContain('<P_20>false</P_20>')
      expect(xml).toContain('<P_21>false</P_21>')
      expect(xml).toContain('<P_22>false</P_22>')
      expect(xml).toContain('<P_23>false</P_23>')
      expect(xml).toContain('<P_106E_2>false</P_106E_2>')
      expect(xml).toContain('<P_106E_3>false</P_106E_3>')
    })

    it('generates boolean flags as true when set', () => {
      const fakt = { ...SIMPLE_FAKTURA, P_18A: '1', P_16: 'true' }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<P_18A>true</P_18A>')
      expect(xml).toContain('<P_16>true</P_16>')
    })

    it('generates exemption basis fields when P_19 is true', () => {
      const fakt = { ...SIMPLE_FAKTURA, P_19: '1', P_19A: 'art. 43 ust. 1 pkt 37' }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<P_19>true</P_19>')
      expect(xml).toContain('<P_19A>art. 43 ust. 1 pkt 37</P_19A>')
    })

    it('generates correction fields for KOREKTA', () => {
      const fakt: Record<string, string> = {
        ...SIMPLE_FAKTURA,
        RodzajFaktury: 'KOREKTA',
        PrzyczynaKorekty: 'Błędna cena',
        NrFaKorygowanej: 'FV/2026/001',
        OkresFaKorygowanej: '2026-02',
      }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<RodzajFaktury>KOREKTA</RodzajFaktury>')
      expect(xml).toContain('<PrzyczynaKorekty>Błędna cena</PrzyczynaKorekty>')
      expect(xml).toContain('<NrFaKorygowanej>FV/2026/001</NrFaKorygowanej>')
      expect(xml).toContain('<OkresFaKorygowanej>2026-02</OkresFaKorygowanej>')
    })

    it('generates advance invoice reference for ZAL', () => {
      const fakt = { ...SIMPLE_FAKTURA, RodzajFaktury: 'ZAL', NrFaZaliczkowej: 'FZ/2026/001' }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('<RodzajFaktury>ZAL</RodzajFaktury>')
      expect(xml).toContain('<NrFaZaliczkowej>FZ/2026/001</NrFaZaliczkowej>')
    })
  })

  // ── FakturaCtrl ──
  describe('FakturaCtrl', () => {
    it('counts faktury correctly', () => {
      const xml = generateJpkFa(makeInput({
        faktury: [SIMPLE_FAKTURA, { ...SIMPLE_FAKTURA, P_2A: 'FV/002', P_15: '500.00' }],
      }))
      expect(xml).toContain('<LiczbaFaktur>2</LiczbaFaktur>')
    })

    it('sums P_15 (WartoscFaktur)', () => {
      const xml = generateJpkFa(makeInput({
        faktury: [
          { ...SIMPLE_FAKTURA, P_15: '1230.00' },
          { ...SIMPLE_FAKTURA, P_2A: 'FV/002', P_15: '500.00' },
        ],
      }))
      expect(xml).toContain('<WartoscFaktur>1730.00</WartoscFaktur>')
    })

    it('handles single faktura', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<LiczbaFaktur>1</LiczbaFaktur>')
      expect(xml).toContain('<WartoscFaktur>1230.00</WartoscFaktur>')
    })
  })

  // ── FakturaWiersz ──
  describe('FakturaWiersz', () => {
    it('generates basic line item', () => {
      const xml = generateJpkFa(makeInput())
      expect(xml).toContain('<P_2B>FV/2026/001</P_2B>')
      expect(xml).toContain('<P_7>Usługa programistyczna</P_7>')
      expect(xml).toContain('<P_8A>godz.</P_8A>')
      expect(xml).toContain('<P_8B>10</P_8B>')
      expect(xml).toContain('<P_9A>100.00</P_9A>')
      expect(xml).toContain('<P_11>1000.00</P_11>')
      expect(xml).toContain('<P_12>23</P_12>')
    })

    it('generates line with gross pricing', () => {
      const wiersz: Record<string, string> = {
        P_2B: 'FV/001',
        P_7: 'Product',
        P_8B: '1',
        P_9B: '123.00',
        P_11A: '123.00',
        P_12: '23',
      }
      const xml = generateJpkFa(makeInput({ wiersze: [wiersz] }))
      expect(xml).toContain('<P_9B>123.00</P_9B>')
      expect(xml).toContain('<P_11A>123.00</P_11A>')
    })

    it('generates line with discount', () => {
      const wiersz: Record<string, string> = {
        P_2B: 'FV/001',
        P_7: 'Product',
        P_8B: '10',
        P_9A: '100.00',
        P_10: '50.00',
        P_11: '950.00',
        P_12: '23',
      }
      const xml = generateJpkFa(makeInput({ wiersze: [wiersz] }))
      expect(xml).toContain('<P_10>50.00</P_10>')
    })

    it('generates line with exempt VAT rate', () => {
      const wiersz: Record<string, string> = {
        P_2B: 'FV/001',
        P_7: 'Medical service',
        P_11: '500.00',
        P_12: 'zw',
      }
      const xml = generateJpkFa(makeInput({ wiersze: [wiersz] }))
      expect(xml).toContain('<P_12>zw</P_12>')
    })

    it('generates line with OSS/IOSS VAT rate', () => {
      const wiersz: Record<string, string> = {
        P_2B: 'FV/001',
        P_7: 'EU product',
        P_11: '100.00',
        P_12_XII: '19.000000',
      }
      const xml = generateJpkFa(makeInput({ wiersze: [wiersz] }))
      expect(xml).toContain('<P_12_XII>19.000000</P_12_XII>')
    })

    it('omits optional fields when not provided', () => {
      const wiersz: Record<string, string> = {
        P_2B: 'FV/001',
        P_11: '100.00',
      }
      const xml = generateJpkFa(makeInput({ wiersze: [wiersz] }))
      expect(xml).not.toContain('<P_7>')
      expect(xml).not.toContain('<P_8A>')
      expect(xml).not.toContain('<P_8B>')
      expect(xml).not.toContain('<P_9A>')
      expect(xml).not.toContain('<P_9B>')
      expect(xml).not.toContain('<P_10>')
      expect(xml).not.toContain('<P_11A>')
      expect(xml).not.toContain('<P_12>')
    })
  })

  // ── FakturaWierszCtrl ──
  describe('FakturaWierszCtrl', () => {
    it('counts wiersze correctly', () => {
      const xml = generateJpkFa(makeInput({
        wiersze: [SIMPLE_WIERSZ, { ...SIMPLE_WIERSZ, P_7: 'B', P_11: '200.00' }],
      }))
      expect(xml).toContain('<LiczbaWierszyFaktur>2</LiczbaWierszyFaktur>')
    })

    it('sums P_11 (WartoscWierszyFaktur)', () => {
      const xml = generateJpkFa(makeInput({
        wiersze: [
          { P_2B: 'FV/001', P_11: '1000.00' },
          { P_2B: 'FV/001', P_11: '500.00' },
        ],
      }))
      expect(xml).toContain('<WartoscWierszyFaktur>1500.00</WartoscWierszyFaktur>')
    })

    it('handles wiersze without P_11 (treats as 0)', () => {
      const xml = generateJpkFa(makeInput({
        wiersze: [
          { P_2B: 'FV/001', P_11: '1000.00' },
          { P_2B: 'FV/001', P_7: 'No net value' },
        ],
      }))
      expect(xml).toContain('<WartoscWierszyFaktur>1000.00</WartoscWierszyFaktur>')
    })
  })

  // ── XML escaping ──
  describe('XML escaping', () => {
    it('escapes special characters in faktura fields', () => {
      const fakt = { ...SIMPLE_FAKTURA, P_3C: 'A & B "Company" <Ltd>' }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))
      expect(xml).toContain('A &amp; B &quot;Company&quot; &lt;Ltd&gt;')
    })

    it('escapes special characters in wiersz fields', () => {
      const wiersz = { ...SIMPLE_WIERSZ, P_7: "O'Brien's <Special> & Service" }
      const xml = generateJpkFa(makeInput({ wiersze: [wiersz] }))
      expect(xml).toContain('O&apos;Brien&apos;s &lt;Special&gt; &amp; Service')
    })
  })

  // ── Element order in Faktura ──
  describe('element order in Faktura', () => {
    it('maintains XSD element order', () => {
      const fakt: Record<string, string> = {
        KodWaluty: 'PLN',
        P_1: '2026-02-15',
        P_2A: 'FV/001',
        P_3A: 'Buyer',
        P_3B: 'Buyer Addr',
        P_3C: 'Seller',
        P_3D: 'Seller Addr',
        P_4B: '1234567890',
        P_5B: '0987654321',
        P_6: '2026-02-10',
        P_13_1: '1000.00',
        P_14_1: '230.00',
        P_13_6: '100.00',
        P_15: '1330.00',
        RodzajFaktury: 'VAT',
      }
      const xml = generateJpkFa(makeInput({ faktury: [fakt] }))

      const positions = [
        xml.indexOf('<KodWaluty>'),
        xml.indexOf('<P_1>'),
        xml.indexOf('<P_2A>'),
        xml.indexOf('<P_3A>'),
        xml.indexOf('<P_3C>'),
        xml.indexOf('<P_4B>'),
        xml.indexOf('<P_5B>'),
        xml.indexOf('<P_6>'),
        xml.indexOf('<P_13_1>'),
        xml.indexOf('<P_14_1>'),
        xml.indexOf('<P_13_6>'),
        xml.indexOf('<P_15>'),
        xml.indexOf('<P_16>'),
        xml.indexOf('<RodzajFaktury>'),
      ]

      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1])
      }
    })
  })

  // ── Full integration ──
  describe('full integration', () => {
    it('generates complete XML with multiple faktury and wiersze', () => {
      const xml = generateJpkFa({
        naglowek: { dataOd: '2026-03-01', dataDo: '2026-03-31', kodUrzedu: '1471' },
        podmiot: {
          nip: '7680002466',
          pelnaNazwa: 'Jan Kowalski Firma',
          adres: {
            typ: 'polski',
            wojewodztwo: 'MAŁOPOLSKIE',
            powiat: 'Kraków',
            gmina: 'Kraków',
            ulica: 'Floriańska',
            nrDomu: '10',
            miejscowosc: 'Kraków',
            kodPocztowy: '31-021',
          },
        },
        faktury: [
          {
            KodWaluty: 'PLN',
            P_1: '2026-03-15',
            P_2A: 'FV/2026/010',
            P_3A: 'Client A',
            P_3B: 'ul. Testowa 1',
            P_3C: 'Jan Kowalski Firma',
            P_3D: 'ul. Floriańska 10, Kraków',
            P_5B: '5261040828',
            P_13_1: '5000.00',
            P_14_1: '1150.00',
            P_15: '6150.00',
            RodzajFaktury: 'VAT',
          },
          {
            KodWaluty: 'EUR',
            P_1: '2026-03-20',
            P_2A: 'FV/2026/011',
            P_3A: 'German Client',
            P_3B: 'Berlin',
            P_3C: 'Jan Kowalski Firma',
            P_3D: 'ul. Floriańska 10, Kraków',
            P_4A: 'PL',
            P_4B: '7680002466',
            P_5A: 'DE',
            P_5B: 'DE123456789',
            P_13_5: '2000.00',
            P_15: '2000.00',
            RodzajFaktury: 'VAT',
          },
        ],
        wiersze: [
          { P_2B: 'FV/2026/010', P_7: 'Consulting', P_8A: 'h', P_8B: '50', P_9A: '100.00', P_11: '5000.00', P_12: '23' },
          { P_2B: 'FV/2026/011', P_7: 'EU Service', P_8A: 'szt.', P_8B: '1', P_9A: '2000.00', P_11: '2000.00', P_12: 'np' },
        ],
      })

      // Structure
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1>')
      expect(xml).toContain('<FakturaCtrl>')
      expect(xml).toContain('<FakturaWierszCtrl>')

      // Header
      expect(xml).toContain('<DataOd>2026-03-01</DataOd>')
      expect(xml).toContain('<KodUrzedu>1471</KodUrzedu>')

      // Podmiot
      expect(xml).toContain('<NIP>7680002466</NIP>')
      expect(xml).toContain('<etd:Wojewodztwo>MAŁOPOLSKIE</etd:Wojewodztwo>')

      // Faktura count + sum
      expect(xml).toContain('<LiczbaFaktur>2</LiczbaFaktur>')
      expect(xml).toContain('<WartoscFaktur>8150.00</WartoscFaktur>')

      // Wiersz count + sum
      expect(xml).toContain('<LiczbaWierszyFaktur>2</LiczbaWierszyFaktur>')
      expect(xml).toContain('<WartoscWierszyFaktur>7000.00</WartoscWierszyFaktur>')

      // EU invoice fields
      expect(xml).toContain('<P_4A>PL</P_4A>')
      expect(xml).toContain('<P_5A>DE</P_5A>')
    })
  })
})
