- [x] **Faza 17: Precyzja Dynamiki R/R i Optymalizacja Prezentacji Finansowej**
  - Analiza i rozszerzenie obliczeń dynamiki rok-do-roku (YoY) w `CalculateFinancialDynamicsQuery`.
  - Poprawa `PercentageBadge` i `FinancialTable` pod kątem rozróżnienia braku danych (`null`) od wzrostu `0.0%`.
  - Standaryzacja hierarchii i formatowania wierszy w zestawieniu Rachunku Zysków i Strat (P&L Table).
  - Testy jednostkowe i integracyjne dla precyzji obliczeń dynamiki oraz weryfikacji stanów brzegowych.
  - Weryfikacja spójności całego pulpitu zarządczego (Executive Overview) oraz generowanie pełnego buildu produkcyjnego.
- [ ] **Faza 18: Naprawa Filtrowania RecordType i Układ Rodzajowy OPEX**
  - [x] Usunięcie błędu wielkości liter w `GetCategoryBreakdownHandler` blokującego filtrowanie `record_type`.
  - [ ] Wprowadzenie dedykowanych kodów kategorii rodzajowych OPEX w encji domenowej `Category` i seederze bazy danych.
  - [ ] Aktualizacja `FinancialDataSeeder` i zbiorów danych o dystrybucję kosztów operacyjnych na subkategorie rodzajowe.
  - [ ] Testy jednostkowe izolacji kategorii REVENUE od EXPENSE i rekordów bilansowych.
  - [ ] Weryfikacja różnorodnego rozkładu kategorii OPEX na wykresie kołowym zamiast pojedynczego wpisu 100%.
- [ ] **Faza 19: Domenowe Obliczanie Dynamiki R/R dla Podpozycji Kategorii**
  - [ ] Rozszerzenie `GetCategoryBreakdownQuery` i Handlera o kalkulację kwot porównawczych i dynamiki YoY per kategoria.
  - [ ] Ekspozycja dynamiki YoY na poziomie kategorii (`previous_amount`, `yoy_growth_pct`) w endpoincie `/finance/analytics/breakdown`.
  - [ ] Testy jednostkowe kalkulacji dynamiki YoY na poziomie kategorii z przypadkami brzegowymi (nowe kategorie, baza zerowa).
  - [ ] Testy integracyjne endpointu breakdown weryfikujące strukturę payloadu YoY.
  - [ ] Optymalizacja agregacji rekordów i zapytań bazodanowych dla okresów porównawczych.
- [ ] **Faza 20: Integracja UI Tabeli P&L i Wykresu Struktury Kosztów**
  - [ ] Podpięcie dynamicznej dynamiki YoY per kategoria do podwierszy (children) przychodów i OPEX w `DashboardView`.
  - [ ] Zapewnienie ścisłej polaryzacji `reverseChange` dla kosztów OPEX i jej brak dla przychodów.
  - [ ] Optymalizacja wykresu `CostBreakdownChart` z auto-sortowaniem, paletą wielokategorialną i czytelną legendą.
  - [ ] Testy komponentów frontendowych w `DashboardView.test.jsx` weryfikujące rozwijane wiersze P&L i odznaki YoY.
  - [ ] Testy integracyjne weryfikujące poprawną izolację kategorii w zestawieniu przychodów.

---

## 📜 Licencja
Projekt objęty licencją własną dla platformy FinBoard.
