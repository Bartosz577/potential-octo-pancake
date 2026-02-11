# JPK Converter — Specyfikacja Projektu v2

## Aplikacja desktopowa Electron + React do konwersji plików TXT → JPK XML

---

## 1. Opis Produktu

**JPK Converter** to desktopowa aplikacja na Windows umożliwiająca konwersję plików TXT eksportowanych z systemów ERP (NAMOS, ESO i inne) do formatu XML zgodnego ze schematami XSD Ministerstwa Finansów.

### Obsługiwane typy JPK

| Typ | System ERP | Plik TXT | Opis |
|-----|-----------|----------|------|
| **JPK_VDEK (V7M)** | NAMOS | `*_JPK_VDEK_SprzedazWiersz_*.txt` | Ewidencja sprzedaży VAT |
| **JPK_FA** | NAMOS | `*_JPK_FA_Faktura_*.txt` | Faktury VAT |
| **JPK_MAG (WZ)** | ESO | `*_JPK_MAG_WZ_*.txt` | Magazyn — wydania zewnętrzne |
| **JPK_MAG (RW)** | ESO | `*_JPK_MAG_RW_*.txt` | Magazyn — rozchody wewnętrzne |

### Kluczowe cechy
- Import plików TXT z separatorem `|` (pipe)
- Auto-rozpoznawanie typu JPK po nazwie pliku i metadanych
- Podgląd danych w tabeli z kolorowaniem błędów
- Edycja inline przed eksportem
- Walidacja wielopoziomowa (dane + XSD)
- Generowanie plików XML gotowych do wysyłki do MF
- Profile mapowania per system ERP
- Zapis danych firmowych (wielofirmowość)

---

## 2. Analiza plików źródłowych (rzeczywiste dane)

### Wspólne cechy plików TXT

| Parametr | Wartość |
|----------|---------|
| Separator | `\|` (pipe) |
| Kodowanie | UTF-8 (NAMOS), ASCII (ESO) |
| Nagłówek | **BRAK** — dane zaczynają się od pierwszego wiersza |
| Końce linii | `\r\n` (CRLF) — NAMOS, `\n` (LF) — ESO |
| Separator dziesiętny | `,` (przecinek polski) |
| Format dat | `YYYY-MM-DD` |

### Każdy wiersz zaczyna się od metadanych (kolumny 1–6)

| Kolumna | Znaczenie | Przykład |
|---------|-----------|---------|
| 1 | Kod punktu/oddziału | `0P549` |
| 2 | System ERP | `NAMOS` / `ESO` |
| 3 | Typ JPK | `JPK_VDEK` / `JPK_FA` / `JPK_MAG` |
| 4 | Podtyp | `SprzedazWiersz` / `Faktura` / `WZ` / `RW` |
| 5 | Data od | `2026-01-01` |
| 6 | Data do | `2026-01-31` |

---

### 2.1. NAMOS JPK_VDEK SprzedazWiersz (70 kolumn, ~1107 wierszy)

| Kol. | Pole JPK XML | Typ | Przykład |
|------|-------------|-----|---------|
| 1 | _(meta: kod punktu)_ | string | `0P549` |
| 2 | _(meta: system)_ | string | `NAMOS` |
| 3 | _(meta: typ JPK)_ | string | `JPK_VDEK` |
| 4 | _(meta: podtyp)_ | string | `SprzedazWiersz` |
| 5 | _(meta: data od)_ | date | `2026-01-01` |
| 6 | _(meta: data do)_ | date | `2026-01-31` |
| 7 | **LpSprzedazy** | int | `1` |
| 8 | **KodKrajuNadaniaTIN** | string | `PL` / `FR` / _(puste)_ |
| 9 | **NrKontrahenta** | string | `1130549245` / `brak` / `FR57819944604` |
| 10 | **NazwaKontrahenta** | string | `Marcin Dąbrowski - Azotownia.pl` |
| 11 | **DowodSprzedazy** | string | `I26549D01000784` |
| 12 | **DataWystawienia** | date | `2026-01-30` |
| 13 | **DataSprzedazy** | date | _(często puste)_ |
| 14 | **TypDokumentu** | string | `FP` (faktura do paragonu) |
| 15 | **GTU_01–GTU_13** _(puste = nie dotyczy)_ | string | _(puste)_ |
| 16 | **KorektaPodstawyOpodt** / marker | string | `1` / _(puste)_ |
| 17–42 | **Znaczniki proceduralne** (SW, EE, TP, TT_WNT, TT_D, MR_T, MR_UZ, I_42, I_63, B_SPV, B_SPV_DOSTAWA, B_MPV_PROWIZJA, IED, WSTO_EE itd.) | string | _(przeważnie puste)_ |
| 43 | **K_10** (netto — stawka 0%) | decimal | `0,00` |
| 44 | **K_11** (VAT — stawka 0%) | decimal | `0,00` |
| 45 | **K_12** | decimal | `0,00` |
| 46 | **K_13** | decimal | `0,00` |
| 47 | **K_14** | decimal | `0,00` |
| 48 | **K_15** | decimal | `0,00` |
| 49 | **K_16** | decimal | `0,00` |
| 50 | **K_17** | decimal | `0,00` |
| 51 | **K_18** | decimal | `0,00` |
| 52 | **K_19** (netto — stawka 23%) | decimal | `102,95` |
| 53 | **K_20** (VAT — stawka 23%) | decimal | `23,68` |
| 54–70 | **K_21–K_36** + dodatkowe | decimal | `0,00` |

