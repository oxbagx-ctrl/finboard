# Przykładowe Pliki Danych Finansowych (CSV Samples)

Zestaw przygotowanych plików demonstracyjnych na potrzeby testów modułu importu asynchronicznego oraz podglądu dry-run w platformie **FinBoard**.

---

## Lista Dostępnych Plików

### 1. [`01_q3_2026_acme_manufacturing.csv`](01_q3_2026_acme_manufacturing.csv)
- **Przeznaczenie**: Pełny zbiór operacji produkcyjnych za III kwartał 2026 roku dla spółki **Acme Manufacturing S.A.**
- **Format**: Rozdzielany przecinkami (`,`), kropka dziesiętna (`.`), waluta `PLN`.
- **Liczba wierszy**: 25 operacji.
- **Zawartość**: Przychody z kontraktów montażowych, koszty wytworzenia (COGS), wynagrodzenia zespołu inżynierskiego, leasing hali i maszyn CNC, amortyzacja, odsetki bankowe, CIT oraz pozycje bilansowe (środki pieniężne, należności, zobowiązania).
- **Oczekiwany wynik**: **100% Poprawny (Dry-Run Pass)**. Zaksięgowanie wszystkich 25 rekordów.

---

### 2. [`02_q3_2026_helvest_advisory_eur.csv`](02_q3_2026_helvest_advisory_eur.csv)
- **Przeznaczenie**: Zestawienie operacji doradztwa transakcyjnego M&A dla **Helvest Advisory Sp. z o.o.** w walucie `EUR`.
- **Format**: Europejski standard bankowy – rozdzielany średnikami (`;`), przecinek dziesiętny (`,`), kody kategorii (`REV`, `COGS`, `OPEX`, `DEP`, `FIN`).
- **Liczba wierszy**: 20 operacji.
- **Zawartość**: Success fees za zamknięcie procesów sprzedaży, ryczałty miesięczne (retainers), wynagrodzenia kancelarii prawnych i audytorów (PwC, Clifford Chance), koszty terminali Bloomberg/FactSet, podróże do Londynu/Frankfurtu.
- **Oczekiwany wynik**: **100% Poprawny (Dry-Run Pass)**. Automatyczne rozpoznanie separatora `;` i przeliczenie kwot.

---

### 3. [`03_monthly_batch_payroll_and_opex.csv`](03_monthly_batch_payroll_and_opex.csv)
- **Przeznaczenie**: Wsadowy pakiet szczegółowych kosztów operacyjnych (OPEX) i płacowych.
- **Format**: Rozdzielany przecinkami (`,`), kategoria `cat-opex`, waluta `PLN`.
- **Liczba wierszy**: 12 operacji.
- **Zawartość**: Wypłaty wynagrodzeń, składki ZUS, chmura AWS, licencje Microsoft 365, monitoring obiektu, obsługa księgowa, rekrutacja i audyt SOC2.
- **Oczekiwany wynik**: **100% Poprawny (Dry-Run Pass)**. Zaksięgowanie wszystkich 12 pozycji kosztowych.

---

### 4. [`04_invalid_dry_run_testing_with_errors.csv`](04_invalid_dry_run_testing_with_errors.csv)
- **Przeznaczenie**: Plik testowy do weryfikacji mechanizmu **Dry-Run Validation** i prezentacji ostrzeżeń w interfejsie.
- **Zawarte błędy celowe**:
  1. *Linia 3*: Nieistniejąca w słowniku kategoria `cat-crypto-speculation`.
  2. *Linia 4*: Niedozwolona wartość ujemna kwoty (`-8500.00`).
  3. *Linia 5*: Błędny format daty (`niepoprawna-data`).
  4. *Linia 6*: Pusty opis operacji.
  5. *Linia 7*: Nieobsługiwana waluta (`BITCOIN`).
- **Oczekiwany wynik**: **Dry-Run Failed (Błędy walidacji)**. Blokada uruchomienia importu i wykazanie precyzyjnych komunikatów z numerami wierszy i kolumn.
