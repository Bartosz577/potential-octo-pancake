// ── JPK field definitions for mapping and validation ──

/** Data type of a JPK field */
export type JpkFieldType = 'string' | 'date' | 'decimal' | 'integer' | 'nip' | 'boolean' | 'country'

/** Single field definition within a JPK structure */
export interface JpkFieldDef {
  /** XML element name (e.g. "K_10", "P_2", "NazwaKontrahenta") */
  name: string
  /** Polish label for UI display */
  label: string
  /** Data type — drives validation and transform */
  type: JpkFieldType
  /** Is this field required in the XML output? */
  required: boolean
  /** Short description for tooltip / help */
  description?: string
  /** Synonyms / aliases used in source files (for AutoMapper heuristics) */
  synonyms?: string[]
  /** Regex pattern the value must match (for validation) */
  pattern?: string
}

/** Definition of a JPK section (e.g. SprzedazWiersz, Faktura) */
export interface JpkSectionDef {
  /** Section name matching the XML element */
  sectionName: string
  /** Polish label */
  label: string
  /** Ordered list of fields in this section */
  fields: JpkFieldDef[]
}

// ═══════════════════════════════════════════════════════
//  JPK_V7M(3) — SprzedazWiersz
// ═══════════════════════════════════════════════════════

export const JPK_V7M_SPRZEDAZ_FIELDS: JpkFieldDef[] = [
  { name: 'LpSprzedazy', label: 'Lp.', type: 'integer', required: true, description: 'Numer kolejny wiersza', synonyms: ['lp', 'nr', 'numer', 'wiersz', 'pozycja'] },
  { name: 'KodKontrahenta', label: 'Kod kraju', type: 'country', required: false, description: 'Kod kraju kontrahenta (PL, DE, ...)', synonyms: ['kod_kraju', 'kraj', 'country'] },
  { name: 'NrKontrahenta', label: 'NIP kontrahenta', type: 'nip', required: false, description: 'NIP lub identyfikator podatkowy kontrahenta', synonyms: ['nip', 'nip_kontrahenta', 'nip_nabywcy', 'nr_kontrahenta', 'tax_id'] },
  { name: 'NazwaKontrahenta', label: 'Nazwa kontrahenta', type: 'string', required: false, description: 'Imię i nazwisko lub nazwa firmy', synonyms: ['nazwa', 'kontrahent', 'nabywca', 'firma', 'nazwa_kontrahenta', 'nazwa_nabywcy'] },
  { name: 'DowodSprzedazy', label: 'Nr dokumentu', type: 'string', required: true, description: 'Numer faktury / dokumentu sprzedaży', synonyms: ['nr_faktury', 'numer_faktury', 'dowod', 'dokument', 'faktura', 'invoice'] },
  { name: 'DataWystawienia', label: 'Data wystawienia', type: 'date', required: true, description: 'Data wystawienia dokumentu', synonyms: ['data_wystawienia', 'data_wystawienia_faktury', 'issue_date'] },
  { name: 'DataSprzedazy', label: 'Data sprzedaży', type: 'date', required: false, description: 'Data dokonania sprzedaży', synonyms: ['data_sprzedazy', 'data_sprzedaży', 'sale_date'] },
  { name: 'TypDokumentu', label: 'Typ dokumentu', type: 'string', required: false, description: 'RO, WEW, FP', synonyms: ['typ', 'typ_dokumentu', 'doc_type'] },
  { name: 'GTU_01', label: 'GTU 01', type: 'boolean', required: false, description: 'Dostawa napojów alkoholowych' },
  { name: 'GTU_02', label: 'GTU 02', type: 'boolean', required: false, description: 'Dostawa paliw' },
  { name: 'GTU_03', label: 'GTU 03', type: 'boolean', required: false, description: 'Dostawa oleju opałowego' },
  { name: 'GTU_04', label: 'GTU 04', type: 'boolean', required: false, description: 'Dostawa wyrobów tytoniowych' },
  { name: 'GTU_05', label: 'GTU 05', type: 'boolean', required: false, description: 'Dostawa odpadów' },
  { name: 'GTU_06', label: 'GTU 06', type: 'boolean', required: false, description: 'Dostawa urządzeń elektronicznych' },
  { name: 'GTU_07', label: 'GTU 07', type: 'boolean', required: false, description: 'Dostawa pojazdów' },
  { name: 'GTU_08', label: 'GTU 08', type: 'boolean', required: false, description: 'Dostawa metali szlachetnych' },
  { name: 'GTU_09', label: 'GTU 09', type: 'boolean', required: false, description: 'Dostawa produktów leczniczych' },
  { name: 'GTU_10', label: 'GTU 10', type: 'boolean', required: false, description: 'Dostawa budynków' },
  { name: 'GTU_11', label: 'GTU 11', type: 'boolean', required: false, description: 'Usługi w zakresie przenoszenia GHG' },
  { name: 'GTU_12', label: 'GTU 12', type: 'boolean', required: false, description: 'Usługi o charakterze niematerialnym' },
  { name: 'GTU_13', label: 'GTU 13', type: 'boolean', required: false, description: 'Usługi transportowe i gospodarki magazynowej' },
  // Procedure markers
  { name: 'SW', label: 'SW', type: 'boolean', required: false, description: 'Sprzedaż wysyłkowa z terytorium kraju' },
  { name: 'EE', label: 'EE', type: 'boolean', required: false, description: 'Usługi telekomunikacyjne, elektroniczne' },
  { name: 'TP', label: 'TP', type: 'boolean', required: false, description: 'Transakcja z podmiotem powiązanym' },
  { name: 'TT_WNT', label: 'TT_WNT', type: 'boolean', required: false, description: 'Transakcja trójstronna — WNT' },
  { name: 'TT_D', label: 'TT_D', type: 'boolean', required: false, description: 'Transakcja trójstronna — dostawa' },
  { name: 'MR_T', label: 'MR_T', type: 'boolean', required: false, description: 'Marża — usługi turystyki' },
  { name: 'MR_UZ', label: 'MR_UZ', type: 'boolean', required: false, description: 'Marża — towary używane' },
  { name: 'I_42', label: 'I_42', type: 'boolean', required: false, description: 'Import art. 42 (wewnątrzwspólnotowa)' },
  { name: 'I_63', label: 'I_63', type: 'boolean', required: false, description: 'Import art. 63 (WDT)' },
  { name: 'B_SPV', label: 'B_SPV', type: 'boolean', required: false, description: 'Transfer bonu jednego przeznaczenia' },
  { name: 'B_SPV_DOSTAWA', label: 'B_SPV_DOSTAWA', type: 'boolean', required: false, description: 'Dostawa objęta bonem' },
  { name: 'B_MPV_PROWIZJA', label: 'B_MPV_PROWIZJA', type: 'boolean', required: false, description: 'Prowizja od bonu różnego przeznaczenia' },
  { name: 'MPP', label: 'MPP', type: 'boolean', required: false, description: 'Mechanizm podzielonej płatności' },
  { name: 'IED', label: 'IED', type: 'boolean', required: false, description: 'Import e-commerce' },
  // K value fields (amounts)
  { name: 'K_10', label: 'Netto 23%', type: 'decimal', required: false, description: 'Podstawa opodatkowania 23%', synonyms: ['netto_23', 'netto23', 'podstawa_23'] },
  { name: 'K_11', label: 'VAT 23%', type: 'decimal', required: false, description: 'Podatek należny 23%', synonyms: ['vat_23', 'vat23', 'podatek_23'] },
  { name: 'K_12', label: 'Netto 8%', type: 'decimal', required: false, description: 'Podstawa opodatkowania 8%', synonyms: ['netto_8', 'netto8', 'podstawa_8'] },
  { name: 'K_13', label: 'VAT 8%', type: 'decimal', required: false, description: 'Podatek należny 8%', synonyms: ['vat_8', 'vat8', 'podatek_8'] },
  { name: 'K_14', label: 'Netto 5%', type: 'decimal', required: false, description: 'Podstawa opodatkowania 5%', synonyms: ['netto_5', 'netto5', 'podstawa_5'] },
  { name: 'K_15', label: 'VAT 5%', type: 'decimal', required: false, description: 'Podatek należny 5%', synonyms: ['vat_5', 'vat5', 'podatek_5'] },
  { name: 'K_16', label: 'Netto 0%', type: 'decimal', required: false, description: 'Podstawa opodatkowania 0%', synonyms: ['netto_0', 'netto0', 'podstawa_0'] },
  { name: 'K_17', label: 'Zwolnione', type: 'decimal', required: false, description: 'Dostawa zwolniona', synonyms: ['zwolnione', 'zw'] },
  { name: 'K_18', label: 'WDT/Eksport', type: 'decimal', required: false, description: 'WDT i eksport towarów', synonyms: ['wdt', 'eksport'] },
  { name: 'K_19', label: 'Eksport usług', type: 'decimal', required: false, description: 'Eksport usług art. 100', synonyms: ['eksport_uslug'] },
  { name: 'K_20', label: 'WNT', type: 'decimal', required: false, description: 'Wewnątrzwspólnotowe nabycie towarów' },
  { name: 'K_21', label: 'Import art.33a', type: 'decimal', required: false, description: 'Import towarów art. 33a' },
  { name: 'K_22', label: 'Import usług', type: 'decimal', required: false, description: 'Import usług' },
  { name: 'K_23', label: 'WNT netto', type: 'decimal', required: false },
  { name: 'K_24', label: 'WNT VAT', type: 'decimal', required: false },
  { name: 'K_25', label: 'Import tow. netto', type: 'decimal', required: false },
  { name: 'K_26', label: 'Import tow. VAT', type: 'decimal', required: false },
  { name: 'K_27', label: 'Import usł. netto', type: 'decimal', required: false },
  { name: 'K_28', label: 'Import usł. VAT', type: 'decimal', required: false },
  // KSeF fields (new in V7M v3)
  { name: 'NumerKSeF', label: 'Numer KSeF', type: 'string', required: false, description: 'Numer faktury w KSeF', synonyms: ['ksef', 'nr_ksef', 'numer_ksef'] },
  { name: 'OznaczenieKSeF', label: 'Oznaczenie KSeF', type: 'string', required: false, description: 'OFF/BFK/DI', synonyms: ['oznaczenie_ksef'] },
]