**Uwagi:**
- Wszystkie 1107 wierszy to typ `FP` (faktura do paragonu)
- Kolumna 16 zawiera marker `1` w 1077 wierszach (97%)
- Kolumny 17–42 (znaczniki proceduralne) w tym zbiorze są puste
- NIP kontrahenta może mieć format: polski (10 cyfr), zagraniczny (z prefiksem `FR`), lub `brak`
- Separator dziesiętny: **przecinek** (`,`)

---

### 2.2. NAMOS JPK_FA Faktura (62 kolumny, ~1107 wierszy)

| Kol. | Pole JPK XML | Typ | Przykład |
|------|-------------|-----|---------|
| 1–6 | _(metadane — jak wyżej)_ | — | — |
| 7 | **KodWaluty** | string | `PLN` |
| 8 | **P_1** (data wystawienia) | date | `2026-01-02` |
| 9 | **P_2A** (numer faktury) | string | `I26549D03000001` |
| 10 | **P_3A** (nazwa nabywcy) | string | `BP SERVICE CENTER MICHAŁ ZIELIŃSKI` |
| 11 | **P_3B** (adres nabywcy) | string | `HENRYKA SIENKIEWICZA 4 13-306 KURZĘTNIK` |
| 12 | **P_3C** (nazwa sprzedawcy) | string | `Stacja Paliw ZAF Zielińscy Roszkowska SP. J.` |
| 13 | **P_3D** (adres sprzedawcy) | string | `Henryka Sienkiewicza 4, 13-306 Kurzetnik` |
| 14 | **P_4A** (prefix kraju — sprzedawca) | string | `PL` |
| 15 | **P_4B** (NIP sprzedawcy) | string | `8771000580` |
| 16 | **P_5A** (prefix kraju — nabywca) | string | _(puste)_ |
| 17 | **P_5B** (NIP nabywcy) | string | `8771199707` / `877-137-11-70` |
| 18 | **P_6** (data sprzedaży/usługi) | date | `2026-01-02` |
| 19 | **P_13_1** (netto 23%) | decimal | `16,39` |
| 20 | **P_14_1** (VAT 23%) | decimal | `3,77` |
| 21 | **P_13_2** (netto 8%) | decimal | `0,00` |
| 22 | **P_14_2** (VAT 8%) | decimal | `0,00` |
| 23 | **P_13_3** (netto 5%) | decimal | `0,00` |
| 24 | **P_14_3** (VAT 5%) | decimal | `0,00` |
| 25 | **P_13_4** | decimal | `0,00` |
| 26 | **P_14_4** | decimal | `0,00` |
| 27 | **P_13_5** | decimal | `0,00` |
| 28 | **P_14_5** | decimal | `0,00` |
| 29 | **P_13_6** (netto stawka 0%) | decimal | `0,00` |
| 30 | **P_13_7** (netto zw.) | decimal | `0,00` |
| 31 | **P_13_8** | decimal | `0,00` |
| 32 | **P_13_9** | decimal | `0,00` |
| 33 | **P_13_10** | decimal | `0,00` |
| 34 | **P_15** (kwota brutto) | decimal | `20,16` |
| 35 | **P_16** (metoda kasowa) | boolean | `false` |
| 36 | **P_17** (samofakturowanie) | boolean | `false` |
| 37 | **P_18** (odwrotne obciążenie) | boolean | `false` |
| 38 | **P_18A** | boolean | `false` |
| 39 | **P_19** (art. 106c — faktura wystawiona przez organ egzekucyjny) | boolean | `false` |
| 40 | **P_19A** | string | _(puste)_ |
| 41 | **P_19B** | string | _(puste)_ |
| 42 | **P_19C** | string | _(puste)_ |
| 43 | **P_20** (faktura z art. 21) | boolean | `false` |
| 44 | **P_20A** | string | _(puste)_ |
| 45 | **P_20B** | string | _(puste)_ |
| 46 | **P_21** (faktura VAT marża — towary używane) | boolean | `false` |
| 47 | **P_21A** | string | _(puste)_ |
| 48 | **P_21B** | string | _(puste)_ |
| 49 | **P_21C** | string | _(puste)_ |
| 50 | **P_22** (faktura VAT marża — biura podróży) | boolean | `false` |
| 51 | **P_22A** | string | _(puste)_ |
| 52 | **P_22B** | string | _(puste)_ |
| 53 | **P_22C** | string | _(puste)_ |
| 54 | **P_23** (MPP — mechanizm podzielonej płatności) | boolean | `false` |
| 55 | **P_106E_2** / **P_106E_3** | boolean | `false` |
| 56 | **P_106E_3A** | boolean | `false` |
| 57 | **ZALiczka** | string | _(puste)_ |
| 58 | **RodzajFaktury** | string | `VAT` |
| 59 | **PrzyczynaKorekty** | string | _(puste)_ / `Anulowany paragon` |
| 60 | **NrFaKorygowanej** | string | _(puste)_ / `I26549D01000004` |
| 61 | **OkresFaKorygowanej** | string | _(puste)_ / `2026-01-02` |
| 62 | _(padding/puste)_ | string | _(puste)_ |

