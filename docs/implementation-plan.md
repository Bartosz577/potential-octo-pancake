# Plan implementacji JPK Universal Converter v2

## Faza 0 — Przygotowanie projektu
- [ ] Zainicjalizuj CLAUDE.md w katalogu projektu (`/init`)
- [ ] Skopiuj `src/core/` z pakietu architektonicznego do projektu
- [ ] Zainstaluj nowe zależności: `npm install xlsx papaparse fast-xml-parser iconv-lite`
- [ ] Zainstaluj dev dependencies: `npm install -D vitest @types/papaparse`
- [ ] Skonfiguruj Vitest w `vite.config.ts` (electron-vite)
- [ ] Sprawdź kompilację: `npm run typecheck`
- [ ] Utwórz katalog `schemas/` i pobierz aktualne XSD z gov.pl
- [ ] Utwórz katalog `docs/` z dokumentacją regulacyjną

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
- [ ] Dodaj pola KSeF do istniejącego generatora: NumerKSeF, OznaczenieKSeF (OFF/BFK/DI)
- [ ] Zaktualizuj namespace i wersję schematu na (3)
- [ ] Testy: `JpkV7mGenerator.test.ts` — generowanie z polami KSeF
- [ ] Testy: `JpkV7mGenerator.test.ts` — generowanie bez pól KSeF (BFK)
- [ ] Walidacja wygenerowanego XML przeciw schematowi XSD

### 2.2 JPK_FA(4) — nowy generator
- [ ] Przeanalizuj schemat XSD JPK_FA(4) z gov.pl
- [ ] Zaimplementuj `JpkFaGenerator.ts`
- [ ] Sekcja nagłówkowa: Naglowek, Podmiot1
- [ ] Sekcja Faktura: dane nagłówkowe faktury
- [ ] Sekcja FakturaWiersz: pozycje faktury
- [ ] Sekcja FakturaCtrl: sumy kontrolne
- [ ] Testy: `JpkFaGenerator.test.ts`
- [ ] Walidacja XSD

### 2.3 JPK_MAG(1) — nowy generator
- [ ] Przeanalizuj schemat XSD JPK_MAG(1) z gov.pl
- [ ] Zaimplementuj `JpkMagGenerator.ts`
- [ ] Obsługa typów dokumentów: WZ, PZ, RW, MM
- [ ] Testy: `JpkMagGenerator.test.ts`
- [ ] Walidacja XSD

### 2.4 JPK_WB(1) — nowy generator
- [ ] Przeanalizuj schemat XSD JPK_WB(1)
- [ ] Zaimplementuj `JpkWbGenerator.ts`
- [ ] Testy + walidacja XSD

### 2.5 Generyczny silnik XML
- [ ] Refaktor: wydziel wspólną logikę (nagłówek, escape, formatowanie) do `XmlGeneratorEngine.ts`
- [ ] Zdefiniuj interfejs `XmlGenerator` i zarejestruj generatory w registry

## Faza 3 — UI rozszerzenia

### 3.1 Import Step — rozszerzenie
- [ ] Rozszerz dialog otwierania o nowe rozszerzenia (xlsx, csv, json, xml, ods, dbf)
- [ ] Pokaż badge formatu pliku po imporcie
- [ ] Pokaż ostrzeżenia parsowania (encoding, malformed rows)
- [ ] Obsługa wielu plików jednocześnie (batch import)
- [ ] Wybór kodowania (dropdown) jeśli auto-detect zawodzi

### 3.2 Mapping Step — NOWY
- [ ] Utwórz `MappingStep.tsx`
- [ ] Wyświetl wynik AutoMapper: zmapowane kolumny z confidence score
- [ ] Interfejs drag & drop: kolumna źródłowa → pole JPK
- [ ] Podgląd 5 pierwszych wierszy przy każdym polu
- [ ] Konfiguracja transformacji (data format, decimal separator)
- [ ] Zapisywanie/ładowanie profili mapowań
- [ ] Obsługa niezmapowanych pól wymaganych (czerwone podświetlenie)

### 3.3 Preview Step — rozszerzenie
- [ ] Dynamiczne kolumny w tabeli na podstawie aktywnego mapowania
- [ ] Podświetlenie kolumn z transformacjami
- [ ] Podsumowanie per pole liczbowe

### 3.4 Validation Step — rozszerzenie
- [ ] Dodaj poziom 4: walidacja XSD
- [ ] Pokaż auto-fixable błędy z przyciskiem "Napraw automatycznie"
- [ ] Grupowanie błędów per typ (struktura/merytoryka/sumy)

### 3.5 Export Step — rozszerzenie
- [ ] Obsługa wszystkich typów JPK (nie tylko V7M)
- [ ] Informacja o wersji schematu XSD

### 3.6 History Step — NOWY
- [ ] Utwórz `HistoryStep.tsx`
- [ ] Lista poprzednich konwersji (localStorage)
- [ ] Filtrowanie po typie JPK, dacie, firmie
- [ ] Szybki re-eksport z zapisanych ustawień

### 3.7 Layout
- [ ] Zaktualizuj Sidebar: dodaj nowe typy JPK (WB, KR, PKPIR, EWP)
- [ ] Zaktualizuj StepIndicator: 7 kroków (+ ikona mapowania)
- [ ] AppShell: routing dla nowych kroków

## Faza 4 — Zustand stores

- [ ] Rozszerz `appStore`: obsługa 7 kroków, nowe typy JPK
- [ ] Utwórz `mappingStore`: aktywne mapowanie, zapisane profile, wynik AutoMapper
- [ ] Rozszerz `importStore`: obsługa RawSheet[] zamiast ParsedFile[]
- [ ] Utwórz `historyStore`: lista ConversionRecord[], persistowany w localStorage
- [ ] Podłącz ConversionPipeline do stores (bridge pattern)

## Faza 5 — Electron main process

- [ ] Rozszerz `openFileDialog()`: nowe filtry plików z FileReaderRegistry
- [ ] Dodaj IPC handler: `readFileAsBuffer()` (Buffer zamiast string — kluczowe dla binarnych)
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
