import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateJpkMag,
  formatQuantity,
  MAG_NAMESPACE,
  MAG_ETD_NAMESPACE,
  MagGeneratorInput,
  MagPodmiot,
  MagNaglowek,
  MagDokument,
  MagInwentaryzacja,
} from '../../../src/core/generators/JpkMagGenerator'

// ── Test fixtures ──

function makeNaglowek(overrides?: Partial<MagNaglowek>): MagNaglowek {
  return {
    dataOd: '2026-01-01',
    dataDo: '2026-03-31',
    kodUrzedu: '0271',
    ...overrides,
  }
}

function makePodmiotPolski(overrides?: Partial<MagPodmiot>): MagPodmiot {
  return {
    nip: '5261040828',
    pelnaNazwa: 'ACME Sp. z o.o.',
    adres: {
      typ: 'polski',
      wojewodztwo: 'MAZOWIECKIE',
      powiat: 'Warszawa',
      gmina: 'Warszawa',
      ulica: 'Marszalkowska',
      nrDomu: '1',
      nrLokalu: '10',
      miejscowosc: 'Warszawa',
      kodPocztowy: '00-001',
    },
    ...overrides,
  }
}

function makePodmiotZagraniczny(): MagPodmiot {
  return {
    nip: '5261040828',
    pelnaNazwa: 'Export GmbH',
    adres: {
      typ: 'zagraniczny',
      kodKraju: 'DE',
      kodPocztowy: '10115',
      miejscowosc: 'Berlin',
      ulica: 'Berliner Str. 1',
    },
  }
}

function makePZDoc(overrides?: Partial<MagDokument>): MagDokument {
  return {
    header: {
      NumerPZ: 'PZ/2026/001',
      DataPZ: '2026-01-15',
      WartoscPZ: '5000.00',
      DataOtrzymaniaPZ: '2026-01-15',
      Dostawca: 'Dostawca ABC',
      NumerFaPZ: 'FV/2026/100',
      DataFaPZ: '2026-01-14',
    },
    wiersze: [
      {
        NrWierszaPZ: '1',
        KodTowaruPZ: 'MAT-001',
        NazwaTowaruPZ: 'Stal nierdzewna',
        IloscPrzyjetaPZ: '100',
        JednostkaMiaryPZ: 'kg',
        CenaJednPZ: '25.00',
        WartoscPozycjiPZ: '2500.00',
      },
      {
        NrWierszaPZ: '2',
        KodTowaruPZ: 'MAT-002',
        NazwaTowaruPZ: 'Aluminium',
        IloscPrzyjetaPZ: '50',
        JednostkaMiaryPZ: 'kg',
        CenaJednPZ: '50.00',
        WartoscPozycjiPZ: '2500.00',
      },
    ],
    ...overrides,
  }
}

function makeWZDoc(): MagDokument {
  return {
    header: {
      NumerWZ: 'WZ/2026/001',
      DataWZ: '2026-02-10',
      WartoscWZ: '3000.00',
      DataWydaniaWZ: '2026-02-10',
      OdbiorcaWZ: 'Klient XYZ',
      NumerFaWZ: 'FV/2026/200',
      DataFaWZ: '2026-02-09',
    },
    wiersze: [
      {
        NrWierszaWZ: '1',
        KodTowaruWZ: 'PROD-001',
        NazwaTowaruWZ: 'Profil aluminiowy',
        IloscWydanaWZ: '20',
        JednostkaMiaryWZ: 'szt.',
        CenaJednWZ: '150.00',
        WartoscPozycjiWZ: '3000.00',
      },
    ],
  }
}

function makeRWDoc(): MagDokument {
  return {
    header: {
      NumerRW: 'RW/2026/001',
      DataRW: '2026-01-20',
      WartoscRW: '1000.00',
      DataWydaniaRW: '2026-01-20',
      DokadRW: 'Produkcja hala A',
    },
    wiersze: [
      {
        NrWierszaRW: '1',
        NazwaTowaruRW: 'Stal nierdzewna',
        IloscWydanaRW: '40',
        JednostkaMiaryRW: 'kg',
        CenaJednRW: '25.00',
        WartoscPozycjiRW: '1000.00',
      },
    ],
  }
}

function makePWDoc(): MagDokument {
  return {
    header: {
      NumerPW: 'PW/2026/001',
      DataPW: '2026-02-01',
      WartoscPW: '8000.00',
      DataOtrzymaniaPW: '2026-02-01',
      Wydzial: 'Produkcja',
    },
    wiersze: [
      {
        NrWierszaPW: '1',
        KodProduktuPW: 'GOTOWY-001',
        NazwaProduktuPW: 'Profil aluminiowy',
        IloscPrzyjetaPW: '100',
        JednostkaMiaryPW: 'szt.',
        CenaJednPW: '80.00',
        WartoscPozycjiPW: '8000.00',
      },
    ],
  }
}