**Uwagi:**
- NIP nabywcy: różne formaty — z myślnikami (`877-137-11-70`) i bez (`8771199707`)
- Sprzedawca zawsze ten sam (stacja paliw) — NIP `8771000580`
- 1 faktura z przyczyną korekty `Anulowany paragon`
- `RodzajFaktury` = `VAT` (wszystkie wiersze)
- Pola `false` odpowiadają znacznikom `false` w XML (pomijane lub `<P_16>false</P_16>`)

---

### 2.3. ESO JPK_MAG WZ (21 kolumn, ~171 wierszy)

| Kol. | Pole JPK XML | Typ | Przykład |
|------|-------------|-----|---------|
| 1–6 | _(metadane — jak wyżej)_ | — | — |
| 7 | **Magazyn** (NumerWZWartoscNadawcy) | string | `0P549` |
| 8 | **NumerWZ** | string | `WZ0P54920260131` |
| 9 | **DataWZ** | date | `2026-01-31` |
| 10 | **WartoscWZ** | decimal | `2468,59` |
| 11 | **DataOtrzymaniaWZ** | date | `2026-01-31` |
| 12 | **StatusWZ** / OdbiorcaWZ | string | `0P549` |
| 13 | _(puste)_ | string | _(puste)_ |
| 14 | _(puste)_ | string | _(puste)_ |
| 15 | **NumerWZ2** (wiersz→nagłówek ref) | string | `WZ0P54920260131` |
| 16 | **KodTowaruWZ** (indeks) | string | `1004115` |
| 17 | **NazwaTowaruWZ** | string | `CREMA 1000G/1000` |
| 18 | **IloscWZ** | decimal | `80,000000` |
| 19 | **JednostkaWZ** | string | `Szt.` |
| 20 | **CenaWZ** | decimal | `0,06` |
| 21 | **WartoscWZ2** (wartość wiersza) | decimal | `5,14` |

**Uwagi:**
- Jeden dokument WZ na wiele wierszy (towarów)
- W tym pliku jest 1 unikalne WZ (`WZ0P54920260131`) ze 171 pozycjami
- Kol. 7–14: dane nagłówkowe (powtarzają się w każdym wierszu)
- Kol. 15–21: dane wierszowe (unikalne per pozycja)
- Separator dziesiętny: **przecinek** (`,`)
- Ilość z 6 miejscami po przecinku (`80,000000`)

---

## 3. Architektura Techniczna

### Stack technologiczny
```
Frontend:   React 18 + TypeScript + Tailwind CSS
State:      Zustand
Backend:    Electron 28+ (Node.js main process)
Budowanie:  Vite + electron-builder
Parser:     Własny parser pipe-delimited (nie Papa Parse — bo bez nagłówków)
XML:        xmlbuilder2 (generowanie) + libxmljs2 (walidacja XSD)
Baza:       better-sqlite3 (historia, profile, dane firm)
UI:         Radix UI + custom components
Ikony:      Lucide React
Font:       JetBrains Mono (dane) + Plus Jakarta Sans (UI)
Testy:      Vitest + Playwright (E2E)
```

