import { describe, it, expect } from 'vitest'
import {
  generateJpkV7m,
  escapeXml,
  formatAmount,
  formatDeclAmount,
  V7M_NAMESPACE,
  ETD_NAMESPACE,
  type V7mGeneratorInput,
  type V7mNaglowek,
  type V7mPodmiot,
} from '../../../src/core/generators/JpkV7mGenerator'

// ── Test helpers ──

const BASE_NAGLOWEK: V7mNaglowek = {
  celZlozenia: 1,
  kodUrzedu: '0271',
  rok: 2026,
  miesiac: 2,
  nazwaSystemu: 'JPK Universal Converter',
}

const BASE_PODMIOT_NIEFIZYCZNA: V7mPodmiot = {
  typ: 'niefizyczna',
  nip: '5261040828',
  pelnaNazwa: 'ACME Sp. z o.o.',
  email: 'biuro@acme.pl',
}

const BASE_PODMIOT_FIZYCZNA: V7mPodmiot = {
  typ: 'fizyczna',
  nip: '7680002466',
  imie: 'Jan',
  nazwisko: 'Kowalski',
  dataUrodzenia: '1985-03-15',
  email: 'jan@kowalski.pl',
  telefon: '600123456',
}

function makeInput(overrides: Partial<V7mGeneratorInput> = {}): V7mGeneratorInput {
  return {
    naglowek: BASE_NAGLOWEK,
    podmiot: BASE_PODMIOT_NIEFIZYCZNA,
    sprzedazWiersze: [],
    zakupWiersze: [],
    ...overrides,
  }
}

// ── Tests ──

