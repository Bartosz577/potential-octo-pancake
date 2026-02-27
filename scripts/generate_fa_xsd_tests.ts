import { generateJpkFa, type FaGeneratorInput } from '../src/core/generators/JpkFaGenerator'
import { writeFileSync } from 'fs'

// ── Test 1: Simple single invoice with Polish address ──
const test1: FaGeneratorInput = {
  naglowek: { dataOd: '2026-02-01', dataDo: '2026-02-28', kodUrzedu: '0271' },
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
  faktury: [{
    KodWaluty: 'PLN',
    P_1: '2026-02-15',
    P_2A: 'FV/2026/001',
    P_3A: 'Nabywca Sp. z o.o.',
    P_3B: 'ul. Testowa 1, 00-001 Warszawa',
    P_3C: 'ACME Sp. z o.o.',
    P_3D: 'ul. Marszalkowska 1, 00-001 Warszawa',
    P_5B: '7680002466',
    P_13_1: '1000.00',
    P_14_1: '230.00',
    P_15: '1230.00',
    RodzajFaktury: 'VAT',
  }],
  wiersze: [{
    P_2B: 'FV/2026/001',
    P_7: 'Usluga programistyczna',
    P_8A: 'godz.',
    P_8B: '10',
    P_9A: '100.00',
    P_11: '1000.00',
    P_12: '23',
  }],
}
writeFileSync('/tmp/jpk_fa_test1_simple.xml', generateJpkFa(test1))

// ── Test 2: Multiple invoices with various VAT rates ──
const test2: FaGeneratorInput = {
  naglowek: { dataOd: '2026-03-01', dataDo: '2026-03-31', kodUrzedu: '1471' },
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
  faktury: [
    {
      KodWaluty: 'PLN',
      P_1: '2026-03-15',
      P_2A: 'FV/2026/010',
      P_3A: 'Client A',
      P_3B: 'ul. Testowa 1',
      P_3C: 'Jan Kowalski Firma',
      P_3D: 'Krakow',
      P_5B: '5261040828',
      P_13_1: '5000.00',
      P_14_1: '1150.00',
      P_13_2: '1000.00',
      P_14_2: '80.00',
      P_13_3: '500.00',
      P_14_3: '25.00',
      P_15: '7755.00',
      RodzajFaktury: 'VAT',
    },
    {
      KodWaluty: 'PLN',
      P_1: '2026-03-20',
      P_2A: 'FV/2026/011',
      P_3A: 'Client B',
      P_3B: 'ul. Inna 2',
      P_3C: 'Jan Kowalski Firma',
      P_3D: 'Krakow',
      P_5B: '1234563218',
      P_6: '2026-03-18',
      P_13_7: '200.00',
      P_15: '200.00',
      P_19: '1',
      P_19A: 'art. 43 ust. 1 pkt 37',
      RodzajFaktury: 'VAT',
    },
  ],
  wiersze: [
    { P_2B: 'FV/2026/010', P_7: 'Service A', P_8A: 'h', P_8B: '50', P_9A: '100.00', P_11: '5000.00', P_12: '23' },
    { P_2B: 'FV/2026/010', P_7: 'Product B', P_8A: 'szt.', P_8B: '10', P_9A: '100.00', P_11: '1000.00', P_12: '8' },
    { P_2B: 'FV/2026/010', P_7: 'Product C', P_8A: 'szt.', P_8B: '5', P_9A: '100.00', P_11: '500.00', P_12: '5' },
    { P_2B: 'FV/2026/011', P_7: 'Medical service', P_11: '200.00', P_12: 'zw' },
  ],
}
writeFileSync('/tmp/jpk_fa_test2_multi.xml', generateJpkFa(test2))

// ── Test 3: Correction invoice (KOREKTA) ──
const test3: FaGeneratorInput = {
  naglowek: { dataOd: '2026-02-01', dataDo: '2026-02-28', kodUrzedu: '0271' },
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
  faktury: [{
    KodWaluty: 'PLN',
    P_1: '2026-02-20',
    P_2A: 'FK/2026/001',
    P_3A: 'Client',
    P_3B: 'Address',
    P_3C: 'ACME Sp. z o.o.',
    P_3D: 'Warszawa',
    P_5B: '7680002466',
    P_13_1: '-500.00',
    P_14_1: '-115.00',
    P_15: '-615.00',
    RodzajFaktury: 'KOREKTA',
    PrzyczynaKorekty: 'Bledna cena',
    NrFaKorygowanej: 'FV/2026/001',
    OkresFaKorygowanej: '2026-02',
  }],
  wiersze: [{
    P_2B: 'FK/2026/001',
    P_7: 'Korekta uslugi',
    P_8A: 'godz.',
    P_8B: '5',
    P_9A: '-100.00',
    P_11: '-500.00',
    P_12: '23',
  }],
}
writeFileSync('/tmp/jpk_fa_test3_korekta.xml', generateJpkFa(test3))

// ── Test 4: Foreign currency with foreign address ──
const test4: FaGeneratorInput = {
  naglowek: { dataOd: '2026-02-01', dataDo: '2026-02-28', kodUrzedu: '0271' },
  podmiot: {
    nip: '5261040828',
    pelnaNazwa: 'Export Company Sp. z o.o.',
    adres: {
      typ: 'zagraniczny',
      kodKraju: 'DE',
      kodPocztowy: '10115',
      miejscowosc: 'Berlin',
      ulica: 'Berliner Str. 1',
    },
  },
  faktury: [{
    KodWaluty: 'EUR',
    P_1: '2026-02-15',
    P_2A: 'FV/2026/EU-001',
    P_3A: 'German Client GmbH',
    P_3B: 'Berlin',
    P_3C: 'Export Company Sp. z o.o.',
    P_3D: 'Berliner Str. 1, Berlin',
    P_4A: 'PL',
    P_4B: '5261040828',
    P_5A: 'DE',
    P_5B: 'DE123456789',
    P_13_1: '10000.00',
    P_14_1: '2300.00',
    P_14_1W: '10580.00',
    P_15: '12300.00',
    RodzajFaktury: 'VAT',
  }],
  wiersze: [{
    P_2B: 'FV/2026/EU-001',
    P_7: 'Software Development',
    P_8A: 'h',
    P_8B: '100',
    P_9A: '100.00',
    P_11: '10000.00',
    P_12: '23',
  }],
}
writeFileSync('/tmp/jpk_fa_test4_eur.xml', generateJpkFa(test4))

console.log('All 4 FA test XMLs generated successfully')
