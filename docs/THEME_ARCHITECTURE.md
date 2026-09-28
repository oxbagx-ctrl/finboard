# FinBoard Architecture: Multi-Theme System (Light, Dark & System Theme Architecture)

**Wersja:** 1.0  
**Data wydania:** 28 września 2026  
**Kontekst:** Architektura Frontendu Platformy FinBoard (React 19 + Tailwind CSS + Vitest)  
**Status:** Produkcyjny (Faza 60, Commity 295–302)

---

## 1. Wprowadzenie i Cel Architektoniczny

Do momentu realizacji Fazy 60 platforma FinBoard posiadała sztywno zdefiniowany, ciemny interfejs użytkownika (tzw. *dark-only institutional theme*). Wszystkie komponenty, tabele, karty KPI oraz widoki analityczne wykorzystywały bezpośrednie klasy palety Tailwind (m.in. `bg-zinc-900`, `bg-zinc-950`, `border-zinc-800`, `text-zinc-100`), a plik konfiguracyjny `tailwind.config.js` nie posiadał aktywnej strategii `darkMode`.

Taka architektura niosła ze sobą istotne ograniczenia:
1. **Ograniczenia ergonomiczne i dostępności (WCAG 2.1 AA):** Część doradców transakcyjnych, analityków M&A oraz audytorów pracuje w warunkach silnego oświetlenia biurowego, gdzie motyw jasny (Light mode) oferuje wyższą czytelność i mniejsze zmęczenie wzroku.
2. **Ryzyko zjawiska FOUC (Flash of Unstyled Content):** Próby naiwnego przełączania motywów w React po załadowaniu drzewa komponentów powodują nieprzyjemne dla oka migotanie interfejsu (nagłe przejście z bieli w ciemność lub odwrotnie).
3. **Wyzwania wizualizacji Recharts (SVG):** Wykresy renderowane jako elementy SVG nie dziedziczą automatycznie kaskady stylów CSS klas Tailwind, wymagając precyzyjnego sterowania atrybutami `stroke`, `fill` oraz `cursor` z poziomu stanu motywu.

W ramach **Fazy 60 (Commity 295–302)** zaprojektowano i wdrożono bezkompromisowy, wielowarstwowy system wielomotywowości wspierający:
- **Motyw Jasny (Light mode):** Czysty, nowoczesny, wysokokontrastowy interfejs biznesowy.
- **Motyw Ciemny (Dark mode):** Prestiżowy styl ciemnego terminala transakcyjnego Deal Advisory.
- **Motyw Systemowy (System preference):** Automatyczna synchronizacja z preferencjami systemu operacyjnego użytkownika w czasie rzeczywistym.

---

## 2. Architektura Podstawowa & Eliminacja FOUC

Fundamentem rozwiązania jest podział odpowiedzialności pomiędzy warstwę szablonu Blade (natychmiastowa inicjalizacja przed pierwszym renderem), konfigurację Tailwind CSS oraz reaktywny kontekst React 19.

```
                         [Żądanie HTTP / Przeładowanie Strony]
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │     resources/views/app.blade.php     │
                     │  Synchroniczny Bootstrap w <head>:    │
                     │  - Odczyt localStorage('finboard_theme')│
                     │  - Sprawdzenie matchMedia (OS Theme)  │
                     │  - Dodanie/usunięcie klasy .dark      │
                     └───────────────────────────────────────┘
                                         │  (ZERO FOUC)
                                         ▼
                     ┌───────────────────────────────────────┐
                     │          Inicjalizacja React          │
                     │  <ThemeProvider defaultTheme="system">│
                     │  - Reaktywne wyznaczanie resolvedTheme│
                     │  - Nasłuchiwanie matchMedia.change    │
                     │  - Zapewnienie hooka useTheme()       │
                     └───────────────────────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
     ┌─────────────────────────────┐           ┌─────────────────────────────┐
     │        Komponenty UI        │           │       Wykresy Recharts      │
     │   Klasy Tailwind CSS:       │           │   Dynamiczne tokeny SVG:    │
     │   bg-white dark:bg-zinc-900 │           │   gridStroke, axisLine,     │
     │   text-zinc-900 dark:text-..│           │   dotStroke, cursorFill     │
     └─────────────────────────────┘           └─────────────────────────────┘
```

