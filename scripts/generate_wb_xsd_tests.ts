// Script to generate test XML files and validate against JPK_WB(1) XSD
// Usage: npx tsx scripts/generate_wb_xsd_tests.ts

import { generateJpkWb, WbGeneratorInput } from '../src/core/generators/JpkWbGenerator'
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

const SCHEMA_PATH = 'schemas/JPK_WB_1.xsd'

// ── Test 1: Simple — single credit ──
const test1: WbGeneratorInput = {
  naglowek: {
    dataOd: '2026-02-01',
    dataDo: '2026-02-28',
    kodUrzedu: '0271',
  },
  podmiot: {
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
  },
  numerRachunku: 'PL61109010140000071219812874',
  saldoPoczatkowe: '10000.00',
  saldoKoncowe: '15000.00',
  wiersze: [{
    dataOperacji: '2026-02-15',
    nazwaPodmiotu: 'Klient ABC',
    opisOperacji: 'Zaplata za FV/2026/001',
    kwotaOperacji: '5000.00',
    saldoOperacji: '15000.00',
  }],
}

// ── Test 2: Multiple operations — mixed debits/credits ──
const test2: WbGeneratorInput = {
  naglowek: {
    dataOd: '2026-01-01',
    dataDo: '2026-01-31',
    domyslnyKodWaluty: 'PLN',
    kodUrzedu: '1471',
  },
  podmiot: {
    nip: '7680002466',
    pelnaNazwa: 'Jan Kowalski Firma',
    adres: {
      wojewodztwo: 'MALOPOLSKIE',
      powiat: 'Krakow',
      gmina: 'Krakow',
      nrDomu: '10',
      miejscowosc: 'Krakow',
      kodPocztowy: '31-021',
      poczta: 'Krakow',
    },
  },
  numerRachunku: 'PL27114020040000300201355387',
  saldoPoczatkowe: '50000.00',
  saldoKoncowe: '48500.00',
  wiersze: [
    {
      dataOperacji: '2026-01-05',
      nazwaPodmiotu: 'Klient A',
      opisOperacji: 'Zaplata FV/2025/120',
      kwotaOperacji: '12000.00',
      saldoOperacji: '62000.00',
    },
    {
      dataOperacji: '2026-01-10',
      nazwaPodmiotu: 'Dostawca B',
      opisOperacji: 'Przelew za material',
      kwotaOperacji: '-8000.00',
      saldoOperacji: '54000.00',
    },
    {
      dataOperacji: '2026-01-15',
      nazwaPodmiotu: 'ZUS',
      opisOperacji: 'Skladki ZUS 01/2026',
      kwotaOperacji: '-3500.00',
      saldoOperacji: '50500.00',
    },
    {
      dataOperacji: '2026-01-20',
      nazwaPodmiotu: 'US Krakow',
      opisOperacji: 'Podatek VAT 12/2025',
      kwotaOperacji: '-2000.00',
      saldoOperacji: '48500.00',
    },
  ],
}

// ── Test 3: EUR account with REGON ──
const test3: WbGeneratorInput = {
  naglowek: {
    dataOd: '2026-03-01',
    dataDo: '2026-03-31',
    domyslnyKodWaluty: 'EUR',
    kodUrzedu: '0271',
  },
  podmiot: {
    nip: '5261040828',
    pelnaNazwa: 'ACME Sp. z o.o.',
    regon: '012345678',
    adres: {
      wojewodztwo: 'MAZOWIECKIE',
      powiat: 'Warszawa',
      gmina: 'Warszawa',
      nrDomu: '5',
      miejscowosc: 'Warszawa',
      kodPocztowy: '00-950',
      poczta: 'Warszawa',
    },
  },
  numerRachunku: 'PL83101010230000261395100000',
  saldoPoczatkowe: '25000.00',
  saldoKoncowe: '30500.50',
  wiersze: [
    {
      dataOperacji: '2026-03-10',
      nazwaPodmiotu: 'German Client GmbH',
      opisOperacji: 'Payment for INV/2026/EU-001',
      kwotaOperacji: '10000.50',
      saldoOperacji: '35000.50',
    },
    {
      dataOperacji: '2026-03-20',
      nazwaPodmiotu: 'French Supplier SARL',
      opisOperacji: 'Transfer for PO/2026/FR-005',
      kwotaOperacji: '-4500.00',
      saldoOperacji: '30500.50',
    },
  ],
}

// ── Generate and validate ──

const tests = [
  { name: 'test1_simple', input: test1 },
  { name: 'test2_multi', input: test2 },
  { name: 'test3_eur_regon', input: test3 },
]

let allPassed = true

for (const t of tests) {
  const xml = generateJpkWb(t.input)
  const filePath = `/tmp/jpk_wb_${t.name}.xml`
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