### Struktura katalogów
```
jpk-converter/
├── electron/
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # Context bridge (IPC)
│   ├── services/
│   │   ├── fileParser.ts          # Parser TXT (pipe-delimited)
│   │   ├── fileDetector.ts        # Auto-detect typ JPK z nazwy i metadanych
│   │   ├── xmlGenerators/
│   │   │   ├── vdekGenerator.ts   # JPK_V7M XML builder
│   │   │   ├── faGenerator.ts     # JPK_FA XML builder
│   │   │   └── magGenerator.ts    # JPK_MAG XML builder
│   │   ├── xsdValidator.ts        # Walidacja XSD
│   │   ├── transformers.ts        # Normalizacja NIP, kwot, dat
│   │   ├── profileManager.ts      # Profile mapowania
│   │   └── companyManager.ts      # Zarządzanie danymi firm
│   ├── schemas/                   # Oficjalne pliki XSD z gov.pl
│   │   ├── JPK_V7M_3.xsd
│   │   ├── JPK_FA_4.xsd
│   │   ├── JPK_MAG_1.xsd
│   │   └── shared/               # Wspólne typy (etd, kck)
│   └── db/
│       └── database.ts            # SQLite schema + queries
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx       # Główny layout
│   │   │   ├── Sidebar.tsx        # Nawigacja typów JPK
│   │   │   ├── StepIndicator.tsx  # Progress bar kroków
│   │   │   └── TitleBar.tsx       # Custom titlebar (frameless)
│   │   ├── steps/
│   │   │   ├── Step1_Import.tsx       # Drag & drop + auto-detect
│   │   │   ├── Step2_CompanyData.tsx  # Dane firmowe + nagłówek
│   │   │   ├── Step3_Preview.tsx      # Tabela danych + edycja
│   │   │   ├── Step4_Validate.tsx     # Walidacja + raport
│   │   │   └── Step5_Export.tsx       # Generowanie XML + zapis
│   │   ├── shared/
│   │   │   ├── DataTable.tsx          # Wirtualizowana tabela
│   │   │   ├── FileDropZone.tsx
│   │   │   ├── XmlPreview.tsx         # Podgląd XML z kolorowaniem
│   │   │   ├── ValidationBadge.tsx
│   │   │   └── NipInput.tsx           # Input z walidacją NIP
│   │   └── dialogs/
│   │       ├── CompanyDialog.tsx
│   │       └── ProfileDialog.tsx
│   ├── stores/
│   │   ├── appStore.ts            # Globalny stan (aktualny krok, typ JPK)
│   │   ├── importStore.ts         # Zaimportowane dane
│   │   ├── companyStore.ts        # Dane firmowe
│   │   └── validationStore.ts     # Wyniki walidacji
│   ├── types/
│   │   ├── jpk-vdek.ts            # Typy TS dla JPK_V7M
│   │   ├── jpk-fa.ts              # Typy TS dla JPK_FA
│   │   ├── jpk-mag.ts             # Typy TS dla JPK_MAG
│   │   ├── common.ts              # Wspólne typy (NIP, Date, Decimal)
│   │   └── electron.d.ts          # Typy dla IPC bridge
│   └── utils/
│       ├── nipValidator.ts
│       ├── decimalParser.ts       # Polskie przecinki → JS floaty
│       ├── dateFormatter.ts
│       └── xmlEscape.ts
├── resources/
│   ├── icon.ico
│   └── schemas/                   # XSD bundlowane z aplikacją
├── package.json
├── electron-builder.yml
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

### Komunikacja Electron ↔ React (IPC)
```typescript
// preload.ts — contextBridge API
interface ElectronAPI {
  // Pliki
  openFileDialog(): Promise<string[]>;
  saveFileDialog(defaultName: string): Promise<string | null>;
  parseFile(path: string): Promise<ParsedFile>;
  detectFileType(path: string): Promise<JpkFileType>;
  
  // XML
  generateXml(data: JpkData, company: CompanyData): Promise<string>;
  validateXsd(xml: string, jpkType: JpkType): Promise<ValidationResult>;
  saveXml(xml: string, path: string): Promise<void>;
  
  // Profile i dane
  saveProfile(profile: MappingProfile): Promise<void>;
  loadProfiles(): Promise<MappingProfile[]>;
  saveCompany(company: CompanyData): Promise<void>;
  loadCompanies(): Promise<CompanyData[]>;
  
