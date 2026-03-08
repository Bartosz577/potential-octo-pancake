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

### 2.5 JPK_V7K(3) — wariant kwartalny V7M
- [x] Przeanalizuj schemat XSD JPK_V7K(3) (namespace 14089)
- [x] Zaimplementuj `JpkV7kGenerator.ts` (Deklaracja VAT-7K, Kwartal)
- [x] Przełącznik miesięczny/kwartalny w CompanyStep
- [x] Routing jpkSubtype w xmlExporter
- [x] Testy: `JpkV7kGenerator.test.ts` — 39 testów

### 2.6 JPK_PKPIR(3) — nowy generator
- [x] Przeanalizuj schemat XSD JPK_PKPIR(3) (namespace 10302)
- [x] Zaimplementuj `JpkPkpirGenerator.ts` (Naglowek, Podmiot1, PKPIRInfo, PKPIRSpis, PKPIRWiersz, PKPIRCtrl)
- [x] Dodaj typ JPK_PKPIR do core/models/types.ts i renderer/types
- [x] Dodaj JPK_PKPIR_WIERSZ_FIELDS do JpkFieldDefinitions.ts (21 pól, K_1..K_17)
- [x] Integracja: appStore, Sidebar, ImportStep, ExportStep, PreviewStep, ValidationStep, HistoryStep, xmlExporter, validator
- [x] Testy: `JpkPkpirGenerator.test.ts` — 57 testów

### 2.7 JPK_EWP(4) — nowy generator (ewidencja przychodów / ryczałt)
- [x] Schemat XSD JPK_EWP(4) (namespace 10301) — już w /schemas
- [x] Zaimplementuj `JpkEwpGenerator.ts` (Naglowek, Podmiot1+Kasowy_PIT, EWPWiersz K_1..K_10, EWPCtrl)
- [x] Dodaj typ JPK_EWP do core/models/types.ts i renderer/types
- [x] Dodaj JPK_EWP_WIERSZ_FIELDS do JpkFieldDefinitions.ts (10 pól)
- [x] Integracja: appStore, Sidebar, ImportStep, ExportStep, PreviewStep, ValidationStep, HistoryStep, xmlExporter, validator
- [x] Testy: `JpkEwpGenerator.test.ts` — 42 testy

### 2.8 JPK_KR_PD(1) — nowy generator (księgi rachunkowe CIT/PIT)
- [x] Schemat XSD JPK_KR_PD(1) (namespace 09041) — już w /schemas
- [x] Zaimplementuj `JpkKrPdGenerator.ts` (Naglowek, Podmiot1+AdresPol+EST/MSSF, Kontrahent, ZOiS7, Dziennik+KontoZapis, Ctrl C_1..C_5, RPD K_1..K_8)
- [x] Dodaj typ JPK_KR_PD do core/models/types.ts i renderer/types
- [x] Dodaj JPK_KR_PD_DZIENNIK_FIELDS do JpkFieldDefinitions.ts (12 pól D_1..D_12)
- [x] Integracja: appStore, Sidebar, ImportStep, ExportStep, PreviewStep, ValidationStep, HistoryStep, xmlExporter, validator
- [x] TMapKontaPD enum (28 wartości: 13 bilansowych + 15 pozabilansowych) z walidacją
- [x] KontoZapis: xsd:choice debit (Z_4/Z_5/Z_6) vs credit (Z_7/Z_8/Z_9) z obsługą walut
- [x] Testy: `JpkKrPdGenerator.test.ts` — 54 testy

### 2.9 JPK_ST(1) — nowy generator (środki trwałe — EWP/PKPIR)
- [x] Schemat XSD JPK_ST(1) (namespace 11262) — już w /schemas
- [x] Zaimplementuj `JpkStGenerator.ts` (Naglowek, Podmiot1 fizyczna/niefizyczna+ZnacznikST, EWP F_1..F_16, PKPIR G_1..G_22)
- [x] Dodaj typ JPK_ST do core/models/types.ts i renderer/types
- [x] Dodaj JPK_ST_WIERSZ_FIELDS do JpkFieldDefinitions.ts (11 pól)
- [x] Integracja: appStore, Sidebar, ImportStep, ExportStep, PreviewStep, ValidationStep, HistoryStep, xmlExporter, validator
- [x] Testy: `JpkStGenerator.test.ts` — 42 testy