### A. Strategia `darkMode: 'class'` w Tailwind CSS
W pliku [`tailwind.config.js`](file:///home/rafal/Workspace/finboard/tailwind.config.js) włączono flagę `darkMode: 'class'`:
```javascript
export default {
    darkMode: 'class',
    content: [
        './resources/**/*.blade.php',
        './resources/**/*.jsx',
        './resources/**/*.js',
    ],
    // ...
};
```
Dzięki temu warianty `dark:*` są aktywowane wyłącznie wtedy, gdy korzeń dokumentu (`<html class="dark">`) posiada przypisaną klasę `dark`.

### B. Synchroniczny Bootstrap Script w `<head>`
Aby całkowicie wyeliminować FOUC, w pliku [`resources/views/app.blade.php`](file:///home/rafal/Workspace/finboard/resources/views/app.blade.php) przed załadowaniem skryptów JS umieszczono lekki, synchroniczny blok kodu:
```html
<script>
    (function() {
        try {
            var stored = localStorage.getItem('finboard_theme');
            var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (stored === 'dark' || (!stored && prefersDark) || (stored === 'system' && prefersDark)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        } catch (e) {}
    })();
</script>
```

---

## 3. Silnik Stanu Motywu: `ThemeContext` & `useTheme`

Centralnym punktem zarządzania motywem w aplikacji React jest [`resources/js/context/ThemeContext.jsx`](file:///home/rafal/Workspace/finboard/resources/js/context/ThemeContext.jsx).

### A. Stałe i Typy
```javascript
export const THEME_STORAGE_KEY = 'finboard_theme';

export const THEMES = Object.freeze({
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system',
});
```

### B. Interfejs Hooka `useTheme()`
Hook `useTheme()` udostępnia:
- `theme` (`'light'` | `'dark'` | `'system'`): jawny wybór użytkownika.
- `resolvedTheme` (`'light'` | `'dark'`): fizycznie wyznaczony motyw po uwzględnieniu preferencji systemowych.
- `isDark` (`boolean`): flaga pomocnicza (`resolvedTheme === 'dark'`).
- `setTheme(theme: string)`: funkcja aktualizująca stan z walidacją i zapisem w `localStorage`.

### C. Bezpieczny Fallback Poza Providerem
Dla zachowania 100% stabilności w izolowanych testach komponentowych (`render(<Component />)` bez otaczającego `<ThemeProvider>`), `useTheme()` zawiera bezpieczną implementację awaryjną:
```javascript
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        return {
            theme: THEMES.DARK,
            resolvedTheme: THEMES.DARK,
            setTheme: () => {},
            isDark: true,
        };
    }
    return context;
};
```

---

## 4. Dostępny Komponent Przełącznika: `ThemeToggle`

W pliku [`resources/js/components/ui/ThemeToggle.jsx`](file:///home/rafal/Workspace/finboard/resources/js/components/ui/ThemeToggle.jsx) zaimplementowano dostępną kontrolkę menu rozwijanego osadzoną w nagłówku aplikacji obok przełącznika firm i walut.

### A. Dostępność i Semantyka WAI-ARIA
- **Trigger:** element `<button>` z `aria-haspopup="true"`, `aria-expanded={isOpen}` oraz opisowym `aria-label`.
- **Menu:** kontener `<div>` z `role="menu"` i `aria-label="Wybierz motyw aplikacji"`.
- **Elementy opcji:** przyciski z `role="menuitemradio"` oraz `aria-checked={isSelected}`.

### B. Obsługa Klawiatury i Interakcji
- `ArrowDown`: otwiera menu lub przesuwa fokus na kolejny wariant motywu (z cyklicznym zapętleniem).
- `ArrowUp`: przesuwa fokus na poprzedni wariant motywu.
- `Escape`: natychmiast zamyka menu i przywraca fokus na przycisk wyzwalający.
- **Outside Click:** automatyczne zamykanie menu po kliknięciu poza jego obszarem.

---

## 5. Tokeny Projektowe i Adaptacja Komponentów UI

Wszystkie kluczowe komponenty platformy zostały przekształcone z jednolicie ciemnych stylów na elastyczne tokeny barwne o wysokim kontraście.

| Obszar / Komponent | Motyw Jasny (Light) | Motyw Ciemny (Dark) | Zastosowanie |
| :--- | :--- | :--- | :--- |
| **Główny szkielet (`AppLayout`)** | `bg-zinc-50 text-zinc-900` | `dark:bg-zinc-950 dark:text-zinc-100` | Tło całej aplikacji |
| **Nagłówek (`Header`)** | `bg-white/95 border-zinc-200` | `dark:bg-zinc-950/95 dark:border-zinc-800` | Pasek nawigacyjny i akcji |
| **Pasek boczny (`Sidebar`)** | `bg-white border-zinc-200` | `dark:bg-zinc-950 dark:border-zinc-800` | Menu modułów i spółka |
| **Karty (`Card`, `MetricCard`)** | `bg-white border-zinc-200` | `dark:bg-zinc-900 dark:border-zinc-800` | Kontenery pulpitów i KPI |
| **Tabela P&L (`FinancialTable`)** | `bg-white border-zinc-200` | `dark:bg-zinc-900 dark:border-zinc-800` | Sprawozdanie PSR/MSR |
| **Nagłówek tabeli (`thead`)** | `bg-zinc-100/90 text-zinc-600` | `dark:bg-zinc-950/80 dark:text-zinc-400` | Kolumny tabel finansowych |
| **Tooltipy (`Tooltip`, `InfoTooltip`)** | `bg-white text-zinc-900 border-zinc-200` | `dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-750` | Dymki wyjaśniające |
| **Przycisk Primary (`Button`)** | `bg-zinc-900 text-white hover:bg-zinc-800` | `dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white` | Odwrócony wysoki kontrast |
| **Wartość zysku (`FinancialValue`)** | `text-emerald-600` | `dark:text-emerald-400` | Wartości dodatnie / zysk |
| **Wartość straty (`FinancialValue`)** | `text-rose-600` | `dark:text-rose-400` | Wartości ujemne / strata |

---

## 6. Integracja z Biblioteką Recharts (Wizualizacja SVG)

Wykresy Recharts nie pobierają kolorów obrysów osi i siatki automatycznie z arkuszy CSS. Zastosowano wzorzec reaktywnego mapowania tokenów SVG za pośrednictwem `useTheme()`:

```javascript
const { isDark } = useTheme();
const gridStroke = isDark ? '#27272a' : '#e4e4e7';
const axisStroke = '#71717a';
const axisLineStroke = isDark ? '#3f3f46' : '#d4d4d8';
const dotStroke = isDark ? '#09090b' : '#ffffff';
const cursorFill = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
const pieStroke = isDark ? '#09090b' : '#ffffff';
```

Komponenty dostosowane w tym modelu:
1. [`CustomChartTooltip.jsx`](file:///home/rafal/Workspace/finboard/resources/js/components/charts/CustomChartTooltip.jsx): adaptacyjny kontener dymku, nagłówki okresów, etykiety i kwoty.
2. [`LiquidityTrendChart.jsx`](file:///home/rafal/Workspace/finboard/resources/js/components/charts/LiquidityTrendChart.jsx): dynamiczna siatka, osie, obrysy punktów serii CR i QR, formatowana legenda.
3. [`PnlTrendChart.jsx`](file:///home/rafal/Workspace/finboard/resources/js/components/charts/PnlTrendChart.jsx): siatka, osie, kursor podświetlenia, obrysy linii EBITDA i zysku netto.
4. [`CostBreakdownChart.jsx`](file:///home/rafal/Workspace/finboard/resources/js/components/charts/CostBreakdownChart.jsx): obrys wycinków pierścienia (`pieStroke`), mikro-legenda z dynamiką YoY.
5. [`SensitivityCockpitView.jsx`](file:///home/rafal/Workspace/finboard/resources/js/components/investments/SensitivityCockpitView.jsx) & [`ReinvestmentManager.jsx`](file:///home/rafal/Workspace/finboard/resources/js/components/investments/ReinvestmentManager.jsx): wykresy symulatora What-If oraz nakładów CAPEX.

---

## 7. Weryfikacja Jakościowa i Testy Regresyjne

System wielomotywowości został objęty dedykowanym pakietem testów jednostkowych i integracyjnych:
- [`ThemeContext.test.jsx`](file:///home/rafal/Workspace/finboard/resources/js/tests/unit/ThemeContext.test.jsx) – 10 testów.
- [`ThemeToggle.test.jsx`](file:///home/rafal/Workspace/finboard/resources/js/tests/components/ThemeToggle.test.jsx) – 7 testów.

Wynik pełnego pakietu testów platformy po wdrożeniu Fazy 60:
- **Pliki testowe Vitest:** 74 passed (74)
- **Łączna liczba testów:** 670 passed (670)
- **Wskaźnik sukcesu:** **100% PASS**
- **Kompilacja produkcyjna Vite:** **Bez błędów (`npm run build`)**

---

## 8. Wytyczne dla Deweloperów (Developer Guidelines)

1. **Zawsze twórz style w parach `[klasa_jasna] dark:[klasa_ciemna]`:**
   ```jsx
   // Prawidłowo:
   <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
   
   // Nieprawidłowo (sztywny dark-mode):
   <div className="bg-zinc-900 text-zinc-100 border border-zinc-800">
   ```
2. **Używaj `useTheme()` do sterowania elementami Canvas i SVG:**
   Jeśli komponent rysuje wykresy, mapy lub elementy SVG niepodatne na kaskadę CSS, pobierz `isDark` z hooka `useTheme()`.
3. **Pamiętaj o bezpiecznym fallbacku:**
   Nigdy nie zakładaj, że komponent będzie renderowany wyłącznie wewnątrz `<ThemeProvider>`. Dzięki zaimplementowanemu fallbackowi `useTheme()` izolowane testy jednostkowe działają natychmiast bez konieczności mockowania całego drzewa providerów.