  // Historia
  saveConversion(record: ConversionRecord): Promise<void>;
  loadHistory(): Promise<ConversionRecord[]>;
}
```

---

## 4. Flow użytkownika (5 kroków)

### Krok 1: Import plików

```
┌────────────────────────────────────────────────────────┐
│  📥 Import plików                                       │
│                                                         │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│  │                                                   │   │
│  │     Przeciągnij pliki TXT tutaj                   │   │
│  │     lub kliknij aby wybrać                        │   │
│  │                                                   │   │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                                         │
│  Wykryte pliki:                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ✅ 0P549_NAMOS_JPK_VDEK_Sprzedaz...  │ V7M    │    │
│  │    1107 wierszy │ UTF-8 │ separator: |          │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ ✅ 0P549_NAMOS_JPK_FA_Faktura...     │ FA     │    │
│  │    1107 wierszy │ UTF-8 │ separator: |          │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ ✅ 0P549_ESO_JPK_MAG_WZ...           │ MAG WZ │    │
│  │    171 wierszy  │ ASCII │ separator: |          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Auto-detect:  System: NAMOS/ESO  Punkt: 0P549         │
│  Okres: 2026-01-01 — 2026-01-31                        │
│                                                         │
│                             [Dalej →]                   │
└────────────────────────────────────────────────────────┘
```

**Logika auto-detection:**
```typescript
function detectFileType(filename: string, firstRow: string[]): JpkFileInfo {
  // 1. Z nazwy pliku: *_JPK_VDEK_*, *_JPK_FA_*, *_JPK_MAG_WZ_*
  // 2. Z metadanych (kol 2-4): NAMOS|JPK_VDEK|SprzedazWiersz
  // 3. Zwraca: { system, jpkType, subType, dateFrom, dateTo, rowCount }
}
```

### Krok 2: Dane firmowe

```
┌────────────────────────────────────────────────────────┐
│  🏢 Dane podmiotu (Podmiot1 / Naglowek)                │
│                                                         │
│  Firma: [Stacja Paliw ZAF Zielińscy... ▾]  [+ Nowa]   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  NIP:              [8771000580        ]         │    │
│  │  Pełna nazwa:      [Stacja Paliw ZAF Zieli...] │    │
│  │  REGON:            [___________] (opcj.)        │    │
│  │  Kod urzędu skarb: [2820] [US Nowe Miasto L▾]  │    │
│  │  Email:            [__________________] (opcj.) │    │
│  │  Telefon:          [__________________] (opcj.) │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Okres rozliczeniowy:                                   │
│  Rok:  [2026 ▾]   Miesiąc: [1 (Styczeń) ▾]            │
│                                                         │
│  Cel złożenia:  ● Złożenie (1)  ○ Korekta (2)          │
│  Wariant:       ● JPK_V7M (miesięczny)                  │
│                 ○ JPK_V7K (kwartalny)                    │
│                                                         │
│  💾 Dane firmy pobrane automatycznie z pliku FA         │
│     (NIP: 8771000580, Nazwa: Stacja Paliw ZAF...)      │
│                                                         │
│                   [← Wstecz]  [Dalej →]                │
└────────────────────────────────────────────────────────┘
```

**Auto-fill z danych:** W pliku FA kolumny 12–15 zawierają dane sprzedawcy — aplikacja automatycznie wypełnia NIP i nazwę firmy.

### Krok 3: Podgląd danych

```
┌────────────────────────────────────────────────────────┐
│  📋 Podgląd: JPK_VDEK SprzedazWiersz (1107 wierszy)    │
│                                                         │
│  Zakładki: [Sprzedaż] [Faktury] [Magazyn WZ]           │
│                                                         │
│  ┌────┬──────┬─────────────┬────────────┬───────┬─────┐ │
│  │ Lp │ NIP  │ Kontrahent  │ Nr dowodu  │ K_19  │K_20 │ │
│  ├────┼──────┼─────────────┼────────────┼───────┼─────┤ │
│  │ 1  │ PL.. │ Marcin Dąb. │ I265..784  │102,95 │23,68│ │
│  │ 2  │ PL.. │ DOMBRUK TO..│ I265..555  │176,70 │40,64│ │
│  │ 3  │ PL.. │ MAZOTECH W..│ I265..004  │163,20 │37,53│ │
│  │...                                                  │ │
│  │1106│      │ ŻURAŃSKA A..│ I265..125  │231,03 │53,14│ │
│  │1107│ FR.. │ WIŚNIEWSKI.│ I265..420  │140,60 │32,34│ │
│  └────┴──────┴─────────────┴────────────┴───────┴─────┘ │
│                                                         │
│  Podsumowanie:                                          │
│  Σ K_19 (netto 23%): 185 432,17 PLN                    │
│  Σ K_20 (VAT 23%):    42 649,39 PLN                    │
│  Wierszy: 1107  │  NIP brak: 30  │  Zagraniczne: 1     │
│                                                         │
│  ⚠️ 30 wierszy z NIP = "brak" — OK dla osób fizycznych  │
│                                                         │
│  Kliknij wiersz aby edytować │ Prawy klik → opcje       │
│                                                         │
│                   [← Wstecz]  [Dalej →]                │
└────────────────────────────────────────────────────────┘
```

### Krok 4: Walidacja

```
┌────────────────────────────────────────────────────────┐
│  ✅ Walidacja                                           │
│                                                         │
│  Dane wejściowe                                        │
│  ├── ✅ Struktura pliku: 1107 wierszy, 70 kolumn       │
│  ├── ✅ Separator: | (pipe) — poprawny                  │
│  ├── ✅ Kodowanie: UTF-8                                │
│  └── ✅ Spójność kolumn: OK                             │
│                                                         │
│  Dane merytoryczne                                      │
│  ├── ✅ NIP sprzedawcy: 8771000580 ✓                    │
│  ├── ⚠️ NIP nabywców: 1077 poprawnych, 30x "brak"       │
│  ├── ✅ Daty: wszystkie w formacie YYYY-MM-DD           │
│  ├── ✅ Kwoty: parsowanie OK (separator: ,)             │
│  └── ✅ Sumy kontrolne: netto 185 432,17 / VAT 42 649  │
│                                                         │
│  Walidacja XSD                                          │
│  ├── ✅ Nagłówek (Naglowek): kompletny                  │
│  ├── ✅ Podmiot (Podmiot1): NIP + nazwa OK              │
│  ├── ✅ Ewidencja SprzedazWiersz: 1107 elementów       │
│  ├── ✅ SprzedazCtrl: sumy zgodne                       │
│  └── ✅ Schemat JPK_V7M(3): ZGODNY ✓                    │
│                                                         │
│  Wynik: 0 błędów ❌  2 ostrzeżenia ⚠️                    │
│                                                         │
│                   [← Wstecz]  [Eksportuj XML →]        │
└────────────────────────────────────────────────────────┘
```

### Krok 5: Eksport

```
┌────────────────────────────────────────────────────────┐
│  💾 Eksport XML                                         │
│                                                         │
│  Podgląd XML:                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ <?xml version="1.0" encoding="UTF-8"?>           │   │
│  │ <JPK xmlns="http://crd.gov.pl/wzor/...">        │   │
│  │   <Naglowek>                                     │   │
│  │     <KodFormularza ...>JPK_VAT</KodFormularza>   │   │
│  │     <WariantFormularza>3</WariantFormularza>     │   │
│  │     ...                                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Plik: JPK_V7M_2026-01_8771000580.xml                  │
│  Rozmiar: ~285 KB │ Wierszy sprzedaży: 1107            │
│                                                         │
│  [💾 Zapisz XML]  [📋 Kopiuj do schowka]  [👁 Otwórz]  │
│                                                         │
│  ✅ Plik zapisany: C:\Users\...\JPK_V7M_2026-01_...xml │
│                                                         │
│  Następne pliki do konwersji:                           │
│  ○ JPK_FA (1107 faktur)        [Konwertuj →]           │
│  ○ JPK_MAG WZ (171 pozycji)   [Konwertuj →]           │
│                                                         │
│                   [← Wstecz]  [Nowa konwersja]         │
└────────────────────────────────────────────────────────┘
```

---

## 5. Logika konwersji (szczegóły)

### 5.1. Parser plików TXT

```typescript
interface ParsedRow {
  meta: {
    pointCode: string;     // kol 1: "0P549"
    system: string;        // kol 2: "NAMOS" | "ESO"
    jpkType: string;       // kol 3: "JPK_VDEK" | "JPK_FA" | "JPK_MAG"
    subType: string;       // kol 4: "SprzedazWiersz" | "Faktura" | "WZ"
    dateFrom: string;      // kol 5
    dateTo: string;        // kol 6
  };
  data: string[];          // kol 7+ — dane właściwe
}

