import { describe, it, expect } from 'vitest'
import {
  generateJpkV7k,
  V7K_NAMESPACE,
  ETD_NAMESPACE,
  type V7kGeneratorInput,
  type V7kNaglowek,
  type V7kPodmiot,
} from '../../../src/core/generators/JpkV7kGenerator'
import { generatorRegistry } from '../../../src/core/generators/XmlGeneratorEngine'
import '../../../src/core/generators/JpkV7mGenerator'

// ── Test helpers ──

const BASE_NAGLOWEK: V7kNaglowek = {
  celZlozenia: 1,
  kodUrzedu: '0271',
  rok: 2026,
  miesiac: 3,
  nazwaSystemu: 'JPK Universal Converter',
}

const BASE_PODMIOT_NIEFIZYCZNA: V7kPodmiot = {
  typ: 'niefizyczna',
  nip: '5261040828',
  pelnaNazwa: 'ACME Sp. z o.o.',
  email: 'biuro@acme.pl',
}

const BASE_PODMIOT_FIZYCZNA: V7kPodmiot = {
  typ: 'fizyczna',
  nip: '7680002466',
  imie: 'Jan',
  nazwisko: 'Kowalski',
  dataUrodzenia: '1985-03-15',
  email: 'jan@kowalski.pl',
  telefon: '600123456',
}

function makeInput(overrides: Partial<V7kGeneratorInput> = {}): V7kGeneratorInput {
  return {
    naglowek: BASE_NAGLOWEK,
    podmiot: BASE_PODMIOT_NIEFIZYCZNA,
    sprzedazWiersze: [],
    zakupWiersze: [],
    ...overrides,
  }
}

// ── Tests ──