// ═══════════════════════════════════════════════════════
//  JPK_FA(4) — Faktura (header)
// ═══════════════════════════════════════════════════════

export const JPK_FA_FAKTURA_FIELDS: JpkFieldDef[] = [
  { name: 'KodWaluty', label: 'Waluta', type: 'string', required: true, description: 'Kod waluty (PLN, EUR, USD)', synonyms: ['waluta', 'currency', 'kod_waluty'] },
  { name: 'P_1', label: 'Data wystawienia', type: 'date', required: true, description: 'Data wystawienia faktury', synonyms: ['data_wystawienia', 'data_faktury', 'issue_date'] },
  { name: 'P_2', label: 'Nr faktury', type: 'string', required: true, description: 'Kolejny numer faktury', synonyms: ['nr_faktury', 'numer_faktury', 'numer', 'invoice_number'] },
  { name: 'P_3A', label: 'Nabywca — nazwa', type: 'string', required: true, description: 'Imię i nazwisko lub nazwa nabywcy', synonyms: ['nabywca', 'nazwa_nabywcy', 'buyer_name'] },
  { name: 'P_3B', label: 'Nabywca — adres', type: 'string', required: true, description: 'Adres nabywcy', synonyms: ['adres_nabywcy', 'buyer_address'] },
  { name: 'P_3C', label: 'Sprzedawca — nazwa', type: 'string', required: true, description: 'Imię i nazwisko lub nazwa sprzedawcy', synonyms: ['sprzedawca', 'nazwa_sprzedawcy', 'seller_name'] },
  { name: 'P_3D', label: 'Sprzedawca — adres', type: 'string', required: false, description: 'Adres sprzedawcy', synonyms: ['adres_sprzedawcy', 'seller_address'] },
  { name: 'P_4A', label: 'Sprzedawca — kraj', type: 'country', required: false, description: 'Kod kraju sprzedawcy', synonyms: ['kraj_sprzedawcy'] },
  { name: 'P_5', label: 'NIP sprzedawcy', type: 'nip', required: true, description: 'NIP sprzedawcy', synonyms: ['nip_sprzedawcy', 'seller_nip', 'seller_tax_id'] },
  { name: 'P_4B', label: 'Nabywca — kraj', type: 'country', required: false, description: 'Kod kraju nabywcy', synonyms: ['kraj_nabywcy'] },
  { name: 'P_6', label: 'NIP nabywcy', type: 'nip', required: false, description: 'NIP nabywcy', synonyms: ['nip_nabywcy', 'buyer_nip', 'buyer_tax_id'] },
  { name: 'DataSprzedazy', label: 'Data sprzedaży', type: 'date', required: false, description: 'Data dokonania sprzedaży', synonyms: ['data_sprzedazy', 'sale_date'] },
  { name: 'P_13_1', label: 'Netto 23%', type: 'decimal', required: false, description: 'Kwota netto — stawka 23%', synonyms: ['netto_23', 'netto23'] },
  { name: 'P_14_1', label: 'VAT 23%', type: 'decimal', required: false, description: 'Kwota podatku — stawka 23%', synonyms: ['vat_23', 'vat23'] },
  { name: 'P_13_2', label: 'Netto 8%', type: 'decimal', required: false, synonyms: ['netto_8'] },
  { name: 'P_14_2', label: 'VAT 8%', type: 'decimal', required: false, synonyms: ['vat_8'] },
  { name: 'P_13_3', label: 'Netto 5%', type: 'decimal', required: false, synonyms: ['netto_5'] },
  { name: 'P_14_3', label: 'VAT 5%', type: 'decimal', required: false, synonyms: ['vat_5'] },
  { name: 'P_13_4', label: 'Netto 0%', type: 'decimal', required: false, synonyms: ['netto_0'] },
  { name: 'P_13_5', label: 'Netto zw.', type: 'decimal', required: false, synonyms: ['zwolnione'] },
  { name: 'P_13_6', label: 'Netto np.', type: 'decimal', required: false, description: 'Kwota netto — nie podlega' },
  { name: 'P_14_4', label: 'VAT w.', type: 'decimal', required: false },
  { name: 'P_14_5', label: 'VAT np.', type: 'decimal', required: false },
  { name: 'P_13_7', label: 'Netto odw.', type: 'decimal', required: false },
  { name: 'P_14_6', label: 'VAT odw.', type: 'decimal', required: false },
  { name: 'P_13_8', label: 'Netto eksport', type: 'decimal', required: false },
  { name: 'P_13_9', label: 'Netto WDT', type: 'decimal', required: false },
  { name: 'P_13_10', label: 'Netto import', type: 'decimal', required: false },
  { name: 'P_13_11', label: 'Netto import usł.', type: 'decimal', required: false },
  { name: 'P_15', label: 'Brutto razem', type: 'decimal', required: true, description: 'Kwota należności ogółem', synonyms: ['brutto', 'razem', 'total', 'kwota_brutto'] },
  { name: 'RodzajFaktury', label: 'Rodzaj faktury', type: 'string', required: true, description: 'VAT, KOR, ZAL, POZ, ...', synonyms: ['rodzaj', 'typ_faktury', 'invoice_type'] },
]