function parseTxtFile(content: string): ParsedRow[] {
  return content
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map(line => {
      const cols = line.split('|');
      return {
        meta: {
          pointCode: cols[0],
          system: cols[1],
          jpkType: cols[2],
          subType: cols[3],
          dateFrom: cols[4],
          dateTo: cols[5],
        },
        data: cols.slice(6),
      };
    });
}
```

### 5.2. Transformacje danych

```typescript
// Polskie kwoty → XML decimal
function parsePolishDecimal(value: string): string {
  // "102,95" → "102.95"
  // "2468,59" → "2468.59"  
  // "80,000000" → "80.00"
  // "" → "0.00"
  if (!value || value.trim() === '') return '0.00';
  return parseFloat(value.replace(',', '.')).toFixed(2);
}

// NIP normalizacja
function normalizeNip(nip: string): string {
  // "877-137-11-70" → "8771371170"
  // "8771199707" → "8771199707"
  // "brak" → "" (pomijane w XML)
  // "FR57819944604" → "FR57819944604" (zagraniczny — bez zmian)
  if (nip === 'brak' || nip === '') return '';
  return nip.replace(/[^A-Z0-9]/g, '');
}

// Walidacja NIP polskiego
function validatePolishNip(nip: string): boolean {
  const digits = nip.replace(/\D/g, '');
  if (digits.length !== 10) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * parseInt(digits[i]), 0);
  return sum % 11 === parseInt(digits[9]);
}

