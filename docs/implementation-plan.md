# Plan implementacji JPK Universal Converter v2

## Faza 0 — Przygotowanie projektu
- [x] Zainicjalizuj CLAUDE.md w katalogu projektu (`/init`)
- [x] Skopiuj `src/core/` z pakietu architektonicznego do projektu
- [x] Zainstaluj nowe zależności: `npm install xlsx papaparse fast-xml-parser iconv-lite`
- [x] Zainstaluj dev dependencies: `npm install -D vitest @types/papaparse`
- [x] Skonfiguruj Vitest w `vite.config.ts` (electron-vite)
- [x] Sprawdź kompilację: `npm run typecheck`
- [x] Utwórz katalog `schemas/` i pobierz aktualne XSD z gov.pl
- [x] Utwórz katalog `docs/` z dokumentacją regulacyjną

## Faza 1 — Fundament core (parsery + mapowanie)

### 1.1 File Readers
- [x] Zintegruj istniejący `fileParser.ts` z nowym `TxtFileReader.ts`
- [x] Testy: `TxtFileReader.test.ts` — parsowanie pliku NAMOS VDEK (pipe separator)
- [x] Testy: `TxtFileReader.test.ts` — parsowanie pliku ESO MAG (windows-1250)
- [x] Testy: `CsvFileReader.test.ts` — CSV z separatorem `;` i `,`
- [x] Testy: `CsvFileReader.test.ts` — CSV z polskimi znakami (windows-1250)
- [x] Testy: `XlsxFileReader.test.ts` — plik Excel z wieloma arkuszami
- [x] Testy: `XlsxFileReader.test.ts` — plik XLS (stary format)
- [x] Testy: `JsonFileReader.test.ts` — tablica obiektów + zagnieżdżony JSON
- [x] Testy: `XmlFileReader.test.ts` — generyczny XML z powtarzającymi się elementami
- [x] Testy: `FileReaderRegistry.test.ts` — auto-detection formatu
- [x] Testy: `EncodingDetector.test.ts` — detekcja UTF-8, windows-1250, CP852

### 1.2 Mapowanie
- [x] Testy: `AutoMapper.test.ts` — auto-mapping NAMOS → JPK_V7M
- [x] Testy: `AutoMapper.test.ts` — auto-mapping nieznanego formatu (heurystyka)
- [x] Testy: `TransformEngine.test.ts` — transformacja dat DD.MM.YYYY → YYYY-MM-DD
- [x] Testy: `TransformEngine.test.ts` — transformacja kwot z przecinkiem
- [x] Testy: `TransformEngine.test.ts` — normalizacja NIP
- [x] Testy: `SystemProfiles.test.ts` — profil NAMOS_JPK_V7M

### 1.3 Pipeline
- [x] Testy: `ConversionPipeline.test.ts` — pełny flow TXT → validation
- [x] Testy: `ConversionPipeline.test.ts` — walidacja NIP checksum
- [x] Testy: `ConversionPipeline.test.ts` — walidacja wymaganych pól

## Faza 2 — Generatory XML

### 2.1 JPK_V7M(3) — aktualizacja
- [x] Dodaj pola KSeF do istniejącego generatora: NumerKSeF, OznaczenieKSeF (OFF/BFK/DI)
- [x] Zaktualizuj namespace i wersję schematu na (3)
- [x] Testy: `JpkV7mGenerator.test.ts` — generowanie z polami KSeF
- [x] Testy: `JpkV7mGenerator.test.ts` — generowanie bez pól KSeF (BFK)
- [x] Walidacja wygenerowanego XML przeciw schematowi XSD

### 2.2 JPK_FA(4) — nowy generator
- [x] Przeanalizuj schemat XSD JPK_FA(4) z gov.pl
- [x] Zaimplementuj `JpkFaGenerator.ts`
- [x] Sekcja nagłówkowa: Naglowek, Podmiot1
- [x] Sekcja Faktura: dane nagłówkowe faktury
- [x] Sekcja FakturaWiersz: pozycje faktury
- [x] Sekcja FakturaCtrl: sumy kontrolne
- [x] Testy: `JpkFaGenerator.test.ts`
- [x] Walidacja XSD

