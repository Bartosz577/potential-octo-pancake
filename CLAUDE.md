# JPK Converter

## Opis projektu
Desktopowa aplikacja Electron + React do konwersji plików TXT (eksportowanych z systemów ERP: NAMOS, ESO) na format XML (JPK) wymagany przez polskie Ministerstwo Finansów.

## Stack technologiczny
- Electron 28+ (desktop shell)
- React 18 + TypeScript
- Vite (bundler)
- Tailwind CSS (stylowanie)
- Zustand (state management)
- shadcn/ui (komponenty UI)
- Lucide React (ikony)
- JetBrains Mono + Plus Jakarta Sans (fonty)

## Obsługiwane typy JPK
- JPK_V7M (VDEK) — ewidencja sprzedaży VAT (miesięczna)
- JPK_FA — faktury VAT
- JPK_MAG — dokumenty magazynowe (WZ, RW)

## Kluczowe pliki
- `docs/JPK_Converter_Specyfikacja_v2.md` — pełna specyfikacja z mapowaniem kolumn
- `test-data/` — prawdziwe pliki TXT do testowania

## Format plików wejściowych (TXT)
- Separator: | (pipe)
- Bez nagłówka (dane od pierwszego wiersza)
- Kodowanie: UTF-8 (NAMOS), ASCII (ESO)
- Separator dziesiętny: , (przecinek) — w XML musi być . (kropka)
- Kolumny 1-6: metadane (kod_punktu|system|typ_jpk|podtyp|data_od|data_do)
- Kolumny 7+: dane właściwe (różne per typ JPK)

## Konwencje
- Język kodu: angielski (nazwy zmiennych, komentarze)
- Język UI: polski (labele, komunikaty)
- Dark theme (paleta kolorów w specyfikacji)
- Monospace font na dane/tabele (JetBrains Mono)

## Struktura katalogów
electron/          — Electron main process + services
src/               — React frontend (renderer)
src/components/    — komponenty React
src/stores/        — Zustand stores
src/utils/         — helpery (parser, validator, generator XML)
src/types/         — TypeScript types
docs/              — specyfikacja
test-data/         — pliki TXT do testów