// Boolean pola (JPK_FA)
function parseBoolean(value: string): boolean {
  return value.toLowerCase() === 'true';
}
```

### 5.3. Generator XML — JPK_VDEK (V7M)

```typescript
function generateVdekXml(
  rows: VdekSprzedazRow[],
  company: CompanyData,
  period: { year: number; month: number },
  celZlozenia: 1 | 2
): string {
  
  const xml = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('JPK', { xmlns: 'http://crd.gov.pl/wzor/2023/06/29/12648/' })
    
    // Naglowek
    .ele('Naglowek')
      .ele('KodFormularza', {
        kodSystemowy: 'JPK_V7M (3)',
        wersjaSchemy: '1-2E'
      }).txt('JPK_VAT').up()
      .ele('WariantFormularza').txt('3').up()
      .ele('DataWytworzeniaJPK').txt(new Date().toISOString()).up()
      .ele('NazwaSystemu').txt('JPK Converter 1.0').up()
      .ele('CelZlozenia', { poz: 'P_7' }).txt(String(celZlozenia)).up()
      .ele('KodUrzedu').txt(company.kodUrzedu).up()
      .ele('Rok').txt(String(period.year)).up()
      .ele('Miesiac').txt(String(period.month)).up()
    .up()
    
    // Podmiot1
    .ele('Podmiot1')
      .ele('OsobaNiefizyczna')
        .ele('NIP').txt(company.nip).up()
        .ele('PelnaNazwa').txt(company.fullName).up()
      .up()
    .up()
    
    // Ewidencja
    .ele('Ewidencja');

  // SprzedazWiersz (per rekord)
  for (const row of rows) {
    const sw = xml.ele('SprzedazWiersz');
    sw.ele('LpSprzedazy').txt(String(row.lp)).up();
    
    if (row.kodKraju) {
      sw.ele('KodKrajuNadaniaTIN').txt(row.kodKraju).up();
    }
    if (row.nrKontrahenta && row.nrKontrahenta !== '') {
      sw.ele('NrKontrahenta').txt(row.nrKontrahenta).up();
    }
    sw.ele('NazwaKontrahenta').txt(row.nazwaKontrahenta).up();
    sw.ele('DowodSprzedazy').txt(row.dowodSprzedazy).up();
    sw.ele('DataWystawienia').txt(row.dataWystawienia).up();
    
    if (row.dataSprzedazy) {
      sw.ele('DataSprzedazy').txt(row.dataSprzedazy).up();
    }
    if (row.typDokumentu) {
      sw.ele('TypDokumentu').txt(row.typDokumentu).up();
    }
    
    // GTU i znaczniki proceduralne — tylko jeśli `1` lub `true`
    // ... (warunkowe dodawanie)
    
    // Kwoty K_10 — K_36 (tylko niezerowe)
    const kFields = [
      'K_10','K_11','K_12','K_13','K_14','K_15','K_16','K_17','K_18',
      'K_19','K_20','K_21','K_22','K_23','K_24','K_25','K_26','K_27',
      'K_28','K_29','K_30','K_31','K_32','K_33','K_34','K_35','K_36'
    ];
    for (let i = 0; i < kFields.length; i++) {
      const val = row.amounts[i];
      if (val !== '0.00') {
        sw.ele(kFields[i]).txt(val).up();
      }
    }
    sw.up();
  }

  // SprzedazCtrl
  const totalVat = rows.reduce((sum, r) => {
    // Suma VAT: K_20 + K_22 + K_24 + ...
    return sum + parseFloat(r.amounts[10]) /* K_20 */;
  }, 0);
  
  xml.ele('SprzedazCtrl')
    .ele('LiczbaWierszySprzedazy').txt(String(rows.length)).up()
    .ele('PodatekNalezny').txt(totalVat.toFixed(2)).up()
  .up();

  return xml.end({ prettyPrint: true });
}
```

### 5.4. Sumy kontrolne (Ctrl)

| Typ JPK | Element Ctrl | Obliczenie |
|---------|-------------|------------|
| VDEK Sprzedaż | `LiczbaWierszySprzedazy` | count(SprzedazWiersz) |
| VDEK Sprzedaż | `PodatekNalezny` | Σ(K_20 + K_22 + K_24 + K_26 + K_28 + K_30 + K_33) |
| FA | `LiczbaFaktur` | count(Faktura) |
| FA | `WartoscFaktur` | Σ(P_15) — suma brutto |
| MAG WZ | `LiczbaWZ` | count(unique NumerWZ) |
| MAG WZ | `SumaWartoscWZ` | Σ(WartoscWZ) per unique WZ |

---

## 6. Walidacja — szczegóły

### Poziom 1: Plik wejściowy
- [x] Plik istnieje i jest czytelny
- [x] Separator `|` wykryty poprawnie
- [x] Kodowanie UTF-8 / ASCII
- [x] Jednakowa liczba kolumn per wiersz
- [x] Metadane (kol 1–6) spójne w całym pliku

### Poziom 2: Dane merytoryczne
- [x] NIP polskie: algorytm modulo 11
- [x] NIP zagraniczne: prefix kraju (2 litery) + cyfry
- [x] NIP "brak": dopuszczalne (osoby fizyczne bez działalności)
- [x] Daty: format YYYY-MM-DD, w zakresie okresu rozliczeniowego
- [x] Kwoty: parsowanie polskich przecinków, ≥ 0
- [x] TypDokumentu: dopuszczalne wartości (FP, RO, WEW, VAT)
- [x] Sumy kontrolne: Ctrl vs obliczone z wierszy

### Poziom 3: XSD
- [x] Walidacja wygenerowanego XML z oficjalnym schematem XSD
- [x] Raport pozycji z błędami
- [x] Sugestie naprawy (np. brakujące pole, zły format)

### Kategorie komunikatów
```
❌ BŁĄD KRYTYCZNY — blokuje eksport
   "NIP sprzedawcy jest niepoprawny (nie przechodzi modulo 11)"
   "Brak wymaganych pól: DataWystawienia w wierszu 45"

⚠️ OSTRZEŻENIE — nie blokuje, wymaga potwierdzenia
   "30 wierszy z NIP = 'brak' — upewnij się, że to osoby fizyczne"
   "DataSprzedazy puste w 1107 wierszach — zostanie pominięte w XML"

ℹ️ INFO
   "Wiersze sprzedaży: 1107, Suma VAT: 42 649,39 PLN"
```

---

## 7. UI/UX Design

### Paleta kolorów (Dark theme — styl IDE/fintech)
```css
:root {
  /* Tło */
  --bg-app:        #0C0E14;     /* Najciemniejsze — app shell */
  --bg-sidebar:    #111318;     /* Sidebar */
  --bg-main:       #14161E;     /* Główny panel */
  --bg-card:       #1A1D28;     /* Karty, tabele */
  --bg-input:      #1E2130;     /* Inputy */
  --bg-hover:      #252838;     /* Hover stany */

  /* Akcenty */
  --accent:        #4F8EF7;     /* Główny niebieski */
  --accent-hover:  #3A75E0;
  --accent-subtle: #4F8EF71A;   /* 10% opacity */
  --success:       #34D399;     /* Zielony — walidacja OK */
  --warning:       #FBBF24;     /* Żółty — ostrzeżenie */
  --error:         #F87171;     /* Czerwony — błąd */

  /* Tekst */
  --text-primary:  #E8ECF4;
  --text-secondary:#8892A8;
  --text-muted:    #5A6478;
  
  /* Obramowania */
  --border:        #252838;
  --border-active: #4F8EF750;
}
```

### Typografia
```css
/* UI / nagłówki */
font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;