// ═══════════════════════════════════════════════════════
//  JPK_MAG(1) — WZ (Wydanie Zewnętrzne)
// ═══════════════════════════════════════════════════════

export const JPK_MAG_WZ_FIELDS: JpkFieldDef[] = [
  { name: 'NumerWiersza', label: 'Lp.', type: 'integer', required: true, synonyms: ['lp', 'nr', 'wiersz'] },
  { name: 'KodTowaru', label: 'Kod towaru', type: 'string', required: true, description: 'Kod / indeks magazynowy', synonyms: ['kod', 'indeks', 'sku', 'product_code'] },
  { name: 'NazwaTowaru', label: 'Nazwa towaru', type: 'string', required: true, synonyms: ['nazwa', 'towar', 'produkt', 'product_name'] },
  { name: 'IloscWydana', label: 'Ilość', type: 'decimal', required: true, description: 'Ilość wydana', synonyms: ['ilosc', 'ilość', 'qty', 'quantity'] },
  { name: 'JednostkaMiary', label: 'Jm.', type: 'string', required: true, description: 'Jednostka miary', synonyms: ['jm', 'jednostka', 'unit'] },
  { name: 'CenaJednostkowa', label: 'Cena jedn.', type: 'decimal', required: true, synonyms: ['cena', 'cena_jednostkowa', 'price'] },
  { name: 'WartoscPozycji', label: 'Wartość', type: 'decimal', required: true, description: 'Wartość pozycji (ilość × cena)', synonyms: ['wartosc', 'wartość', 'value', 'amount'] },
]

