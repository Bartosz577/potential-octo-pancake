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
├── readers/                    # Pluginy odczytu plików (8 formatów)
│   ├── TxtFileReader.ts        #   TXT pipe-delimited (NAMOS/ESO)
│   ├── CsvFileReader.ts        #   CSV z auto-detect separatora
│   ├── XlsxFileReader.ts       #   Excel XLSX/XLS
│   ├── JsonFileReader.ts       #   JSON (tablica obiektów)
│   ├── XmlFileReader.ts        #   Generyczny XML
│   ├── EppFileReader.ts        #   Format Comarch Optima EPP
│   ├── DbfFileReader.ts        #   dBASE III/IV DBF
│   ├── OdsFileReader.ts        #   OpenDocument Spreadsheet ODS
│   └── FileReaderRegistry.ts   #   Auto-detection formatu
├── mapping/                    # AutoMapper, SystemProfiles, TransformEngine, JpkFieldDefinitions
├── models/                     # TypeScript interfaces (types.ts + canonical models per JPK type)
├── validation/                 # XsdValidator + rules (structural, business, checksums, xsd)
├── generators/                 # XML generators (12 typów JPK)
│   ├── JpkV7mGenerator.ts      #   JPK_V7M(3) z KSeF
│   ├── JpkV7kGenerator.ts      #   JPK_V7K(3) z KSeF
│   ├── JpkFaGenerator.ts       #   JPK_FA(4)
│   ├── JpkFaRrGenerator.ts     #   JPK_FA_RR(1)
│   ├── JpkMagGenerator.ts      #   JPK_MAG(2)
│   ├── JpkWbGenerator.ts       #   JPK_WB(1)
│   ├── JpkPkpirGenerator.ts    #   JPK_PKPIR(3)
│   ├── JpkEwpGenerator.ts      #   JPK_EWP(4)
│   ├── JpkKrPdGenerator.ts     #   JPK_KR_PD(1)
│   ├── JpkKrGenerator.ts       #   JPK_KR(1)
│   ├── JpkStGenerator.ts       #   JPK_ST(1)
│   ├── JpkStKrGenerator.ts     #   JPK_ST_KR(1)
│   └── XmlGeneratorEngine.ts   #   Wspólny silnik XML
├── encoding/                   # EncodingDetector (windows-1250, ISO-8859-2, CP852)
├── JpkMerger.ts                # Scalanie plików JPK XML tego samego typu
├── JpkVersionConverter.ts      # Konwersja starszych wersji JPK (FA(2/3)→FA(4), V7M(2)→V7M(3))
└── ConversionPipeline.ts       # Orkiestrator: parse → map → transform → validate → generate
```

### UI
```
src/renderer/components/
├── layout/          # AppShell, TitleBar, Sidebar, StepIndicator
├── steps/           # ImportStep, MappingStep, CompanyStep, PreviewStep, ValidationStep, ExportStep, HistoryStep
│   └── companyStepLogic.ts  # Pure functions: getDetectedTypes, computeSectionFlags, computeCanProceed
├── mapping/         # ColumnMappingUI, FieldPreview, TransformConfig, SavedMappings
└── shared/          # FormatBadge, EncodingSelector
```

### Bridge (pipeline)
```
src/renderer/bridge/
├── PipelineBridge.ts      # processFile(): ParsedFile + mappings + company → XML result
├── pipelineStore.ts       # Status/results store for pipeline execution
├── usePipelineBridge.ts   # React hook: validateAll, generateAll, processOne, runAll
└── types.ts               # BridgeSummary, FileProcessingResult
```

### State (Zustand stores)
- `appStore` — aktywny typ JPK (JpkType), podtyp (JpkSubtype V7M/V7K), bieżący krok (1-7), tryb (conversion/validation)
- `importStore` — zaimportowane pliki (ParsedFile[]), per-file JPK type detection
- `companyStore` — dane firmy (CompanyData), okresy per typ JPK (periods: Partial<Record<JpkType, PeriodData>>), zapamiętane firmy (localStorage persist z migracją)
- `mappingStore` — aktywne mapowanie kolumn, zapisane profile, matchedProfiles per file
- `historyStore` — historia konwersji (ConversionRecord[]), persistowany localStorage
- `pipelineStore` — status pipeline (idle/validating/generating/success/error), wyniki per file
- `themeStore` — light/dark theme toggle, persistowany localStorage
- `toastStore` — powiadomienia toast (success/error/info)

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
