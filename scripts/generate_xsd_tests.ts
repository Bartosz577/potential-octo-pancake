import { generateJpkV7m, type V7mGeneratorInput } from '../src/core/generators/JpkV7mGenerator'
import { writeFileSync } from 'fs'

// ── Test 1: Minimal — only empty ewidencja ──
const test1: V7mGeneratorInput = {
  naglowek: { celZlozenia: 1, kodUrzedu: '0271', rok: 2026, miesiac: 2 },
  podmiot: { typ: 'niefizyczna', nip: '5261040828', pelnaNazwa: 'ACME Sp. z o.o.', email: 'a@b.pl' },
  sprzedazWiersze: [],
  zakupWiersze: [],
}
writeFileSync('/tmp/jpk_test1_minimal.xml', generateJpkV7m(test1))

// ── Test 2: Full SprzedazWiersz with GTU, procedures, KSeF number ──
const test2: V7mGeneratorInput = {
  naglowek: { celZlozenia: 1, kodUrzedu: '1471', rok: 2026, miesiac: 3, nazwaSystemu: 'TestERP' },
  podmiot: {
    typ: 'fizyczna', nip: '7680002466', imie: 'Jan', nazwisko: 'Kowalski',
    dataUrodzenia: '1985-03-15', email: 'jan@test.pl', telefon: '600123456',
  },
  sprzedazWiersze: [
    {
      KodKrajuNadaniaTIN: 'DE',
      NrKontrahenta: 'DE123456789',
      NazwaKontrahenta: 'German GmbH',
      DowodSprzedazy: 'FV/2026/001',
      DataWystawienia: '2026-03-15',
      DataSprzedazy: '2026-03-10',
      NrKSeF: '1234567890-20260315-ABCDEF-ABCDEF-AB',
      GTU_06: '1',
      TP: '1',
      WSTO_EE: '1',
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
      K_10: '500.00',
    },
    {
      NrKontrahenta: '5261040828',
      NazwaKontrahenta: 'Duplikat',
      DowodSprzedazy: 'FV/2026/002',
      DataWystawienia: '2026-03-20',
      BFK: '1',
      TypDokumentu: 'FP',
      K_19: '200.00',
      K_20: '46.00',
    },
    {
      NrKontrahenta: '5261040828',
      NazwaKontrahenta: 'Korekta',
      DowodSprzedazy: 'FK/2026/001',
      DataWystawienia: '2026-03-25',
      OFF: '1',
      KorektaPodstawyOpodt: '1',
      TerminPlatnosci: '2025-06-15',
      K_19: '-500.00',
      K_20: '-115.00',
    },
  ],
  zakupWiersze: [
    {
      KodKrajuNadaniaTIN: 'PL',
      NrDostawcy: '5261040828',
      NazwaDostawcy: 'Dostawca Sp. z o.o.',
      DowodZakupu: 'FZ/2026/001',
      DataZakupu: '2026-03-05',
      DataWplywu: '2026-03-07',
      BFK: '1',
      DokumentZakupu: 'MK',
      K_40: '10000.00',
      K_41: '2300.00',
      K_42: '500.00',
      K_43: '115.00',
      K_44: '50.00',
      K_46: '-10.00',
    },
    {
      NrDostawcy: 'DE987654321',
      NazwaDostawcy: 'Import GmbH',
      DowodZakupu: 'SAD/001',
      DataZakupu: '2026-03-10',
      DI: '1',
      IMP: '1',
      K_42: '2000.00',
      K_43: '460.00',
    },
  ],
}
writeFileSync('/tmp/jpk_test2_full.xml', generateJpkV7m(test2))

