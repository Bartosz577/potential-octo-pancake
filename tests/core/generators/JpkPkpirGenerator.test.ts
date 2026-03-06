import { describe, it, expect } from 'vitest'
import {
  generateJpkPkpir,
  PKPIR_NAMESPACE,
  ETD_NAMESPACE,
  escapeXml,
  formatAmount,
  type PkpirGeneratorInput,
  type PkpirNaglowek,
  type PkpirPodmiot,
  type PkpirInfo,
} from '../../../src/core/generators/JpkPkpirGenerator'
import { generatorRegistry } from '../../../src/core/generators/XmlGeneratorEngine'

// ── Test helpers ──

const BASE_NAGLOWEK: PkpirNaglowek = {
  celZlozenia: 1,
  dataOd: '2026-01-01',
  dataDo: '2026-12-31',
  kodUrzedu: '0271',
}

const BASE_PODMIOT_NIEFIZYCZNA: PkpirPodmiot = {
  typ: 'niefizyczna',
  nip: '5261040828',
  pelnaNazwa: 'ACME Sp. z o.o.',
  email: 'biuro@acme.pl',
}

const BASE_PODMIOT_FIZYCZNA: PkpirPodmiot = {
  typ: 'fizyczna',
  nip: '7680002466',
  imie: 'Jan',
  nazwisko: 'Kowalski',
  dataUrodzenia: '1985-03-15',
  email: 'jan@kowalski.pl',
  telefon: '600123456',
}

const BASE_INFO: PkpirInfo = {
  spisPoczatek: 0,
  spisKoniec: 0,
  kosztyRazem: 0,
  dochod: 0,
}

function makeInput(overrides: Partial<PkpirGeneratorInput> = {}): PkpirGeneratorInput {
  return {
    naglowek: BASE_NAGLOWEK,
    podmiot: BASE_PODMIOT_NIEFIZYCZNA,
    pkpirInfo: BASE_INFO,
    wiersze: [],
    ...overrides,
  }
}

function makeRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    K_1: '1',
    K_2: '2026-03-15',
    K_3A: 'FV/001/2026',
    K_5A: 'Firma ABC',
    K_5B: 'ul. Testowa 1, Warszawa',
    K_6: 'Zakup towarów',
    ...overrides,
  }
}

// ── Tests ──