describe('JpkV7mGenerator', () => {
  // ── XML structure ──
  describe('basic XML structure', () => {
    it('generates valid XML header and root element with both namespaces', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`<JPK xmlns="${V7M_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)
      expect(xml).toContain('</JPK>')
    })

    it('generates sections in correct order: Naglowek, Podmiot1, Ewidencja', () => {
      const xml = generateJpkV7m(makeInput())
      const naglowekPos = xml.indexOf('<Naglowek>')
      const podmiotPos = xml.indexOf('<Podmiot1')
      const ewidencjaPos = xml.indexOf('<Ewidencja>')

      expect(naglowekPos).toBeLessThan(podmiotPos)
      expect(podmiotPos).toBeLessThan(ewidencjaPos)
    })

    it('generates Deklaracja between Podmiot1 and Ewidencja when provided', () => {
      const xml = generateJpkV7m(makeInput({
        deklaracja: { P_38: '1000.00', P_51: '500.00' },
      }))
      const podmiotPos = xml.indexOf('</Podmiot1>')
      const deklaracjaPos = xml.indexOf('<Deklaracja>')
      const ewidencjaPos = xml.indexOf('<Ewidencja>')

      expect(podmiotPos).toBeLessThan(deklaracjaPos)
      expect(deklaracjaPos).toBeLessThan(ewidencjaPos)
    })

    it('omits Deklaracja when not provided', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).not.toContain('<Deklaracja>')
    })
  })

  // ── Naglowek ──
  describe('Naglowek', () => {
    it('generates KodFormularza with correct attributes', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('kodSystemowy="JPK_V7M (3)"')
      expect(xml).toContain('wersjaSchemy="1-0E"')
      expect(xml).toContain('>JPK_VAT</KodFormularza>')
    })

    it('generates WariantFormularza = 3', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('<WariantFormularza>3</WariantFormularza>')
    })

    it('generates DataWytworzeniaJPK in ISO format', () => {
      const xml = generateJpkV7m(makeInput())
      // Should match pattern like 2026-02-27T...Z
      expect(xml).toMatch(/<DataWytworzeniaJPK>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/DataWytworzeniaJPK>/)
    })

    it('includes NazwaSystemu when provided', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('<NazwaSystemu>JPK Universal Converter</NazwaSystemu>')
    })

    it('omits NazwaSystemu when not provided', () => {
      const xml = generateJpkV7m(makeInput({
        naglowek: { ...BASE_NAGLOWEK, nazwaSystemu: undefined },
      }))
      expect(xml).not.toContain('<NazwaSystemu>')
    })

    it('generates CelZlozenia with poz attribute', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('<CelZlozenia poz="P_7">1</CelZlozenia>')
    })

    it('generates correction purpose (celZlozenia=2)', () => {
      const xml = generateJpkV7m(makeInput({
        naglowek: { ...BASE_NAGLOWEK, celZlozenia: 2 },
      }))
      expect(xml).toContain('<CelZlozenia poz="P_7">2</CelZlozenia>')
    })

    it('generates KodUrzedu, Rok, Miesiac', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('<KodUrzedu>0271</KodUrzedu>')
      expect(xml).toContain('<Rok>2026</Rok>')
      expect(xml).toContain('<Miesiac>2</Miesiac>')
    })
  })

  // ── Podmiot1 ──
  describe('Podmiot1', () => {
    it('generates OsobaNiefizyczna for company', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('<Podmiot1 rola="Podatnik">')
      expect(xml).toContain('<OsobaNiefizyczna>')
      expect(xml).toContain('<NIP>5261040828</NIP>')
      expect(xml).toContain('<PelnaNazwa>ACME Sp. z o.o.</PelnaNazwa>')
      expect(xml).toContain('<Email>biuro@acme.pl</Email>')
      expect(xml).toContain('</OsobaNiefizyczna>')
    })

    it('generates OsobaFizyczna for individual with etd: prefix on inherited fields', () => {
      const xml = generateJpkV7m(makeInput({ podmiot: BASE_PODMIOT_FIZYCZNA }))
      expect(xml).toContain('<OsobaFizyczna>')
      expect(xml).toContain('<etd:NIP>7680002466</etd:NIP>')
      expect(xml).toContain('<etd:ImiePierwsze>Jan</etd:ImiePierwsze>')
      expect(xml).toContain('<etd:Nazwisko>Kowalski</etd:Nazwisko>')
      expect(xml).toContain('<etd:DataUrodzenia>1985-03-15</etd:DataUrodzenia>')
      expect(xml).toContain('<Email>jan@kowalski.pl</Email>')
      expect(xml).toContain('<Telefon>600123456</Telefon>')
    })

    it('includes Telefon for company when provided', () => {
      const xml = generateJpkV7m(makeInput({
        podmiot: { ...BASE_PODMIOT_NIEFIZYCZNA, telefon: '222334455' },
      }))
      expect(xml).toContain('<Telefon>222334455</Telefon>')
    })

    it('omits Telefon when not provided', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).not.toContain('<Telefon>')
    })
  })

  // ── SprzedazWiersz ──
  describe('SprzedazWiersz', () => {
    it('generates basic sales row with BFK default', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Firma ABC',
          DowodSprzedazy: 'FV/2026/001',
          DataWystawienia: '2026-02-15',
          K_19: '1000.00',
          K_20: '230.00',
        }],
      }))

      expect(xml).toContain('<LpSprzedazy>1</LpSprzedazy>')
      expect(xml).toContain('<NrKontrahenta>1234567890</NrKontrahenta>')
      expect(xml).toContain('<NazwaKontrahenta>Firma ABC</NazwaKontrahenta>')
      expect(xml).toContain('<DowodSprzedazy>FV/2026/001</DowodSprzedazy>')
      expect(xml).toContain('<DataWystawienia>2026-02-15</DataWystawienia>')
      expect(xml).toContain('<BFK>1</BFK>')
      expect(xml).toContain('<K_19>1000.00</K_19>')
      expect(xml).toContain('<K_20>230.00</K_20>')
    })

    it('generates NrKSeF when provided', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          NrKSeF: '1234567890-20260215-ABCDEF-ABCDEF-AB',
        }],
      }))

      expect(xml).toContain('<NrKSeF>1234567890-20260215-ABCDEF-ABCDEF-AB</NrKSeF>')
      expect(xml).not.toContain('<BFK>')
      expect(xml).not.toContain('<OFF>')
      expect(xml).not.toContain('<DI>')
    })

    it('generates OFF marker', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          OFF: '1',
        }],
      }))

      expect(xml).toContain('<OFF>1</OFF>')
      expect(xml).not.toContain('<BFK>')
    })

    it('generates DI marker', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          DI: '1',
        }],
      }))

      expect(xml).toContain('<DI>1</DI>')
      expect(xml).not.toContain('<BFK>')
    })

    it('includes DataSprzedazy when provided', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          DataSprzedazy: '2026-02-10',
        }],
      }))

      expect(xml).toContain('<DataSprzedazy>2026-02-10</DataSprzedazy>')
    })

    it('includes TypDokumentu when provided', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: 'BRAK',
          NazwaKontrahenta: 'raport kasowy',
          DowodSprzedazy: 'RK/001',
          DataWystawienia: '2026-02-15',
          TypDokumentu: 'RO',
          DI: '1',
        }],
      }))

      expect(xml).toContain('<TypDokumentu>RO</TypDokumentu>')
    })

    it('includes KodKrajuNadaniaTIN when provided', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          KodKrajuNadaniaTIN: 'DE',
          NrKontrahenta: 'DE123456789',
          NazwaKontrahenta: 'German GmbH',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
        }],
      }))

      expect(xml).toContain('<KodKrajuNadaniaTIN>DE</KodKrajuNadaniaTIN>')
    })

    it('numbers multiple rows sequentially', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [
          { NrKontrahenta: '1111111111', NazwaKontrahenta: 'A', DowodSprzedazy: 'FV/1', DataWystawienia: '2026-02-01' },
          { NrKontrahenta: '2222222222', NazwaKontrahenta: 'B', DowodSprzedazy: 'FV/2', DataWystawienia: '2026-02-02' },
          { NrKontrahenta: '3333333333', NazwaKontrahenta: 'C', DowodSprzedazy: 'FV/3', DataWystawienia: '2026-02-03' },
        ],
      }))

      expect(xml).toContain('<LpSprzedazy>1</LpSprzedazy>')
      expect(xml).toContain('<LpSprzedazy>2</LpSprzedazy>')
      expect(xml).toContain('<LpSprzedazy>3</LpSprzedazy>')
    })
  })

  // ── GTU codes ──
  describe('GTU codes', () => {
    it('includes GTU markers when set to "1"', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          GTU_01: '1',
          GTU_06: '1',
          GTU_12: '1',
        }],
      }))

      expect(xml).toContain('<GTU_01>1</GTU_01>')
      expect(xml).toContain('<GTU_06>1</GTU_06>')
      expect(xml).toContain('<GTU_12>1</GTU_12>')
      // Others should not appear
      expect(xml).not.toContain('<GTU_02>')
      expect(xml).not.toContain('<GTU_13>')
    })

    it('skips GTU markers when set to "0" or empty', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          GTU_01: '0',
          GTU_02: '',
        }],
      }))

      expect(xml).not.toContain('<GTU_01>')
      expect(xml).not.toContain('<GTU_02>')
    })
  })

  // ── Procedure markers ──
  describe('procedure markers', () => {
    it('includes V7M(3) procedure markers', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          WSTO_EE: '1',
          TP: '1',
          IED: '1',
        }],
      }))

      expect(xml).toContain('<WSTO_EE>1</WSTO_EE>')
      expect(xml).toContain('<TP>1</TP>')
      expect(xml).toContain('<IED>1</IED>')
    })

    it('omits procedure markers when not set', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
        }],
      }))

      expect(xml).not.toContain('<WSTO_EE>')
      expect(xml).not.toContain('<TP>')
      expect(xml).not.toContain('<MR_T>')
    })
  })

  // ── KorektaPodstawyOpodt ──
  describe('KorektaPodstawyOpodt', () => {
    it('includes KorektaPodstawyOpodt with TerminPlatnosci', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          KorektaPodstawyOpodt: '1',
          TerminPlatnosci: '2025-08-15',
        }],
      }))

      expect(xml).toContain('<KorektaPodstawyOpodt>1</KorektaPodstawyOpodt>')
      expect(xml).toContain('<TerminPlatnosci>2025-08-15</TerminPlatnosci>')
    })

    it('includes KorektaPodstawyOpodt with DataZaplaty', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          KorektaPodstawyOpodt: '1',
          DataZaplaty: '2026-01-10',
        }],
      }))

      expect(xml).toContain('<KorektaPodstawyOpodt>1</KorektaPodstawyOpodt>')
      expect(xml).toContain('<DataZaplaty>2026-01-10</DataZaplaty>')
    })
  })

  // ── Paired K fields ──
  describe('paired K fields in SprzedazWiersz', () => {
    it('outputs both K_19 and K_20 when only K_19 has a value', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          K_19: '1000.00',
        }],
      }))

      expect(xml).toContain('<K_19>1000.00</K_19>')
      expect(xml).toContain('<K_20>0.00</K_20>')
    })

    it('outputs both K_15 and K_16 when only K_16 has a value', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          K_16: '50.00',
        }],
      }))

      expect(xml).toContain('<K_15>0.00</K_15>')
      expect(xml).toContain('<K_16>50.00</K_16>')
    })

    it('omits K pair when neither field has a value', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          K_10: '500.00',
        }],
      }))

      // K_10 is standalone, should be present
      expect(xml).toContain('<K_10>500.00</K_10>')
      // K_19/K_20 pair not provided, should not appear
      expect(xml).not.toContain('<K_19>')
      expect(xml).not.toContain('<K_20>')
    })

    it('outputs standalone K fields independently', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          K_10: '100.00',
          K_33: '50.00',
        }],
      }))

      expect(xml).toContain('<K_10>100.00</K_10>')
      expect(xml).toContain('<K_33>50.00</K_33>')
    })
  })

  // ── SprzedazCtrl ──
  describe('SprzedazCtrl', () => {
    it('counts rows correctly', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [
          { NrKontrahenta: 'A', NazwaKontrahenta: 'A', DowodSprzedazy: 'FV/1', DataWystawienia: '2026-02-01' },
          { NrKontrahenta: 'B', NazwaKontrahenta: 'B', DowodSprzedazy: 'FV/2', DataWystawienia: '2026-02-02' },
        ],
      }))

      expect(xml).toContain('<LiczbaWierszySprzedazy>2</LiczbaWierszySprzedazy>')
    })

    it('shows 0 rows when empty', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('<LiczbaWierszySprzedazy>0</LiczbaWierszySprzedazy>')
    })

    it('calculates PodatekNalezny from XSD formula', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [
          {
            NrKontrahenta: '1111111111', NazwaKontrahenta: 'A',
            DowodSprzedazy: 'FV/1', DataWystawienia: '2026-02-01',
            K_16: '50.00',   // VAT 5%
            K_20: '230.00',  // VAT 23%
            K_33: '10.00',   // spis z natury
          },
          {
            NrKontrahenta: '2222222222', NazwaKontrahenta: 'B',
            DowodSprzedazy: 'FV/2', DataWystawienia: '2026-02-02',
            K_18: '80.00',   // VAT 8%
            K_35: '20.00',   // pomniejszenie (WNT transport)
          },
        ],
      }))

      // Expected: (50 + 230 + 10 + 80) - 20 = 350
      expect(xml).toContain('<PodatekNalezny>350.00</PodatekNalezny>')
    })

    it('returns 0.00 PodatekNalezny for empty rows', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('<PodatekNalezny>0.00</PodatekNalezny>')
    })

    it('excludes FP rows from PodatekNalezny', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [
          {
            NrKontrahenta: '1111111111', NazwaKontrahenta: 'A',
            DowodSprzedazy: 'FV/1', DataWystawienia: '2026-02-01',
            K_20: '230.00',
          },
          {
            NrKontrahenta: '2222222222', NazwaKontrahenta: 'B',
            DowodSprzedazy: 'FV/2', DataWystawienia: '2026-02-02',
            TypDokumentu: 'FP',
            K_20: '100.00', // FP row — excluded from control sum
          },
        ],
      }))

      // Only first row counts: 230
      expect(xml).toContain('<PodatekNalezny>230.00</PodatekNalezny>')
      // But LiczbaWierszy includes all rows
      expect(xml).toContain('<LiczbaWierszySprzedazy>2</LiczbaWierszySprzedazy>')
    })

    it('handles negative PodatekNalezny (more deductions than tax)', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1111111111', NazwaKontrahenta: 'A',
          DowodSprzedazy: 'FV/1', DataWystawienia: '2026-02-01',
          K_20: '100.00',
          K_35: '150.00',
        }],
      }))

      expect(xml).toContain('<PodatekNalezny>-50.00</PodatekNalezny>')
    })
  })

  // ── ZakupWiersz ──
  describe('ZakupWiersz', () => {
    it('generates basic purchase row', () => {
      const xml = generateJpkV7m(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca Sp. z o.o.',
          DowodZakupu: 'FZ/2026/001',
          DataZakupu: '2026-02-10',
          K_42: '500.00',
          K_43: '115.00',
        }],
      }))

      expect(xml).toContain('<LpZakupu>1</LpZakupu>')
      expect(xml).toContain('<NrDostawcy>9876543210</NrDostawcy>')
      expect(xml).toContain('<NazwaDostawcy>Dostawca Sp. z o.o.</NazwaDostawcy>')
      expect(xml).toContain('<DowodZakupu>FZ/2026/001</DowodZakupu>')
      expect(xml).toContain('<DataZakupu>2026-02-10</DataZakupu>')
      expect(xml).toContain('<BFK>1</BFK>')
      expect(xml).toContain('<K_42>500.00</K_42>')
      expect(xml).toContain('<K_43>115.00</K_43>')
    })

    it('includes DataWplywu when provided', () => {
      const xml = generateJpkV7m(makeInput({
        zakupWiersze: [{
          NrDostawcy: '1234567890',
          NazwaDostawcy: 'Test',
          DowodZakupu: 'FZ/001',
          DataZakupu: '2026-02-10',
          DataWplywu: '2026-02-12',
        }],
      }))

      expect(xml).toContain('<DataWplywu>2026-02-12</DataWplywu>')
    })

    it('includes DokumentZakupu when provided', () => {
      const xml = generateJpkV7m(makeInput({
        zakupWiersze: [{
          NrDostawcy: '1234567890',
          NazwaDostawcy: 'Test',
          DowodZakupu: 'FZ/001',
          DataZakupu: '2026-02-10',
          DokumentZakupu: 'VAT_RR',
          DI: '1',
        }],
      }))

      expect(xml).toContain('<DokumentZakupu>VAT_RR</DokumentZakupu>')
    })

    it('includes IMP marker when set', () => {
      const xml = generateJpkV7m(makeInput({
        zakupWiersze: [{
          NrDostawcy: '1234567890',
          NazwaDostawcy: 'Test',
          DowodZakupu: 'FZ/001',
          DataZakupu: '2026-02-10',
          IMP: '1',
        }],
      }))

      expect(xml).toContain('<IMP>1</IMP>')
    })

    it('handles paired K_40/K_41 fields', () => {
      const xml = generateJpkV7m(makeInput({
        zakupWiersze: [{
          NrDostawcy: '1234567890',
          NazwaDostawcy: 'Test',
          DowodZakupu: 'FZ/001',
          DataZakupu: '2026-02-10',
          K_40: '10000.00',
        }],
      }))

      expect(xml).toContain('<K_40>10000.00</K_40>')
      expect(xml).toContain('<K_41>0.00</K_41>')
    })

    it('includes ZakupVAT_Marza when provided', () => {
      const xml = generateJpkV7m(makeInput({
        zakupWiersze: [{
          NrDostawcy: '1234567890',
          NazwaDostawcy: 'Test',
          DowodZakupu: 'FZ/001',
          DataZakupu: '2026-02-10',
          ZakupVAT_Marza: '500.00',
        }],
      }))

      expect(xml).toContain('<ZakupVAT_Marza>500.00</ZakupVAT_Marza>')
    })
  })

  // ── ZakupCtrl ──
  describe('ZakupCtrl', () => {
    it('counts purchase rows correctly', () => {
      const xml = generateJpkV7m(makeInput({
        zakupWiersze: [
          { NrDostawcy: 'A', NazwaDostawcy: 'A', DowodZakupu: 'FZ/1', DataZakupu: '2026-02-01' },
          { NrDostawcy: 'B', NazwaDostawcy: 'B', DowodZakupu: 'FZ/2', DataZakupu: '2026-02-02' },
          { NrDostawcy: 'C', NazwaDostawcy: 'C', DowodZakupu: 'FZ/3', DataZakupu: '2026-02-03' },
        ],
      }))

      expect(xml).toContain('<LiczbaWierszyZakupow>3</LiczbaWierszyZakupow>')
    })

    it('calculates PodatekNaliczony from XSD formula', () => {
      const xml = generateJpkV7m(makeInput({
        zakupWiersze: [
          {
            NrDostawcy: 'A', NazwaDostawcy: 'A', DowodZakupu: 'FZ/1', DataZakupu: '2026-02-01',
            K_41: '200.00',  // VAT from fixed assets
            K_43: '115.00',  // VAT from other purchases
          },
          {
            NrDostawcy: 'B', NazwaDostawcy: 'B', DowodZakupu: 'FZ/2', DataZakupu: '2026-02-02',
            K_44: '30.00',   // correction fixed assets
            K_46: '-10.00',  // correction art.89b (negative)
          },
        ],
      }))

      // Expected: 200 + 115 + 30 + (-10) = 335
      expect(xml).toContain('<PodatekNaliczony>335.00</PodatekNaliczony>')
    })

    it('returns 0.00 PodatekNaliczony for empty rows', () => {
      const xml = generateJpkV7m(makeInput())
      expect(xml).toContain('<PodatekNaliczony>0.00</PodatekNaliczony>')
    })
  })

  // ── Deklaracja ──
  describe('Deklaracja', () => {
    it('generates Deklaracja header with correct attributes', () => {
      const xml = generateJpkV7m(makeInput({
        deklaracja: { P_38: '1000.00', P_51: '500.00' },
      }))

      expect(xml).toContain('kodSystemowy="VAT-7 (23)"')
      expect(xml).toContain('kodPodatku="VAT"')
      expect(xml).toContain('rodzajZobowiazania="Z"')
      expect(xml).toContain('>VAT-7</KodFormularzaDekl>')
      expect(xml).toContain('<WariantFormularzaDekl>23</WariantFormularzaDekl>')
    })

    it('includes P_38 (required) even as default 0', () => {
      const xml = generateJpkV7m(makeInput({
        deklaracja: {},
      }))

      expect(xml).toContain('<P_38>0</P_38>')
    })

    it('includes P_51 (required) even as default 0', () => {
      const xml = generateJpkV7m(makeInput({
        deklaracja: {},
      }))

      expect(xml).toContain('<P_51>0</P_51>')
    })

    it('outputs declaration fields in correct order', () => {
      const xml = generateJpkV7m(makeInput({
        deklaracja: {
          P_10: '5000.00',
          P_19: '10000.00',
          P_20: '2300.00',
          P_38: '2300.00',
          P_51: '2300.00',
        },
      }))

      const p10Pos = xml.indexOf('<P_10>')
      const p19Pos = xml.indexOf('<P_19>')
      const p20Pos = xml.indexOf('<P_20>')
      const p38Pos = xml.indexOf('<P_38>')
      const p51Pos = xml.indexOf('<P_51>')

      expect(p10Pos).toBeLessThan(p19Pos)
      expect(p19Pos).toBeLessThan(p20Pos)
      expect(p20Pos).toBeLessThan(p38Pos)
      expect(p38Pos).toBeLessThan(p51Pos)
    })

    it('includes Pouczenia = 1 by default', () => {
      const xml = generateJpkV7m(makeInput({
        deklaracja: { P_38: '0', P_51: '0' },
      }))

      expect(xml).toContain('<Pouczenia>1</Pouczenia>')
    })

    it('handles paired Deklaracja fields (P_19 + P_20) with integer format', () => {
      const xml = generateJpkV7m(makeInput({
        deklaracja: { P_19: '10000.00', P_38: '2300.00', P_51: '2300.00' },
      }))

      // P_19 has value, P_20 should default to 0 (integer format for TKwotaC)
      expect(xml).toContain('<P_19>10000</P_19>')
      expect(xml).toContain('<P_20>0</P_20>')
    })
  })

  // ── XML escaping ──
  describe('XML escaping', () => {
    it('escapes & in values', () => {
      const xml = generateJpkV7m(makeInput({
        podmiot: { ...BASE_PODMIOT_NIEFIZYCZNA, pelnaNazwa: 'A & B Sp. z o.o.' },
      }))

      expect(xml).toContain('A &amp; B Sp. z o.o.')
      expect(xml).not.toContain('A & B')
    })

    it('escapes < and > in values', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test <ABC> Corp',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
        }],
      }))

      expect(xml).toContain('Test &lt;ABC&gt; Corp')
    })

    it('escapes quotes in values', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Firma "XYZ"',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
        }],
      }))

      expect(xml).toContain('Firma &quot;XYZ&quot;')
    })

    it('escapes apostrophes in values', () => {
      const xml = generateJpkV7m(makeInput({
        podmiot: { ...BASE_PODMIOT_NIEFIZYCZNA, pelnaNazwa: "O'Brien Inc." },
      }))

      expect(xml).toContain('O&apos;Brien Inc.')
    })
  })

  // ── formatAmount ──
  describe('formatAmount', () => {
    it('formats number to 2 decimal places', () => {
      expect(formatAmount(100)).toBe('100.00')
      expect(formatAmount(100.5)).toBe('100.50')
      expect(formatAmount(100.555)).toBe('100.56')
    })

    it('formats string number', () => {
      expect(formatAmount('100')).toBe('100.00')
      expect(formatAmount('100.5')).toBe('100.50')
    })

    it('returns 0.00 for undefined/empty/NaN', () => {
      expect(formatAmount(undefined)).toBe('0.00')
      expect(formatAmount('')).toBe('0.00')
      expect(formatAmount('abc')).toBe('0.00')
    })

    it('handles negative numbers', () => {
      expect(formatAmount(-50)).toBe('-50.00')
      expect(formatAmount('-50.5')).toBe('-50.50')
    })
  })

  // ── formatDeclAmount ──
  describe('formatDeclAmount', () => {
    it('formats to integer (rounds)', () => {
      expect(formatDeclAmount(1000)).toBe('1000')
      expect(formatDeclAmount(1000.5)).toBe('1001')
      expect(formatDeclAmount(1000.49)).toBe('1000')
    })

    it('formats string numbers to integer', () => {
      expect(formatDeclAmount('2300.00')).toBe('2300')
      expect(formatDeclAmount('500')).toBe('500')
    })

    it('returns 0 for undefined/empty/NaN', () => {
      expect(formatDeclAmount(undefined)).toBe('0')
      expect(formatDeclAmount('')).toBe('0')
      expect(formatDeclAmount('abc')).toBe('0')
    })

    it('handles negative numbers', () => {
      expect(formatDeclAmount(-50)).toBe('-50')
      expect(formatDeclAmount('-115.00')).toBe('-115')
    })
  })

  // ── escapeXml ──
  describe('escapeXml', () => {
    it('escapes all 5 XML special characters', () => {
      expect(escapeXml('&')).toBe('&amp;')
      expect(escapeXml('<')).toBe('&lt;')
      expect(escapeXml('>')).toBe('&gt;')
      expect(escapeXml('"')).toBe('&quot;')
      expect(escapeXml("'")).toBe('&apos;')
    })

    it('escapes multiple special characters in one string', () => {
      expect(escapeXml('A & B <C> "D" \'E\'')).toBe('A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;')
    })

    it('passes through clean strings', () => {
      expect(escapeXml('Hello World 123')).toBe('Hello World 123')
    })

    it('handles Polish characters', () => {
      expect(escapeXml('Łódź')).toBe('Łódź')
      expect(escapeXml('Kraków & Gdańsk')).toBe('Kraków &amp; Gdańsk')
    })
  })

  // ── SprzedazVAT_Marza ──
  describe('SprzedazVAT_Marza', () => {
    it('includes SprzedazVAT_Marza when provided', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          SprzedazVAT_Marza: '1500.00',
        }],
      }))

      expect(xml).toContain('<SprzedazVAT_Marza>1500.00</SprzedazVAT_Marza>')
    })
  })

  // ── Full integration ──
  describe('full integration', () => {
    it('generates complete XML with all sections', () => {
      const xml = generateJpkV7m({
        naglowek: {
          celZlozenia: 1,
          kodUrzedu: '1471',
          rok: 2026,
          miesiac: 3,
          nazwaSystemu: 'TestERP',
        },
        podmiot: {
          typ: 'niefizyczna',
          nip: '5261040828',
          pelnaNazwa: 'Test Sp. z o.o.',
          email: 'test@test.pl',
          telefon: '221234567',
        },
        sprzedazWiersze: [
          {
            NrKontrahenta: '7680002466',
            NazwaKontrahenta: 'Kowalski Jan',
            DowodSprzedazy: 'FV/2026/001',
            DataWystawienia: '2026-03-15',
            DataSprzedazy: '2026-03-10',
            NrKSeF: '1234567890-20260315-ABCDEF-ABCDEF-AB',
            GTU_06: '1',
            TP: '1',
            K_19: '1000.00',
            K_20: '230.00',
          },
          {
            NrKontrahenta: 'BRAK',
            NazwaKontrahenta: 'Raport kasowy',
            DowodSprzedazy: 'RK/001',
            DataWystawienia: '2026-03-31',
            DI: '1',
            TypDokumentu: 'RO',
            K_19: '500.00',
            K_20: '115.00',
          },
        ],
        zakupWiersze: [
          {
            NrDostawcy: '9999999999',
            NazwaDostawcy: 'Supplier Ltd.',
            DowodZakupu: 'FZ/001',
            DataZakupu: '2026-03-05',
            K_42: '800.00',
            K_43: '184.00',
          },
        ],
        deklaracja: {
          P_19: '1500.00',
          P_20: '345.00',
          P_38: '345.00',
          P_42: '800.00',
          P_43: '184.00',
          P_48: '184.00',
          P_51: '161.00',
        },
      })

      // Verify structure
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`<JPK xmlns="${V7M_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)
      expect(xml).toContain('</JPK>')

      // Verify key content
      expect(xml).toContain('<Rok>2026</Rok>')
      expect(xml).toContain('<Miesiac>3</Miesiac>')
      expect(xml).toContain('<NIP>5261040828</NIP>')
      expect(xml).toContain('<Telefon>221234567</Telefon>')
      expect(xml).toContain('<LpSprzedazy>1</LpSprzedazy>')
      expect(xml).toContain('<LpSprzedazy>2</LpSprzedazy>')
      expect(xml).toContain('<LpZakupu>1</LpZakupu>')

      // PodatekNalezny: 230 + 115 = 345 (no FP rows)
      expect(xml).toContain('<PodatekNalezny>345.00</PodatekNalezny>')
      expect(xml).toContain('<LiczbaWierszySprzedazy>2</LiczbaWierszySprzedazy>')

      // PodatekNaliczony: 184
      expect(xml).toContain('<PodatekNaliczony>184.00</PodatekNaliczony>')
      expect(xml).toContain('<LiczbaWierszyZakupow>1</LiczbaWierszyZakupow>')

      // Deklaracja (integer format for TKwotaC fields)
      expect(xml).toContain('<P_19>1500</P_19>')
      expect(xml).toContain('<P_51>161</P_51>')
      expect(xml).toContain('<Pouczenia>1</Pouczenia>')
    })

    it('generates valid XML with only Ewidencja (no Deklaracja)', () => {
      const xml = generateJpkV7m({
        naglowek: { celZlozenia: 1, kodUrzedu: '0271', rok: 2026, miesiac: 2 },
        podmiot: BASE_PODMIOT_NIEFIZYCZNA,
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          K_19: '100.00',
          K_20: '23.00',
        }],
        zakupWiersze: [],
      })

      expect(xml).not.toContain('<Deklaracja>')
      expect(xml).toContain('<Ewidencja>')
      expect(xml).toContain('<PodatekNalezny>23.00</PodatekNalezny>')
      expect(xml).toContain('<PodatekNaliczony>0.00</PodatekNaliczony>')
    })
  })

  // ── Element order in SprzedazWiersz ──
  describe('element order in SprzedazWiersz', () => {
    it('maintains XSD element order', () => {
      const xml = generateJpkV7m(makeInput({
        sprzedazWiersze: [{
          KodKrajuNadaniaTIN: 'DE',
          NrKontrahenta: 'DE123456789',
          NazwaKontrahenta: 'German GmbH',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-02-15',
          DataSprzedazy: '2026-02-10',
          NrKSeF: '1234567890-20260215-ABCDEF-ABCDEF-AB',
          TypDokumentu: 'FP',
          GTU_06: '1',
          TP: '1',
          K_19: '1000.00',
          K_20: '230.00',
        }],
      }))

      const positions = [
        xml.indexOf('<LpSprzedazy>'),
        xml.indexOf('<KodKrajuNadaniaTIN>'),
        xml.indexOf('<NrKontrahenta>'),
        xml.indexOf('<NazwaKontrahenta>'),
        xml.indexOf('<DowodSprzedazy>'),
        xml.indexOf('<DataWystawienia>'),
        xml.indexOf('<DataSprzedazy>'),
        xml.indexOf('<NrKSeF>'),
        xml.indexOf('<TypDokumentu>'),
        xml.indexOf('<GTU_06>'),
        xml.indexOf('<TP>'),
        xml.indexOf('<K_19>'),
        xml.indexOf('<K_20>'),
      ]

      // Every position should be greater than the previous
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1])
      }
    })
  })

  // ── Element order in ZakupWiersz ──
  describe('element order in ZakupWiersz', () => {
    it('maintains XSD element order', () => {
      const xml = generateJpkV7m(makeInput({
        zakupWiersze: [{
          KodKrajuNadaniaTIN: 'DE',
          NrDostawcy: 'DE987654321',
          NazwaDostawcy: 'German Supplier',
          DowodZakupu: 'FZ/001',
          DataZakupu: '2026-02-10',
          DataWplywu: '2026-02-12',
          DokumentZakupu: 'MK',
          IMP: '1',
          K_42: '500.00',
          K_43: '115.00',
          K_44: '10.00',
        }],
      }))

      const positions = [
        xml.indexOf('<LpZakupu>'),
        xml.indexOf('<KodKrajuNadaniaTIN>'),
        xml.indexOf('<NrDostawcy>'),
        xml.indexOf('<NazwaDostawcy>'),
        xml.indexOf('<DowodZakupu>'),
        xml.indexOf('<DataZakupu>'),
        xml.indexOf('<DataWplywu>'),
        xml.indexOf('<BFK>'),
        xml.indexOf('<DokumentZakupu>'),
        xml.indexOf('<IMP>'),
        xml.indexOf('<K_42>'),
        xml.indexOf('<K_43>'),
        xml.indexOf('<K_44>'),
      ]

      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1])
      }
    })
  })
})