### 2.10 JPK_ST_KR(1) — nowy generator (środki trwałe — księgi rachunkowe)
- [x] Schemat XSD JPK_ST_KR(1) (namespace 04242) — już w /schemas
- [x] Zaimplementuj `JpkStKrGenerator.ts` (Naglowek z rokiem fiskalnym, Podmiot1 niefizyczna+AdresPol/AdresZagr, ST_KR E_1..E_32)
- [x] TOdpis enum (M/K/R/J/S/I/X), TWykreslenieKr (7 wartości z 'A'), 3x metoda amortyzacji
- [x] Pola rachunkowe: E_21..E_27 (wartość początkowa rach., amortyzacja rach.)
- [x] Dodaj typ JPK_ST_KR do core/models/types.ts i renderer/types
- [x] Dodaj JPK_ST_KR_WIERSZ_FIELDS do JpkFieldDefinitions.ts (14 pól)
- [x] Integracja: appStore, Sidebar, ImportStep, ExportStep, PreviewStep, ValidationStep, HistoryStep, xmlExporter, validator
- [x] Testy: `JpkStKrGenerator.test.ts` — 43 testy

### 2.11 JPK_FA_RR(1) — nowy generator (faktury VAT RR)
- [x] Schemat XSD JPK_FA_RR(1) (namespace 08121) — pobrany do /schemas
- [x] Zaimplementuj `JpkFaRrGenerator.ts` — 3 namespacey (tns, etd, kck), TPodpis, typ="G"
- [x] FakturaRR: P_1A..P_4C1, P_11_1/P_11_2, P_12_1/P_12_2, P_116_3, RodzajFaktury, korekta
- [x] FakturaRRWiersz: P_4C2..P_10, TIlosciJPK (P_6B)
- [x] FakturaRRCtrl (sum P_12_1), FakturaRRWierszCtrl (sum P_8)
- [x] Opcjonalna sekcja Oswiadczenie + OswiadczenieCtrl (count only)
- [x] Dodaj typ JPK_FA_RR do core/models/types.ts i renderer/types
- [x] Dodaj JPK_FA_RR_FAKTURA_FIELDS do JpkFieldDefinitions.ts (11 pól)
- [x] Integracja: appStore, Sidebar, ImportStep, ExportStep, PreviewStep, ValidationStep, HistoryStep, xmlExporter, validator
- [x] Testy: `JpkFaRrGenerator.test.ts` — 52 testy

### 2.12 JPK_KR(1) — nowy generator (księgi rachunkowe legacy)
- [x] Schemat XSD JPK_KR(1) (namespace 03091) — pobrany do /schemas
- [x] Zaimplementuj `JpkKrGenerator.ts` — etd v4, starszy format (2016)
- [x] ZOiS: 18 pól (16 wymaganych + 2 opcjonalne podkategorie), typ="G"
- [x] Dziennik: 11 pól (wszystkie wymagane), typ="G"
- [x] KontoZapis: debit AND credit w każdym wierszu (nie choice), default="null", typ="G"
- [x] DziennikCtrl: LiczbaWierszyDziennika + SumaKwotOperacji
- [x] KontoZapisCtrl: LiczbaWierszyKontoZapisj (oficjalny typo!) + SumaWinien + SumaMa
- [x] Dodaj typ JPK_KR do core/models/types.ts i renderer/types
- [x] Dodaj JPK_KR_DZIENNIK_FIELDS do JpkFieldDefinitions.ts (11 pól)
- [x] Integracja: appStore, Sidebar, ImportStep, ExportStep, PreviewStep, ValidationStep, HistoryStep, xmlExporter, validator
- [x] Testy: `JpkKrGenerator.test.ts` — 39 testy

