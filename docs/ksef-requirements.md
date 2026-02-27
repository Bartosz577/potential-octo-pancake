# Wymagania KSeF — kontekst dla implementacji

## Harmonogram (wpływa na wersjonowanie generatorów)
- 01.02.2026: obowiązek wystawiania KSeF dla firm >200 mln zł; obowiązek ODBIERANIA dla WSZYSTKICH
- 01.04.2026: obowiązek wystawiania KSeF dla wszystkich czynnych podatników VAT
- 31.12.2026: koniec okresu przejściowego (faktury z kas, uproszczone)
- 01.01.2027: obowiązek dla wszystkich (w tym zwolnieni z VAT, mikro)

## Wpływ na JPK_V7M(3) — CO IMPLEMENTOWAĆ
Od rozliczenia za luty 2026 obowiązuje wersja (3) struktury JPK_VAT.

### Nowe pola w SprzedazWiersz i ZakupWiersz:
- `NumerKSeF` — numer identyfikujący fakturę w KSeF (string)
- W przypadku braku numeru KSeF — jedno z oznaczeń:
  - `OFF` — faktura wystawiona w trybie awaryjnym KSeF
  - `BFK` — faktura wystawiona poza systemem KSeF
  - `DI` — dokument inny niż faktura

### Logika w generatorze V7M:
```
IF NumerKSeF is present:
  → <NumerKSeF>{value}</NumerKSeF>
ELSE IF OznaczenieKSeF is present:
  → <OznaczenieKSeF>{OFF|BFK|DI}</OznaczenieKSeF>
  IF OznaczenieKSeF == 'DI':
    → może wymagać dodatkowego RO/WEW (sprzedaż) lub VAT_RR/WEW (zakupy)
ELSE:
  → walidacja: błąd — wymagane NumerKSeF lub oznaczenie
```

### Logika walidacji:
- Jeśli firma objęta KSeF od 01.02.2026: każdy wiersz MUSI mieć NumerKSeF LUB oznaczenie
- Jeśli firma objęta od 01.04.2026: wiersze za luty-marzec 2026 oznaczone BFK
- Faktury wystawione w trybie awaryjnym: OFF, ale jeśli przesłane do KSeF przed wysłaniem JPK → NumerKSeF

## Wpływ na JPK_FA — CO WIEDZIEĆ
- Obowiązek JPK_FA NIE dotyczy faktur wystawionych w KSeF (urząd ma bezpośredni dostęp)
- JPK_FA nadal wymagane dla faktur POZA KSeF (wyłączenia ustawowe)
- Generator JPK_FA nadal potrzebny na okres przejściowy i wyłączenia

## Struktura logiczna FA(3) — faktury ustrukturyzowane KSeF
- Format XML zgodny ze schematem FA(3)
- NIE jest to JPK_FA — to oddzielna struktura dla samych faktur w KSeF
- Na razie: niski priorytet implementacji (systemy fakturowe robią to same)
- Ewentualnie dodać jako oddzielny moduł w przyszłości

## Implementacja w UI
- CompanyStep: dodaj pole "Firma objęta KSeF od" z datepickerem
- MappingStep: pokaż pola NumerKSeF/OznaczenieKSeF w mapowaniu V7M
- ValidationStep: weryfikuj obecność NumerKSeF/oznaczenia per wiersz
- ExportStep: informacja o wersji schematu (3)
