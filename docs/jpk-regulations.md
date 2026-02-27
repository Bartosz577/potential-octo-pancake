# Regulacje JPK — kontekst dla generatorów XML

## Struktury JPK i ich pola

### JPK_V7M(3) — ewidencja VAT + deklaracja (od 02.2026)
**Sekcje XML:**
- `Naglowek`: KodFormularza (JPK_VAT), WariantFormularza (3), CelZlozenia, DataWytworzeniaJPK, DataOd, DataDo, NazwaSystemu
- `Podmiot1`: NIP, PelnaNazwa, REGON, KodUrzeduSkarbowego, Email
- `Deklaracja`: PozycjeSzczegolowe (P_10..P_62), Pouczenia
- `SprzedazWiersz`: LpSprzedazy, KodKontrahenta, NazwaKontrahenta, NrKontrahenta, DowodSprzedazy, DataWystawienia, DataSprzedazy, TypDokumentu, GTU_01..13, procedury, K_10..K_36, NumerKSeF/OznaczenieKSeF
- `SprzedazCtrl`: LiczbaWierszySprzedazy, PodatekNalezny
- `ZakupWiersz`: LpZakupu, KodKontrahenta, NazwaKontrahenta, NrDostawcy, DowodZakupu, DataZakupu, DataWplywu, DokumentZakupu, K_40..K_47, NumerKSeF/OznaczenieKSeF
- `ZakupCtrl`: LiczbaWierszyZakupow, PodatekNaliczony

**Kolumny K (sprzedaż):**
- K_10: netto krajowe 23%, K_11: VAT
- K_12: netto krajowe 8%, K_13: VAT
- K_14: netto krajowe 5%, K_15: VAT
- K_16: netto 0%, K_17: zwolnione
- K_18: WDT/eksport towarów, K_19: eksport usług art.100
- K_20: WNT, K_21: import towarów art.33a, K_22: import usług
- K_23-K_36: dalsze pozycje (nabycia, korekty, marża)

**Kolumny K (zakupy):**
- K_40: netto zakupy, K_41: VAT naliczony
- K_42: netto środki trwałe, K_43: VAT
- K_44: netto pozostałe, K_45: VAT
- K_46: korekta VAT (środki trwałe), K_47: korekta VAT (pozostałe)

### JPK_FA(4) — faktury
**Sekcje:** Naglowek, Podmiot1, Faktura, FakturaWiersz, FakturaCtrl
**Faktura:** KodWaluty, P_1 (data), P_1M (miejsce), P_2 (nr faktury), P_3A-P_3D (sprzedawca), P_4A-P_4B (nabywca), P_5-P_6 (NIP), P_13_1..P_14_5 (kwoty per stawka), P_15 (brutto razem), RodzajFaktury
**FakturaWiersz:** P_7 (nazwa), P_8A/B (miara/ilość), P_9A/B (cena), P_11/P_11A (netto), P_12 (stawka VAT)

### JPK_MAG(1) — magazyn
**Typy dokumentów:** PZ (przyjęcie), WZ (wydanie), RW (rozchód wewnętrzny), MM (przesunięcie)
**Sekcje per typ:** np. PZ → sekcja PZ + PZWiersz + PZCtrl
**Pola wiersza:** NumerWiersza, KodTowaru, NazwaTowaru, IloscPrzyjeta/Wydana, JednostkaMiary, CenaJednostkowa, WartoscPozycji

### JPK_WB(1) — wyciąg bankowy
**Sekcje:** Naglowek, Podmiot, NumerRachunku, SaldoPoczatkowe, Wyciag (wiersze), SaldoKoncowe, WyciagCtrl
**Wiersz:** NumerWiersza, DataOperacji, NazwaPodmiotu, OpisOperacji, KwotaOperacji, SaldoOperacji

## Walidacja — reguły biznesowe
- NIP: 10 cyfr, wagi checksumu: 6,5,7,2,3,4,5,6,7, reszta z dzielenia przez 11 = ostatnia cyfra
- Daty: nie mogą być z przyszłości, data sprzedaży ≤ data wystawienia (tolerancja)
- Kwoty: netto + VAT ≈ brutto (tolerancja zaokrągleń ±1 grosz per pozycja)
- Stawki VAT: 23%, 8%, 5%, 0%, zw (zwolnione), np (nie podlega), oo (odwrotne obciążenie)
- GTU: wzajemnie wykluczające się grupy (np. GTU_01 i GTU_12 nie mogą być jednocześnie)
- Procedury: TP = transakcja z podmiotem powiązanym, MPP = mechanizm podzielonej płatności
- Sumy kontrolne: LiczbaWierszy musi = faktyczna liczba wierszy, PodatekNalezny = suma K_11+K_13+K_15+...

## Namespace'y XML
```xml
<!-- JPK_V7M(3) -->
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2024/12/09/12091/"
     xmlns:etd="http://crd.gov.pl/wzor/2023/12/13/13073/">

<!-- JPK_FA(4) -->  
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2022/02/17/02171/">

<!-- JPK_MAG(1) -->
<JPK xmlns="http://jpk.mf.gov.pl/wzor/2016/03/09/03091/">
```
