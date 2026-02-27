// Script to generate test XML files and validate against JPK_MAG(2) XSD
// Usage: npx tsx scripts/generate_mag_xsd_tests.ts

import { generateJpkMag, MagGeneratorInput } from '../src/core/generators/JpkMagGenerator'
import * as fs from 'fs'
import { execSync } from 'child_process'

// Fix timestamp for reproducible output
const origDate = Date
global.Date = class extends origDate {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super('2026-02-27T17:57:40.000Z')
    } else {
      // @ts-ignore
      super(...args)
    }
  }
  static now() { return new origDate('2026-02-27T17:57:40.000Z').getTime() }
} as any

const SCHEMA_PATH = 'schemas/JPK_MAG_2.xsd'

// ── Test 1: Minimal — just header, no documents ──
const test1: MagGeneratorInput = {
  naglowek: {
    dataOd: '2026-01-01',
    dataDo: '2026-03-31',
    kodUrzedu: '0271',
  },
  podmiot: {
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
  },
  magazyn: 'Magazyn Glowny',
  metoda: 1,
}

// ── Test 2: PZ + WZ with full fields ──
const test2: MagGeneratorInput = {
  naglowek: {
    dataOd: '2026-01-01',
    dataDo: '2026-03-31',
    kodUrzedu: '0271',
  },
  podmiot: {
    nip: '5261040828',
    pelnaNazwa: 'ACME Sp. z o.o.',
    adres: {
      typ: 'polski',
      wojewodztwo: 'MAZOWIECKIE',
      powiat: 'Warszawa',
      gmina: 'Warszawa',
      nrDomu: '1',
      miejscowosc: 'Warszawa',
      kodPocztowy: '00-001',
    },
  },
  magazyn: 'MAG-01',
  metoda: 1,
  pz: [{
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
  }],
  wz: [{
    header: {
      NumerWZ: 'WZ/2026/001',
      DataWZ: '2026-02-10',
      WartoscWZ: '3000.00',
      DataWydaniaWZ: '2026-02-10',
      OdbiorcaWZ: 'Klient XYZ',
      NumerFaWZ: 'FV/2026/200',
      DataFaWZ: '2026-02-09',
    },
    wiersze: [{
      NrWierszaWZ: '1',
      KodTowaruWZ: 'PROD-001',
      NazwaTowaruWZ: 'Profil aluminiowy',
      IloscWydanaWZ: '20',
      JednostkaMiaryWZ: 'szt.',
      CenaJednWZ: '150.00',
      WartoscPozycjiWZ: '3000.00',
    }],
  }],
}

// ── Test 3: All document types ──
const test3: MagGeneratorInput = {
  naglowek: {
    dataOd: '2026-01-01',
    dataDo: '2026-03-31',
    domyslnyKodWaluty: 'PLN',
    kodUrzedu: '1471',
  },
  podmiot: {
    nip: '7680002466',
    pelnaNazwa: 'Jan Kowalski Firma',
    adres: {
      typ: 'polski',
      wojewodztwo: 'MALOPOLSKIE',
      powiat: 'Krakow',
      gmina: 'Krakow',
      nrDomu: '10',
      miejscowosc: 'Krakow',
      kodPocztowy: '31-021',
    },
  },
  magazyn: 'Magazyn Centralny',
  metoda: 1,
  pz: [{
    header: {
      NumerPZ: 'PZ/2026/001',
      DataPZ: '2026-01-10',
      WartoscPZ: '1000.00',
      DataOtrzymaniaPZ: '2026-01-10',
      Dostawca: 'Hurtownia X',
    },
    wiersze: [{
      NrWierszaPZ: '1',
      NazwaTowaruPZ: 'Material A',
      IloscPrzyjetaPZ: '50',
      JednostkaMiaryPZ: 'szt.',
      CenaJednPZ: '20.00',
      WartoscPozycjiPZ: '1000.00',
    }],
  }],
  pw: [{
    header: {
      NumerPW: 'PW/2026/001',
      DataPW: '2026-02-01',
      WartoscPW: '5000.00',
      DataOtrzymaniaPW: '2026-02-01',
    },
    wiersze: [{
      NrWierszaPW: '1',
      NazwaProduktuPW: 'Produkt gotowy A',
      IloscPrzyjetaPW: '100',
      JednostkaMiaryPW: 'szt.',
      CenaJednPW: '50.00',
      WartoscPozycjiPW: '5000.00',
    }],
  }],
  wz: [{
    header: {
      NumerWZ: 'WZ/2026/001',
      DataWZ: '2026-02-15',
      WartoscWZ: '2000.00',
      DataWydaniaWZ: '2026-02-15',
      OdbiorcaWZ: 'Klient ABC',
    },
    wiersze: [{
      NrWierszaWZ: '1',
      NazwaTowaruWZ: 'Produkt gotowy A',
      IloscWydanaWZ: '40',
      JednostkaMiaryWZ: 'szt.',
      CenaJednWZ: '50.00',
      WartoscPozycjiWZ: '2000.00',
    }],
  }],
  rw: [{
    header: {
      NumerRW: 'RW/2026/001',
      DataRW: '2026-02-20',
      WartoscRW: '200.00',
      DataWydaniaRW: '2026-02-20',
      DokadRW: 'Produkcja',
    },
    wiersze: [{
      NrWierszaRW: '1',
      NazwaTowaruRW: 'Material A',
      IloscWydanaRW: '10',
      JednostkaMiaryRW: 'szt.',
      CenaJednRW: '20.00',
      WartoscPozycjiRW: '200.00',
    }],
  }],
  mmwe: [{
    header: {
      NumerMMWE: 'MM/2026/001',
      DataMMWE: '2026-03-01',
      WartoscMMWE: '500.00',
      DataPrzyjeciaMMWE: '2026-03-01',
      SkadMMWE: 'Magazyn Poznan',
    },
    wiersze: [{
      NrWierszaMMWE: '1',
      NazwaTowaruMMWE: 'Towar B',
      IloscPrzyjetaMMWE: '25',
      JednostkaMiaryMMWE: 'szt.',
      CenaJednMMWE: '20.00',
      WartoscPozycjiMMWE: '500.00',
    }],
  }],
  mmwy: [{
    header: {
      NumerMMWY: 'MM/2026/002',
      DataMMWY: '2026-03-05',
      WartoscMMWY: '300.00',
      DataWydaniaMMWY: '2026-03-05',
      DokadMMWY: 'Magazyn Gdansk',
    },
    wiersze: [{
      NrWierszaMMWY: '1',
      NazwaTowaruMMWY: 'Towar C',
      IloscWydanaMMWY: '15',
      JednostkaMiaryMMWY: 'szt.',
      CenaJednMMWY: '20.00',
      WartoscPozycjiMMWY: '300.00',
    }],
  }],
}

