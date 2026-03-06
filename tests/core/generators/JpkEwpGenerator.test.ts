import { describe, it, expect } from 'vitest'
import {
  generateJpkEwp,
  EWP_NAMESPACE,
  ETD_NAMESPACE,
  VALID_RATES,
  escapeXml,
  formatAmount,
  type EwpGeneratorInput,
  type EwpNaglowek,
  type EwpPodmiot,
} from '../../../src/core/generators/JpkEwpGenerator'
import { generatorRegistry } from '../../../src/core/generators/XmlGeneratorEngine'

// ── Test helpers ──

const BASE_NAGLOWEK: EwpNaglowek = {
  celZlozenia: 1,
  dataOd: '2026-01-01',
  dataDo: '2026-12-31',
  kodUrzedu: '0271',
}

const BASE_PODMIOT_NIEFIZYCZNA: EwpPodmiot = {
  typ: 'niefizyczna',
  nip: '5261040828',
  pelnaNazwa: 'ACME Sp. z o.o.',
  email: 'biuro@acme.pl',
}

const BASE_PODMIOT_FIZYCZNA: EwpPodmiot = {
  typ: 'fizyczna',
  nip: '7680002466',
  imie: 'Jan',
  nazwisko: 'Kowalski',
  dataUrodzenia: '1985-03-15',
  email: 'jan@kowalski.pl',
  telefon: '600123456',
}

function makeInput(overrides: Partial<EwpGeneratorInput> = {}): EwpGeneratorInput {
  return {
    naglowek: BASE_NAGLOWEK,
    podmiot: BASE_PODMIOT_NIEFIZYCZNA,
    wiersze: [],
    ...overrides,
  }
}

function makeRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    K_1: '1',
    K_2: '2026-03-15',
    K_3: '2026-03-15',
    K_4: 'FV/001/2026',
    K_8: '1000.00',
    K_9: '8.5',
    ...overrides,
  }
}

// ── Tests ──

