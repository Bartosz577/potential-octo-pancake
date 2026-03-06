import { describe, it, expect } from 'vitest'
import {
  generateJpkKrPd,
  KR_PD_NAMESPACE,
  ETD_NAMESPACE,
  MAP_KONTA_PD,
  isValidMapKontaPd,
  escapeXml,
  type KrPdGeneratorInput,
  type KrPdNaglowek,
  type KrPdPodmiot,
  type KrPdZOiSEntry,
  type KrPdDziennik,
  type KrPdKontoZapis,
  type KrPdRpd,
} from '../../../src/core/generators/JpkKrPdGenerator'
import { generatorRegistry } from '../../../src/core/generators/XmlGeneratorEngine'

// ── Test helpers ──

const BASE_NAGLOWEK: KrPdNaglowek = {
  celZlozenia: 1,
  dataOd: '2026-01-01',
  dataDo: '2026-12-31',
  rokDataOd: '2026-01-01',
  rokDataDo: '2026-12-31',
  kodUrzedu: '0271',
}

const BASE_PODMIOT: KrPdPodmiot = {
  nip: '5261040828',
  pelnaNazwa: 'ACME Sp. z o.o.',
  adres: {
    kodKraju: 'PL',
    wojewodztwo: 'mazowieckie',
    powiat: 'm. Warszawa',
    gmina: 'Warszawa',
    ulica: 'Marszałkowska',
    nrDomu: '1',
    miejscowosc: 'Warszawa',
    kodPocztowy: '00-001',
  },
}

const BASE_RPD: KrPdRpd = {
  k1: 0, k2: 0, k3: 0, k4: 0, k5: 0, k6: 0, k7: 0, k8: 0,
}

function makeZOiS(overrides: Partial<KrPdZOiSEntry> = {}): KrPdZOiSEntry {
  return {
    numerKonta: '100',
    nazwaKonta: 'Kasa',
    kontoNadrzedne: '1',
    saldoPoczatkoweWn: 1000,
    saldoPoczatkoweMa: 0,
    obrotyBiezaceWn: 500,
    obrotyBiezaceMa: 200,
    obrotyNarastajaceWn: 500,
    obrotyNarastajaceMa: 200,
    saldoKoncoweWn: 1300,
    saldoKoncoweMa: 0,
    mapKonta1: 'BAA_A_W',
    ...overrides,
  }
}

function makeKontoZapisWn(overrides: Partial<KrPdKontoZapis> = {}): KrPdKontoZapis {
  return { lp: '1', opis: 'Wpłata', numerKonta: '100', kwotaWn: 1000, ...overrides }
}

function makeKontoZapisMa(overrides: Partial<KrPdKontoZapis> = {}): KrPdKontoZapis {
  return { lp: '2', opis: 'Wpłata', numerKonta: '201', kwotaMa: 1000, ...overrides }
}

function makeDziennik(overrides: Partial<KrPdDziennik> = {}): KrPdDziennik {
  return {
    numerZapisu: '1',
    opisDziennika: 'Zakup',
    numerDowodu: 'FV/001/2026',
    rodzajDowodu: 'Faktura VAT',
    dataOperacji: '2026-03-15',
    dataDowodu: '2026-03-15',
    dataKsiegowania: '2026-03-15',
    osobaOdpowiedzialna: 'Jan Kowalski',
    opisOperacji: 'Zakup materiałów',
    kwotaOperacji: 1000,
    kontoZapisy: [makeKontoZapisWn(), makeKontoZapisMa()],
    ...overrides,
  }
}

function makeInput(overrides: Partial<KrPdGeneratorInput> = {}): KrPdGeneratorInput {
  return {
    naglowek: BASE_NAGLOWEK,
    podmiot: BASE_PODMIOT,
    zpisSald: [makeZOiS()],
    dziennik: [makeDziennik()],
    rpd: BASE_RPD,
    ...overrides,
  }
}

// ── Tests ──

