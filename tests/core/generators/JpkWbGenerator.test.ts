import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateJpkWb,
  WB_NAMESPACE,
  WB_ETD_NAMESPACE,
  WbGeneratorInput,
  WbPodmiot,
  WbNaglowek,
  WbWiersz,
} from '../../../src/core/generators/JpkWbGenerator'

// ── Test fixtures ──

function makeNaglowek(overrides?: Partial<WbNaglowek>): WbNaglowek {
  return {
    dataOd: '2026-02-01',
    dataDo: '2026-02-28',
    kodUrzedu: '0271',
    ...overrides,
  }
}

function makePodmiot(overrides?: Partial<WbPodmiot>): WbPodmiot {
  return {
    nip: '5261040828',
    pelnaNazwa: 'ACME Sp. z o.o.',
    adres: {
      wojewodztwo: 'MAZOWIECKIE',
      powiat: 'Warszawa',
      gmina: 'Warszawa',
      ulica: 'Marszalkowska',
      nrDomu: '1',
      nrLokalu: '10',
      miejscowosc: 'Warszawa',
      kodPocztowy: '00-001',
      poczta: 'Warszawa',
    },
    ...overrides,
  }
}

function makeWiersze(): WbWiersz[] {
  return [
    {
      dataOperacji: '2026-02-05',
      nazwaPodmiotu: 'Klient ABC Sp. z o.o.',
      opisOperacji: 'Zaplata za FV/2026/001',
      kwotaOperacji: '5000.00',
      saldoOperacji: '15000.00',
    },
    {
      dataOperacji: '2026-02-10',
      nazwaPodmiotu: 'Dostawca XYZ',
      opisOperacji: 'Przelew za FZ/2026/050',
      kwotaOperacji: '-3000.00',
      saldoOperacji: '12000.00',
    },
    {
      dataOperacji: '2026-02-15',
      nazwaPodmiotu: 'ZUS',
      opisOperacji: 'Skladki ZUS 02/2026',
      kwotaOperacji: '-2000.00',
      saldoOperacji: '10000.00',
    },
    {
      dataOperacji: '2026-02-20',
      nazwaPodmiotu: 'Urzad Skarbowy',
      opisOperacji: 'VAT-7 01/2026',
      kwotaOperacji: '-1500.00',
      saldoOperacji: '8500.00',
    },
    {
      dataOperacji: '2026-02-25',
      nazwaPodmiotu: 'Klient DEF',
      opisOperacji: 'Zaplata za FV/2026/010',
      kwotaOperacji: '8000.00',
      saldoOperacji: '16500.00',
    },
  ]
}

function makeInput(overrides?: Partial<WbGeneratorInput>): WbGeneratorInput {
  return {
    naglowek: makeNaglowek(),
    podmiot: makePodmiot(),
    numerRachunku: 'PL61109010140000071219812874',
    saldoPoczatkowe: '10000.00',
    saldoKoncowe: '16500.00',
    wiersze: makeWiersze(),
    ...overrides,
  }
}

function makeMinimalInput(): WbGeneratorInput {
  return {
    naglowek: makeNaglowek(),
    podmiot: makePodmiot(),
    numerRachunku: 'PL61109010140000071219812874',
    saldoPoczatkowe: '0.00',
    saldoKoncowe: '1000.00',
    wiersze: [{
      dataOperacji: '2026-02-01',
      nazwaPodmiotu: 'Kontrahent',
      opisOperacji: 'Wplata',
      kwotaOperacji: '1000.00',
      saldoOperacji: '1000.00',
    }],
  }
}

// ── Tests ──