### 2.13 Generyczny silnik XML
- [x] Refaktor: wydziel wspólną logikę (nagłówek, escape, formatowanie) do `XmlGeneratorEngine.ts`
- [x] Zdefiniuj interfejs `XmlGenerator` i zarejestruj generatory w registry

## Faza 3 — UI rozszerzenia

### 3.1 Import Step — rozszerzenie
- [x] Rozszerz dialog otwierania o nowe rozszerzenia (xlsx, csv, json, xml, dat, tsv)
- [x] Pokaż badge formatu pliku po imporcie (FormatBadge component)
- [x] Pokaż ostrzeżenia parsowania (encoding, malformed rows)
- [x] Obsługa wielu plików jednocześnie (batch import)
- [x] Przeniesienie parsowania plików do main process (IPC `file:parse`)
- [x] Wybór kodowania (dropdown) jeśli auto-detect zawodzi — z podglądem na żywo i re-parse

### 3.2 Mapping Step — NOWY
- [x] Utwórz `MappingStep.tsx` — dwukolumnowy layout
- [x] Wyświetl wynik AutoMapper: zmapowane kolumny z confidence score
- [x] Interfejs manual override: klik kolumna źródłowa → klik pole JPK
- [x] Podgląd 5 pierwszych wierszy przy każdym polu
- [x] Utwórz `mappingStore.ts` — aktywne mapowania, autoMap, profile
- [x] SystemProfiles: 100% confidence dla NAMOS/ESO (pozycyjne mapowanie)
- [x] Obsługa niezmapowanych pól wymaganych (czerwone podświetlenie, blokada "Dalej")
- [x] Konfiguracja transformacji (data format, decimal separator, NIP) — collapsible panel z podglądem przed→po
- [x] Zapisywanie/ładowanie profili mapowań — UI (save/load/delete z potwierdzeniem)

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
- [x] Walidacja XSD (poziom 4) — XsdValidator.ts z regułami ze schematów XSD

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
- [x] Podłącz ConversionPipeline do stores (bridge pattern)

## Faza 5 — Electron main process

- [x] Rozszerz `openFileDialog()`: nowe filtry plików (txt, csv, xlsx, xls, json, xml, dat, tsv)
- [x] Dodaj IPC handler: `readFileAsBuffer()` (Buffer jako number[] przez IPC)
- [x] Dodaj IPC handler: `file:parse` — parsowanie plików w main process (FileReaderRegistry)
- [x] Rozszerz preload API: `parseFile()`, `readFileAsBuffer()`
- [x] Typy globalne w `index.d.ts`: SerializedSheet, SerializedFileReadResult
- [x] Obsługa błędów: globalny error handler z logowaniem
- [x] Auto-update: electron-updater

## Faza 6 — Jakość

- [x] Konfiguracja Vitest: pokrycie kodu, threshold 80%
- [x] CI: GitHub Actions (lint + typecheck + test + e2e + build)
- [x] E2E test: Playwright — pełny flow import → export (Electron + dialog mocking)
- [ ] Dokumentacja użytkownika: README.md z screenshotami
- [x] Obsługa błędów graceful: toast notifications w UI

## Faza 7 — Release

- [x] electron-builder config (Win NSIS+portable, Mac DMG, Linux AppImage+deb)
- [x] App icon (1024x1024 PNG → ico/icns/png)
- [x] GitHub Actions release workflow (matrix Win/Mac/Linux, draft release on v* tag)
- [x] Version 3.0.0 (bumped from 2.1.0)
- [ ] Testy manualne z rzeczywistymi plikami z różnych systemów ERP
- [ ] Dokumentacja użytkownika ze screenshotami
- [ ] Wersja 3.0.0: release publiczny

## Faza 8 — Jakość kodu i refaktory (post-release)

