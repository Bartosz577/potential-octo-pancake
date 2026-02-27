# Ściągawka promptów — Claude Code + JPK Converter

## Rozpoczęcie dnia
```
Przeczytaj @docs/implementation-plan.md i podaj 3 następne niezrobione zadania.
```

## File Readers
```
Zaimplementuj [Xxx]FileReader w src/core/readers/[Xxx]FileReader.ts.
Implementuj interfejs FileReaderPlugin z @src/core/models/types.ts.
Zarejestruj w FileReaderRegistry. Napisz testy. Uruchom npm test.
```

## Generatory XML
```
Przeczytaj schemat @schemas/JPK_[TYP]_[VER].xsd.
Przeczytaj @docs/jpk-regulations.md sekcję o JPK_[TYP].
Zaimplementuj Jpk[Typ]Generator.ts z pełną zgodnością XSD.
Po implementacji zwaliduj XML przeciw schematowi. Napisz testy.
```

## Komponenty React
```
Utwórz [Xxx]Step.tsx w src/renderer/components/steps/.
Przeczytaj @docs/implementation-plan.md sekcję [X.Y].
Styl: Tailwind CSS dark theme. Fonty: Plus Jakarta Sans (UI), JetBrains Mono (dane).
Dane z Zustand store. Po implementacji sprawdź typecheck.
```

## Zustand stores
```
Utwórz [xxx]Store w src/renderer/stores/[xxx]Store.ts.
Użyj Zustand 5, persist middleware dla localStorage.
Typuj interfejs zgodnie z @src/core/models/types.ts.
```

## Subagenci
```
Użyj jpk-schema-expert do [walidacji XML / analizy XSD / ...].
Użyj parser-debugger do [zbadania dlaczego plik X się nie parsuje / ...].
Użyj code-reviewer do [przeglądu zmian / ...].
```

## Testy
```
Napisz testy Vitest dla [moduł]. Testuj: happy path, edge cases,
polskie znaki, puste dane, błędne formaty. Uruchom npm test.
```

## Debugging
```
Test "[nazwa testu]" nie przechodzi. Błąd: [błąd].
Zbadaj, napraw, uruchom ponownie.
```

## Code review + commit
```
Użyj code-reviewer do przeglądu zmian.
Odhacz ukończone w @docs/implementation-plan.md.
git add -A && git commit -m "[typ]: [opis]"
```

## Sesja
```
/clear          ← nowe zadanie
/compact        ← kontekst się kończy, ale chcesz kontynuować
claude --continue  ← wznów po zamknięciu terminala
```
