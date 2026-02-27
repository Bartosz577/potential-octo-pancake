# JPK Universal Converter v2

## Projekt
Aplikacja desktopowa Electron + React do konwersji plików z systemów ERP (dowolny format) na XML w formacie JPK wymaganym przez Ministerstwo Finansów RP. Docelowo: uniwersalne narzędzie obsługujące wszystkie formaty wejściowe i wszystkie struktury JPK.

## Stack
- Electron 39 (frameless window, custom titlebar)
- React 19 + TypeScript 5.9
- Vite 7 via electron-vite 5
- Tailwind CSS 4 + custom CSS variables (dark theme)
- Zustand 5 (state management)
- Lucide React (ikony)
- Plus Jakarta Sans (UI font), JetBrains Mono (dane/tabele)

## Architektura

### Workflow 7-krokowy
```
Import → Mapowanie → Firma → Podgląd → Walidacja → Eksport → Historia
  (1)       (2)       (3)      (4)        (5)        (6)       (7)
```
Każdy krok = osobny komponent React. Nawigacja przez `appStore.currentStep`.

### Warstwy core
```
src/core/
├── readers/         # Pluginy odczytu plików (TxtFileReader, CsvFileReader, XlsxFileReader, JsonFileReader, XmlFileReader)
├── mapping/         # AutoMapper, SystemProfiles, TransformEngine, JpkFieldDefinitions
├── models/          # TypeScript interfaces (types.ts + canonical models per JPK type)
├── validation/      # ValidationEngine + rules (structural, business, checksums, xsd)
├── generators/      # XML generators per typ JPK
├── encoding/        # EncodingDetector (windows-1250, ISO-8859-2, CP852)
└── ConversionPipeline.ts  # Orkiestrator: parse → map → transform → validate → generate
```

### UI
```
src/renderer/components/
├── layout/          # AppShell, TitleBar, Sidebar, StepIndicator
├── steps/           # ImportStep, MappingStep, CompanyStep, PreviewStep, ValidationStep, ExportStep, HistoryStep
├── mapping/         # ColumnMappingUI, FieldPreview, TransformConfig, SavedMappings
└── shared/          # FormatBadge, EncodingSelector
```

### State (Zustand stores)
- `appStore` — aktywny typ JPK, bieżący krok (1-7)
- `importStore` — zaimportowane pliki (ParsedFile[])
- `companyStore` — dane firmy, okres, zapamiętane firmy (localStorage)
- `mappingStore` — aktywne mapowanie kolumn, zapisane profile
- `historyStore` — historia konwersji (ConversionRecord[]), persistowany localStorage

## Komendy
- `npm run dev` — development
- `npm run build` — production build
- `npm run build:win` / `build:mac` / `build:linux` — platform builds
- `npm run lint` — ESLint
- `npm run typecheck` — tsc --noEmit
- `npm test` — Vitest

## Konwencje
- Nazwy plików: PascalCase dla komponentów React, camelCase dla utils
- Eksport: named exports (nie default) dla utils, default dla komponentów React
- Język kodu: angielski (nazwy zmiennych, komentarze)
- Język UI: polski (labels, komunikaty, walidacja)
- Kwoty: zawsze 2 miejsca dziesiętne, separator dziesiętny `.` w XML
- Daty: format `YYYY-MM-DD` w modelu kanonicznym i XML wyjściowym
- NIP: 10 cyfr bez separatorów w modelu, `XXX-XXX-XX-XX` w UI

## Zasady
- NIGDY nie modyfikuj istniejących plików w `src/core/models/types.ts` bez aktualizacji importów we wszystkich zależnych modułach
- Każdy nowy FileReader MUSI implementować interfejs `FileReaderPlugin` i być zarejestrowany w `FileReaderRegistry`
- Każdy nowy generator XML MUSI generować XML zgodny ze schematem XSD Ministerstwa Finansów
- Walidacja NIP: 10 cyfr → checksum (wagi: 6,5,7,2,3,4,5,6,7); 11 cyfr → PESEL (OK); KodKontrahenta ≠ PL → zagraniczny (OK); brak/pusty → warning
- Testy: pisz testy Vitest dla każdego nowego modułu w `src/core/`
- XML escaping: zawsze escape `&`, `<`, `>`, `"`, `'` w wartościach
- Kodowanie plików wejściowych: auto-detect przez EncodingDetector, fallback windows-1250

## Kontekst biznesowy
- JPK = Jednolity Plik Kontrolny (polska regulacja podatkowa)
- Od lutego 2026: obowiązkowy KSeF (e-fakturowanie), nowa wersja JPK_V7M(3) z polami KSeF
- Szczegółowa dokumentacja: `docs/jpk-regulations.md`, `docs/ksef-requirements.md`
- Schematy XSD: `schemas/` — pobrane z gov.pl

## Priorytety implementacji
Szczegółowy plan w `docs/implementation-plan.md` (checkboxy [ ] do odhaczania)