describe('JpkV7kGenerator', () => {
  // ── XML structure ──
  describe('basic XML structure', () => {
    it('generates valid XML header and root element with V7K namespace', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`<JPK xmlns="${V7K_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)
      expect(xml).toContain('</JPK>')
    })

    it('uses V7K namespace (14089), not V7M namespace (14090)', () => {
      expect(V7K_NAMESPACE).toBe('http://crd.gov.pl/wzor/2025/12/19/14089/')
      expect(V7K_NAMESPACE).not.toContain('14090')
    })

    it('generates sections in correct order: Naglowek, Podmiot1, Ewidencja', () => {
      const xml = generateJpkV7k(makeInput())
      const naglowekPos = xml.indexOf('<Naglowek>')
      const podmiotPos = xml.indexOf('<Podmiot1')
      const ewidencjaPos = xml.indexOf('<Ewidencja>')

      expect(naglowekPos).toBeLessThan(podmiotPos)
      expect(podmiotPos).toBeLessThan(ewidencjaPos)
    })

    it('generates Deklaracja between Podmiot1 and Ewidencja when provided', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: '1000.00', P_51: '500.00' },
        kwartal: 1,
      }))
      const podmiotPos = xml.indexOf('</Podmiot1>')
      const deklaracjaPos = xml.indexOf('<Deklaracja>')
      const ewidencjaPos = xml.indexOf('<Ewidencja>')

      expect(podmiotPos).toBeLessThan(deklaracjaPos)
      expect(deklaracjaPos).toBeLessThan(ewidencjaPos)
    })

    it('omits Deklaracja when not provided', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).not.toContain('<Deklaracja>')
    })
  })

  // ── Naglowek ──
  describe('Naglowek', () => {
    it('generates KodFormularza with V7K kodSystemowy', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).toContain('kodSystemowy="JPK_V7K (3)"')
      expect(xml).toContain('wersjaSchemy="1-0E"')
      expect(xml).toContain('>JPK_VAT</KodFormularza>')
    })

    it('does NOT contain V7M kodSystemowy', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).not.toContain('JPK_V7M (3)')
    })

    it('generates WariantFormularza = 3', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).toContain('<WariantFormularza>3</WariantFormularza>')
    })

    it('generates DataWytworzeniaJPK in ISO format', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).toMatch(/<DataWytworzeniaJPK>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/DataWytworzeniaJPK>/)
    })

    it('includes NazwaSystemu when provided', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).toContain('<NazwaSystemu>JPK Universal Converter</NazwaSystemu>')
    })

    it('omits NazwaSystemu when not provided', () => {
      const xml = generateJpkV7k(makeInput({
        naglowek: { ...BASE_NAGLOWEK, nazwaSystemu: undefined },
      }))
      expect(xml).not.toContain('NazwaSystemu')
    })

    it('generates CelZlozenia with poz attribute', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).toContain('<CelZlozenia poz="P_7">1</CelZlozenia>')
    })

    it('generates Rok and Miesiac', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).toContain('<Rok>2026</Rok>')
      expect(xml).toContain('<Miesiac>3</Miesiac>')
    })

    it('uses Miesiac in main Naglowek (same as V7M per XSD)', () => {
      const xml = generateJpkV7k(makeInput({
        naglowek: { ...BASE_NAGLOWEK, miesiac: 6 },
      }))
      expect(xml).toContain('<Miesiac>6</Miesiac>')
      // Kwartal is only in Deklaracja, not in main Naglowek
      const naglowekSection = xml.split('</Naglowek>')[0]
      expect(naglowekSection).not.toContain('<Kwartal>')
    })
  })

  // ── Podmiot1 ──
  describe('Podmiot1', () => {
    it('generates OsobaNiefizyczna for niefizyczna type', () => {
      const xml = generateJpkV7k(makeInput())
      expect(xml).toContain('<OsobaNiefizyczna>')
      expect(xml).toContain('<NIP>5261040828</NIP>')
      expect(xml).toContain('<PelnaNazwa>ACME Sp. z o.o.</PelnaNazwa>')
      expect(xml).toContain('<Email>biuro@acme.pl</Email>')
    })

    it('generates OsobaFizyczna with etd namespace', () => {
      const xml = generateJpkV7k(makeInput({ podmiot: BASE_PODMIOT_FIZYCZNA }))
      expect(xml).toContain('<OsobaFizyczna>')
      expect(xml).toContain('<etd:NIP>7680002466</etd:NIP>')
      expect(xml).toContain('<etd:ImiePierwsze>Jan</etd:ImiePierwsze>')
      expect(xml).toContain('<etd:Nazwisko>Kowalski</etd:Nazwisko>')
      expect(xml).toContain('<etd:DataUrodzenia>1985-03-15</etd:DataUrodzenia>')
      expect(xml).toContain('<Email>jan@kowalski.pl</Email>')
      expect(xml).toContain('<Telefon>600123456</Telefon>')
    })
  })

  // ── Deklaracja — V7K-specific ──
  describe('Deklaracja', () => {
    it('generates VAT-7K KodFormularzaDekl (not VAT-7)', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: 0, P_51: 0 },
        kwartal: 1,
      }))
      expect(xml).toContain('kodSystemowy="VAT-7K (17)"')
      expect(xml).toContain('>VAT-7K</KodFormularzaDekl>')
      expect(xml).not.toContain('VAT-7 (23)')
      expect(xml).not.toContain('>VAT-7</KodFormularzaDekl>')
    })

    it('generates WariantFormularzaDekl = 17 (not 23)', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: 0, P_51: 0 },
        kwartal: 2,
      }))
      expect(xml).toContain('<WariantFormularzaDekl>17</WariantFormularzaDekl>')
      expect(xml).not.toContain('<WariantFormularzaDekl>23</WariantFormularzaDekl>')
    })

    it('generates Kwartal element in Deklaracja Naglowek', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: 0, P_51: 0 },
        kwartal: 3,
      }))
      expect(xml).toContain('<Kwartal>3</Kwartal>')
    })

    it('generates Kwartal for each valid quarter (1-4)', () => {
      for (const q of [1, 2, 3, 4]) {
        const xml = generateJpkV7k(makeInput({
          deklaracja: { P_38: 0, P_51: 0 },
          kwartal: q,
        }))
        expect(xml).toContain(`<Kwartal>${q}</Kwartal>`)
      }
    })

    it('omits Kwartal when kwartal is not provided', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: 0, P_51: 0 },
      }))
      expect(xml).not.toContain('<Kwartal>')
    })

    it('generates required P_38 field', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: 1500, P_51: 700 },
        kwartal: 1,
      }))
      expect(xml).toContain('<P_38>1500</P_38>')
    })

    it('generates required P_51 field', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: 1500, P_51: 700 },
        kwartal: 1,
      }))
      expect(xml).toContain('<P_51>700</P_51>')
    })

    it('generates optional P_ fields when provided', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: {
          P_10: 5000,
          P_15: 10000,
          P_16: 2300,
          P_38: 2300,
          P_51: 1000,
          P_62: 100,
        },
        kwartal: 4,
      }))
      expect(xml).toContain('<P_10>5000</P_10>')
      expect(xml).toContain('<P_15>10000</P_15>')
      expect(xml).toContain('<P_16>2300</P_16>')
      expect(xml).toContain('<P_62>100</P_62>')
    })

    it('generates Pouczenia = 1 by default', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: 0, P_51: 0 },
        kwartal: 1,
      }))
      expect(xml).toContain('<Pouczenia>1</Pouczenia>')
    })

    it('Kwartal appears after WariantFormularzaDekl in Deklaracja Naglowek', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: 0, P_51: 0 },
        kwartal: 2,
      }))
      const wariantPos = xml.indexOf('<WariantFormularzaDekl>')
      const kwartalPos = xml.indexOf('<Kwartal>')
      const pozycjePos = xml.indexOf('<PozycjeSzczegolowe>')

      expect(wariantPos).toBeLessThan(kwartalPos)
      expect(kwartalPos).toBeLessThan(pozycjePos)
    })

    it('generates Deklaracja attributes with correct V7K values', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: { P_38: 0, P_51: 0 },
        kwartal: 1,
      }))
      expect(xml).toContain('kodPodatku="VAT"')
      expect(xml).toContain('rodzajZobowiazania="Z"')
      expect(xml).toContain('wersjaSchemy="1-0E"')
    })
  })

  // ── SprzedazWiersz (identical to V7M) ──
  describe('SprzedazWiersz', () => {
    it('generates basic sales row with BFK default', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Firma ABC',
          DowodSprzedazy: 'FV/001/2026',
          DataWystawienia: '2026-03-15',
          K_19: '1000.00',
          K_20: '230.00',
        }],
      }))
      expect(xml).toContain('<LpSprzedazy>1</LpSprzedazy>')
      expect(xml).toContain('<NrKontrahenta>1234567890</NrKontrahenta>')
      expect(xml).toContain('<NazwaKontrahenta>Firma ABC</NazwaKontrahenta>')
      expect(xml).toContain('<DowodSprzedazy>FV/001/2026</DowodSprzedazy>')
      expect(xml).toContain('<BFK>1</BFK>')
      expect(xml).toContain('<K_19>1000.00</K_19>')
      expect(xml).toContain('<K_20>230.00</K_20>')
    })

    it('generates NrKSeF when provided', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001/2026',
          DataWystawienia: '2026-03-15',
          NrKSeF: '1234567890-20260315-ABC123DEF456',
        }],
      }))
      expect(xml).toContain('<NrKSeF>1234567890-20260315-ABC123DEF456</NrKSeF>')
      expect(xml).not.toContain('<BFK>')
    })

    it('generates GTU codes', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001/2026',
          DataWystawienia: '2026-03-15',
          GTU_01: '1',
          GTU_13: '1',
        }],
      }))
      expect(xml).toContain('<GTU_01>1</GTU_01>')
      expect(xml).toContain('<GTU_13>1</GTU_13>')
    })

    it('generates procedure markers', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001/2026',
          DataWystawienia: '2026-03-15',
          TP: '1',
          WSTO_EE: '1',
        }],
      }))
      expect(xml).toContain('<TP>1</TP>')
      expect(xml).toContain('<WSTO_EE>1</WSTO_EE>')
    })
  })

  // ── SprzedazCtrl ──
  describe('SprzedazCtrl', () => {
    it('generates correct control sums', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [
          {
            NrKontrahenta: '111', NazwaKontrahenta: 'A',
            DowodSprzedazy: 'F1', DataWystawienia: '2026-03-01',
            K_19: '1000', K_20: '230',
          },
          {
            NrKontrahenta: '222', NazwaKontrahenta: 'B',
            DowodSprzedazy: 'F2', DataWystawienia: '2026-03-02',
            K_19: '2000', K_20: '460',
          },
        ],
      }))
      expect(xml).toContain('<LiczbaWierszySprzedazy>2</LiczbaWierszySprzedazy>')
      // PodatekNalezny = K_20 row1 (230) + K_20 row2 (460) = 690
      expect(xml).toContain('<PodatekNalezny>690.00</PodatekNalezny>')
    })

    it('excludes FP rows from PodatekNalezny', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [
          {
            NrKontrahenta: '111', NazwaKontrahenta: 'A',
            DowodSprzedazy: 'F1', DataWystawienia: '2026-03-01',
            K_19: '1000', K_20: '230',
          },
          {
            NrKontrahenta: '222', NazwaKontrahenta: 'B',
            DowodSprzedazy: 'FP1', DataWystawienia: '2026-03-02',
            TypDokumentu: 'FP',
            K_19: '5000', K_20: '1150',
          },
        ],
      }))
      expect(xml).toContain('<LiczbaWierszySprzedazy>2</LiczbaWierszySprzedazy>')
      // Only row1 counts: 230
      expect(xml).toContain('<PodatekNalezny>230.00</PodatekNalezny>')
    })
  })

  // ── ZakupWiersz ──
  describe('ZakupWiersz', () => {
    it('generates basic purchase row', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca XYZ',
          DowodZakupu: 'FZ/001/2026',
          DataZakupu: '2026-03-10',
          K_40: '800.00',
          K_41: '184.00',
        }],
      }))
      expect(xml).toContain('<LpZakupu>1</LpZakupu>')
      expect(xml).toContain('<NrDostawcy>9876543210</NrDostawcy>')
      expect(xml).toContain('<NazwaDostawcy>Dostawca XYZ</NazwaDostawcy>')
      expect(xml).toContain('<K_40>800.00</K_40>')
      expect(xml).toContain('<K_41>184.00</K_41>')
    })
  })

  // ── ZakupCtrl ──
  describe('ZakupCtrl', () => {
    it('generates correct control sums', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [
          {
            NrDostawcy: '111', NazwaDostawcy: 'A',
            DowodZakupu: 'Z1', DataZakupu: '2026-03-01',
            K_40: '500', K_41: '115',
          },
          {
            NrDostawcy: '222', NazwaDostawcy: 'B',
            DowodZakupu: 'Z2', DataZakupu: '2026-03-02',
            K_42: '300', K_43: '69',
          },
        ],
      }))
      expect(xml).toContain('<LiczbaWierszyZakupow>2</LiczbaWierszyZakupow>')
      // PodatekNaliczony = K_41 (115) + K_43 (69) = 184
      expect(xml).toContain('<PodatekNaliczony>184.00</PodatekNaliczony>')
    })
  })

  // ── Branch coverage — uncovered conditional paths ──
  describe('branch coverage — uncovered conditional paths', () => {
    it('generates OFF=1 when NrKSeF is absent and OFF is set in SprzedazWiersz', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/001',
          DataWystawienia: '2026-03-15',
          OFF: '1',
        }],
      }))
      expect(xml).toContain('<OFF>1</OFF>')
      expect(xml).not.toContain('<BFK>')
      expect(xml).not.toContain('<NrKSeF>')
    })

    it('generates DI=1 when NrKSeF and OFF are absent in SprzedazWiersz', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/002',
          DataWystawienia: '2026-03-15',
          DI: '1',
        }],
      }))
      expect(xml).toContain('<DI>1</DI>')
      expect(xml).not.toContain('<BFK>')
      expect(xml).not.toContain('<OFF>')
    })

    it('generates OFF=1 with value "true" in SprzedazWiersz', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/002b',
          DataWystawienia: '2026-03-15',
          OFF: 'true',
        }],
      }))
      expect(xml).toContain('<OFF>1</OFF>')
    })

    it('generates DI=1 with value "true" in SprzedazWiersz', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/002c',
          DataWystawienia: '2026-03-15',
          DI: 'true',
        }],
      }))
      expect(xml).toContain('<DI>1</DI>')
    })

    it('generates DokumentZakupu when provided in ZakupWiersz', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/001',
          DataZakupu: '2026-03-10',
          DokumentZakupu: 'MK',
          K_40: '800',
          K_41: '184',
        }],
      }))
      expect(xml).toContain('<DokumentZakupu>MK</DokumentZakupu>')
    })

    it('generates ZakupVAT_Marza when provided in ZakupWiersz', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/002',
          DataZakupu: '2026-03-10',
          ZakupVAT_Marza: '1500.00',
        }],
      }))
      expect(xml).toContain('<ZakupVAT_Marza>1500.00</ZakupVAT_Marza>')
    })

    it('generates OFF=1 in ZakupWiersz when NrKSeF is absent and OFF is set', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/003',
          DataZakupu: '2026-03-10',
          OFF: '1',
        }],
      }))
      expect(xml).toContain('<OFF>1</OFF>')
      expect(xml).not.toContain('<BFK>')
    })

    it('generates DI=1 in ZakupWiersz when NrKSeF and OFF are absent (value "true")', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/004',
          DataZakupu: '2026-03-10',
          DI: 'true',
        }],
      }))
      expect(xml).toContain('<DI>1</DI>')
      expect(xml).not.toContain('<BFK>')
    })

    it('generates DI=1 in ZakupWiersz (value "1")', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/004b',
          DataZakupu: '2026-03-10',
          DI: '1',
        }],
      }))
      expect(xml).toContain('<DI>1</DI>')
    })

    it('generates OFF=1 in ZakupWiersz (value "true")', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/003b',
          DataZakupu: '2026-03-10',
          OFF: 'true',
        }],
      }))
      expect(xml).toContain('<OFF>1</OFF>')
    })

    it('generates NrKSeF in ZakupWiersz when provided', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/005',
          DataZakupu: '2026-03-10',
          NrKSeF: '9876543210-20260310-XYZ789',
        }],
      }))
      expect(xml).toContain('<NrKSeF>9876543210-20260310-XYZ789</NrKSeF>')
      expect(xml).not.toContain('<BFK>')
    })

    it('generates DataWplywu in ZakupWiersz when provided', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/006',
          DataZakupu: '2026-03-10',
          DataWplywu: '2026-03-12',
        }],
      }))
      expect(xml).toContain('<DataWplywu>2026-03-12</DataWplywu>')
    })

    it('generates KodKrajuNadaniaTIN in ZakupWiersz when provided', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          KodKrajuNadaniaTIN: 'DE',
          NrDostawcy: 'DE123456789',
          NazwaDostawcy: 'German GmbH',
          DowodZakupu: 'FZ/007',
          DataZakupu: '2026-03-10',
        }],
      }))
      expect(xml).toContain('<KodKrajuNadaniaTIN>DE</KodKrajuNadaniaTIN>')
    })

    it('generates IMP flag in ZakupWiersz when set', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/008',
          DataZakupu: '2026-03-10',
          IMP: '1',
        }],
      }))
      expect(xml).toContain('<IMP>1</IMP>')
    })

    it('generates SprzedazVAT_Marza when provided', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/003',
          DataWystawienia: '2026-03-15',
          SprzedazVAT_Marza: '2000.00',
        }],
      }))
      expect(xml).toContain('<SprzedazVAT_Marza>2000.00</SprzedazVAT_Marza>')
    })

    it('generates DataSprzedazy in SprzedazWiersz when provided', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/004',
          DataWystawienia: '2026-03-15',
          DataSprzedazy: '2026-03-10',
        }],
      }))
      expect(xml).toContain('<DataSprzedazy>2026-03-10</DataSprzedazy>')
    })

    it('generates KorektaPodstawyOpodt with TerminPlatnosci', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/005',
          DataWystawienia: '2026-03-15',
          KorektaPodstawyOpodt: '1',
          TerminPlatnosci: '2026-04-15',
        }],
      }))
      expect(xml).toContain('<KorektaPodstawyOpodt>1</KorektaPodstawyOpodt>')
      expect(xml).toContain('<TerminPlatnosci>2026-04-15</TerminPlatnosci>')
    })

    it('generates KorektaPodstawyOpodt with DataZaplaty when TerminPlatnosci is absent', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/006',
          DataWystawienia: '2026-03-15',
          KorektaPodstawyOpodt: '1',
          DataZaplaty: '2026-04-01',
        }],
      }))
      expect(xml).toContain('<KorektaPodstawyOpodt>1</KorektaPodstawyOpodt>')
      expect(xml).toContain('<DataZaplaty>2026-04-01</DataZaplaty>')
      expect(xml).not.toContain('<TerminPlatnosci>')
    })

    it('generates KorektaPodstawyOpodt without TerminPlatnosci or DataZaplaty', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/007',
          DataWystawienia: '2026-03-15',
          KorektaPodstawyOpodt: '1',
        }],
      }))
      expect(xml).toContain('<KorektaPodstawyOpodt>1</KorektaPodstawyOpodt>')
      expect(xml).not.toContain('<TerminPlatnosci>')
      expect(xml).not.toContain('<DataZaplaty>')
    })

    it('generates TypDokumentu in SprzedazWiersz when provided', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'RO/001',
          DataWystawienia: '2026-03-15',
          TypDokumentu: 'RO',
        }],
      }))
      expect(xml).toContain('<TypDokumentu>RO</TypDokumentu>')
    })

    it('generates KodKrajuNadaniaTIN in SprzedazWiersz when provided', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          KodKrajuNadaniaTIN: 'DE',
          NrKontrahenta: 'DE123456789',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/008',
          DataWystawienia: '2026-03-15',
        }],
      }))
      expect(xml).toContain('<KodKrajuNadaniaTIN>DE</KodKrajuNadaniaTIN>')
    })

    it('generates standalone K fields in zakup when set', () => {
      const xml = generateJpkV7k(makeInput({
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca',
          DowodZakupu: 'FZ/009',
          DataZakupu: '2026-03-10',
          K_44: '100.00',
          K_45: '200.00',
          K_46: '50.00',
          K_47: '75.00',
        }],
      }))
      expect(xml).toContain('<K_44>100.00</K_44>')
      expect(xml).toContain('<K_45>200.00</K_45>')
      expect(xml).toContain('<K_46>50.00</K_46>')
      expect(xml).toContain('<K_47>75.00</K_47>')
    })

    it('generates fizyczna podmiot without optional fields', () => {
      const xml = generateJpkV7k(makeInput({
        podmiot: {
          typ: 'fizyczna',
          nip: '7680002466',
          email: 'test@test.pl',
        },
      }))
      expect(xml).toContain('<OsobaFizyczna>')
      expect(xml).toContain('<etd:NIP>7680002466</etd:NIP>')
      expect(xml).not.toContain('<etd:ImiePierwsze>')
      expect(xml).not.toContain('<etd:Nazwisko>')
      expect(xml).not.toContain('<etd:DataUrodzenia>')
      expect(xml).not.toContain('<Telefon>')
    })

    it('generates niefizyczna podmiot with telefon', () => {
      const xml = generateJpkV7k(makeInput({
        podmiot: {
          typ: 'niefizyczna',
          nip: '5261040828',
          pelnaNazwa: 'Test',
          email: 'test@test.pl',
          telefon: '500600700',
        },
      }))
      expect(xml).toContain('<Telefon>500600700</Telefon>')
    })

    it('generates Deklaracja with P_61 and P_ORDZU raw fields', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: {
          P_38: 0,
          P_51: 0,
          P_61: 'Uzasadnienie korekty deklaracji',
          P_ORDZU: 'TAK',
        },
        kwartal: 1,
      }))
      expect(xml).toContain('<P_61>Uzasadnienie korekty deklaracji</P_61>')
      expect(xml).toContain('<P_ORDZU>TAK</P_ORDZU>')
    })

    it('calculates PodatekNalezny with minus fields K_35 and K_36', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Test',
          DowodSprzedazy: 'FV/010',
          DataWystawienia: '2026-03-15',
          K_19: '10000',
          K_20: '2300',
          K_35: '100',
          K_36: '50',
          K_360: '25',
        }],
      }))
      // PodatekNalezny = K_20(2300) - K_35(100) - K_36(50) - K_360(25) = 2125
      expect(xml).toContain('<PodatekNalezny>2125.00</PodatekNalezny>')
    })

    it('generates Deklaracja with custom Pouczenia value', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: {
          P_38: 0,
          P_51: 0,
          Pouczenia: '2',
        },
        kwartal: 1,
      }))
      expect(xml).toContain('<Pouczenia>2</Pouczenia>')
    })
  })

  // ── Generator registry — V7K ──
  describe('registry generate function', () => {
    it('generate function works via registry', () => {
      const gen = generatorRegistry.get('JPK_V7K')!
      const xml = gen.generate(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '111',
          NazwaKontrahenta: 'A',
          DowodSprzedazy: 'F1',
          DataWystawienia: '2026-03-01',
          K_19: '1000',
          K_20: '230',
        }],
      }))
      expect(xml).toContain('<SprzedazWiersz>')
      expect(xml).toContain('<K_19>1000.00</K_19>')
    })
  })

  // ── Full integration ──
  describe('full integration', () => {
    it('generates complete V7K XML with all sections', () => {
      const xml = generateJpkV7k(makeInput({
        deklaracja: {
          P_10: 5000,
          P_15: 10000,
          P_16: 2300,
          P_38: 2300,
          P_51: 1000,
        },
        kwartal: 1,
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Firma ABC',
          DowodSprzedazy: 'FV/001/2026',
          DataWystawienia: '2026-03-15',
          K_19: '10000',
          K_20: '2300',
        }],
        zakupWiersze: [{
          NrDostawcy: '9876543210',
          NazwaDostawcy: 'Dostawca XYZ',
          DowodZakupu: 'FZ/001/2026',
          DataZakupu: '2026-03-10',
          K_40: '4347.83',
          K_41: '1000',
        }],
      }))

      // Structure
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`xmlns="${V7K_NAMESPACE}"`)
      expect(xml).toContain('JPK_V7K (3)')
      expect(xml).toContain('VAT-7K')
      expect(xml).toContain('<Kwartal>1</Kwartal>')
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1')
      expect(xml).toContain('<Deklaracja>')
      expect(xml).toContain('<Ewidencja>')
      expect(xml).toContain('<SprzedazWiersz>')
      expect(xml).toContain('<SprzedazCtrl>')
      expect(xml).toContain('<ZakupWiersz>')
      expect(xml).toContain('<ZakupCtrl>')
      expect(xml).toContain('</JPK>')
    })
  })

  // ── XML escaping ──
  describe('XML escaping', () => {
    it('escapes special characters in text fields', () => {
      const xml = generateJpkV7k(makeInput({
        sprzedazWiersze: [{
          NrKontrahenta: '1234567890',
          NazwaKontrahenta: 'Firma "A&B" <sp.>',
          DowodSprzedazy: 'FV/001/2026',
          DataWystawienia: '2026-03-15',
        }],
      }))
      expect(xml).toContain('Firma &quot;A&amp;B&quot; &lt;sp.&gt;')
    })
  })

  // ── Generator registry ──
  describe('generator registry', () => {
    it('registers as JPK_V7K type', () => {
      const gen = generatorRegistry.get('JPK_V7K')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_V7K')
      expect(gen!.version).toBe('3')
      expect(gen!.namespace).toBe(V7K_NAMESPACE)
    })

    it('coexists with V7M in the registry', () => {
      const v7m = generatorRegistry.get('JPK_V7M')
      const v7k = generatorRegistry.get('JPK_V7K')
      expect(v7m).toBeDefined()
      expect(v7k).toBeDefined()
      expect(v7m!.namespace).not.toBe(v7k!.namespace)
    })
  })
})
