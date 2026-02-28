# JPK Universal Converter v2

![CI](https://github.com/Bartosz577/potential-octo-pancake/actions/workflows/ci.yml/badge.svg)
![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)

Desktopowe narzedzie do konwersji plikow z systemow ERP (NAMOS, ESO i inne) na pliki XML w formacie **JPK** (Jednolity Plik Kontrolny) wymagane przez Ministerstwo Finansow RP.

Obslugiwane struktury JPK:
- **JPK_V7M(3)** — ewidencja sprzedazy/zakupu VAT (z polami KSeF)
- **JPK_FA(4)** — faktury VAT
- **JPK_MAG(2)** — dokumenty magazynowe (PZ, WZ, RW, MM)
- **JPK_WB(1)** — wyciagi bankowe

## Screenshoty

> TODO: screenshots

## Funkcje

### Import plikow
- Formaty wejsciowe: **TXT**, **CSV**, **XLSX/XLS**, **JSON**, **XML**
- Auto-detekcja kodowania: UTF-8, Windows-1250, ISO-8859-2, CP852
- Auto-detekcja separatora: `|`, `;`, `,`, `TAB`
- Reczny wybor kodowania z podgladem na zywo
- Import wielu plikow jednoczesnie (batch)

### Mapowanie kolumn
- Automatyczne mapowanie dla systemow NAMOS i ESO (pozycyjne, 100% confidence)
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
- **JPK_V7M(3)** — z obsluga pol KSeF (NumerKSeF, OznaczenieKSeF)
- **JPK_FA(4)** — faktury z wieloma stawkami VAT, korekty, waluty obce
- **JPK_MAG(2)** — dokumenty PZ/WZ/RW/MM z grupowaniem po numerze dokumentu
- **JPK_WB(1)** — operacje bankowe z saldem

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
# Testy jednostkowe (761 testow)
npm test

# Testy z pokryciem kodu (threshold 80%)
npm run test:coverage

# Testy E2E — Playwright + Electron (wymaga wcześniejszego buildu)
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
├── core/                        # Logika biznesowa (niezalezna od UI)
│   ├── readers/                 # Parsery plikow wejsciowych
│   │   ├── TxtFileReader.ts     #   TXT pipe-delimited (NAMOS/ESO)
│   │   ├── CsvFileReader.ts     #   CSV z auto-detect separatora
│   │   ├── XlsxFileReader.ts    #   Excel XLSX/XLS
│   │   ├── JsonFileReader.ts    #   JSON (tablica obiektow)
│   │   ├── XmlFileReader.ts     #   Generyczny XML
│   │   └── FileReaderRegistry.ts#   Auto-detection formatu
│   ├── mapping/                 # Mapowanie kolumn
│   │   ├── AutoMapper.ts        #   Heurystyczne mapowanie
│   │   ├── SystemProfiles.ts    #   Profile NAMOS/ESO
│   │   ├── JpkFieldDefinitions.ts#  Definicje pol JPK
│   │   └── TransformEngine.ts   #   Transformacje danych
│   ├── generators/              # Generatory XML
│   │   ├── JpkV7mGenerator.ts   #   JPK_V7M(3) z KSeF
│   │   ├── JpkFaGenerator.ts    #   JPK_FA(4)
│   │   ├── JpkMagGenerator.ts   #   JPK_MAG(2)
│   │   ├── JpkWbGenerator.ts    #   JPK_WB(1)
│   │   └── XmlGeneratorEngine.ts#   Wspolny silnik XML
│   ├── validation/              # Walidacja
│   │   └── XsdValidator.ts      #   Walidacja regul XSD
│   ├── encoding/                # Detekcja kodowania
│   │   └── EncodingDetector.ts
│   ├── models/                  # Interfejsy TypeScript
│   │   └── types.ts
│   └── ConversionPipeline.ts    # Orkiestrator calego flow
│
├── main/                        # Electron main process
│   ├── index.ts                 #   Okno, IPC handlers, dialogi
│   ├── logger.ts                #   Logowanie bledow
│   └── updater.ts               #   Auto-update (electron-updater)
│
├── preload/                     # Electron preload (context bridge)
│   └── index.ts                 #   API: openFileDialog, parseFile, saveFile
│
└── renderer/                    # React frontend
    └── src/
        ├── components/
        │   ├── layout/          #   AppShell, TitleBar, Sidebar, StepIndicator
        │   └── steps/           #   7 krokow wizarda
        │       ├── ImportStep.tsx
        │       ├── MappingStep.tsx
        │       ├── CompanyStep.tsx
        │       ├── PreviewStep.tsx
        │       ├── ValidationStep.tsx
        │       ├── ExportStep.tsx
        │       └── HistoryStep.tsx
        ├── stores/              #   Zustand stores
        │   ├── appStore.ts      #     Aktywny typ JPK, krok
        │   ├── importStore.ts   #     Zaimportowane pliki
        │   ├── mappingStore.ts  #     Mapowania kolumn, profile
        │   ├── companyStore.ts  #     Dane firmy, okres
        │   ├── historyStore.ts  #     Historia konwersji
        │   └── toastStore.ts    #     Powiadomienia toast
        └── utils/               #   Utility renderera
            ├── xmlExporter.ts   #     Bridge: stores → generatory XML
            ├── validator.ts     #     4-poziomowa walidacja
            └── nipValidator.ts  #     Walidacja checksum NIP

tests/                           # Testy
├── core/                        #   Testy jednostkowe core (parsery, mapping, generatory)
├── renderer/                    #   Testy stores i utils
├── e2e/                         #   Playwright E2E (full flow)
└── fixtures/                    #   Dane testowe

schemas/                         # Schematy XSD ze strony gov.pl
docs/                            # Dokumentacja regulacyjna i plan implementacji
```

## Workflow aplikacji

```
Import → Mapowanie → Firma → Podglad → Walidacja → Eksport → Historia
  (1)       (2)       (3)      (4)        (5)        (6)       (7)
```

Kazdy krok to osobny komponent React. Nawigacja przyciskami "Dalej" / "Wstecz" z walidacja warunkow przejscia (np. wymagane mapowanie pol, poprawny NIP).

## Licencja

MIT