### 8.1 Poprawki jakości kodu
- [x] CQ-1: Zamiana float accumulation na integer math we wszystkich generatorach
- [x] CQ-2: XML escaping w string interpolations we wszystkich generatorach
- [x] CQ-3: Runtime input validation we wszystkich generatorach
- [x] TB-1: Dodanie `src/core` do pipeline typecheck (tsconfig.core.json)
- [x] TB-2/TB-3: Enforced noImplicitAny, typecheck dla wszystkich platform builds
- [x] UI-1: Immutable Zustand store updates (replace direct mutation)
- [x] TKwotowy decimal 18,2 compliance we wszystkich generatorach

### 8.2 Unifikacja typów
- [x] JpkType — single source of truth w `appStore.ts` (reeksport z `core/models/types.ts`)
- [x] `jpkTypeUtils.ts` — normalizeJpkType, jpkTypeToLabel, jpkTypeToXmlCode, getAllJpkTypes
- [x] Per-file JPK type detection via `jpkTypeFromHeaders()` w ImportStep
- [x] Per-file JPK type selector w ImportStep (dropdown override)

### 8.3 CompanyStep rewrite
- [x] PeriodData per JpkType: `periods: Partial<Record<JpkType, PeriodData>>` (z migracją localStorage)
- [x] CompanyData rozszerzone o pola: objetyKsefOd, numerRachunku, walutaRachunku, saldoPoczatkowe, miejsceWystawienia, kodMagazynu, nazwaMagazynu
- [x] Dynamiczne sekcje wg wykrytych typów JPK z plików (showAll gdy brak plików)
- [x] Per-type period cards z kolorowym border-left (V7M→blue, FA→purple, MAG→green, WB→orange)
- [x] V7M: toggle miesięczny/kwartalny, rok/miesiąc/kwartał selects
- [x] Non-V7M: dataOd/dataDo date inputs
- [x] Sekcje: KSeF (V7M), dane bankowe (WB), dane faktury (FA), dane magazynu (MAG)
- [x] numerKorekty input gdy celZlozenia === 2
- [x] KSeF badge: "Faktury przed X → oznaczane BFK"
- [x] Walidacja canProceed: NIP + fullName + kodUrzedu(4) + per-type period + numerKorekty + numerRachunku(WB)
- [x] Pure functions extracted to `companyStepLogic.ts` (getDetectedTypes, computeSectionFlags, computeCanProceed)
- [x] 39 testów walidacji logiki CompanyStep

### 8.4 UI features
- [x] Light/dark theme toggle (themeStore z persist)
- [x] Przycisk "Nowa konwersja" w HistoryStep i ExportStep (reset stores)

---

## Status

| Faza | Status | Testy |
|------|--------|-------|
| 0 — Przygotowanie | ✅ Done | — |
| 1 — Core (parsery + mapowanie) | ✅ Done | 309 tests |
| 2 — Generatory XML | ✅ Done | 871 tests |
| 3 — UI rozszerzenia | ✅ Done | Web typecheck OK |
| 4 — Zustand stores | ✅ Done | 632 tests |
| 5 — Electron main | ✅ Done | Build OK |
| 6 — Jakość | ✅ Done | 1986 unit + 1 E2E, 54 test files |
| 7 — Release | 🔶 In progress | Build config done |
| 8 — Jakość kodu i refaktory | ✅ Done | +39 CompanyStep tests |

### Pozostałe zadania (Faza 3-5)
- ~~Wybór kodowania w ImportStep (dropdown fallback)~~ ✅
- ~~Konfiguracja transformacji w MappingStep (data format, decimal separator)~~ ✅
- ~~UI do zapisywania/ładowania profili mapowań~~ ✅
- ~~Walidacja XSD w ValidationStep (poziom 4)~~ ✅
- ~~Podłączenie ConversionPipeline do stores~~ ✅
- ~~Error handling + auto-update w Electron~~ ✅
