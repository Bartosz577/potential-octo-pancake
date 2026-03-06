# JPK Universal Converter v3

![CI](https://github.com/Bartosz577/potential-octo-pancake/actions/workflows/ci.yml/badge.svg)
![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-2.1.0-green)

Desktopowe narzedzie do konwersji plikow z systemow ERP na pliki XML w formacie **JPK** (Jednolity Plik Kontrolny) wymagane przez Ministerstwo Finansow RP. Uniwersalne narzedzie obsługujace wszystkie popularne formaty wejsciowe i wszystkie struktury JPK.

## Obslugiwane struktury JPK

| Struktura | Opis | Wersja |
|-----------|------|--------|
| **JPK_V7M(3)** | Ewidencja sprzedazy/zakupu VAT (miesiecznie) | 3 (z KSeF) |
| **JPK_V7K(3)** | Ewidencja sprzedazy/zakupu VAT (kwartalnie) | 3 (z KSeF) |
| **JPK_FA(4)** | Faktury VAT | 4 |
| **JPK_FA_RR(1)** | Faktury VAT RR (rolnicy ryczaltowi) | 1 |
| **JPK_MAG(2)** | Dokumenty magazynowe (PZ, WZ, RW, MM) | 2 |
| **JPK_WB(1)** | Wyciagi bankowe | 1 |
| **JPK_PKPIR(3)** | Podatkowa Ksiega Przychodow i Rozchodow | 3 |
| **JPK_EWP(4)** | Ewidencja przychodow (ryczalt) | 4 |
| **JPK_KR_PD(1)** | Ksiegi rachunkowe (CIT) | 1 |
| **JPK_KR(1)** | Ksiegi rachunkowe (legacy) | 1 |
| **JPK_ST(1)** | Srodki trwale (EWP/PKPiR) | 1 |
| **JPK_ST_KR(1)** | Srodki trwale (KR) | 1 |

## Obslugiwane formaty wejsciowe

| Format | Rozszerzenia | Opis |
|--------|-------------|------|
| **TXT** | `.txt`, `.dat` | Pipe-delimited, tab-delimited, pozycyjny |
| **CSV** | `.csv`, `.tsv` | Auto-detekcja separatora (`;`, `,`, `TAB`, `\|`) |
| **Excel** | `.xlsx`, `.xls` | Arkusze z wieloma zakladkami |
| **JSON** | `.json` | Tablica obiektow |
| **XML** | `.xml` | Generyczny XML |
| **EPP** | `.epp` | Format eksportu Comarch Optima |
| **DBF** | `.dbf` | dBASE III/IV (legacy ERP) |
| **ODS** | `.ods` | OpenDocument Spreadsheet (LibreOffice) |

## Obslugiwane systemy ERP

| System | Udzial rynkowy | Format |
|--------|---------------|--------|
| **Comarch Optima** | ~24% | EPP, CSV, XLSX |
| **Insert Subiekt** | ~15% | CSV, TXT |
| **enova365** | ~10% | XML, CSV |
| **Sage Symfonia** | ~8% | TXT, CSV |
| **Asseco WAPRO** | ~6% | TXT, DBF |
| **NAMOS** | — | TXT (pipe-delimited, pozycyjny) |
| **ESO** | — | TXT (pipe-delimited) |
| **Dynamics NAV** | — | CSV, XLSX |
| **SAP R/3** | — | CSV, XML |

## Funkcje

### Import plikow
- 8 formatow wejsciowych: TXT, CSV, XLSX/XLS, JSON, XML, EPP, DBF, ODS
- Auto-detekcja kodowania: UTF-8, Windows-1250, ISO-8859-2, CP852
- Auto-detekcja separatora: `|`, `;`, `,`, `TAB`
- Reczny wybor kodowania z podgladem na zywo
- Import wielu plikow jednoczesnie (batch)
- Drag & drop plikow

### Mapowanie kolumn
- Automatyczne mapowanie dla systemow NAMOS, ESO, Comarch Optima i innych
- Rozpoznawanie struktury pliku (jpkType + subType) niezaleznie od nazwy systemu
- Heurystyczne mapowanie nieznanych formatow (analiza naglowkow + zawartosci)
- Reczny override: klikniecie kolumny zrodlowej → pole JPK
- Podglad przykladowych danych przy kazdym polu
- Wizualizacja confidence score (kolorowa skala)

### Transformacje danych
- Konwersja dat: `DD.MM.YYYY`, `DD/MM/YYYY`, `DD-MM-YYYY` → `YYYY-MM-DD`
- Normalizacja kwot: przecinek → kropka, formatowanie do 2 miejsc dziesietnych
- Normalizacja NIP: usuwanie myslnikow i spacji, walidacja checksum

### Profile mapowan
- Zapis aktywnego mapowania jako profil (nazwa + konfiguracja)
- Ladowanie zapisanych profili
- Usuwanie profili z potwierdzeniem

### Generatory XML
- 12 generatorow XML zgodnych ze schematami XSD Ministerstwa Finansow
- Obsluga pol KSeF (NumerKSeF, OznaczenieKSeF) w JPK_V7M(3) i JPK_FA(4)
- Faktury z wieloma stawkami VAT, korekty, waluty obce
- Dokumenty PZ/WZ/RW/MM z grupowaniem po numerze dokumentu

### Walidacja 4-poziomowa
1. **Struktura** — spojnosc kolumn, wymagane pola, format pliku
2. **Merytoryka** — poprawnosc NIP (checksum, PESEL, zagraniczny), format dat, kwoty
3. **Sumy kontrolne** — automatyczne obliczenie sum per pole K
4. **Schemat XSD** — walidacja wygenerowanego XML zgodnie ze schematami MF

### Auto-naprawa
- Automatyczna konwersja dat do formatu `YYYY-MM-DD`
- Zamiana przecinkow na kropki w kwotach
- Przycisk "Napraw automatycznie" — per problem, per grupa, globalnie

### Historia konwersji
- Lista poprzednich eksportow z data, typem JPK, firma, rozmiarem
- Filtrowanie po typie + wyszukiwarka (nazwa/firma/NIP)
- Ponowne pobranie XML z historii
- Dane persistowane w localStorage

## Narzedzia dodatkowe

### JPK Merger
Scalanie wielu plikow JPK XML tego samego typu w jeden plik. Waliduje zgodnosc KodFormularza, WariantFormularza i NIP. Przenumerowuje wiersze (LP) i przelicza sumy kontrolne. Obsluguje 7 typow: JPK_VAT, JPK_FA, JPK_WB, JPK_EWP, JPK_PKPIR, JPK_KR, JPK_FA_RR.

### Standalone Validator
Walidacja istniejacego pliku JPK XML bez koniecznosci importu danych. Sprawdza strukture dokumentu, poprawnosc NIP, sumy kontrolne i zgodnosc ze schematem XSD. Automatycznie rozpoznaje typ JPK.

### Version Upgrader
Automatyczna konwersja starszych wersji JPK do najnowszych:
- JPK_FA(2) / JPK_FA(3) → JPK_FA(4)
- JPK_V7M(2) → JPK_V7M(3)

Dodaje oznaczenia KSeF (BFK) do wierszy faktur, aktualizuje WariantFormularza i namespace. Wyswietla liste zmian przed zapisem.

## Wymagania

- **Node.js** 20+
- **npm** 9+

## Instalacja i uruchomienie

```bash
# Klonowanie repozytorium
git clone https://github.com/Bartosz577/potential-octo-pancake.git
cd potential-octo-pancake

# Instalacja zaleznosci
npm install

# Uruchomienie w trybie deweloperskim
npm run dev

# Build produkcyjny
npm run build

# Build platformowy
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Testy

```bash
# Testy jednostkowe (1426 testow)
npm test

# Testy z pokryciem kodu (threshold 80%)
npm run test:coverage

# Testy E2E — Playwright + Electron (wymaga wczesniejszego buildu)
npm run test:e2e

# Linting
npm run lint

# Sprawdzenie typow
npm run typecheck
```

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Desktop shell | Electron 39 (frameless window, custom titlebar) |
| Frontend | React 19 + TypeScript 5.9 |
| Bundler | Vite 7 via electron-vite 5 |
| Stylowanie | Tailwind CSS 4 + custom CSS variables (dark theme) |
| State | Zustand 5 (z persist middleware) |
| Ikony | Lucide React |
| Fonty | Plus Jakarta Sans (UI), JetBrains Mono (dane/tabele) |
| XML parsing | fast-xml-parser |
| Excel | SheetJS (xlsx) |
| CSV | PapaParse |
| Kodowanie | iconv-lite |
| Testy | Vitest + Playwright |
| CI | GitHub Actions |

## Struktura projektu

```
src/
├── core/                          # Logika biznesowa (niezalezna od UI)
│   ├── readers/                   # Parsery plikow wejsciowych
│   │   ├── TxtFileReader.ts       #   TXT pipe-delimited (NAMOS/ESO)
│   │   ├── CsvFileReader.ts       #   CSV z auto-detect separatora
│   │   ├── XlsxFileReader.ts      #   Excel XLSX/XLS
│   │   ├── JsonFileReader.ts      #   JSON (tablica obiektow)
│   │   ├── XmlFileReader.ts       #   Generyczny XML
│   │   ├── EppFileReader.ts       #   Format Comarch Optima EPP
│   │   ├── DbfFileReader.ts       #   dBASE III/IV DBF
│   │   ├── OdsFileReader.ts       #   OpenDocument Spreadsheet ODS
│   │   └── FileReaderRegistry.ts  #   Auto-detection formatu
│   ├── mapping/                   # Mapowanie kolumn
│   │   ├── AutoMapper.ts          #   Heurystyczne mapowanie
│   │   ├── SystemProfiles.ts      #   Profile ERP (struktura-based)
│   │   ├── JpkFieldDefinitions.ts #   Definicje pol JPK
│   │   └── TransformEngine.ts     #   Transformacje danych
│   ├── generators/                # Generatory XML (12 typow)
│   │   ├── JpkV7mGenerator.ts     #   JPK_V7M(3) z KSeF
│   │   ├── JpkV7kGenerator.ts     #   JPK_V7K(3) z KSeF
│   │   ├── JpkFaGenerator.ts      #   JPK_FA(4)
│   │   ├── JpkFaRrGenerator.ts    #   JPK_FA_RR(1)
│   │   ├── JpkMagGenerator.ts     #   JPK_MAG(2)
│   │   ├── JpkWbGenerator.ts      #   JPK_WB(1)
│   │   ├── JpkPkpirGenerator.ts   #   JPK_PKPIR(3)
│   │   ├── JpkEwpGenerator.ts     #   JPK_EWP(4)
│   │   ├── JpkKrPdGenerator.ts    #   JPK_KR_PD(1)
│   │   ├── JpkKrGenerator.ts      #   JPK_KR(1)
│   │   ├── JpkStGenerator.ts      #   JPK_ST(1)
│   │   ├── JpkStKrGenerator.ts    #   JPK_ST_KR(1)
│   │   └── XmlGeneratorEngine.ts  #   Wspolny silnik XML
│   ├── validation/                # Walidacja
│   │   └── XsdValidator.ts        #   Walidacja regul XSD
│   ├── encoding/                  # Detekcja kodowania
│   │   └── EncodingDetector.ts
│   ├── models/                    # Interfejsy TypeScript
│   │   └── types.ts
│   ├── JpkMerger.ts               # Scalanie plikow JPK XML
│   ├── JpkVersionConverter.ts     # Konwersja starszych wersji JPK
│   └── ConversionPipeline.ts      # Orkiestrator calego flow
│
├── main/                          # Electron main process
│   ├── index.ts                   #   Okno, IPC handlers, dialogi
│   ├── logger.ts                  #   Logowanie bledow
│   └── updater.ts                 #   Auto-update (electron-updater)
│
├── preload/                       # Electron preload (context bridge)
│   └── index.ts                   #   API: openFileDialog, parseFile, saveFile
│
└── renderer/                      # React frontend
    └── src/
        ├── components/
        │   ├── layout/            #   AppShell, TitleBar, Sidebar, StepIndicator
        │   └── steps/             #   7 krokow wizarda
        │       ├── ImportStep.tsx
        │       ├── MappingStep.tsx
        │       ├── CompanyStep.tsx
        │       ├── PreviewStep.tsx
        │       ├── ValidationStep.tsx
        │       ├── ExportStep.tsx
        │       └── HistoryStep.tsx
        ├── stores/                #   Zustand stores
        │   ├── appStore.ts        #     Aktywny typ JPK, krok, tryb
        │   ├── importStore.ts     #     Zaimportowane pliki
        │   ├── mappingStore.ts    #     Mapowania kolumn, profile
        │   ├── companyStore.ts    #     Dane firmy, okres
        │   ├── historyStore.ts    #     Historia konwersji
        │   └── toastStore.ts      #     Powiadomienia toast
        └── utils/                 #   Utility renderera
            ├── xmlExporter.ts     #     Bridge: stores → generatory XML
            ├── validator.ts       #     4-poziomowa walidacja + standalone validator
            └── nipValidator.ts    #     Walidacja checksum NIP

tests/                             # Testy (1426)
├── core/                          #   Testy jednostkowe core
├── renderer/                      #   Testy stores i utils
├── e2e/                           #   Playwright E2E
└── fixtures/                      #   Dane testowe

schemas/                           # Schematy XSD ze strony gov.pl
docs/                              # Dokumentacja i screenshoty
```

## Workflow aplikacji

```
Import → Mapowanie → Firma → Podglad → Walidacja → Eksport → Historia
  (1)       (2)       (3)      (4)        (5)        (6)       (7)
```

Kazdy krok to osobny komponent React. Nawigacja przyciskami "Dalej" / "Wstecz" z walidacja warunkow przejscia (np. wymagane mapowanie pol, poprawny NIP).

## Licencja

MIT