### 2.3 JPK_MAG(2) — nowy generator
- [x] Przeanalizuj schemat XSD JPK_MAG(2) z gov.pl
- [x] Zaimplementuj `JpkMagGenerator.ts`
- [x] Obsługa typów dokumentów: PZ, PW, WZ, RW, MMWE, MMWY + INW
- [x] Testy: `JpkMagGenerator.test.ts`
- [x] Walidacja XSD

### 2.4 JPK_WB(1) — nowy generator
- [x] Przeanalizuj schemat XSD JPK_WB(1)
- [x] Zaimplementuj `JpkWbGenerator.ts`
- [x] Testy + walidacja XSD

### 2.5 Generyczny silnik XML
- [x] Refaktor: wydziel wspólną logikę (nagłówek, escape, formatowanie) do `XmlGeneratorEngine.ts`
- [x] Zdefiniuj interfejs `XmlGenerator` i zarejestruj generatory w registry

## Faza 3 — UI rozszerzenia

### 3.1 Import Step — rozszerzenie
- [x] Rozszerz dialog otwierania o nowe rozszerzenia (xlsx, csv, json, xml, dat, tsv)
- [x] Pokaż badge formatu pliku po imporcie (FormatBadge component)
- [x] Pokaż ostrzeżenia parsowania (encoding, malformed rows)
- [x] Obsługa wielu plików jednocześnie (batch import)
- [x] Przeniesienie parsowania plików do main process (IPC `file:parse`)
- [ ] Wybór kodowania (dropdown) jeśli auto-detect zawodzi

### 3.2 Mapping Step — NOWY
- [x] Utwórz `MappingStep.tsx` — dwukolumnowy layout
- [x] Wyświetl wynik AutoMapper: zmapowane kolumny z confidence score
- [x] Interfejs manual override: klik kolumna źródłowa → klik pole JPK
- [x] Podgląd 5 pierwszych wierszy przy każdym polu
- [x] Utwórz `mappingStore.ts` — aktywne mapowania, autoMap, profile
- [x] SystemProfiles: 100% confidence dla NAMOS/ESO (pozycyjne mapowanie)
- [x] Obsługa niezmapowanych pól wymaganych (czerwone podświetlenie, blokada "Dalej")
- [ ] Konfiguracja transformacji (data format, decimal separator) — osobny panel
- [ ] Zapisywanie/ładowanie profili mapowań — UI (backend gotowy w mappingStore)

### 3.3 Preview Step — rozszerzenie
- [x] Dynamiczne kolumny w tabeli na podstawie aktywnego mapowania (mappingStore)
- [x] Podświetlenie kolumn wg typu: daty=blue, kwoty=green, NIP=amber
- [x] Podsumowanie per pole liczbowe (summable decimal columns)
- [x] Edytowalność komórek (EditableCell)
- [x] Ostrzeżenia NIP "brak" w SummaryBar
- [x] Fix layout: tabela scrolluje w kontenerze (overflow-hidden + min-w-0), paginacja i Dalej zawsze widoczne

### 3.4 Validation Step — rozszerzenie
- [x] Grupowanie błędów: STRUKTURA / MERYTORYKA / SUMY KONTROLNE
- [x] Walidacja z uwzględnieniem dynamicznych mapowań (mapping-aware)
- [x] Auto-fix: daty DD.MM.YYYY → YYYY-MM-DD, kwoty z przecinkiem → kropka
- [x] Przycisk "Napraw automatycznie" per item i per grupa
- [x] Globalny przycisk "Napraw automatycznie" w SummaryBanner
- [x] Walidacja NIP: PESEL (11 cyfr) rozpoznawany jako OK, NIP zagraniczny akceptowany, brak/pusty = warning
- [ ] Walidacja XSD (poziom 4) — wymaga integracji z parserem XSD

### 3.5 Export Step — rozszerzenie
- [x] Obsługa wszystkich typów JPK via generatorRegistry (V7M, FA, MAG, WB)
- [x] Informacja o wersji schematu XSD (typ + wersja + namespace)
- [x] Utility `xmlExporter.ts` — bridge ParsedFile + mappings → core generators
- [x] Tabbed UI per file z XML preview
- [x] "Zapisz wszystkie" dla multi-file export
- [x] Zapis do historii po eksporcie (historyStore.addRecord)
- [x] Przycisk "Historia" w footerze → krok 7