// ═══════════════════════════════════════════════════════
//  JPK_MAG(1) — WZ document-level fields
// ═══════════════════════════════════════════════════════

export const JPK_MAG_WZ_DOC_FIELDS: JpkFieldDef[] = [
  { name: 'MagazynNadawcy', label: 'Magazyn nadawcy', type: 'string', required: true, synonyms: ['magazyn', 'warehouse'] },
  { name: 'NumerDokumentu', label: 'Nr dokumentu', type: 'string', required: true, synonyms: ['nr_dokumentu', 'numer_wz', 'doc_number'] },
  { name: 'DataDokumentu', label: 'Data dokumentu', type: 'date', required: true, synonyms: ['data', 'data_dokumentu'] },
  { name: 'WartoscDokumentu', label: 'Wartość dokumentu', type: 'decimal', required: true, synonyms: ['wartosc_dokumentu'] },
  { name: 'DataOperacji', label: 'Data operacji', type: 'date', required: false, synonyms: ['data_operacji'] },
  { name: 'MagazynOdbiorcy', label: 'Magazyn odbiorcy', type: 'string', required: false, synonyms: ['magazyn_odbiorcy'] },
]

// ═══════════════════════════════════════════════════════
//  Section definitions (for registry / lookup)
// ═══════════════════════════════════════════════════════

export const JPK_SECTIONS: Record<string, JpkSectionDef> = {
  'JPK_VDEK.SprzedazWiersz': {
    sectionName: 'SprzedazWiersz',
    label: 'Sprzedaż — wiersze',
    fields: JPK_V7M_SPRZEDAZ_FIELDS,
  },
  'JPK_FA.Faktura': {
    sectionName: 'Faktura',
    label: 'Faktury — nagłówki',
    fields: JPK_FA_FAKTURA_FIELDS,
  },
  'JPK_MAG.WZ': {
    sectionName: 'WZ',
    label: 'Magazyn — wydania zewnętrzne',
    fields: JPK_MAG_WZ_FIELDS,
  },
}

/**
 * Look up field definitions for a given JPK type and sub-type.
 */
export function getFieldDefinitions(jpkType: string, subType: string): JpkFieldDef[] {
  const key = `${jpkType}.${subType}`
  return JPK_SECTIONS[key]?.fields ?? []
}