// ── Test 4: Foreign address + INW ──
const test4: MagGeneratorInput = {
  naglowek: {
    dataOd: '2026-01-01',
    dataDo: '2026-12-31',
    domyslnyKodWaluty: 'EUR',
    kodUrzedu: '0271',
  },
  podmiot: {
    nip: '5261040828',
    pelnaNazwa: 'Export GmbH',
    adres: {
      typ: 'zagraniczny',
      kodKraju: 'DE',
      kodPocztowy: '10115',
      miejscowosc: 'Berlin',
      ulica: 'Berliner Str. 1',
    },
  },
  magazyn: 'Lager Berlin',
  metoda: 2,
  pz: [{
    header: {
      NumerPZ: 'PZ/2026/001',
      DataPZ: '2026-06-01',
      DataOtrzymaniaPZ: '2026-06-01',
      Dostawca: 'Lieferant GmbH',
    },
    wiersze: [{
      NrWierszaPZ: '1',
      NazwaTowaruPZ: 'Stahl',
      IloscPrzyjetaPZ: '200.5',
      JednostkaMiaryPZ: 'kg',
    }],
  }],
  inw: [{
    dataInwentaryzacji: '2026-12-31',
    dataCzasOd: '2026-12-31T08:00:00Z',
    dataCzasDo: '2026-12-31T18:00:00Z',
    tabela1: [{
      Lp: '1',
      Nazwa: 'Stahl',
      Jednostka: 'kg',
      Ilosc: '150.25',
      Cena: '25.00',
      Wartosc: '3756.25',
    }],
    tabela2: [{
      Lp: '1',
      Nazwa: 'Aluminium',
      Jednostka: 'kg',
      Ilosc1: '100',
      Ilosc2: '98.5',
      Cena1: '50.00',
      Cena2: '50.00',
      Wartosc1: '5000.00',
      Wartosc2: '4925.00',
    }],
  }],
}

// ── Generate and validate ──

const tests = [
  { name: 'test1_minimal', input: test1 },
  { name: 'test2_pz_wz', input: test2 },
  { name: 'test3_all_docs', input: test3 },
  { name: 'test4_foreign_inw', input: test4 },
]

let allPassed = true

for (const t of tests) {
  const xml = generateJpkMag(t.input)
  const filePath = `/tmp/jpk_mag_${t.name}.xml`
  fs.writeFileSync(filePath, xml, 'utf-8')
  console.log(`\n=== ${t.name} ===`)
  console.log(`Generated: ${filePath}`)

  try {
    const result = execSync(
      `xmllint --schema ${SCHEMA_PATH} ${filePath} --noout 2>&1`,
      { encoding: 'utf-8' },
    )
    console.log(`✅ PASSED: ${result.trim()}`)
  } catch (err: any) {
    console.log(`❌ FAILED:\n${err.stdout || err.stderr || err.message}`)
    allPassed = false
  }
}

console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed!'}`)
process.exit(allPassed ? 0 : 1)