// ── Test 3: With Deklaracja ──
const test3: V7mGeneratorInput = {
  naglowek: { celZlozenia: 1, kodUrzedu: '0271', rok: 2026, miesiac: 2 },
  podmiot: { typ: 'niefizyczna', nip: '5261040828', pelnaNazwa: 'ACME Sp. z o.o.', email: 'a@b.pl' },
  sprzedazWiersze: [{
    NrKontrahenta: '7680002466',
    NazwaKontrahenta: 'Jan Kowalski',
    DowodSprzedazy: 'FV/001',
    DataWystawienia: '2026-02-15',
    BFK: '1',
    K_19: '1000.00',
    K_20: '230.00',
  }],
  zakupWiersze: [{
    NrDostawcy: '5261040828',
    NazwaDostawcy: 'Dostawca',
    DowodZakupu: 'FZ/001',
    DataZakupu: '2026-02-10',
    BFK: '1',
    K_42: '500.00',
    K_43: '115.00',
  }],
  deklaracja: {
    P_19: '1000.00',
    P_20: '230.00',
    P_38: '230.00',
    P_42: '500.00',
    P_43: '115.00',
    P_48: '115.00',
    P_51: '115.00',
  },
}
writeFileSync('/tmp/jpk_test3_deklaracja.xml', generateJpkV7m(test3))

// ── Test 4: All K fields in SprzedazWiersz ──
const test4: V7mGeneratorInput = {
  naglowek: { celZlozenia: 1, kodUrzedu: '0271', rok: 2026, miesiac: 2 },
  podmiot: { typ: 'niefizyczna', nip: '5261040828', pelnaNazwa: 'Test', email: 'a@b.pl' },
  sprzedazWiersze: [{
    NrKontrahenta: '1234567890',
    NazwaKontrahenta: 'All Fields Test',
    DowodSprzedazy: 'FV/ALL',
    DataWystawienia: '2026-02-15',
    BFK: '1',
    K_10: '100.00',
    K_11: '200.00',
    K_12: '50.00',
    K_13: '300.00',
    K_14: '150.00',
    K_15: '400.00', K_16: '20.00',
    K_17: '500.00', K_18: '40.00',
    K_19: '1000.00', K_20: '230.00',
    K_21: '600.00',
    K_22: '700.00',
    K_23: '800.00', K_24: '184.00',
    K_25: '900.00', K_26: '207.00',
    K_27: '1100.00', K_28: '253.00',
    K_29: '1200.00', K_30: '276.00',
    K_31: '1300.00', K_32: '299.00',
    K_33: '50.00',
    K_34: '25.00',
    K_35: '10.00',
    K_36: '5.00',
    K_360: '3.00',
    SprzedazVAT_Marza: '1500.00',
  }],
  zakupWiersze: [{
    NrDostawcy: '1234567890',
    NazwaDostawcy: 'All Fields Zakup',
    DowodZakupu: 'FZ/ALL',
    DataZakupu: '2026-02-15',
    BFK: '1',
    K_40: '5000.00', K_41: '1150.00',
    K_42: '3000.00', K_43: '690.00',
    K_44: '100.00',
    K_45: '50.00',
    K_46: '-20.00',
    K_47: '30.00',
    ZakupVAT_Marza: '800.00',
  }],
}
writeFileSync('/tmp/jpk_test4_allk.xml', generateJpkV7m(test4))

// ── Test 5: Correction (CelZlozenia=2) ──
const test5: V7mGeneratorInput = {
  naglowek: { celZlozenia: 2, kodUrzedu: '0271', rok: 2026, miesiac: 2 },
  podmiot: { typ: 'niefizyczna', nip: '5261040828', pelnaNazwa: 'Test', email: 'a@b.pl' },
  sprzedazWiersze: [{
    NrKontrahenta: '7680002466',
    NazwaKontrahenta: 'Test',
    DowodSprzedazy: 'FV/001',
    DataWystawienia: '2026-02-15',
    BFK: '1',
    K_15: '100.00',
    K_16: '5.00',
    K_17: '200.00',
    K_18: '16.00',
  }],
  zakupWiersze: [],
}
writeFileSync('/tmp/jpk_test5_correction.xml', generateJpkV7m(test5))

console.log('All 5 test XMLs generated successfully')
