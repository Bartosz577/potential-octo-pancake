# Proces pracy z Claude Code — JPK Universal Converter v2

## Spis treści
1. [Przygotowanie środowiska](#1-przygotowanie-środowiska)
2. [Struktura pamięci projektu](#2-struktura-pamięci-projektu)
3. [Sesje robocze — jak pracować](#3-sesje-robocze--jak-pracować)
4. [Komendy i prompty na każdą fazę](#4-komendy-i-prompty-na-każdą-fazę)
5. [Subagenci — kiedy i jak](#5-subagenci--kiedy-i-jak)
6. [Zarządzanie kontekstem](#6-zarządzanie-kontekstem)
7. [Testowanie i review](#7-testowanie-i-review)
8. [Rozwiązywanie problemów](#8-rozwiązywanie-problemów)

---

## 1. Przygotowanie środowiska

### Instalacja Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### Inicjalizacja projektu
```bash
cd /path/to/jpk-converter
claude
# W sesji Claude Code:
> /init
```
Claude przeanalizuje strukturę projektu i zaproponuje CLAUDE.md. Zastąp go przygotowanym plikiem `CLAUDE.md` z tego pakietu.

### Struktura katalogów do utworzenia
```bash
mkdir -p .claude/agents
mkdir -p docs
mkdir -p schemas
mkdir -p src/core/{readers,mapping,models,validation,generators,encoding}
mkdir -p src/core/validation/rules
mkdir -p tests/{core,integration}
```

### Skopiuj pliki z pakietu
```bash
# CLAUDE.md → root projektu
cp CLAUDE.md ./CLAUDE.md

# Subagenci
cp .claude/agents/*.md ./.claude/agents/

# Dokumentacja
cp docs/*.md ./docs/

# Core modules (z poprzedniej sesji)
cp -r src/core/* ./src/core/
```

### Zainstaluj nowe zależności
```bash
npm install xlsx papaparse fast-xml-parser iconv-lite
npm install -D vitest @types/papaparse
```

---

## 2. Struktura pamięci projektu

```
jpk-converter/
├── CLAUDE.md                    # ← Główna pamięć (ładowana ZAWSZE)
├── CLAUDE.local.md              # ← Twoje prywatne ustawienia (gitignored)
├── .claude/
│   └── agents/
│       ├── jpk-schema-expert.md # Subagent: ekspert JPK/XSD
│       ├── parser-debugger.md   # Subagent: debugger parserów
│       └── code-reviewer.md     # Subagent: code review
├── docs/
│   ├── implementation-plan.md   # Plan z checkboxami [ ]
│   ├── jpk-regulations.md       # Kontekst regulacyjny (ładowany na żądanie)
│   └── ksef-requirements.md     # Wymagania KSeF (ładowany na żądanie)
├── schemas/
│   ├── JPK_V7M_3.xsd           # Schemat XSD z gov.pl
│   ├── JPK_FA_4.xsd
│   └── ...
└── src/
    └── core/                    # Moduły z pakietu architektonicznego
```

### Zasada: CLAUDE.md = zwięzły, docs/ = szczegółowy

| Plik | Ładowanie | Zawartość |
|------|-----------|-----------|
| `CLAUDE.md` | Automatyczne, każda sesja | Stack, komendy, konwencje, zasady (~100 linii) |
| `docs/implementation-plan.md` | Na żądanie (`@docs/implementation-plan.md`) | Szczegółowy plan z checkboxami |
| `docs/jpk-regulations.md` | Na żądanie | Regulacje JPK, struktury, pola |
| `docs/ksef-requirements.md` | Na żądanie | Wymagania KSeF od 2026 |
| `schemas/*.xsd` | Na żądanie (przez subagenta) | Schematy XSD z MF |

**Dlaczego tak?** CLAUDE.md jest ładowany do kontekstu przy KAŻDEJ sesji. Im jest dłuższy, tym mniej tokenów zostaje na pracę. Szczegóły trzymaj w `docs/` i referencuj przez `@docs/plik.md` gdy potrzebujesz.

---

## 3. Sesje robocze — jak pracować

### Złota zasada: jedna sesja = jedno zadanie

```
Sesja 1: "Zaimplementuj CsvFileReader + testy"
Sesja 2: "Zaimplementuj MappingStep.tsx"
Sesja 3: "Napisz generator JPK_FA"
```

NIE rób: "Zaimplementuj cały core + UI + testy w jednej sesji" — kontekst się wyczerpie.

### Schemat sesji roboczej

```
1. START
   claude                          # otwórz sesję
   
2. KONTEKST (jeśli potrzebny)
   > Przeczytaj @docs/implementation-plan.md i znajdź następne niezrobione zadanie z Fazy 1

3. ZADANIE
   > Zaimplementuj CsvFileReader.ts z testami. Parsuj CSV z PapaParse,
   > obsłuż polskie kodowania i auto-detect separatora.
   > Po implementacji uruchom testy.

4. WERYFIKACJA
   > Uruchom npm run typecheck && npm test
   > Użyj subagenta code-reviewer do przeglądu zmian

5. ZAPIS
   > Odhacz ukończone zadania w @docs/implementation-plan.md
   > git add -A && git commit -m "feat: implement CsvFileReader with Polish encoding support"

6. KONIEC
   > /clear                        # czyść kontekst dla następnej sesji
```

### Kiedy /clear vs /compact

| Sytuacja | Akcja |
|----------|-------|
| Skończyłeś zadanie, zaczynasz nowe | `/clear` |
| W trakcie zadania, kontekst się kończy | `/compact` |
| Debugujesz długi problem | `/compact` (zachowaj kontekst) |
| Nowy dzień pracy | `/clear` |

### Wznawianie sesji
```bash
# Kontynuuj ostatnią sesję
claude --continue

# Wznów konkretną sesję (np. po restarcie terminala)
claude --resume
```

---

## 4. Komendy i prompty na każdą fazę

### Faza 0 — Setup

```
> Przeczytaj CLAUDE.md i zweryfikuj, że projekt jest poprawnie skonfigurowany.
> Sprawdź czy wszystkie zależności z package.json są zainstalowane.
> Sprawdź czy TypeScript kompiluje się bez błędów.
```

### Faza 1 — File Readers

**Prompt na pojedynczy reader:**
```
> Zaimplementuj XlsxFileReader w src/core/readers/XlsxFileReader.ts.
> Wymagania:
> - Implementuj interfejs FileReaderPlugin z src/core/models/types.ts
> - Użyj biblioteki 'xlsx' (SheetJS)
> - Obsłuż wieloarkuszowe pliki (zwróć RawSheet per arkusz)
> - Daty konwertuj do YYYY-MM-DD
> - Obsłuż stary format .xls (codepage 1250 dla polskich znaków)
> - Napisz testy w tests/core/XlsxFileReader.test.ts
> - Po implementacji uruchom testy
```

**Prompt na testy:**
```
> Napisz testy Vitest dla EncodingDetector.
> Przygotuj fixture files w tests/fixtures/:
> - utf8-with-bom.txt (polskie znaki, BOM)
> - windows1250.txt (polskie znaki, windows-1250)
> - cp852.txt (polskie znaki, CP852/DOS)
> Testuj: detect(), decode(), autoDecode(), hasPolishChars()
```

### Faza 2 — Generatory XML

**Prompt z kontekstem XSD:**
```
> Przeczytaj schemat @schemas/JPK_FA_4.xsd i zaimplementuj JpkFaGenerator.ts.
> Przeczytaj też @docs/jpk-regulations.md sekcję o JPK_FA.
> Generator musi:
> - Generować XML zgodny ze schematem XSD
> - Zawierać sekcje: Naglowek, Podmiot1, Faktura, FakturaWiersz, FakturaCtrl
> - Poprawnie obliczać sumy kontrolne
> - Escape'ować znaki specjalne XML
> - Formatować kwoty do 2 miejsc dziesiętnych
> Po implementacji zwaliduj wygenerowany XML przeciw schematowi XSD.
```

**Prompt z użyciem subagenta:**
```
> Użyj subagenta jpk-schema-expert do zweryfikowania wygenerowanego XML
> z JpkV7mGenerator przeciw schematowi XSD JPK_V7M(3).
> Sprawdź szczególnie nowe pola KSeF: NumerKSeF, oznaczenia OFF/BFK/DI.
```

### Faza 3 — UI

**Prompt na nowy komponent:**
```
> Utwórz MappingStep.tsx w src/renderer/components/steps/.
> Przeczytaj @docs/implementation-plan.md sekcję "3.2 Mapping Step".
> Komponent powinien:
> - Pobierać dane z importStore (zaimportowane RawSheet[])
> - Wywoływać AutoMapper.map() i wyświetlać wyniki
> - Pokazywać confidence score per pole (kolor: zielony >80%, żółty >50%, czerwony <50%)
> - Umożliwiać ręczne mapowanie drag & drop
> - Pokazywać podgląd 5 pierwszych wartości przy każdym polu
> - Zapisywać mapowanie do mappingStore
> Styl: Tailwind CSS, dark theme jak reszta aplikacji.
> Font danych: JetBrains Mono. Font UI: Plus Jakarta Sans.
```

### Faza 4 — Zustand stores

```
> Utwórz mappingStore w src/renderer/stores/mappingStore.ts.
> Interfejs:
> - activeMapping: ColumnMapping | null
> - autoMapResult: AutoMapResult | null  
> - savedMappings: ColumnMapping[] (persistowane w localStorage)
> - setAutoMapResult(result)
> - updateFieldMapping(targetField, sourceColumn)
> - saveMapping(name)
> - loadMapping(id)
> - clearMapping()
> Persistuj savedMappings w localStorage z kluczem 'jpk-saved-mappings'.
```

---

## 5. Subagenci — kiedy i jak

### Dostępni subagenci

| Subagent | Kiedy używać | Jak wywołać |
|----------|-------------|-------------|
| `jpk-schema-expert` | Implementacja/debug generatorów XML, walidacja XSD | Claude auto-wybierze lub: "Użyj jpk-schema-expert do..." |
| `parser-debugger` | Problemy z parsowaniem plików, złe kodowanie, brak danych | "Użyj parser-debugger do zbadania dlaczego..." |
| `code-reviewer` | Po implementacji feature, przed commitem | "Użyj code-reviewer do przeglądu moich zmian" |

### Przykłady wywołań

```
> Użyj subagenta jpk-schema-expert do przeanalizowania schematu
> @schemas/JPK_FA_4.xsd i wygenerowania listy wymaganych pól
> z ich typami danych i ograniczeniami.
```

```
> Plik ESO_MAG_WZ.txt importuje się z krzakami zamiast polskich znaków.
> Użyj parser-debugger do zbadania problemu.
> Plik jest w tests/fixtures/ESO_MAG_WZ.txt
```

```
> Skończyłem implementację JpkFaGenerator. Użyj code-reviewer
> do przeglądu wszystkich zmian od ostatniego commita.
```

### Kiedy NIE używać subagentów
- Proste, jednorazowe zadania (edycja jednego pliku)
- Gdy potrzebujesz pełnego kontekstu konwersacji
- Debugowanie wymagające interaktywnego dialogu z tobą

---

## 6. Zarządzanie kontekstem

### Referencje plików (@)
Zamiast wklejać treść plików, używaj referencji:

```
> Przeczytaj @src/core/readers/TxtFileReader.ts i dodaj obsługę
> separatora tab (\t) oprócz istniejących pipe (|) i semicolon (;).
```

```
> Na podstawie @src/core/models/types.ts i @src/core/mapping/JpkFieldDefinitions.ts
> dodaj definicje pól dla JPK_PKPIR.
```

### Kiedy ładować docs/
```
> Przeczytaj @docs/implementation-plan.md
```
— gdy chcesz zobaczyć co dalej robić

```
> Przeczytaj @docs/jpk-regulations.md
```
— gdy pracujesz nad generatorem XML lub walidacją i potrzebujesz kontekstu regulacyjnego

```
> Przeczytaj @docs/ksef-requirements.md
```
— gdy pracujesz nad polami KSeF w JPK_V7M(3)

### Oszczędzanie kontekstu

**TAK:**
```
> Dodaj obsługę plików .dbf w FileReaderRegistry.
> Interfejs FileReaderPlugin jest w @src/core/models/types.ts.
> Wzoruj się na istniejącym CsvFileReader.
```

**NIE:**
```
> [wklejenie 200 linii kodu types.ts]
> [wklejenie 150 linii kodu CsvFileReader.ts]
> Zrób coś podobnego dla DBF.
```

---

## 7. Testowanie i review

### Workflow testowania

```bash
# Po każdej implementacji
> Uruchom npm test -- --reporter=verbose

# Przed commitem
> Uruchom npm run typecheck && npm run lint && npm test

# Review
> Użyj code-reviewer do przeglądu zmian
```

### Prompt na pisanie testów
```
> Napisz testy Vitest dla [moduł].
> Każdy test powinien:
> - Mieć opisową nazwę po polsku (describe/it)
> - Testować happy path + edge cases
> - Testować polskie znaki (ąćęłńóśźż)
> - Testować puste dane / brakujące pola
> Uruchom testy po napisaniu.
```

### Prompt na debugging
```
> Test "powinien parsować plik ESO z kodowaniem windows-1250" nie przechodzi.
> Błąd: [wklej błąd]
> Zbadaj problem, napraw, i uruchom test ponownie.
```

---

## 8. Rozwiązywanie problemów

### Problem: Claude ignoruje CLAUDE.md
```bash
# Sprawdź czy plik istnieje
cat CLAUDE.md

# Sprawdź rozmiar (max ~150 linii)
wc -l CLAUDE.md

# Restartuj sesję
/clear
```

### Problem: Kontekst się wyczerpuje
```
> /compact
```
Lub zakończ sesję i zacznij nową z `/clear`.

### Problem: Claude nie zna kontekstu JPK
```
> Przeczytaj @docs/jpk-regulations.md i @docs/ksef-requirements.md
> aby zrozumieć kontekst regulacyjny, a potem kontynuuj zadanie.
```

### Problem: Wygenerowany XML nie przechodzi walidacji XSD
```
> Użyj jpk-schema-expert do porównania wygenerowanego XML
> z wymaganiami schematu @schemas/JPK_V7M_3.xsd.
> Plik XML jest w tests/output/test-v7m.xml.
```

### Problem: Parsowanie pliku z nieznanego systemu ERP
```
> Mam plik export.csv z systemu [nazwa].
> Nie wiem jaki jest format i mapowanie kolumn.
> 1. Użyj parser-debugger do zbadania pliku @tests/fixtures/export.csv
> 2. Zidentyfikuj kolumny i zaproponuj mapowanie na pola JPK_V7M
> 3. Dodaj nowy profil w SystemProfiles.ts jeśli pasuje
```

---

## Typowy dzień pracy

```
09:00  claude
       > Przeczytaj @docs/implementation-plan.md, co dalej?
       Claude: "Następne niezrobione: Faza 2.2 — JpkFaGenerator"

09:05  > Przeczytaj @schemas/JPK_FA_4.xsd i zaimplementuj JpkFaGenerator.ts
       > z testami. Użyj jpk-schema-expert do weryfikacji.
       [Claude implementuje, testuje, weryfikuje]

10:30  > Odhacz zadania 2.2 w @docs/implementation-plan.md
       > git commit -m "feat: implement JPK_FA XML generator"
       > /clear

10:35  > Następne zadanie: MappingStep.tsx UI
       > Przeczytaj @docs/implementation-plan.md sekcję 3.2
       [Claude implementuje komponent React]

12:00  > Użyj code-reviewer do przeglądu wszystkich zmian z dzisiejszego dnia
       > git commit -m "feat: add MappingStep UI with drag-and-drop"
       > /clear

       Przerwa na obiad.

13:00  claude --continue
       > Dalej: testy integracyjne dla pełnego flow CSV → JPK_V7M XML
       ...
```