describe('JpkPkpirGenerator', () => {
  // ── XML structure ──
  describe('basic XML structure', () => {
    it('generates valid XML header and root element with PKPIR namespace', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`<JPK xmlns="${PKPIR_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)
      expect(xml).toContain('</JPK>')
    })

    it('uses correct PKPIR namespace (10302)', () => {
      expect(PKPIR_NAMESPACE).toBe('http://jpk.mf.gov.pl/wzor/2024/10/30/10302/')
    })

    it('uses correct ETD namespace', () => {
      expect(ETD_NAMESPACE).toBe('http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/')
    })

    it('generates sections in correct order: Naglowek, Podmiot1, PKPIRInfo, PKPIRWiersz, PKPIRCtrl', () => {
      const xml = generateJpkPkpir(makeInput({ wiersze: [makeRow()] }))
      const naglowekPos = xml.indexOf('<Naglowek>')
      const podmiotPos = xml.indexOf('<Podmiot1')
      const infoPos = xml.indexOf('<PKPIRInfo>')
      const wierszPos = xml.indexOf('<PKPIRWiersz>')
      const ctrlPos = xml.indexOf('<PKPIRCtrl>')

      expect(naglowekPos).toBeLessThan(podmiotPos)
      expect(podmiotPos).toBeLessThan(infoPos)
      expect(infoPos).toBeLessThan(wierszPos)
      expect(wierszPos).toBeLessThan(ctrlPos)
    })

    it('places PKPIRSpis between PKPIRInfo and PKPIRWiersz when provided', () => {
      const xml = generateJpkPkpir(makeInput({
        spisy: [{ data: '2026-01-01', wartosc: 5000 }],
        wiersze: [makeRow()],
      }))
      const infoPos = xml.indexOf('</PKPIRInfo>')
      const spisPos = xml.indexOf('<PKPIRSpis>')
      const wierszPos = xml.indexOf('<PKPIRWiersz>')

      expect(infoPos).toBeLessThan(spisPos)
      expect(spisPos).toBeLessThan(wierszPos)
    })

    it('omits PKPIRSpis when not provided', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).not.toContain('<PKPIRSpis>')
    })
  })

  // ── Naglowek ──
  describe('Naglowek', () => {
    it('generates KodFormularza with PKPIR kodSystemowy', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('kodSystemowy="JPK_PKPIR (3)"')
      expect(xml).toContain('wersjaSchemy="1-0"')
      expect(xml).toContain('>JPK_PKPIR</KodFormularza>')
    })

    it('generates WariantFormularza = 3', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<WariantFormularza>3</WariantFormularza>')
    })

    it('generates DataWytworzeniaJPK in ISO format', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toMatch(/<DataWytworzeniaJPK>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/DataWytworzeniaJPK>/)
    })

    it('generates CelZlozenia (1 = zlozenie)', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<CelZlozenia>1</CelZlozenia>')
    })

    it('generates CelZlozenia = 0 (biezace)', () => {
      const xml = generateJpkPkpir(makeInput({
        naglowek: { ...BASE_NAGLOWEK, celZlozenia: 0 },
      }))
      expect(xml).toContain('<CelZlozenia>0</CelZlozenia>')
    })

    it('generates CelZlozenia = 2 (korekta)', () => {
      const xml = generateJpkPkpir(makeInput({
        naglowek: { ...BASE_NAGLOWEK, celZlozenia: 2 },
      }))
      expect(xml).toContain('<CelZlozenia>2</CelZlozenia>')
    })

    it('generates DataOd and DataDo (not Rok/Miesiac)', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<DataOd>2026-01-01</DataOd>')
      expect(xml).toContain('<DataDo>2026-12-31</DataDo>')
      expect(xml).not.toContain('<Rok>')
      expect(xml).not.toContain('<Miesiac>')
    })

    it('generates KodUrzedu', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<KodUrzedu>0271</KodUrzedu>')
    })
  })

  // ── Podmiot1 ──
  describe('Podmiot1', () => {
    it('generates Podmiot1 with rola="Podatnik"', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<Podmiot1 rola="Podatnik">')
    })

    it('generates OsobaNiefizyczna for niefizyczna type', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<OsobaNiefizyczna>')
      expect(xml).toContain('<NIP>5261040828</NIP>')
      expect(xml).toContain('<PelnaNazwa>ACME Sp. z o.o.</PelnaNazwa>')
      expect(xml).toContain('<Email>biuro@acme.pl</Email>')
    })

    it('generates OsobaFizyczna with etd namespace', () => {
      const xml = generateJpkPkpir(makeInput({ podmiot: BASE_PODMIOT_FIZYCZNA }))
      expect(xml).toContain('<OsobaFizyczna>')
      expect(xml).toContain('<etd:NIP>7680002466</etd:NIP>')
      expect(xml).toContain('<etd:ImiePierwsze>Jan</etd:ImiePierwsze>')
      expect(xml).toContain('<etd:Nazwisko>Kowalski</etd:Nazwisko>')
      expect(xml).toContain('<etd:DataUrodzenia>1985-03-15</etd:DataUrodzenia>')
      expect(xml).toContain('<Email>jan@kowalski.pl</Email>')
      expect(xml).toContain('<Telefon>600123456</Telefon>')
    })

    it('generates Kasowy_PIT = 1 when kasowyPit is true', () => {
      const xml = generateJpkPkpir(makeInput({
        podmiot: { ...BASE_PODMIOT_NIEFIZYCZNA, kasowyPit: true },
      }))
      expect(xml).toContain('<Kasowy_PIT>1</Kasowy_PIT>')
    })

    it('omits Kasowy_PIT when kasowyPit is false/undefined', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).not.toContain('<Kasowy_PIT>')
    })

    it('omits optional fields when not provided', () => {
      const xml = generateJpkPkpir(makeInput({
        podmiot: { typ: 'niefizyczna', nip: '1111111111', pelnaNazwa: 'Test' },
      }))
      expect(xml).not.toContain('<Email>')
      expect(xml).not.toContain('<Telefon>')
    })
  })

  // ── PKPIRInfo ──
  describe('PKPIRInfo', () => {
    it('generates PKPIRInfo with all P_ fields', () => {
      const xml = generateJpkPkpir(makeInput({
        pkpirInfo: { spisPoczatek: 10000, spisKoniec: 12000, kosztyRazem: 50000, dochod: 80000 },
      }))
      expect(xml).toContain('<P_1>10000.00</P_1>')
      expect(xml).toContain('<P_2>12000.00</P_2>')
      expect(xml).toContain('<P_3>50000.00</P_3>')
      expect(xml).toContain('<P_4>80000.00</P_4>')
    })

    it('formats zero values correctly', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<P_1>0.00</P_1>')
      expect(xml).toContain('<P_2>0.00</P_2>')
      expect(xml).toContain('<P_3>0.00</P_3>')
      expect(xml).toContain('<P_4>0.00</P_4>')
    })
  })

  // ── PKPIRSpis ──
  describe('PKPIRSpis', () => {
    it('generates PKPIRSpis with date and value', () => {
      const xml = generateJpkPkpir(makeInput({
        spisy: [{ data: '2026-01-01', wartosc: 15000 }],
      }))
      expect(xml).toContain('<PKPIRSpis>')
      expect(xml).toContain('<P_5A>2026-01-01</P_5A>')
      expect(xml).toContain('<P_5B>15000.00</P_5B>')
    })

    it('generates multiple PKPIRSpis entries', () => {
      const xml = generateJpkPkpir(makeInput({
        spisy: [
          { data: '2026-01-01', wartosc: 5000 },
          { data: '2026-12-31', wartosc: 7500 },
        ],
      }))
      const count = (xml.match(/<PKPIRSpis>/g) || []).length
      expect(count).toBe(2)
      expect(xml).toContain('<P_5B>5000.00</P_5B>')
      expect(xml).toContain('<P_5B>7500.00</P_5B>')
    })
  })

  // ── PKPIRWiersz ──
  describe('PKPIRWiersz', () => {
    it('generates required fields K_1..K_6', () => {
      const xml = generateJpkPkpir(makeInput({ wiersze: [makeRow()] }))
      expect(xml).toContain('<K_1>1</K_1>')
      expect(xml).toContain('<K_2>2026-03-15</K_2>')
      expect(xml).toContain('<K_3A>FV/001/2026</K_3A>')
      expect(xml).toContain('<K_5A>Firma ABC</K_5A>')
      expect(xml).toContain('<K_5B>ul. Testowa 1, Warszawa</K_5B>')
      expect(xml).toContain('<K_6>Zakup towarów</K_6>')
    })

    it('generates optional KSeF number K_3B', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({ K_3B: '1234567890-20260315-ABC123DEF456' })],
      }))
      expect(xml).toContain('<K_3B>1234567890-20260315-ABC123DEF456</K_3B>')
    })

    it('omits K_3B when empty', () => {
      const xml = generateJpkPkpir(makeInput({ wiersze: [makeRow()] }))
      expect(xml).not.toContain('<K_3B>')
    })

    it('generates optional kontrahent fields K_4A and K_4B', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({ K_4A: 'PL', K_4B: '9876543210' })],
      }))
      expect(xml).toContain('<K_4A>PL</K_4A>')
      expect(xml).toContain('<K_4B>9876543210</K_4B>')
    })

    it('omits K_4A and K_4B when not provided', () => {
      const xml = generateJpkPkpir(makeInput({ wiersze: [makeRow()] }))
      expect(xml).not.toContain('<K_4A>')
      expect(xml).not.toContain('<K_4B>')
    })

    it('generates amount fields K_7 through K_15', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({
          K_7: '1000.50',
          K_8: '200.00',
          K_9: '1200.50',
          K_10: '500.00',
          K_11: '100.00',
          K_12: '300.00',
          K_13: '400.00',
          K_14: '1300.00',
          K_15: '2500.50',
        })],
      }))
      expect(xml).toContain('<K_7>1000.50</K_7>')
      expect(xml).toContain('<K_8>200.00</K_8>')
      expect(xml).toContain('<K_9>1200.50</K_9>')
      expect(xml).toContain('<K_10>500.00</K_10>')
      expect(xml).toContain('<K_11>100.00</K_11>')
      expect(xml).toContain('<K_12>300.00</K_12>')
      expect(xml).toContain('<K_13>400.00</K_13>')
      expect(xml).toContain('<K_14>1300.00</K_14>')
      expect(xml).toContain('<K_15>2500.50</K_15>')
    })

    it('generates optional K_9A and K_14A amount fields', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({ K_9A: '50.00', K_14A: '75.00' })],
      }))
      expect(xml).toContain('<K_9A>50.00</K_9A>')
      expect(xml).toContain('<K_14A>75.00</K_14A>')
    })

    it('omits optional amount fields when not provided', () => {
      const xml = generateJpkPkpir(makeInput({ wiersze: [makeRow()] }))
      expect(xml).not.toContain('<K_7>')
      expect(xml).not.toContain('<K_8>')
      expect(xml).not.toContain('<K_9>')
      expect(xml).not.toContain('<K_10>')
      expect(xml).not.toContain('<K_15>')
    })

    it('generates K_16A + K_16B pair when present', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({ K_16A: 'B+R', K_16B: '2500.00' })],
      }))
      expect(xml).toContain('<K_16A>B+R</K_16A>')
      expect(xml).toContain('<K_16B>2500.00</K_16B>')
    })

    it('generates both K_16A and K_16B when only K_16A is set', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({ K_16A: 'B+R' })],
      }))
      expect(xml).toContain('<K_16A>B+R</K_16A>')
      expect(xml).toContain('<K_16B>')
    })

    it('omits K_16A/K_16B pair when neither is set', () => {
      const xml = generateJpkPkpir(makeInput({ wiersze: [makeRow()] }))
      expect(xml).not.toContain('<K_16A>')
      expect(xml).not.toContain('<K_16B>')
    })

    it('generates K_17 uwagi when provided', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({ K_17: 'Uwaga testowa' })],
      }))
      expect(xml).toContain('<K_17>Uwaga testowa</K_17>')
    })

    it('omits K_17 when not provided', () => {
      const xml = generateJpkPkpir(makeInput({ wiersze: [makeRow()] }))
      expect(xml).not.toContain('<K_17>')
    })

    it('generates multiple rows with sequential numbering', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [
          makeRow({ K_1: '1', K_9: '1000' }),
          makeRow({ K_1: '2', K_9: '2000' }),
          makeRow({ K_1: '3', K_9: '3000' }),
        ],
      }))
      const count = (xml.match(/<PKPIRWiersz>/g) || []).length
      expect(count).toBe(3)
    })

    it('generates fields in XSD order within PKPIRWiersz', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({
          K_3B: 'KSEF123',
          K_4A: 'PL',
          K_4B: '1111111111',
          K_7: '100',
          K_9: '500',
          K_14: '200',
          K_16A: 'test',
          K_16B: '50',
          K_17: 'uwagi',
        })],
      }))
      const k1 = xml.indexOf('<K_1>')
      const k2 = xml.indexOf('<K_2>')
      const k3a = xml.indexOf('<K_3A>')
      const k3b = xml.indexOf('<K_3B>')
      const k4a = xml.indexOf('<K_4A>')
      const k5a = xml.indexOf('<K_5A>')
      const k6 = xml.indexOf('<K_6>')
      const k7 = xml.indexOf('<K_7>')
      const k9 = xml.indexOf('<K_9>')
      const k14 = xml.indexOf('<K_14>')
      const k16a = xml.indexOf('<K_16A>')
      const k17 = xml.indexOf('<K_17>')

      expect(k1).toBeLessThan(k2)
      expect(k2).toBeLessThan(k3a)
      expect(k3a).toBeLessThan(k3b)
      expect(k3b).toBeLessThan(k4a)
      expect(k4a).toBeLessThan(k5a)
      expect(k5a).toBeLessThan(k6)
      expect(k6).toBeLessThan(k7)
      expect(k7).toBeLessThan(k9)
      expect(k9).toBeLessThan(k14)
      expect(k14).toBeLessThan(k16a)
      expect(k16a).toBeLessThan(k17)
    })
  })

  // ── PKPIRCtrl ──
  describe('PKPIRCtrl', () => {
    it('generates LiczbaWierszy = 0 for empty input', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<LiczbaWierszy>0</LiczbaWierszy>')
    })

    it('generates correct LiczbaWierszy count', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow(), makeRow({ K_1: '2' }), makeRow({ K_1: '3' })],
      }))
      expect(xml).toContain('<LiczbaWierszy>3</LiczbaWierszy>')
    })

    it('generates SumaPrzychodow from K_9 sum', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [
          makeRow({ K_9: '1000.50' }),
          makeRow({ K_1: '2', K_9: '2500.75' }),
        ],
      }))
      expect(xml).toContain('<SumaPrzychodow>3501.25</SumaPrzychodow>')
    })

    it('generates SumaPrzychodow = 0.00 when no K_9 values', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow(), makeRow({ K_1: '2' })],
      }))
      expect(xml).toContain('<SumaPrzychodow>0.00</SumaPrzychodow>')
    })

    it('generates SumaPrzychodow = 0.00 for zero rows', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<SumaPrzychodow>0.00</SumaPrzychodow>')
    })

    it('handles mixed rows where some have K_9 and some do not', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [
          makeRow({ K_9: '100' }),
          makeRow({ K_1: '2' }),
          makeRow({ K_1: '3', K_9: '200' }),
        ],
      }))
      expect(xml).toContain('<LiczbaWierszy>3</LiczbaWierszy>')
      expect(xml).toContain('<SumaPrzychodow>300.00</SumaPrzychodow>')
    })
  })

  // ── XML escaping ──
  describe('XML escaping', () => {
    it('escapes special characters in kontrahent name (K_5A)', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({ K_5A: 'Firma "A&B" <sp.>' })],
      }))
      expect(xml).toContain('Firma &quot;A&amp;B&quot; &lt;sp.&gt;')
    })

    it('escapes special characters in opis (K_6)', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({ K_6: 'Zakup <materiałów> & usług' })],
      }))
      expect(xml).toContain('Zakup &lt;materiałów&gt; &amp; usług')
    })

    it('escapes special characters in pelnaNazwa', () => {
      const xml = generateJpkPkpir(makeInput({
        podmiot: { ...BASE_PODMIOT_NIEFIZYCZNA, pelnaNazwa: 'O\'Brien & Co "Ltd"' },
      }))
      expect(xml).toContain('O&apos;Brien &amp; Co &quot;Ltd&quot;')
    })

    it('escapeXml handles all five entities', () => {
      expect(escapeXml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&apos;')
    })
  })

  // ── Amount formatting ──
  describe('amount formatting', () => {
    it('formats integer values to 2 decimal places', () => {
      expect(formatAmount(1000)).toBe('1000.00')
    })

    it('formats string decimal values', () => {
      expect(formatAmount('1234.5')).toBe('1234.50')
    })

    it('formats undefined as 0.00', () => {
      expect(formatAmount(undefined)).toBe('0.00')
    })

    it('formats empty string as 0.00', () => {
      expect(formatAmount('')).toBe('0.00')
    })
  })

  // ── Branch coverage — uncovered conditional paths ──
  describe('branch coverage — uncovered conditional paths', () => {
    it('handles empty spisy array (length = 0)', () => {
      const xml = generateJpkPkpir(makeInput({ spisy: [] }))
      expect(xml).not.toContain('<PKPIRSpis>')
    })

    it('generates K_16A and K_16B when only K_16B is present', () => {
      const xml = generateJpkPkpir(makeInput({
        wiersze: [makeRow({ K_16B: '3000.00' })],
      }))
      expect(xml).toContain('<K_16A></K_16A>')
      expect(xml).toContain('<K_16B>3000.00</K_16B>')
    })

    it('generates row with all required fields missing (fallback to empty)', () => {
      const row: Record<string, string> = {}
      const xml = generateJpkPkpir(makeInput({ wiersze: [row] }))
      expect(xml).toContain('<K_1>1</K_1>')
      expect(xml).toContain('<K_2></K_2>')
      expect(xml).toContain('<K_3A></K_3A>')
      expect(xml).toContain('<K_5A></K_5A>')
      expect(xml).toContain('<K_5B></K_5B>')
      expect(xml).toContain('<K_6></K_6>')
    })

    it('generates niefizyczna podmiot without email and telefon', () => {
      const xml = generateJpkPkpir(makeInput({
        podmiot: {
          typ: 'niefizyczna',
          nip: '5261040828',
          pelnaNazwa: 'Test',
        },
      }))
      expect(xml).toContain('<OsobaNiefizyczna>')
      expect(xml).not.toContain('<Email>')
      expect(xml).not.toContain('<Telefon>')
    })

    it('generates niefizyczna podmiot with telefon', () => {
      const xml = generateJpkPkpir(makeInput({
        podmiot: {
          typ: 'niefizyczna',
          nip: '5261040828',
          pelnaNazwa: 'Test',
          telefon: '500600700',
        },
      }))
      expect(xml).toContain('<Telefon>500600700</Telefon>')
    })

    it('generates fizyczna podmiot without optional fields', () => {
      const xml = generateJpkPkpir(makeInput({
        podmiot: {
          typ: 'fizyczna',
          nip: '7680002466',
        },
      }))
      expect(xml).toContain('<OsobaFizyczna>')
      expect(xml).toContain('<etd:NIP>7680002466</etd:NIP>')
      expect(xml).not.toContain('<etd:ImiePierwsze>')
      expect(xml).not.toContain('<etd:Nazwisko>')
      expect(xml).not.toContain('<etd:DataUrodzenia>')
      expect(xml).not.toContain('<Email>')
      expect(xml).not.toContain('<Telefon>')
    })

    it('generates PKPIRInfo with string values for amounts', () => {
      const xml = generateJpkPkpir(makeInput({
        pkpirInfo: {
          spisPoczatek: '5000.50',
          spisKoniec: '6000.75',
          kosztyRazem: '30000',
          dochod: '45000',
        },
      }))
      expect(xml).toContain('<P_1>5000.50</P_1>')
      expect(xml).toContain('<P_2>6000.75</P_2>')
      expect(xml).toContain('<P_3>30000.00</P_3>')
      expect(xml).toContain('<P_4>45000.00</P_4>')
    })

    it('generates PKPIRSpis with string wartosc value', () => {
      const xml = generateJpkPkpir(makeInput({
        spisy: [{ data: '2026-06-30', wartosc: '7500.25' }],
      }))
      expect(xml).toContain('<PKPIRSpis>')
      expect(xml).toContain('<P_5B>7500.25</P_5B>')
    })
  })

  // ── Full integration ──
  describe('full integration', () => {
    it('generates complete PKPIR XML with all sections', () => {
      const xml = generateJpkPkpir(makeInput({
        podmiot: BASE_PODMIOT_FIZYCZNA,
        pkpirInfo: { spisPoczatek: 10000, spisKoniec: 12000, kosztyRazem: 50000, dochod: 80000 },
        spisy: [
          { data: '2026-01-01', wartosc: 10000 },
          { data: '2026-12-31', wartosc: 12000 },
        ],
        wiersze: [
          makeRow({ K_9: '5000', K_10: '1000' }),
          makeRow({ K_1: '2', K_9: '3000', K_10: '500' }),
        ],
      }))

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`xmlns="${PKPIR_NAMESPACE}"`)
      expect(xml).toContain('JPK_PKPIR (3)')
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1 rola="Podatnik">')
      expect(xml).toContain('<OsobaFizyczna>')
      expect(xml).toContain('<PKPIRInfo>')
      expect(xml).toContain('<PKPIRSpis>')
      expect(xml).toContain('<PKPIRWiersz>')
      expect(xml).toContain('<PKPIRCtrl>')
      expect(xml).toContain('<LiczbaWierszy>2</LiczbaWierszy>')
      expect(xml).toContain('<SumaPrzychodow>8000.00</SumaPrzychodow>')
      expect(xml).toContain('</JPK>')
    })

    it('generates valid XML for 0 rows', () => {
      const xml = generateJpkPkpir(makeInput())
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1')
      expect(xml).toContain('<PKPIRInfo>')
      expect(xml).toContain('<PKPIRCtrl>')
      expect(xml).toContain('<LiczbaWierszy>0</LiczbaWierszy>')
      expect(xml).toContain('<SumaPrzychodow>0.00</SumaPrzychodow>')
      expect(xml).not.toContain('<PKPIRWiersz>')
      expect(xml).toContain('</JPK>')
    })
  })

  // ── Generator registry ──
  describe('generator registry', () => {
    it('registers as JPK_PKPIR type', () => {
      const gen = generatorRegistry.get('JPK_PKPIR')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_PKPIR')
      expect(gen!.version).toBe('3')
      expect(gen!.namespace).toBe(PKPIR_NAMESPACE)
    })

    it('generate function works via registry', () => {
      const gen = generatorRegistry.get('JPK_PKPIR')!
      const xml = gen.generate(makeInput({ wiersze: [makeRow({ K_9: '100' })] }))
      expect(xml).toContain('<PKPIRWiersz>')
      expect(xml).toContain('<SumaPrzychodow>100.00</SumaPrzychodow>')
    })
  })
})
