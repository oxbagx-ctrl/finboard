# FinBoard UI Design System: Institutional Financial Grid Standards

**Wersja:** 2.0  
**Kontekst:** Deal Advisory & Corporate Finance Terminal (Executive Overview & PDF Reports)  
**Architektura:** React + Tailwind CSS + Domain-Driven Design (DDD)

---

## 1. Wprowadzenie i Filozofia Typografii Finansowej

System FinBoard został zaprojektowany z myślą o doradcach M&A, analitykach private equity oraz dyrektorach finansowych (CFO). W interfejsach klasy institutional-grade (takich jak Bloomberg Terminal, FactSet, PitchBook czy Ramp) kluczowe znaczenie ma **bezwzględna dyscyplina siatki pionowej (vertical grid alignment)** oraz **stała szerokość znaków (tabular numbers)**.

Niniejsza specyfikacja definiuje standardy prezentacji tabeli **Rachunek Zysków i Strat (P&L Konsolidowany)** oraz raportów zarządczych PDF.

---

## 2. Standardy Wyrównania Siatki Tabeli P&L (Level-0 Alignment)

### 2.1. Jednolita Oś Pionowa Numeracji Pozycji (Wiersze 1–9)
- Wszystkie pozycje główne rachunku wyników poziomu 0 (od pozycji 1. do 9.) posiadają **identyczne dopełnienie bazowe `px-4`** (16px) w interfejsie webowym (`FinancialTable.jsx`) oraz `px-3` (12px) w raporcie PDF (`ExecutivePdfReport.jsx`).
- **Zakaz stosowania wcięć na wierszach głównych:** Żaden wiersz poziomu 0 (w tym pozycje kosztowe lub dedukcje, takie jak COGS, OPEX, D&A, CIT) nie może posiadać klas przesunięcia `pl-6` ani `pl-8`.
- Cyfry numeracji (`1.`, `2.`, `3.`, `4.`, `5.`, `6.`, `7.`, `8.`, `9.`) muszą zaczynać się w dokładnie tej samej współrzędnej poziomej X.

```
[Poprawnie - Stała oś X]
px-4 | [slot 14px] 1. Przychody ze Sprzedaży (Total Revenue)
px-4 | [slot 14px] 2. Koszt Wytworzenia Sprzedanych Produktów (COGS)
px-4 | [slot 14px] 3. ZYSK BRUTTO ZE SPRZEDAŻY (GROSS PROFIT)
px-4 | [Chevron  ] 4. Koszty Działalności Operacyjnej (OPEX)
px-4 | [slot 14px] 5. WYNIK OPERACYJNY EBITDA
px-4 | [slot 14px] 6. Amortyzacja Rzeczowa i Niematerialna (D&A)
px-4 | [slot 14px] 7. ZYSK OPERACYJNY (EBIT)
px-4 | [slot 14px] 8. Podatek Dochodowy od Osób Prawnych (CIT)
px-4 | [slot 14px] 9. ZYSK NETTO OKRESU (NET PROFIT / EAT)
```

### 2.2. Precyzyjny Slot Pozycjonujący (Expander Chevron vs Placeholder Spacer)
- Każda komórka poziomu 0 posiada zadeklarowany slot pozycjonujący o stałych wymiarach:
  ```html
  w-3.5 h-3.5 inline-flex shrink-0 (14px × 14px)
  ```
- **Wiersze z podkategoriami (`isExpandable`):** renderują wewnątrz slotu interaktywny element SVG `<ChevronDown className="w-3.5 h-3.5" />` lub `<ChevronRight className="w-3.5 h-3.5" />`.
- **Wiersze bez podkategorii (jednorodne):** renderują statyczny placeholder spacer `<span className="w-3.5 h-3.5 inline-flex shrink-0" aria-hidden="true" />`.
- Zastosowanie `inline-flex shrink-0` na obu wariantach uniemożliwia deformację flexboxową i zapewnia mikro-dokładność co do piksela.

---

## 3. Prezentacja Znaczników Potrąceń (-) i Kodów Rachunkowych

### 3.1. Grupowanie Mikro-typograficzne
- Wskaźnik pozycji pomniejszającej wynik `(-)` nie może poprzedzać numeracji wiersza ani wpływać na lewostronne wyrównanie etykiety `row.label`.
- Wskaźnik `(-)` oraz kod kategorii `[{row.code}]` są zgrupowane w kompaktowym kontenerze:
  ```jsx
  <span className="inline-flex items-center gap-1 shrink-0">
      <span className="text-[10px] font-mono text-zinc-500 font-normal select-none" title="Pozycja pomniejszająca wynik">(-)</span>
      <span className="text-[10px] font-mono text-zinc-500 font-normal">[{row.code}]</span>
  </span>
  ```
- Obie wartości korzystają z rodziny `font-mono` oraz spójnego koloru `text-zinc-500`, co gwarantuje harmonię z oznaczeniami podkategorii.

---

## 4. Hierarchia i Wcięcia Wierszy Podrzędnych (Children Rows)

- Klasy wcięć są zarezerwowane **wyłącznie** dla wierszy podrzędnych:
  - Podpozycje renderowane w rozwiniętym drzewie kategorii otrzymują klasę `pl-10` oraz prefiks gałęzi `↳` (`text-zinc-600 font-mono select-none`).
  - Samodzielne pozycje podrzędne (`isSubItem: true`) otrzymują klasę `pl-8`.
- Wiersze podrzędne prezentują mniejszą skalę typograficzną (`text-xs` / `text-zinc-400`), subtelne tło `bg-zinc-950/25` oraz zredukowany padding pionowy `py-1.5`.

---

## 5. Liczby Tabelaryczne Wysokiej Gęstości (`FinancialValue.jsx`)

1. **Monospace & Tabular Nums:**
   - Wartości liczbowe są zawsze renderowane z klasami `font-mono tabular-nums tracking-tight whitespace-nowrap`.
   - Każda cyfra (`0–9`), przecinek, kropka i spacja tysięczna ma identyczną szerokość bazową, co zapobiega jitterowi przy odświeżaniu danych i umożliwia pionowe porównywanie rzędów wielkości.
2. **Przyrostek Walutowy:**
   - Oznaczony klasą `ml-1 text-[0.8em] font-mono font-normal text-zinc-500 uppercase shrink-0`.
   - Stała szerokość 3-znakowych kodów ISO (`PLN`, `EUR`, `USD`) gwarantuje równe krawędzie kolumn kwotowych wyrównanych do prawej strony (`text-right`).
3. **Formatowanie Potrąceń (Nawiasy Księgowe):**
   - Pozycje dedukcji oraz ujemne wyniki finansowe są opcjonalnie prezentowane w klasycznym zapisie nawiasowym: `(120 000,00) PLN`.

---

## 6. Spójność Raportów Wydruku i PDF (`ExecutivePdfReport.jsx`)

- Moduł generowania raportów zarządczych Due Diligence (`ExecutivePdfReport.jsx`) w formacie A4 zachowuje pełną spójność ze standardami widoku webowego:
  - Usunięto klasę `pl-6` ze wszystkich wierszy dedukcji.
  - Wszystkie komórki tytułowe P&L stosują zunifikowany padding `py-2 px-3`.
  - Wartości kwotowe stosują `tabular-nums` oraz formatowanie walutowe zgodne z polskim i międzynarodowym standardem rachunkowości.