/* Dane, tabele, XML, kody */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

### Custom frameless window
```
┌──────────────────────────────────────────────────┐
│ ◉ JPK Converter  │  [Stacja Paliw ZAF...]  ─□× │  ← custom titlebar
├──────┬───────────────────────────────────────────┤
│      │                                           │
│ V7M  │  (zawartość kroku)                        │
│ FA   │                                           │
│ MAG  │                                           │
│      │                                           │
│──────│                                           │
│      │                                           │
│ ⏱    │                                           │  ← historia
│      │                                           │
├──────┴───────────────────────────────────────────┤
│ ● Import ─── ○ Firma ─── ○ Podgląd ─── ○ Export │  ← step indicator
└──────────────────────────────────────────────────┘
```

---

## 8. Baza danych (SQLite)

```sql
-- Dane firm
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nip TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  regon TEXT,
  kod_urzedu TEXT,
  email TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Profile mapowania
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,            -- np. "NAMOS VDEK"
  system_erp TEXT NOT NULL,     -- "NAMOS" | "ESO"
  jpk_type TEXT NOT NULL,       -- "VDEK" | "FA" | "MAG"
  sub_type TEXT,                -- "SprzedazWiersz" | "Faktura" | "WZ"
  column_mapping TEXT NOT NULL, -- JSON: {col_index: jpk_field}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Historia konwersji
CREATE TABLE conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_nip TEXT,
  jpk_type TEXT NOT NULL,
  period_year INTEGER,
  period_month INTEGER,
  source_file TEXT NOT NULL,
  output_file TEXT,
  row_count INTEGER,
  status TEXT DEFAULT 'completed', -- completed | error | cancelled
  errors_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 9. Plan implementacji

### Faza 1 — MVP (2–3 tygodnie)
- [ ] Setup: Electron + React + Vite + TypeScript + Tailwind
- [ ] Custom titlebar + sidebar + step indicator
- [ ] Parser TXT z separatorem `|` i auto-detection
- [ ] Generator XML: JPK_V7M (SprzedazWiersz + SprzedazCtrl)
- [ ] Formularz danych firmowych
- [ ] Podgląd danych w tabeli (react-virtual dla wydajności)
- [ ] Walidacja NIP + dat + kwot
- [ ] Eksport XML + save dialog
- [ ] Podstawowy dark theme

### Faza 2 — Pełne typy JPK (2 tygodnie)
- [ ] Generator XML: JPK_FA (Faktura + FakturaWiersz + FakturaCtrl)
- [ ] Generator XML: JPK_MAG (WZ + WZWiersz + WZCtrl, RW + RWCtrl)
- [ ] Walidacja XSD z oficjalnymi schematami
- [ ] Edycja inline w tabeli
- [ ] Profile mapowania (zapis/odczyt)
- [ ] SQLite: firmy + profile + historia

### Faza 3 — Polish & Ship (1–2 tygodnie)
- [ ] Batch processing (wiele plików jednocześnie)
- [ ] Podgląd XML z kolorowaniem składni
- [ ] Instalator Windows (electron-builder → .exe / .msi)
- [ ] Auto-update (electron-updater)
- [ ] Testy jednostkowe (Vitest)
- [ ] Ikona aplikacji + splash screen

### Faza 4 — Rozszerzenia (opcjonalnie)
- [ ] JPK_VDEK ZakupWiersz (ewidencja zakupów)
- [ ] JPK_VDEK Deklaracja (część deklaracyjna VAT-7)
- [ ] Obsługa KSeF numer / tagi OFF/BFK/DI (JPK_V7M(3))
- [ ] Obsługa XLSX jako input
- [ ] Eksport raportów PDF
- [ ] Wielojęzyczność (PL/EN)

---

## 10. Wymagania systemowe

| Parametr | Minimum |
|----------|---------|
| OS | Windows 10/11 (64-bit) |
| RAM | 4 GB |
| Dysk | ~250 MB |
| Rozdzielczość | 1280×720 |
| .NET | Nie wymagane |
| Internet | Nie wymagane (offline-first) |

---

## 11. Uwagi prawne i techniczne

### JPK_V7M(3) — nowe wymagania od 01.02.2026
- Obowiązkowy numer KSeF lub tag (OFF, BFK, DI) dla każdej faktury
- Nowe pola dot. rozliczenia kaucji za opakowania napojów
- Plik bez KSeF/tagów → automatyczne odrzucenie przy walidacji technicznej MF

### Oficjalne schematy XSD
- Źródło: https://www.gov.pl/web/kas/struktury-jpk
- Aplikacja bundluje aktualne XSD
- Mechanizm sprawdzania nowych wersji (opcjonalnie)

### Bezpieczeństwo
- Przetwarzanie 100% lokalne — żadne dane nie opuszczają komputera
- Brak komunikacji sieciowej (oprócz opcjonalnych aktualizacji)
- Dane firmowe w lokalnej bazie SQLite (zaszyfrowanej opcjonalnie)

---

*Dokument wygenerowany na podstawie analizy rzeczywistych plików TXT z systemów NAMOS i ESO.*
*Wersja: 2.0 | Data: 2026-02-08*