### 3.6 History Step — NOWY
- [x] Utwórz `HistoryStep.tsx`
- [x] Utwórz `historyStore.ts` — ConversionRecord[], persistowany w localStorage (zustand/persist)
- [x] Lista poprzednich konwersji z datą, typem JPK, firmą, rozmiarem
- [x] Filtrowanie po typie JPK (przyciski) + wyszukiwarka (nazwa/firma/NIP)
- [x] Przycisk "Pobierz ponownie" (re-eksport XML z zapisanego rekordu)
- [x] Przycisk "Usuń" per rekord + "Wyczyść historię"
- [x] Pusty stan: "Brak historii konwersji"

### 3.7 Layout
- [x] Zaktualizuj Sidebar: dodaj nowe typy JPK (WB)
- [x] Zaktualizuj StepIndicator: 7 kroków z ikonami
- [x] AppShell: routing dla wszystkich 7 kroków (w tym HistoryStep)
- [x] Nawigacja krokowa: wszystkie komponenty zaktualizowane (back/forward)

## Faza 4 — Zustand stores

- [x] Rozszerz `appStore`: obsługa 7 kroków, nowe typy JPK (WB)
- [x] Utwórz `mappingStore`: aktywne mapowanie, zapisane profile, wynik AutoMapper
- [x] Rozszerz `importStore`: obsługa format/encoding/warnings/headers w ParsedFile
- [x] Utwórz `historyStore`: lista ConversionRecord[], persistowany w localStorage
- [ ] Podłącz ConversionPipeline do stores (bridge pattern)

## Faza 5 — Electron main process

- [x] Rozszerz `openFileDialog()`: nowe filtry plików (txt, csv, xlsx, xls, json, xml, dat, tsv)
- [x] Dodaj IPC handler: `readFileAsBuffer()` (Buffer jako number[] przez IPC)
- [x] Dodaj IPC handler: `file:parse` — parsowanie plików w main process (FileReaderRegistry)
- [x] Rozszerz preload API: `parseFile()`, `readFileAsBuffer()`
- [x] Typy globalne w `index.d.ts`: SerializedSheet, SerializedFileReadResult
- [ ] Obsługa błędów: globalny error handler z logowaniem
- [ ] Auto-update: electron-updater

## Faza 6 — Jakość

- [ ] Konfiguracja Vitest: pokrycie kodu, threshold 80%
- [ ] CI: GitHub Actions (lint + typecheck + test)
- [ ] E2E test: Playwright — pełny flow import → export
- [ ] Dokumentacja użytkownika: README.md z screenshotami
- [ ] Obsługa błędów graceful: toast notifications w UI

## Faza 7 — Release

- [ ] Wersja beta: build Win/Mac/Linux
- [ ] Testy manualne z rzeczywistymi plikami z różnych systemów ERP
- [ ] Feedback loop: korekty na podstawie testów
- [ ] Wersja 2.0.0: release publiczny

---

## Status

| Faza | Status | Testy |
|------|--------|-------|
| 0 — Przygotowanie | ✅ Done | — |
| 1 — Core (parsery + mapowanie) | ✅ Done | 309 tests |
| 2 — Generatory XML | ✅ Done | 594 tests (14 XSD) |
| 3 — UI rozszerzenia | ✅ ~95% | Web typecheck OK |
| 4 — Zustand stores | ✅ ~90% | — |
| 5 — Electron main | 🔶 ~70% | Build OK |
| 6 — Jakość | ⬜ Not started | — |
| 7 — Release | ⬜ Not started | — |

### Pozostałe zadania (Faza 3-5)
- Wybór kodowania w ImportStep (dropdown fallback)
- Konfiguracja transformacji w MappingStep (data format, decimal separator)
- UI do zapisywania/ładowania profili mapowań
- Walidacja XSD w ValidationStep (poziom 4)
- Podłączenie ConversionPipeline do stores
- Error handling + auto-update w Electron