function makeMMWEDoc(): MagDokument {
  return {
    header: {
      NumerMMWE: 'MM/2026/001',
      DataMMWE: '2026-03-01',
      WartoscMMWE: '2000.00',
      DataPrzyjeciaMMWE: '2026-03-01',
      SkadMMWE: 'Magazyn Krakow',
    },
    wiersze: [
      {
        NrWierszaMMWE: '1',
        NazwaTowaruMMWE: 'Produkt X',
        IloscPrzyjetaMMWE: '10',
        JednostkaMiaryMMWE: 'szt.',
        CenaJednMMWE: '200.00',
        WartoscPozycjiMMWE: '2000.00',
      },
    ],
  }
}

function makeMMWYDoc(): MagDokument {
  return {
    header: {
      NumerMMWY: 'MM/2026/002',
      DataMMWY: '2026-03-01',
      WartoscMMWY: '2000.00',
      DataWydaniaMMWY: '2026-03-01',
      DokadMMWY: 'Magazyn Warszawa',
    },
    wiersze: [
      {
        NrWierszaMMWY: '1',
        NazwaTowaruMMWY: 'Produkt X',
        IloscWydanaMMWY: '10',
        JednostkaMiaryMMWY: 'szt.',
        CenaJednMMWY: '200.00',
        WartoscPozycjiMMWY: '2000.00',
      },
    ],
  }
}

function makeINW(): MagInwentaryzacja {
  return {
    dataInwentaryzacji: '2026-03-31',
    dataCzasOd: '2026-03-31T08:00:00Z',
    dataCzasDo: '2026-03-31T16:00:00Z',
    tabela1: [
      {
        Lp: '1',
        Indeks: 'MAT-001',
        Nazwa: 'Stal nierdzewna',
        Jednostka: 'kg',
        Ilosc: '60',
        Cena: '25.00',
        Wartosc: '1500.00',
      },
    ],
  }
}

function makeMinimalInput(): MagGeneratorInput {
  return {
    naglowek: makeNaglowek(),
    podmiot: makePodmiotPolski(),
    magazyn: 'Magazyn Glowny',
    metoda: 1,
  }
}

function makeFullInput(): MagGeneratorInput {
  return {
    naglowek: makeNaglowek(),
    podmiot: makePodmiotPolski(),
    magazyn: 'Magazyn Glowny',
    metoda: 1,
    pz: [makePZDoc()],
    pw: [makePWDoc()],
    wz: [makeWZDoc()],
    rw: [makeRWDoc()],
    mmwe: [makeMMWEDoc()],
    mmwy: [makeMMWYDoc()],
    inw: [makeINW()],
  }
}

// ── Tests ──