describe('JpkWbGenerator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-27T17:57:40.000Z'))
  })

  // ── XML structure ──

  describe('XML structure', () => {
    it('generates valid XML declaration', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
    })

    it('includes JPK root element with correct namespaces', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain(`xmlns="${WB_NAMESPACE}"`)
      expect(xml).toContain(`xmlns:etd="${WB_ETD_NAMESPACE}"`)
    })

    it('closes JPK root element', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toMatch(/<\/JPK>$/)
    })

    it('generates all required sections in order', () => {
      const xml = generateJpkWb(makeInput())
      const positions = {
        Naglowek: xml.indexOf('<Naglowek>'),
        Podmiot1: xml.indexOf('<Podmiot1>'),
        NumerRachunku: xml.indexOf('<NumerRachunku>'),
        Salda: xml.indexOf('<Salda>'),
        WyciagWiersz: xml.indexOf('<WyciagWiersz'),
        WyciagCtrl: xml.indexOf('<WyciagCtrl>'),
      }

      expect(positions.Naglowek).toBeLessThan(positions.Podmiot1)
      expect(positions.Podmiot1).toBeLessThan(positions.NumerRachunku)
      expect(positions.NumerRachunku).toBeLessThan(positions.Salda)
      expect(positions.Salda).toBeLessThan(positions.WyciagWiersz)
      expect(positions.WyciagWiersz).toBeLessThan(positions.WyciagCtrl)
    })
  })

  // ── Naglowek ──

  describe('Naglowek', () => {
    it('generates correct KodFormularza', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<KodFormularza kodSystemowy="JPK_WB (1)" wersjaSchemy="1-0">JPK_WB</KodFormularza>')
    })

    it('generates WariantFormularza = 1', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<WariantFormularza>1</WariantFormularza>')
    })

    it('generates CelZlozenia = 1', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<CelZlozenia>1</CelZlozenia>')
    })

    it('generates DataWytworzeniaJPK as ISO datetime', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<DataWytworzeniaJPK>2026-02-27T17:57:40Z</DataWytworzeniaJPK>')
    })

    it('generates DataOd and DataDo', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<DataOd>2026-02-01</DataOd>')
      expect(xml).toContain('<DataDo>2026-02-28</DataDo>')
    })

    it('generates DomyslnyKodWaluty defaults to PLN', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<DomyslnyKodWaluty>PLN</DomyslnyKodWaluty>')
    })

    it('generates DomyslnyKodWaluty with custom value', () => {
      const input = makeMinimalInput()
      input.naglowek.domyslnyKodWaluty = 'EUR'
      const xml = generateJpkWb(input)
      expect(xml).toContain('<DomyslnyKodWaluty>EUR</DomyslnyKodWaluty>')
    })

    it('generates KodUrzedu', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<KodUrzedu>0271</KodUrzedu>')
    })
  })

  // ── Podmiot1 ──

  describe('Podmiot1', () => {
    it('generates IdentyfikatorPodmiotu with etd: prefix', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<etd:NIP>5261040828</etd:NIP>')
      expect(xml).toContain('<etd:PelnaNazwa>ACME Sp. z o.o.</etd:PelnaNazwa>')
    })

    it('includes REGON when provided', () => {
      const input = makeMinimalInput()
      input.podmiot.regon = '012345678'
      const xml = generateJpkWb(input)
      expect(xml).toContain('<etd:REGON>012345678</etd:REGON>')
    })

    it('omits REGON when not provided', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).not.toContain('REGON')
    })

    it('generates AdresPodmiotu with etd: prefix', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<AdresPodmiotu>')
      expect(xml).toContain('<etd:KodKraju>PL</etd:KodKraju>')
      expect(xml).toContain('<etd:Wojewodztwo>MAZOWIECKIE</etd:Wojewodztwo>')
      expect(xml).toContain('<etd:Powiat>Warszawa</etd:Powiat>')
      expect(xml).toContain('<etd:Gmina>Warszawa</etd:Gmina>')
      expect(xml).toContain('<etd:Ulica>Marszalkowska</etd:Ulica>')
      expect(xml).toContain('<etd:NrDomu>1</etd:NrDomu>')
      expect(xml).toContain('<etd:NrLokalu>10</etd:NrLokalu>')
      expect(xml).toContain('<etd:Miejscowosc>Warszawa</etd:Miejscowosc>')
      expect(xml).toContain('<etd:KodPocztowy>00-001</etd:KodPocztowy>')
      expect(xml).toContain('</AdresPodmiotu>')
    })

    it('generates Poczta field (required in TAdresPolski)', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<etd:Poczta>Warszawa</etd:Poczta>')
    })

    it('omits optional address fields', () => {
      const input = makeMinimalInput()
      input.podmiot.adres = {
        wojewodztwo: 'MAZOWIECKIE',
        powiat: 'Warszawa',
        gmina: 'Warszawa',
        nrDomu: '1',
        miejscowosc: 'Warszawa',
        kodPocztowy: '00-001',
        poczta: 'Warszawa',
      }
      const xml = generateJpkWb(input)
      expect(xml).not.toContain('Ulica')
      expect(xml).not.toContain('NrLokalu')
    })
  })

  // ── NumerRachunku ──

  describe('NumerRachunku', () => {
    it('generates IBAN number', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<NumerRachunku>PL61109010140000071219812874</NumerRachunku>')
    })
  })

  // ── Salda ──

  describe('Salda', () => {
    it('generates SaldoPoczatkowe and SaldoKoncowe', () => {
      const xml = generateJpkWb(makeInput())
      expect(xml).toContain('<Salda>')
      expect(xml).toContain('<SaldoPoczatkowe>10000.00</SaldoPoczatkowe>')
      expect(xml).toContain('<SaldoKoncowe>16500.00</SaldoKoncowe>')
      expect(xml).toContain('</Salda>')
    })

    it('formats amounts with 2 decimal places', () => {
      const input = makeMinimalInput()
      input.saldoPoczatkowe = '100'
      input.saldoKoncowe = '1100'
      const xml = generateJpkWb(input)
      expect(xml).toContain('<SaldoPoczatkowe>100.00</SaldoPoczatkowe>')
      expect(xml).toContain('<SaldoKoncowe>1100.00</SaldoKoncowe>')
    })

    it('handles negative saldo', () => {
      const input = makeMinimalInput()
      input.saldoPoczatkowe = '-500.50'
      const xml = generateJpkWb(input)
      expect(xml).toContain('<SaldoPoczatkowe>-500.50</SaldoPoczatkowe>')
    })
  })

  // ── WyciagWiersz ──

  describe('WyciagWiersz', () => {
    it('generates wiersz with typ="G" attribute', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<WyciagWiersz typ="G">')
    })

    it('generates all required fields', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<NumerWiersza>1</NumerWiersza>')
      expect(xml).toContain('<DataOperacji>2026-02-01</DataOperacji>')
      expect(xml).toContain('<NazwaPodmiotu>Kontrahent</NazwaPodmiotu>')
      expect(xml).toContain('<OpisOperacji>Wplata</OpisOperacji>')
      expect(xml).toContain('<KwotaOperacji>1000.00</KwotaOperacji>')
      expect(xml).toContain('<SaldoOperacji>1000.00</SaldoOperacji>')
    })

    it('auto-numbers wiersze sequentially', () => {
      const xml = generateJpkWb(makeInput())
      expect(xml).toContain('<NumerWiersza>1</NumerWiersza>')
      expect(xml).toContain('<NumerWiersza>2</NumerWiersza>')
      expect(xml).toContain('<NumerWiersza>3</NumerWiersza>')
      expect(xml).toContain('<NumerWiersza>4</NumerWiersza>')
      expect(xml).toContain('<NumerWiersza>5</NumerWiersza>')
    })

    it('formats negative amounts (debits)', () => {
      const xml = generateJpkWb(makeInput())
      expect(xml).toContain('<KwotaOperacji>-3000.00</KwotaOperacji>')
      expect(xml).toContain('<KwotaOperacji>-2000.00</KwotaOperacji>')
      expect(xml).toContain('<KwotaOperacji>-1500.00</KwotaOperacji>')
    })

    it('generates multiple wiersze', () => {
      const xml = generateJpkWb(makeInput())
      const matches = xml.match(/<WyciagWiersz typ="G">/g)
      expect(matches).toHaveLength(5)
    })
  })

  // ── WyciagCtrl ──

  describe('WyciagCtrl', () => {
    it('generates LiczbaWierszy', () => {
      const xml = generateJpkWb(makeInput())
      expect(xml).toContain('<LiczbaWierszy>5</LiczbaWierszy>')
    })

    it('generates SumaObciazen (sum of absolute debits)', () => {
      const xml = generateJpkWb(makeInput())
      // debits: -3000 + -2000 + -1500 = 6500
      expect(xml).toContain('<SumaObciazen>6500.00</SumaObciazen>')
    })

    it('generates SumaUznan (sum of credits)', () => {
      const xml = generateJpkWb(makeInput())
      // credits: 5000 + 8000 = 13000
      expect(xml).toContain('<SumaUznan>13000.00</SumaUznan>')
    })

    it('handles single credit entry', () => {
      const xml = generateJpkWb(makeMinimalInput())
      expect(xml).toContain('<LiczbaWierszy>1</LiczbaWierszy>')
      expect(xml).toContain('<SumaObciazen>0.00</SumaObciazen>')
      expect(xml).toContain('<SumaUznan>1000.00</SumaUznan>')
    })

    it('handles only debit entries', () => {
      const input = makeMinimalInput()
      input.wiersze = [
        {
          dataOperacji: '2026-02-01',
          nazwaPodmiotu: 'Dostawca',
          opisOperacji: 'Przelew',
          kwotaOperacji: '-500.00',
          saldoOperacji: '-500.00',
        },
        {
          dataOperacji: '2026-02-02',
          nazwaPodmiotu: 'ZUS',
          opisOperacji: 'Skladki',
          kwotaOperacji: '-300.00',
          saldoOperacji: '-800.00',
        },
      ]
      const xml = generateJpkWb(input)
      expect(xml).toContain('<LiczbaWierszy>2</LiczbaWierszy>')
      expect(xml).toContain('<SumaObciazen>800.00</SumaObciazen>')
      expect(xml).toContain('<SumaUznan>0.00</SumaUznan>')
    })

    it('handles mixed debits and credits with decimals', () => {
      const input = makeMinimalInput()
      input.wiersze = [
        {
          dataOperacji: '2026-02-01',
          nazwaPodmiotu: 'A',
          opisOperacji: 'op1',
          kwotaOperacji: '1234.56',
          saldoOperacji: '1234.56',
        },
        {
          dataOperacji: '2026-02-02',
          nazwaPodmiotu: 'B',
          opisOperacji: 'op2',
          kwotaOperacji: '-789.12',
          saldoOperacji: '445.44',
        },
      ]
      const xml = generateJpkWb(input)
      expect(xml).toContain('<SumaObciazen>789.12</SumaObciazen>')
      expect(xml).toContain('<SumaUznan>1234.56</SumaUznan>')
    })
  })

  // ── XML escaping ──

  describe('XML escaping', () => {
    it('escapes special characters in text fields', () => {
      const input = makeMinimalInput()
      input.wiersze[0].nazwaPodmiotu = 'Firma "ABC & DEF"'
      input.wiersze[0].opisOperacji = 'Przelew <test>'
      const xml = generateJpkWb(input)

      expect(xml).toContain('<NazwaPodmiotu>Firma &quot;ABC &amp; DEF&quot;</NazwaPodmiotu>')
      expect(xml).toContain('<OpisOperacji>Przelew &lt;test&gt;</OpisOperacji>')
    })

    it('escapes special characters in company name', () => {
      const input = makeMinimalInput()
      input.podmiot.pelnaNazwa = 'Test & Co.'
      const xml = generateJpkWb(input)
      expect(xml).toContain('<etd:PelnaNazwa>Test &amp; Co.</etd:PelnaNazwa>')
    })
  })

  // ── Full integration ──

  describe('full integration', () => {
    it('generates complete XML with multiple operations', () => {
      const xml = generateJpkWb(makeInput())

      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1>')
      expect(xml).toContain('<NumerRachunku>')
      expect(xml).toContain('<Salda>')
      expect(xml).toContain('<WyciagWiersz')
      expect(xml).toContain('<WyciagCtrl>')
      expect(xml).toContain('</JPK>')

      // Verify consistency: credits - debits = saldo change
      // SaldoKoncowe(16500) - SaldoPoczatkowe(10000) = 6500
      // SumaUznan(13000) - SumaObciazen(6500) = 6500 ✓
    })

    it('generates correct control sums for the full dataset', () => {
      const xml = generateJpkWb(makeInput())

      expect(xml).toContain('<LiczbaWierszy>5</LiczbaWierszy>')
      expect(xml).toContain('<SumaObciazen>6500.00</SumaObciazen>')
      expect(xml).toContain('<SumaUznan>13000.00</SumaUznan>')
    })
  })
})