describe('JpkKrPdGenerator', () => {
  // ── XML structure ──
  describe('basic XML structure', () => {
    it('generates valid XML header and root with KR_PD namespace', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`<JPK xmlns="${KR_PD_NAMESPACE}" xmlns:etd="${ETD_NAMESPACE}">`)
      expect(xml).toContain('</JPK>')
    })

    it('uses correct KR_PD namespace (09041)', () => {
      expect(KR_PD_NAMESPACE).toBe('http://jpk.mf.gov.pl/wzor/2024/09/04/09041/')
    })

    it('generates sections in correct order per XSD', () => {
      const xml = generateJpkKrPd(makeInput())
      const naglowekPos = xml.indexOf('<Naglowek>')
      const podmiotPos = xml.indexOf('<Podmiot1>')
      const zoisPos = xml.indexOf('<ZOiS>')
      const dziennikPos = xml.indexOf('<Dziennik>')
      const ctrlPos = xml.indexOf('<Ctrl>')
      const rpdPos = xml.indexOf('<RPD>')

      expect(naglowekPos).toBeLessThan(podmiotPos)
      expect(podmiotPos).toBeLessThan(zoisPos)
      expect(zoisPos).toBeLessThan(dziennikPos)
      expect(dziennikPos).toBeLessThan(ctrlPos)
      expect(ctrlPos).toBeLessThan(rpdPos)
    })

    it('includes Kontrahent between Podmiot1 and ZOiS when provided', () => {
      const xml = generateJpkKrPd(makeInput({
        kontrahenci: [{ kod: 'K001', kodKraju: 'PL', nip: '1234567890' }],
      }))
      const podmiotEnd = xml.indexOf('</Podmiot1>')
      const kontrahentPos = xml.indexOf('<Kontrahent>')
      const zoisPos = xml.indexOf('<ZOiS>')

      expect(podmiotEnd).toBeLessThan(kontrahentPos)
      expect(kontrahentPos).toBeLessThan(zoisPos)
    })
  })

  // ── Naglowek ──
  describe('Naglowek', () => {
    it('generates KodFormularza with KR_PD kodSystemowy', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('kodSystemowy="JPK_KR_PD (1)"')
      expect(xml).toContain('wersjaSchemy="1-1"')
      expect(xml).toContain('>JPK_KR_PD</KodFormularza>')
    })

    it('generates WariantFormularza = 1', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('<WariantFormularza>1</WariantFormularza>')
    })

    it('generates DataWytworzeniaJPK in ISO format', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toMatch(/<DataWytworzeniaJPK>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/DataWytworzeniaJPK>/)
    })

    it('generates CelZlozenia 1 and 2', () => {
      for (const cel of [1, 2]) {
        const xml = generateJpkKrPd(makeInput({
          naglowek: { ...BASE_NAGLOWEK, celZlozenia: cel },
        }))
        expect(xml).toContain(`<CelZlozenia>${cel}</CelZlozenia>`)
      }
    })

    it('generates DataOd, DataDo, RokDataOd, RokDataDo', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('<DataOd>2026-01-01</DataOd>')
      expect(xml).toContain('<DataDo>2026-12-31</DataDo>')
      expect(xml).toContain('<RokDataOd>2026-01-01</RokDataOd>')
      expect(xml).toContain('<RokDataDo>2026-12-31</RokDataDo>')
    })

    it('generates optional RokPdDataOd/RokPdDataDo when provided', () => {
      const xml = generateJpkKrPd(makeInput({
        naglowek: { ...BASE_NAGLOWEK, rokPdDataOd: '2026-04-01', rokPdDataDo: '2027-03-31' },
      }))
      expect(xml).toContain('<RokPdDataOd>2026-04-01</RokPdDataOd>')
      expect(xml).toContain('<RokPdDataDo>2027-03-31</RokPdDataDo>')
    })

    it('omits RokPdDataOd/RokPdDataDo when not provided', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).not.toContain('<RokPdDataOd>')
      expect(xml).not.toContain('<RokPdDataDo>')
    })

    it('generates DomyslnyKodWaluty defaulting to PLN', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('<DomyslnyKodWaluty>PLN</DomyslnyKodWaluty>')
    })

    it('generates custom DomyslnyKodWaluty', () => {
      const xml = generateJpkKrPd(makeInput({
        naglowek: { ...BASE_NAGLOWEK, domyslnyKodWaluty: 'EUR' },
      }))
      expect(xml).toContain('<DomyslnyKodWaluty>EUR</DomyslnyKodWaluty>')
    })
  })

  // ── Podmiot1 ──
  describe('Podmiot1', () => {
    it('generates IdentyfikatorPodmiotu with NIP and PelnaNazwa', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('<etd:NIP>5261040828</etd:NIP>')
      expect(xml).toContain('<etd:PelnaNazwa>ACME Sp. z o.o.</etd:PelnaNazwa>')
    })

    it('generates REGON when provided', () => {
      const xml = generateJpkKrPd(makeInput({
        podmiot: { ...BASE_PODMIOT, regon: '123456789' },
      }))
      expect(xml).toContain('<etd:REGON>123456789</etd:REGON>')
    })

    it('generates AdresPol with address fields', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('<AdresPol>')
      expect(xml).toContain('<etd:KodKraju>PL</etd:KodKraju>')
      expect(xml).toContain('<etd:Miejscowosc>Warszawa</etd:Miejscowosc>')
      expect(xml).toContain('<etd:KodPocztowy>00-001</etd:KodPocztowy>')
    })

    it('generates Znacznik_EST when true', () => {
      const xml = generateJpkKrPd(makeInput({
        podmiot: { ...BASE_PODMIOT, znacznikEst: true },
      }))
      expect(xml).toContain('<Znacznik_EST>1</Znacznik_EST>')
    })

    it('generates Znacznik_MSSF when true', () => {
      const xml = generateJpkKrPd(makeInput({
        podmiot: { ...BASE_PODMIOT, znacznikMssf: true },
      }))
      expect(xml).toContain('<Znacznik_MSSF>1</Znacznik_MSSF>')
    })

    it('omits Znacznik flags when false', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).not.toContain('<Znacznik_EST>')
      expect(xml).not.toContain('<Znacznik_MSSF>')
    })
  })

  // ── Kontrahent ──
  describe('Kontrahent', () => {
    it('generates Kontrahent with T_1, T_2, T_3', () => {
      const xml = generateJpkKrPd(makeInput({
        kontrahenci: [{ kod: 'DOSTAWCA1', kodKraju: 'PL', nip: '9876543210' }],
      }))
      expect(xml).toContain('<Kontrahent>')
      expect(xml).toContain('<T_1>DOSTAWCA1</T_1>')
      expect(xml).toContain('<T_2>PL</T_2>')
      expect(xml).toContain('<T_3>9876543210</T_3>')
    })

    it('omits optional T_2 and T_3', () => {
      const xml = generateJpkKrPd(makeInput({
        kontrahenci: [{ kod: 'K001' }],
      }))
      expect(xml).toContain('<T_1>K001</T_1>')
      expect(xml).not.toContain('<T_2>')
      expect(xml).not.toContain('<T_3>')
    })

    it('generates multiple Kontrahent entries', () => {
      const xml = generateJpkKrPd(makeInput({
        kontrahenci: [{ kod: 'K1' }, { kod: 'K2' }, { kod: 'K3' }],
      }))
      const count = (xml.match(/<Kontrahent>/g) || []).length
      expect(count).toBe(3)
    })
  })

  // ── ZOiS (ZOiS7 variant) ──
  describe('ZOiS', () => {
    it('generates ZOiS7 wrapper with S_1..S_11 fields', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('<ZOiS>')
      expect(xml).toContain('<ZOiS7>')
      expect(xml).toContain('<S_1>100</S_1>')
      expect(xml).toContain('<S_2>Kasa</S_2>')
      expect(xml).toContain('<S_3>1</S_3>')
      expect(xml).toContain('<S_4>1000.00</S_4>')
      expect(xml).toContain('<S_5>0.00</S_5>')
      expect(xml).toContain('<S_10>1300.00</S_10>')
      expect(xml).toContain('<S_11>0.00</S_11>')
    })

    it('generates S_12_1 mapKonta1', () => {
      const xml = generateJpkKrPd(makeInput({
        zpisSald: [makeZOiS({ mapKonta1: 'BAA_A_W' })],
      }))
      expect(xml).toContain('<S_12_1>BAA_A_W</S_12_1>')
    })

    it('generates optional S_12_2 and S_12_3', () => {
      const xml = generateJpkKrPd(makeInput({
        zpisSald: [makeZOiS({ mapKonta2: 'BAA_B_W', mapKontaPd: 'PD1' })],
      }))
      expect(xml).toContain('<S_12_2>BAA_B_W</S_12_2>')
      expect(xml).toContain('<S_12_3>PD1</S_12_3>')
    })

    it('omits S_12_2 and S_12_3 when not provided', () => {
      const xml = generateJpkKrPd(makeInput({
        zpisSald: [makeZOiS({ mapKonta2: undefined, mapKontaPd: undefined })],
      }))
      expect(xml).not.toContain('<S_12_2>')
      expect(xml).not.toContain('<S_12_3>')
    })

    it('generates multiple ZOiS7 entries', () => {
      const xml = generateJpkKrPd(makeInput({
        zpisSald: [
          makeZOiS({ numerKonta: '100' }),
          makeZOiS({ numerKonta: '201' }),
          makeZOiS({ numerKonta: '700' }),
        ],
      }))
      const count = (xml.match(/<ZOiS7>/g) || []).length
      expect(count).toBe(3)
    })
  })

  // ── Dziennik ──
  describe('Dziennik', () => {
    it('generates all required D_ fields', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('<Dziennik>')
      expect(xml).toContain('<D_1>1</D_1>')
      expect(xml).toContain('<D_2>Zakup</D_2>')
      expect(xml).toContain('<D_4>FV/001/2026</D_4>')
      expect(xml).toContain('<D_5>Faktura VAT</D_5>')
      expect(xml).toContain('<D_6>2026-03-15</D_6>')
      expect(xml).toContain('<D_9>Jan Kowalski</D_9>')
      expect(xml).toContain('<D_11>1000.00</D_11>')
    })

    it('generates optional D_3 (contractor code)', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik({ kodKontrahenta: 'K001' })],
      }))
      expect(xml).toContain('<D_3>K001</D_3>')
    })

    it('omits D_3 when not provided', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).not.toContain('<D_3>')
    })

    it('generates optional D_12 (KSeF number)', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik({ nrKsef: '1234567890-20260315-ABC123DEF456' })],
      }))
      expect(xml).toContain('<D_12>1234567890-20260315-ABC123DEF456</D_12>')
    })

    it('omits D_12 when not provided', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).not.toContain('<D_12>')
    })
  })

  // ── KontoZapis ──
  describe('KontoZapis', () => {
    it('generates debit posting (Z_4)', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik({
          kontoZapisy: [makeKontoZapisWn({ kwotaWn: 500 })],
        })],
      }))
      expect(xml).toContain('<KontoZapis>')
      expect(xml).toContain('<Z_1>1</Z_1>')
      expect(xml).toContain('<Z_4>500.00</Z_4>')
      expect(xml).not.toContain('<Z_7>')
    })

    it('generates credit posting (Z_7)', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik({
          kontoZapisy: [makeKontoZapisMa({ kwotaMa: 500 })],
        })],
      }))
      expect(xml).toContain('<Z_7>500.00</Z_7>')
      expect(xml).not.toContain('<Z_4>')
    })

    it('generates foreign currency fields for debit', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik({
          kontoZapisy: [{
            lp: '1', opis: 'FX', numerKonta: '100',
            kwotaWn: 4300, kwotaWnWaluta: 1000, kodWalutyWn: 'EUR',
          }],
        })],
      }))
      expect(xml).toContain('<Z_4>4300.00</Z_4>')
      expect(xml).toContain('<Z_5>1000.00</Z_5>')
      expect(xml).toContain('<Z_6>EUR</Z_6>')
    })

    it('generates foreign currency fields for credit', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik({
          kontoZapisy: [{
            lp: '1', opis: 'FX', numerKonta: '201',
            kwotaMa: 4300, kwotaMaWaluta: 1000, kodWalutyMa: 'USD',
          }],
        })],
      }))
      expect(xml).toContain('<Z_7>4300.00</Z_7>')
      expect(xml).toContain('<Z_8>1000.00</Z_8>')
      expect(xml).toContain('<Z_9>USD</Z_9>')
    })

    it('generates multiple KontoZapis within a Dziennik', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik({
          kontoZapisy: [
            makeKontoZapisWn({ lp: '1', kwotaWn: 500 }),
            makeKontoZapisMa({ lp: '2', kwotaMa: 300 }),
            makeKontoZapisMa({ lp: '3', kwotaMa: 200 }),
          ],
        })],
      }))
      const count = (xml.match(/<KontoZapis>/g) || []).length
      expect(count).toBe(3)
    })
  })

  // ── Ctrl ──
  describe('Ctrl', () => {
    it('generates C_1 (count of Dziennik entries)', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik(), makeDziennik({ numerZapisu: '2' })],
      }))
      expect(xml).toContain('<C_1>2</C_1>')
    })

    it('generates C_2 (sum of D_11)', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [
          makeDziennik({ kwotaOperacji: 1000 }),
          makeDziennik({ numerZapisu: '2', kwotaOperacji: 2500 }),
        ],
      }))
      expect(xml).toContain('<C_2>3500.00</C_2>')
    })

    it('generates C_3 (total KontoZapis count)', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [
          makeDziennik({ kontoZapisy: [makeKontoZapisWn(), makeKontoZapisMa()] }),
          makeDziennik({ numerZapisu: '2', kontoZapisy: [makeKontoZapisWn()] }),
        ],
      }))
      expect(xml).toContain('<C_3>3</C_3>')
    })

    it('generates C_4 (sum of Z_4 debits) and C_5 (sum of Z_7 credits)', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik({
          kontoZapisy: [
            makeKontoZapisWn({ kwotaWn: 500 }),
            makeKontoZapisWn({ lp: '2', kwotaWn: 300 }),
            makeKontoZapisMa({ lp: '3', kwotaMa: 800 }),
          ],
        })],
      }))
      expect(xml).toContain('<C_4>800.00</C_4>')
      expect(xml).toContain('<C_5>800.00</C_5>')
    })
  })

  // ── RPD ──
  describe('RPD', () => {
    it('generates all K_1..K_8 fields', () => {
      const xml = generateJpkKrPd(makeInput({
        rpd: { k1: 1000, k2: 2000, k3: 500, k4: 3000, k5: 1500, k6: 200, k7: 100, k8: 50 },
      }))
      expect(xml).toContain('<RPD>')
      expect(xml).toContain('<K_1>1000.00</K_1>')
      expect(xml).toContain('<K_2>2000.00</K_2>')
      expect(xml).toContain('<K_3>500.00</K_3>')
      expect(xml).toContain('<K_4>3000.00</K_4>')
      expect(xml).toContain('<K_5>1500.00</K_5>')
      expect(xml).toContain('<K_6>200.00</K_6>')
      expect(xml).toContain('<K_7>100.00</K_7>')
      expect(xml).toContain('<K_8>50.00</K_8>')
    })

    it('formats zero RPD values', () => {
      const xml = generateJpkKrPd(makeInput())
      expect(xml).toContain('<K_1>0.00</K_1>')
    })
  })

  // ── MapKontaPD validation ──
  describe('MapKontaPD', () => {
    it('contains 28 values', () => {
      expect(MAP_KONTA_PD).toHaveLength(28)
    })

    it('validates known PD values', () => {
      expect(isValidMapKontaPd('PD1')).toBe(true)
      expect(isValidMapKontaPd('PD4_1')).toBe(true)
      expect(isValidMapKontaPd('PD7_PB')).toBe(true)
      expect(isValidMapKontaPd('PD8_PB_2')).toBe(true)
    })

    it('rejects invalid PD values', () => {
      expect(isValidMapKontaPd('PD99')).toBe(false)
      expect(isValidMapKontaPd('INVALID')).toBe(false)
      expect(isValidMapKontaPd('')).toBe(false)
    })

    it('includes bilansowe and pozabilansowe variants', () => {
      const bilansowe = MAP_KONTA_PD.filter(v => !v.includes('_PB'))
      const pozabilansowe = MAP_KONTA_PD.filter(v => v.includes('_PB'))
      expect(bilansowe.length).toBe(13)
      expect(pozabilansowe.length).toBe(15)
    })
  })

  // ── XML escaping ──
  describe('XML escaping', () => {
    it('escapes special characters in account names', () => {
      const xml = generateJpkKrPd(makeInput({
        zpisSald: [makeZOiS({ nazwaKonta: 'Kasa & Bank "główny"' })],
      }))
      expect(xml).toContain('Kasa &amp; Bank &quot;główny&quot;')
    })

    it('escapes special characters in operation description', () => {
      const xml = generateJpkKrPd(makeInput({
        dziennik: [makeDziennik({ opisOperacji: 'Zakup <materiałów> & usług' })],
      }))
      expect(xml).toContain('Zakup &lt;materiałów&gt; &amp; usług')
    })

    it('escapeXml handles all five entities', () => {
      expect(escapeXml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&apos;')
    })
  })

  // ── Full integration ──
  describe('full integration', () => {
    it('generates complete KR_PD XML with all sections', () => {
      const xml = generateJpkKrPd(makeInput({
        kontrahenci: [{ kod: 'K001', nip: '1234567890' }],
        rpd: { k1: 100, k2: 200, k3: 0, k4: 50, k5: 0, k6: 0, k7: 0, k8: 0 },
      }))

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml).toContain(`xmlns="${KR_PD_NAMESPACE}"`)
      expect(xml).toContain('JPK_KR_PD (1)')
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1>')
      expect(xml).toContain('<Kontrahent>')
      expect(xml).toContain('<ZOiS>')
      expect(xml).toContain('<ZOiS7>')
      expect(xml).toContain('<Dziennik>')
      expect(xml).toContain('<KontoZapis>')
      expect(xml).toContain('<Ctrl>')
      expect(xml).toContain('<RPD>')
      expect(xml).toContain('</JPK>')
    })

    it('generates valid XML with empty ZOiS and minimal Dziennik', () => {
      const xml = generateJpkKrPd(makeInput({
        zpisSald: [],
        dziennik: [makeDziennik()],
      }))
      expect(xml).toContain('<ZOiS>')
      expect(xml).toContain('</ZOiS>')
      expect(xml).toContain('<C_1>1</C_1>')
    })
  })

  // ── Generator registry ──
  describe('generator registry', () => {
    it('registers as JPK_KR_PD type', () => {
      const gen = generatorRegistry.get('JPK_KR_PD')
      expect(gen).toBeDefined()
      expect(gen!.jpkType).toBe('JPK_KR_PD')
      expect(gen!.version).toBe('1')
      expect(gen!.namespace).toBe(KR_PD_NAMESPACE)
    })

    it('generate function works via registry', () => {
      const gen = generatorRegistry.get('JPK_KR_PD')!
      const xml = gen.generate(makeInput())
      expect(xml).toContain('<Dziennik>')
      expect(xml).toContain('<Ctrl>')
    })
  })
})