describe('JpkEwpGenerator', () => {
  // ── XML structure ──
  describe('basic XML structure', () => {
    it('generates valid XML header and root element with EWP namespace', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`<JPK xmlns="${EWP_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)
      expect(xml).toContain('</JPK>')
    })

    it('uses correct EWP namespace (10301)', () => {
      expect(EWP_NAMESPACE).toBe('http://jpk.mf.gov.pl/wzor/2024/10/30/10301/')
    })

    it('uses correct ETD namespace', () => {
      expect(ETD_NAMESPACE).toBe('http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/')
    })

    it('generates sections in correct order: Naglowek, Podmiot1, EWPWiersz, EWPCtrl', () => {
      const xml = generateJpkEwp(makeInput({ wiersze: [makeRow()] }))
      const naglowekPos = xml.indexOf('<Naglowek>')
      const podmiotPos = xml.indexOf('<Podmiot1')
      const wierszPos = xml.indexOf('<EWPWiersz>')
      const ctrlPos = xml.indexOf('<EWPCtrl>')

      expect(naglowekPos).toBeLessThan(podmiotPos)
      expect(podmiotPos).toBeLessThan(wierszPos)
      expect(wierszPos).toBeLessThan(ctrlPos)
    })
  })

  // ── Naglowek ──
  describe('Naglowek', () => {
    it('generates KodFormularza with EWP kodSystemowy', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('kodSystemowy="JPK_EWP (4)"')
      expect(xml).toContain('wersjaSchemy="1-0"')
      expect(xml).toContain('>JPK_EWP</KodFormularza>')
    })

    it('generates WariantFormularza = 4', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('<WariantFormularza>4</WariantFormularza>')
    })

    it('generates DataWytworzeniaJPK in ISO format', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toMatch(/<DataWytworzeniaJPK>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/DataWytworzeniaJPK>/)
    })

    it('generates CelZlozenia values 0, 1, 2', () => {
      for (const cel of [0, 1, 2]) {
        const xml = generateJpkEwp(makeInput({
          naglowek: { ...BASE_NAGLOWEK, celZlozenia: cel },
        }))
        expect(xml).toContain(`<CelZlozenia>${cel}</CelZlozenia>`)
      }
    })

    it('generates DataOd and DataDo', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('<DataOd>2026-01-01</DataOd>')
      expect(xml).toContain('<DataDo>2026-12-31</DataDo>')
    })

    it('generates KodUrzedu', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('<KodUrzedu>0271</KodUrzedu>')
    })
  })

  // ── Podmiot1 ──
  describe('Podmiot1', () => {
    it('generates Podmiot1 with rola="Podatnik"', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('<Podmiot1 rola="Podatnik">')
    })

    it('generates OsobaNiefizyczna for niefizyczna type', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('<OsobaNiefizyczna>')
      expect(xml).toContain('<NIP>5261040828</NIP>')
      expect(xml).toContain('<PelnaNazwa>ACME Sp. z o.o.</PelnaNazwa>')
      expect(xml).toContain('<Email>biuro@acme.pl</Email>')
    })

    it('generates OsobaFizyczna with etd namespace', () => {
      const xml = generateJpkEwp(makeInput({ podmiot: BASE_PODMIOT_FIZYCZNA }))
      expect(xml).toContain('<OsobaFizyczna>')
      expect(xml).toContain('<etd:NIP>7680002466</etd:NIP>')
      expect(xml).toContain('<etd:ImiePierwsze>Jan</etd:ImiePierwsze>')
      expect(xml).toContain('<etd:Nazwisko>Kowalski</etd:Nazwisko>')
      expect(xml).toContain('<etd:DataUrodzenia>1985-03-15</etd:DataUrodzenia>')
    })

    it('generates Kasowy_PIT when kasowyPit is true', () => {
      const xml = generateJpkEwp(makeInput({
        podmiot: { ...BASE_PODMIOT_NIEFIZYCZNA, kasowyPit: true },
      }))
      expect(xml).toContain('<Kasowy_PIT>1</Kasowy_PIT>')
    })

    it('omits Kasowy_PIT when kasowyPit is false/undefined', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).not.toContain('<Kasowy_PIT>')
    })
  })

  // ── EWPWiersz ──
  describe('EWPWiersz', () => {
    it('generates required fields K_1..K_4, K_8, K_9', () => {
      const xml = generateJpkEwp(makeInput({ wiersze: [makeRow()] }))
      expect(xml).toContain('<K_1>1</K_1>')
      expect(xml).toContain('<K_2>2026-03-15</K_2>')
      expect(xml).toContain('<K_3>2026-03-15</K_3>')
      expect(xml).toContain('<K_4>FV/001/2026</K_4>')
      expect(xml).toContain('<K_8>1000.00</K_8>')
      expect(xml).toContain('<K_9>8.5</K_9>')
    })

    it('generates optional KSeF number K_5', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [makeRow({ K_5: '1234567890-20260315-ABC123DEF456' })],
      }))
      expect(xml).toContain('<K_5>1234567890-20260315-ABC123DEF456</K_5>')
    })

    it('omits K_5 when empty', () => {
      const xml = generateJpkEwp(makeInput({ wiersze: [makeRow()] }))
      expect(xml).not.toContain('<K_5>')
    })

    it('generates optional country code K_6', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [makeRow({ K_6: 'PL' })],
      }))
      expect(xml).toContain('<K_6>PL</K_6>')
    })

    it('generates optional NIP K_7', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [makeRow({ K_7: '9876543210' })],
      }))
      expect(xml).toContain('<K_7>9876543210</K_7>')
    })

    it('omits K_6 and K_7 when not provided', () => {
      const xml = generateJpkEwp(makeInput({ wiersze: [makeRow()] }))
      expect(xml).not.toContain('<K_6>')
      expect(xml).not.toContain('<K_7>')
    })

    it('generates K_10 uwagi when provided', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [makeRow({ K_10: 'Data otrzymania: 2026-03-20' })],
      }))
      expect(xml).toContain('<K_10>Data otrzymania: 2026-03-20</K_10>')
    })

    it('omits K_10 when not provided', () => {
      const xml = generateJpkEwp(makeInput({ wiersze: [makeRow()] }))
      expect(xml).not.toContain('<K_10>')
    })

    it('generates fields in XSD order', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [makeRow({ K_5: 'KSEF', K_6: 'PL', K_7: '1111111111', K_10: 'uwagi' })],
      }))
      const k1 = xml.indexOf('<K_1>')
      const k2 = xml.indexOf('<K_2>')
      const k3 = xml.indexOf('<K_3>')
      const k4 = xml.indexOf('<K_4>')
      const k5 = xml.indexOf('<K_5>')
      const k6 = xml.indexOf('<K_6>')
      const k7 = xml.indexOf('<K_7>')
      const k8 = xml.indexOf('<K_8>')
      const k9 = xml.indexOf('<K_9>')
      const k10 = xml.indexOf('<K_10>')

      expect(k1).toBeLessThan(k2)
      expect(k2).toBeLessThan(k3)
      expect(k3).toBeLessThan(k4)
      expect(k4).toBeLessThan(k5)
      expect(k5).toBeLessThan(k6)
      expect(k6).toBeLessThan(k7)
      expect(k7).toBeLessThan(k8)
      expect(k8).toBeLessThan(k9)
      expect(k9).toBeLessThan(k10)
    })

    it('generates multiple rows', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [
          makeRow({ K_1: '1', K_9: '8.5' }),
          makeRow({ K_1: '2', K_9: '17' }),
          makeRow({ K_1: '3', K_9: '3' }),
        ],
      }))
      const count = (xml.match(/<EWPWiersz>/g) || []).length
      expect(count).toBe(3)
    })

    it('supports all valid tax rates', () => {
      for (const rate of VALID_RATES) {
        const xml = generateJpkEwp(makeInput({
          wiersze: [makeRow({ K_9: rate })],
        }))
        expect(xml).toContain(`<K_9>${rate}</K_9>`)
      }
    })
  })

  // ── EWPCtrl ──
  describe('EWPCtrl', () => {
    it('generates LiczbaWierszy = 0 for empty input', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('<LiczbaWierszy>0</LiczbaWierszy>')
    })

    it('generates correct LiczbaWierszy count', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [makeRow(), makeRow({ K_1: '2' }), makeRow({ K_1: '3' })],
      }))
      expect(xml).toContain('<LiczbaWierszy>3</LiczbaWierszy>')
    })

    it('generates SumaPrzychodow from K_8 sum', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [
          makeRow({ K_8: '1000.50' }),
          makeRow({ K_1: '2', K_8: '2500.75' }),
        ],
      }))
      expect(xml).toContain('<SumaPrzychodow>3501.25</SumaPrzychodow>')
    })

    it('generates SumaPrzychodow = 0.00 for zero rows', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('<SumaPrzychodow>0.00</SumaPrzychodow>')
    })

    it('sums K_8 across rows with different rates', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [
          makeRow({ K_1: '1', K_8: '100', K_9: '17' }),
          makeRow({ K_1: '2', K_8: '200', K_9: '8.5' }),
          makeRow({ K_1: '3', K_8: '300', K_9: '3' }),
        ],
      }))
      expect(xml).toContain('<LiczbaWierszy>3</LiczbaWierszy>')
      expect(xml).toContain('<SumaPrzychodow>600.00</SumaPrzychodow>')
    })
  })

  // ── XML escaping ──
  describe('XML escaping', () => {
    it('escapes special characters in K_4 (document number)', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [makeRow({ K_4: 'FV "A&B" <2026>' })],
      }))
      expect(xml).toContain('FV &quot;A&amp;B&quot; &lt;2026&gt;')
    })

    it('escapes special characters in pelnaNazwa', () => {
      const xml = generateJpkEwp(makeInput({
        podmiot: { ...BASE_PODMIOT_NIEFIZYCZNA, pelnaNazwa: 'O\'Brien & Co' },
      }))
      expect(xml).toContain('O&apos;Brien &amp; Co')
    })

    it('escapeXml handles all five entities', () => {
      expect(escapeXml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&apos;')
    })
  })

  // ── Amount formatting ──
  describe('amount formatting', () => {
    it('formats K_8 values to 2 decimal places', () => {
      const xml = generateJpkEwp(makeInput({
        wiersze: [makeRow({ K_8: '1000' })],
      }))
      expect(xml).toContain('<K_8>1000.00</K_8>')
    })

    it('formats undefined/empty K_8 as 0.00', () => {
      expect(formatAmount(undefined)).toBe('0.00')
      expect(formatAmount('')).toBe('0.00')
    })
  })

  // ── VALID_RATES constant ──
  describe('VALID_RATES', () => {
    it('contains exactly 9 rates per XSD TStawkaPodatku', () => {
      expect(VALID_RATES).toHaveLength(9)
    })

    it('includes all XSD-defined rates', () => {
      expect(VALID_RATES).toEqual(['17', '15', '14', '12.5', '12', '10', '8.5', '5.5', '3'])
    })
  })

  // ── Full integration ──
  describe('full integration', () => {
    it('generates complete EWP XML with all sections', () => {
      const xml = generateJpkEwp(makeInput({
        podmiot: BASE_PODMIOT_FIZYCZNA,
        wiersze: [
          makeRow({ K_1: '1', K_8: '5000', K_9: '8.5', K_7: '1234567890' }),
          makeRow({ K_1: '2', K_8: '3000', K_9: '17' }),
        ],
      }))

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`xmlns="${EWP_NAMESPACE}"`)
      expect(xml).toContain('JPK_EWP (4)')
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1 rola="Podatnik">')
      expect(xml).toContain('<OsobaFizyczna>')
      expect(xml).toContain('<EWPWiersz>')
      expect(xml).toContain('<EWPCtrl>')
      expect(xml).toContain('<LiczbaWierszy>2</LiczbaWierszy>')
      expect(xml).toContain('<SumaPrzychodow>8000.00</SumaPrzychodow>')
      expect(xml).toContain('</JPK>')
    })

    it('generates valid XML for 0 rows', () => {
      const xml = generateJpkEwp(makeInput())
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1')
      expect(xml).toContain('<EWPCtrl>')
      expect(xml).toContain('<LiczbaWierszy>0</LiczbaWierszy>')
      expect(xml).toContain('<SumaPrzychodow>0.00</SumaPrzychodow>')
      expect(xml).not.toContain('<EWPWiersz>')
    })
  })

  // ── Generator registry ──
  describe('generator registry', () => {
    it('registers as JPK_EWP type', () => {
      const gen = generatorRegistry.get('JPK_EWP')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_EWP')
      expect(gen!.version).toBe('4')
      expect(gen!.namespace).toBe(EWP_NAMESPACE)
    })

    it('generate function works via registry', () => {
      const gen = generatorRegistry.get('JPK_EWP')!
      const xml = gen.generate(makeInput({ wiersze: [makeRow({ K_8: '100' })] }))
      expect(xml).toContain('<EWPWiersz>')
      expect(xml).toContain('<SumaPrzychodow>100.00</SumaPrzychodow>')
    })
  })
})