describe('JpkMagGenerator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-27T17:57:40.000Z'))
  })

  // ── XML structure ──

  describe('XML structure', () => {
    it('generates valid XML declaration', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
    })

    it('includes JPK root element with correct namespaces', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain(`xmlns="${MAG_NAMESPACE}"`)
      expect(xml).toContain(`xmlns:etd="${MAG_ETD_NAMESPACE}"`)
    })

    it('closes JPK root element', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toMatch(/<\/JPK>$/)
    })

    it('generates minimal valid structure without documents', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('</Naglowek>')
      expect(xml).toContain('<Podmiot1>')
      expect(xml).toContain('</Podmiot1>')
      expect(xml).toContain('<Magazyn>')
      expect(xml).toContain('<Metoda>')
      expect(xml).not.toContain('<PZ>')
      expect(xml).not.toContain('<WZ>')
      expect(xml).not.toContain('<RW>')
    })
  })

  // ── Naglowek ──

  describe('Naglowek', () => {
    it('generates correct KodFormularza with attributes', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<KodFormularza kodSystemowy="JPK_MAG (2)" wersjaSchemy="1-0">JPK_MAG</KodFormularza>')
    })

    it('generates WariantFormularza = 2', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<WariantFormularza>2</WariantFormularza>')
    })

    it('generates CelZlozenia = 1', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<CelZlozenia>1</CelZlozenia>')
    })

    it('generates DataWytworzeniaJPK as ISO datetime', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<DataWytworzeniaJPK>2026-02-27T17:57:40Z</DataWytworzeniaJPK>')
    })

    it('generates DataOd and DataDo', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<DataOd>2026-01-01</DataOd>')
      expect(xml).toContain('<DataDo>2026-03-31</DataDo>')
    })

    it('generates DomyslnyKodWaluty defaults to PLN', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<DomyslnyKodWaluty>PLN</DomyslnyKodWaluty>')
    })

    it('generates DomyslnyKodWaluty with custom value', () => {
      const input = makeMinimalInput()
      input.naglowek.domyslnyKodWaluty = 'EUR'
      const xml = generateJpkMag(input)
      expect(xml).toContain('<DomyslnyKodWaluty>EUR</DomyslnyKodWaluty>')
    })

    it('generates KodUrzedu', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<KodUrzedu>0271</KodUrzedu>')
    })
  })

  // ── Podmiot1 ──

  describe('Podmiot1', () => {
    it('generates IdentyfikatorPodmiotu with etd: prefix', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<etd:NIP>5261040828</etd:NIP>')
      expect(xml).toContain('<etd:PelnaNazwa>ACME Sp. z o.o.</etd:PelnaNazwa>')
    })

    it('includes REGON when provided', () => {
      const input = makeMinimalInput()
      input.podmiot.regon = '012345678'
      const xml = generateJpkMag(input)
      expect(xml).toContain('<etd:REGON>012345678</etd:REGON>')
    })

    it('omits REGON when not provided', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).not.toContain('REGON')
    })

    it('generates Polish address with etd: prefixed children in AdresPol', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<Adres>')
      expect(xml).toContain('<AdresPol>')
      expect(xml).toContain('<etd:KodKraju>PL</etd:KodKraju>')
      expect(xml).toContain('<etd:Wojewodztwo>MAZOWIECKIE</etd:Wojewodztwo>')
      expect(xml).toContain('<etd:Powiat>Warszawa</etd:Powiat>')
      expect(xml).toContain('<etd:Gmina>Warszawa</etd:Gmina>')
      expect(xml).toContain('<etd:Ulica>Marszalkowska</etd:Ulica>')
      expect(xml).toContain('<etd:NrDomu>1</etd:NrDomu>')
      expect(xml).toContain('<etd:NrLokalu>10</etd:NrLokalu>')
      expect(xml).toContain('<etd:Miejscowosc>Warszawa</etd:Miejscowosc>')
      expect(xml).toContain('<etd:KodPocztowy>00-001</etd:KodPocztowy>')
      expect(xml).toContain('</AdresPol>')
      expect(xml).toContain('</Adres>')
    })

    it('omits optional address fields when not provided', () => {
      const input = makeMinimalInput()
      input.podmiot.adres = {
        typ: 'polski',
        wojewodztwo: 'MAZOWIECKIE',
        powiat: 'Warszawa',
        gmina: 'Warszawa',
        nrDomu: '1',
        miejscowosc: 'Warszawa',
        kodPocztowy: '00-001',
      }
      const xml = generateJpkMag(input)
      expect(xml).not.toContain('Ulica')
      expect(xml).not.toContain('NrLokalu')
    })

    it('generates foreign address in AdresZagr', () => {
      const input = makeMinimalInput()
      input.podmiot = makePodmiotZagraniczny()
      const xml = generateJpkMag(input)
      expect(xml).toContain('<AdresZagr>')
      expect(xml).toContain('<etd:KodKraju>DE</etd:KodKraju>')
      expect(xml).toContain('<etd:KodPocztowy>10115</etd:KodPocztowy>')
      expect(xml).toContain('<etd:Miejscowosc>Berlin</etd:Miejscowosc>')
      expect(xml).toContain('<etd:Ulica>Berliner Str. 1</etd:Ulica>')
      expect(xml).toContain('</AdresZagr>')
      expect(xml).not.toContain('AdresPol')
    })
  })

  // ── Magazyn and Metoda ──

  describe('Magazyn and Metoda', () => {
    it('generates Magazyn element', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<Magazyn>Magazyn Glowny</Magazyn>')
    })

    it('generates Metoda element', () => {
      const xml = generateJpkMag(makeMinimalInput())
      expect(xml).toContain('<Metoda>1</Metoda>')
    })

    it('supports all Metoda values 1-4', () => {
      for (const m of [1, 2, 3, 4]) {
        const input = makeMinimalInput()
        input.metoda = m
        const xml = generateJpkMag(input)
        expect(xml).toContain(`<Metoda>${m}</Metoda>`)
      }
    })
  })

  // ── PZ: Przyjęcie z zewnątrz ──

  describe('PZ (external receipt)', () => {
    it('generates PZ with header and line items', () => {
      const input = makeMinimalInput()
      input.pz = [makePZDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<PZ>')
      expect(xml).toContain('<PZWartosc>')
      expect(xml).toContain('<NumerPZ>PZ/2026/001</NumerPZ>')
      expect(xml).toContain('<DataPZ>2026-01-15</DataPZ>')
      expect(xml).toContain('<WartoscPZ>5000.00</WartoscPZ>')
      expect(xml).toContain('<DataOtrzymaniaPZ>2026-01-15</DataOtrzymaniaPZ>')
      expect(xml).toContain('<Dostawca>Dostawca ABC</Dostawca>')
      expect(xml).toContain('<NumerFaPZ>FV/2026/100</NumerFaPZ>')
      expect(xml).toContain('<DataFaPZ>2026-01-14</DataFaPZ>')
    })

    it('generates PZ line items with all fields', () => {
      const input = makeMinimalInput()
      input.pz = [makePZDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<PZWiersz>')
      expect(xml).toContain('<NrWierszaPZ>1</NrWierszaPZ>')
      expect(xml).toContain('<KodTowaruPZ>MAT-001</KodTowaruPZ>')
      expect(xml).toContain('<NazwaTowaruPZ>Stal nierdzewna</NazwaTowaruPZ>')
      expect(xml).toContain('<IloscPrzyjetaPZ>100</IloscPrzyjetaPZ>')
      expect(xml).toContain('<JednostkaMiaryPZ>kg</JednostkaMiaryPZ>')
      expect(xml).toContain('<CenaJednPZ>25.00</CenaJednPZ>')
      expect(xml).toContain('<WartoscPozycjiPZ>2500.00</WartoscPozycjiPZ>')
    })

    it('generates multiple PZ line items', () => {
      const input = makeMinimalInput()
      input.pz = [makePZDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<NrWierszaPZ>1</NrWierszaPZ>')
      expect(xml).toContain('<NrWierszaPZ>2</NrWierszaPZ>')
      expect(xml).toContain('<NazwaTowaruPZ>Aluminium</NazwaTowaruPZ>')
    })

    it('omits optional PZ header fields when not present', () => {
      const doc = makePZDoc()
      delete doc.header['NumerFaPZ']
      delete doc.header['DataFaPZ']
      delete doc.header['WartoscPZ']
      const input = makeMinimalInput()
      input.pz = [doc]
      const xml = generateJpkMag(input)

      expect(xml).not.toContain('<NumerFaPZ>')
      expect(xml).not.toContain('<DataFaPZ>')
      expect(xml).not.toContain('<WartoscPZ>')
    })

    it('includes NrKSeFPZ when present', () => {
      const doc = makePZDoc()
      doc.header['NrKSeFPZ'] = '1234567890-20260115-ABC123-DEF456-01'
      const input = makeMinimalInput()
      input.pz = [doc]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<NrKSeFPZ>1234567890-20260115-ABC123-DEF456-01</NrKSeFPZ>')
    })

    it('generates multiple PZ documents', () => {
      const doc2: MagDokument = {
        header: {
          NumerPZ: 'PZ/2026/002',
          DataPZ: '2026-01-20',
          DataOtrzymaniaPZ: '2026-01-20',
          Dostawca: 'Inny Dostawca',
        },
        wiersze: [{
          NrWierszaPZ: '1',
          NazwaTowaruPZ: 'Miedz',
          IloscPrzyjetaPZ: '30',
          JednostkaMiaryPZ: 'kg',
          CenaJednPZ: '80.00',
          WartoscPozycjiPZ: '2400.00',
        }],
      }
      const input = makeMinimalInput()
      input.pz = [makePZDoc(), doc2]
      const xml = generateJpkMag(input)

      const pzMatches = xml.match(/<PZ>/g)
      expect(pzMatches).toHaveLength(2)
      expect(xml).toContain('<NumerPZ>PZ/2026/001</NumerPZ>')
      expect(xml).toContain('<NumerPZ>PZ/2026/002</NumerPZ>')
    })
  })

  // ── PW: Przyjęcie wewnętrzne ──

  describe('PW (internal receipt)', () => {
    it('generates PW with header and line items', () => {
      const input = makeMinimalInput()
      input.pw = [makePWDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<PW>')
      expect(xml).toContain('<PWWartosc>')
      expect(xml).toContain('<NumerPW>PW/2026/001</NumerPW>')
      expect(xml).toContain('<DataPW>2026-02-01</DataPW>')
      expect(xml).toContain('<WartoscPW>8000.00</WartoscPW>')
      expect(xml).toContain('<DataOtrzymaniaPW>2026-02-01</DataOtrzymaniaPW>')
      expect(xml).toContain('<Wydzial>Produkcja</Wydzial>')
    })

    it('generates PW line items', () => {
      const input = makeMinimalInput()
      input.pw = [makePWDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<PWWiersz>')
      expect(xml).toContain('<NrWierszaPW>1</NrWierszaPW>')
      expect(xml).toContain('<KodProduktuPW>GOTOWY-001</KodProduktuPW>')
      expect(xml).toContain('<NazwaProduktuPW>Profil aluminiowy</NazwaProduktuPW>')
      expect(xml).toContain('<IloscPrzyjetaPW>100</IloscPrzyjetaPW>')
      expect(xml).toContain('<JednostkaMiaryPW>szt.</JednostkaMiaryPW>')
      expect(xml).toContain('<CenaJednPW>80.00</CenaJednPW>')
      expect(xml).toContain('<WartoscPozycjiPW>8000.00</WartoscPozycjiPW>')
    })

    it('omits Wydzial when not present', () => {
      const doc = makePWDoc()
      delete doc.header['Wydzial']
      const input = makeMinimalInput()
      input.pw = [doc]
      const xml = generateJpkMag(input)

      expect(xml).not.toContain('<Wydzial>')
    })
  })

  // ── WZ: Wydanie na zewnątrz ──

  describe('WZ (external dispatch)', () => {
    it('generates WZ with header and line items', () => {
      const input = makeMinimalInput()
      input.wz = [makeWZDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<WZ>')
      expect(xml).toContain('<WZWartosc>')
      expect(xml).toContain('<NumerWZ>WZ/2026/001</NumerWZ>')
      expect(xml).toContain('<DataWZ>2026-02-10</DataWZ>')
      expect(xml).toContain('<WartoscWZ>3000.00</WartoscWZ>')
      expect(xml).toContain('<DataWydaniaWZ>2026-02-10</DataWydaniaWZ>')
      expect(xml).toContain('<OdbiorcaWZ>Klient XYZ</OdbiorcaWZ>')
      expect(xml).toContain('<NumerFaWZ>FV/2026/200</NumerFaWZ>')
      expect(xml).toContain('<DataFaWZ>2026-02-09</DataFaWZ>')
    })

    it('generates WZ line items', () => {
      const input = makeMinimalInput()
      input.wz = [makeWZDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<WZWiersz>')
      expect(xml).toContain('<NrWierszaWZ>1</NrWierszaWZ>')
      expect(xml).toContain('<NazwaTowaruWZ>Profil aluminiowy</NazwaTowaruWZ>')
      expect(xml).toContain('<IloscWydanaWZ>20</IloscWydanaWZ>')
    })

    it('includes NrKSeFWZ when present', () => {
      const doc = makeWZDoc()
      doc.header['NrKSeFWZ'] = '1234567890-20260210-AABBCC-DDEEFF-01'
      const input = makeMinimalInput()
      input.wz = [doc]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<NrKSeFWZ>1234567890-20260210-AABBCC-DDEEFF-01</NrKSeFWZ>')
    })
  })

  // ── RW: Rozchód wewnętrzny ──

  describe('RW (internal consumption)', () => {
    it('generates RW with header and line items', () => {
      const input = makeMinimalInput()
      input.rw = [makeRWDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<RW>')
      expect(xml).toContain('<RWWartosc>')
      expect(xml).toContain('<NumerRW>RW/2026/001</NumerRW>')
      expect(xml).toContain('<DataRW>2026-01-20</DataRW>')
      expect(xml).toContain('<WartoscRW>1000.00</WartoscRW>')
      expect(xml).toContain('<DataWydaniaRW>2026-01-20</DataWydaniaRW>')
      expect(xml).toContain('<DokadRW>Produkcja hala A</DokadRW>')
    })

    it('generates RW line items', () => {
      const input = makeMinimalInput()
      input.rw = [makeRWDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<RWWiersz>')
      expect(xml).toContain('<NrWierszaRW>1</NrWierszaRW>')
      expect(xml).toContain('<NazwaTowaruRW>Stal nierdzewna</NazwaTowaruRW>')
      expect(xml).toContain('<IloscWydanaRW>40</IloscWydanaRW>')
    })

    it('omits optional RW fields when not present', () => {
      const doc = makeRWDoc()
      delete doc.header['NumerFaRW']
      delete doc.header['DataFaRW']
      delete doc.header['DokadRW']
      delete doc.header['WartoscRW']
      const input = makeMinimalInput()
      input.rw = [doc]
      const xml = generateJpkMag(input)

      expect(xml).not.toContain('<NumerFaRW>')
      expect(xml).not.toContain('<DataFaRW>')
      expect(xml).not.toContain('<DokadRW>')
      expect(xml).not.toContain('<WartoscRW>')
    })

    it('includes NrKSeFRW when present', () => {
      const doc = makeRWDoc()
      doc.header['NrKSeFRW'] = '1234567890-20260120-112233-445566-01'
      const input = makeMinimalInput()
      input.rw = [doc]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<NrKSeFRW>1234567890-20260120-112233-445566-01</NrKSeFRW>')
    })
  })

  // ── MMWE: Przesunięcie międzymagazynowe — wejście ──

  describe('MMWE (inter-warehouse transfer in)', () => {
    it('generates MMWE with header and line items', () => {
      const input = makeMinimalInput()
      input.mmwe = [makeMMWEDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<MMWE>')
      expect(xml).toContain('<MMWEWartosc>')
      expect(xml).toContain('<NumerMMWE>MM/2026/001</NumerMMWE>')
      expect(xml).toContain('<DataMMWE>2026-03-01</DataMMWE>')
      expect(xml).toContain('<WartoscMMWE>2000.00</WartoscMMWE>')
      expect(xml).toContain('<DataPrzyjeciaMMWE>2026-03-01</DataPrzyjeciaMMWE>')
      expect(xml).toContain('<SkadMMWE>Magazyn Krakow</SkadMMWE>')
    })

    it('generates MMWE line items', () => {
      const input = makeMinimalInput()
      input.mmwe = [makeMMWEDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<MMWEWiersz>')
      expect(xml).toContain('<NrWierszaMMWE>1</NrWierszaMMWE>')
      expect(xml).toContain('<NazwaTowaruMMWE>Produkt X</NazwaTowaruMMWE>')
      expect(xml).toContain('<IloscPrzyjetaMMWE>10</IloscPrzyjetaMMWE>')
    })
  })

  // ── MMWY: Przesunięcie międzymagazynowe — wyjście ──

  describe('MMWY (inter-warehouse transfer out)', () => {
    it('generates MMWY with header and line items', () => {
      const input = makeMinimalInput()
      input.mmwy = [makeMMWYDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<MMWY>')
      expect(xml).toContain('<MMWYWartosc>')
      expect(xml).toContain('<NumerMMWY>MM/2026/002</NumerMMWY>')
      expect(xml).toContain('<DataMMWY>2026-03-01</DataMMWY>')
      expect(xml).toContain('<WartoscMMWY>2000.00</WartoscMMWY>')
      expect(xml).toContain('<DataWydaniaMMWY>2026-03-01</DataWydaniaMMWY>')
      expect(xml).toContain('<DokadMMWY>Magazyn Warszawa</DokadMMWY>')
    })

    it('generates MMWY line items', () => {
      const input = makeMinimalInput()
      input.mmwy = [makeMMWYDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<MMWYWiersz>')
      expect(xml).toContain('<NrWierszaMMWY>1</NrWierszaMMWY>')
      expect(xml).toContain('<NazwaTowaruMMWY>Produkt X</NazwaTowaruMMWY>')
      expect(xml).toContain('<IloscWydanaMMWY>10</IloscWydanaMMWY>')
    })
  })

  // ── INW: Inwentaryzacja ──

  describe('INW (inventory)', () => {
    it('generates INW with Termin', () => {
      const input = makeMinimalInput()
      input.inw = [makeINW()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<INW>')
      expect(xml).toContain('<Termin>')
      expect(xml).toContain('<DataInwentaryzacji>2026-03-31</DataInwentaryzacji>')
      expect(xml).toContain('<DataCzasOd>2026-03-31T08:00:00Z</DataCzasOd>')
      expect(xml).toContain('<DataCzasDo>2026-03-31T16:00:00Z</DataCzasDo>')
      expect(xml).toContain('</Termin>')
    })

    it('generates Tabela1 with inventory rows', () => {
      const input = makeMinimalInput()
      input.inw = [makeINW()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<Tabela1>')
      expect(xml).toContain('<Wiersz>')
      expect(xml).toContain('<Lp>1</Lp>')
      expect(xml).toContain('<Indeks>MAT-001</Indeks>')
      expect(xml).toContain('<Nazwa>Stal nierdzewna</Nazwa>')
      expect(xml).toContain('<Jednostka>kg</Jednostka>')
      expect(xml).toContain('<Ilosc>60</Ilosc>')
      expect(xml).toContain('<Cena>25.00</Cena>')
      expect(xml).toContain('<Wartosc>1500.00</Wartosc>')
      expect(xml).toContain('</Tabela1>')
    })

    it('generates Tabela2 with verification rows', () => {
      const inv: MagInwentaryzacja = {
        dataInwentaryzacji: '2026-03-31',
        dataCzasOd: '2026-03-31T08:00:00Z',
        dataCzasDo: '2026-03-31T16:00:00Z',
        tabela2: [{
          Lp: '1',
          Nazwa: 'Material ABC',
          Jednostka: 'szt.',
          Ilosc1: '100',
          Ilosc2: '95',
          Cena1: '10.00',
          Cena2: '10.00',
          Wartosc1: '1000.00',
          Wartosc2: '950.00',
          Uwagi: 'Roznica -5 szt.',
        }],
      }
      const input = makeMinimalInput()
      input.inw = [inv]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<Tabela2>')
      expect(xml).toContain('<Ilosc1>100</Ilosc1>')
      expect(xml).toContain('<Ilosc2>95</Ilosc2>')
      expect(xml).toContain('<Cena1>10.00</Cena1>')
      expect(xml).toContain('<Cena2>10.00</Cena2>')
      expect(xml).toContain('<Wartosc1>1000.00</Wartosc1>')
      expect(xml).toContain('<Wartosc2>950.00</Wartosc2>')
      expect(xml).toContain('<Uwagi>Roznica -5 szt.</Uwagi>')
    })

    it('generates INW without Tabela when not provided', () => {
      const inv: MagInwentaryzacja = {
        dataInwentaryzacji: '2026-03-31',
        dataCzasOd: '2026-03-31T08:00:00Z',
        dataCzasDo: '2026-03-31T16:00:00Z',
      }
      const input = makeMinimalInput()
      input.inw = [inv]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<INW>')
      expect(xml).toContain('<Termin>')
      expect(xml).not.toContain('<Tabela1>')
      expect(xml).not.toContain('<Tabela2>')
    })

    it('generates INW with both Tabela1 and Tabela2', () => {
      const inv: MagInwentaryzacja = {
        dataInwentaryzacji: '2026-03-31',
        dataCzasOd: '2026-03-31T08:00:00Z',
        dataCzasDo: '2026-03-31T16:00:00Z',
        tabela1: [{
          Lp: '1',
          Nazwa: 'Towar A',
          Jednostka: 'szt.',
          Ilosc: '50',
        }],
        tabela2: [{
          Lp: '1',
          Nazwa: 'Towar B',
          Jednostka: 'kg',
          Ilosc1: '100',
          Ilosc2: '98',
        }],
      }
      const input = makeMinimalInput()
      input.inw = [inv]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<Tabela1>')
      expect(xml).toContain('<Tabela2>')
    })
  })

  // ── formatQuantity ──

  describe('formatQuantity', () => {
    it('formats integer values', () => {
      expect(formatQuantity(10)).toBe('10')
      expect(formatQuantity('100')).toBe('100')
    })

    it('formats decimal values up to 6 places', () => {
      expect(formatQuantity(10.5)).toBe('10.5')
      expect(formatQuantity(10.123456)).toBe('10.123456')
      expect(formatQuantity('3.14')).toBe('3.14')
    })

    it('strips trailing zeros', () => {
      expect(formatQuantity('10.500000')).toBe('10.5')
      expect(formatQuantity('10.100')).toBe('10.1')
    })

    it('handles zero', () => {
      expect(formatQuantity(0)).toBe('0')
      expect(formatQuantity('0')).toBe('0')
    })

    it('handles undefined and empty', () => {
      expect(formatQuantity(undefined)).toBe('0')
      expect(formatQuantity('')).toBe('0')
    })

    it('handles NaN', () => {
      expect(formatQuantity('abc')).toBe('0')
    })

    it('rounds to 6 decimal places', () => {
      expect(formatQuantity(1.1234567)).toBe('1.123457')
    })
  })

  // ── XML escaping ──

  describe('XML escaping', () => {
    it('escapes special characters in text fields', () => {
      const input = makeMinimalInput()
      input.magazyn = 'Magazyn & Hala <A>'
      input.podmiot.pelnaNazwa = 'Firma "Test" Sp. z o.o.'
      const xml = generateJpkMag(input)

      expect(xml).toContain('<Magazyn>Magazyn &amp; Hala &lt;A&gt;</Magazyn>')
      expect(xml).toContain('<etd:PelnaNazwa>Firma &quot;Test&quot; Sp. z o.o.</etd:PelnaNazwa>')
    })

    it('escapes special characters in document fields', () => {
      const doc = makePZDoc()
      doc.header['Dostawca'] = 'ABC & DEF'
      doc.wiersze[0]['NazwaTowaruPZ'] = 'Rura <150mm>'
      const input = makeMinimalInput()
      input.pz = [doc]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<Dostawca>ABC &amp; DEF</Dostawca>')
      expect(xml).toContain('<NazwaTowaruPZ>Rura &lt;150mm&gt;</NazwaTowaruPZ>')
    })
  })

  // ── Element ordering ──

  describe('element ordering', () => {
    it('outputs sections in XSD order: Naglowek, Podmiot1, Magazyn, Metoda, PZ, PW, WZ, RW, MMWE, MMWY, INW', () => {
      const xml = generateJpkMag(makeFullInput())

      const positions = {
        Naglowek: xml.indexOf('<Naglowek>'),
        Podmiot1: xml.indexOf('<Podmiot1>'),
        Magazyn: xml.indexOf('<Magazyn>'),
        Metoda: xml.indexOf('<Metoda>'),
        PZ: xml.indexOf('<PZ>'),
        PW: xml.indexOf('<PW>'),
        WZ: xml.indexOf('<WZ>'),
        RW: xml.indexOf('<RW>'),
        MMWE: xml.indexOf('<MMWE>'),
        MMWY: xml.indexOf('<MMWY>'),
        INW: xml.indexOf('<INW>'),
      }

      expect(positions.Naglowek).toBeLessThan(positions.Podmiot1)
      expect(positions.Podmiot1).toBeLessThan(positions.Magazyn)
      expect(positions.Magazyn).toBeLessThan(positions.Metoda)
      expect(positions.Metoda).toBeLessThan(positions.PZ)
      expect(positions.PZ).toBeLessThan(positions.PW)
      expect(positions.PW).toBeLessThan(positions.WZ)
      expect(positions.WZ).toBeLessThan(positions.RW)
      expect(positions.RW).toBeLessThan(positions.MMWE)
      expect(positions.MMWE).toBeLessThan(positions.MMWY)
      expect(positions.MMWY).toBeLessThan(positions.INW)
    })

    it('outputs PZ header fields in XSD order', () => {
      const input = makeMinimalInput()
      input.pz = [makePZDoc()]
      const xml = generateJpkMag(input)

      const fields = ['NumerPZ', 'DataPZ', 'WartoscPZ', 'DataOtrzymaniaPZ', 'Dostawca', 'NumerFaPZ', 'DataFaPZ']
      let lastPos = 0
      for (const f of fields) {
        const pos = xml.indexOf(`<${f}>`)
        expect(pos).toBeGreaterThan(lastPos)
        lastPos = pos
      }
    })

    it('outputs WZ header fields in XSD order', () => {
      const input = makeMinimalInput()
      input.wz = [makeWZDoc()]
      const xml = generateJpkMag(input)

      const fields = ['NumerWZ', 'DataWZ', 'WartoscWZ', 'DataWydaniaWZ', 'OdbiorcaWZ', 'NumerFaWZ', 'DataFaWZ']
      let lastPos = 0
      for (const f of fields) {
        const pos = xml.indexOf(`<${f}>`)
        expect(pos).toBeGreaterThan(lastPos)
        lastPos = pos
      }
    })
  })

  // ── Line item auto-numbering ──

  describe('line item auto-numbering', () => {
    it('auto-numbers PZ line items when NrWierszaPZ is not provided', () => {
      const doc = makePZDoc()
      delete doc.wiersze[0]['NrWierszaPZ']
      delete doc.wiersze[1]['NrWierszaPZ']
      const input = makeMinimalInput()
      input.pz = [doc]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<NrWierszaPZ>1</NrWierszaPZ>')
      expect(xml).toContain('<NrWierszaPZ>2</NrWierszaPZ>')
    })
  })

  // ── Full integration ──

  describe('full integration', () => {
    it('generates complete XML with all document types', () => {
      const xml = generateJpkMag(makeFullInput())

      // All sections present
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1>')
      expect(xml).toContain('<Magazyn>')
      expect(xml).toContain('<Metoda>')
      expect(xml).toContain('<PZ>')
      expect(xml).toContain('<PW>')
      expect(xml).toContain('<WZ>')
      expect(xml).toContain('<RW>')
      expect(xml).toContain('<MMWE>')
      expect(xml).toContain('<MMWY>')
      expect(xml).toContain('<INW>')

      // Structure closed
      expect(xml).toContain('</JPK>')
    })

    it('generates valid XML without document sections', () => {
      const xml = generateJpkMag(makeMinimalInput())

      // Just header sections
      expect(xml).toContain('<Naglowek>')
      expect(xml).toContain('<Podmiot1>')
      expect(xml).toContain('<Magazyn>')
      expect(xml).toContain('<Metoda>')
      expect(xml).toContain('</JPK>')

      // No documents
      expect(xml).not.toContain('<PZ>')
      expect(xml).not.toContain('<PW>')
      expect(xml).not.toContain('<WZ>')
      expect(xml).not.toContain('<RW>')
      expect(xml).not.toContain('<MMWE>')
      expect(xml).not.toContain('<MMWY>')
      expect(xml).not.toContain('<INW>')
    })

    it('generates only specific document types when others are omitted', () => {
      const input = makeMinimalInput()
      input.pz = [makePZDoc()]
      input.wz = [makeWZDoc()]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<PZ>')
      expect(xml).toContain('<WZ>')
      expect(xml).not.toContain('<PW>')
      expect(xml).not.toContain('<RW>')
      expect(xml).not.toContain('<MMWE>')
      expect(xml).not.toContain('<MMWY>')
      expect(xml).not.toContain('<INW>')
    })
  })

  // ── Minimal line items (value method — no quantities) ──

  describe('value method (minimal line items)', () => {
    it('generates PZ line items without quantity fields (method 3)', () => {
      const doc: MagDokument = {
        header: {
          NumerPZ: 'PZ/2026/010',
          DataPZ: '2026-01-15',
          WartoscPZ: '5000.00',
          DataOtrzymaniaPZ: '2026-01-15',
          Dostawca: 'Dostawca',
        },
        wiersze: [{
          NrWierszaPZ: '1',
          NazwaTowaruPZ: 'Towary zbiorczo',
          WartoscPozycjiPZ: '5000.00',
        }],
      }
      const input = makeMinimalInput()
      input.metoda = 3
      input.pz = [doc]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<NazwaTowaruPZ>Towary zbiorczo</NazwaTowaruPZ>')
      expect(xml).toContain('<WartoscPozycjiPZ>5000.00</WartoscPozycjiPZ>')
      expect(xml).not.toContain('<IloscPrzyjetaPZ>')
      expect(xml).not.toContain('<JednostkaMiaryPZ>')
      expect(xml).not.toContain('<CenaJednPZ>')
    })
  })

  // ── Quantity method (no values) ──

  describe('quantity method (no value fields)', () => {
    it('generates PZ line items without value fields (method 2)', () => {
      const doc: MagDokument = {
        header: {
          NumerPZ: 'PZ/2026/020',
          DataPZ: '2026-01-15',
          DataOtrzymaniaPZ: '2026-01-15',
          Dostawca: 'Dostawca',
        },
        wiersze: [{
          NrWierszaPZ: '1',
          NazwaTowaruPZ: 'Stal',
          IloscPrzyjetaPZ: '100.5',
          JednostkaMiaryPZ: 'kg',
        }],
      }
      const input = makeMinimalInput()
      input.metoda = 2
      input.pz = [doc]
      const xml = generateJpkMag(input)

      expect(xml).toContain('<IloscPrzyjetaPZ>100.5</IloscPrzyjetaPZ>')
      expect(xml).toContain('<JednostkaMiaryPZ>kg</JednostkaMiaryPZ>')
      expect(xml).not.toContain('<CenaJednPZ>')
      expect(xml).not.toContain('<WartoscPozycjiPZ>')
      expect(xml).not.toContain('<WartoscPZ>')
    })
  })
})
