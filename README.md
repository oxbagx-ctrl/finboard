# FinBoard – Financial Analytics & Virtual Data Room Platform

[![PHP Version](https://img.shields.io/badge/php-8.2%2B-blue.svg)](https://www.php.net/)
[![Laravel](https://img.shields.io/badge/laravel-11.x-red.svg)](https://laravel.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-alpine-red.svg)](https://redis.io/)
[![Architecture](https://img.shields.io/badge/architecture-DDD%20%2F%20CQRS-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-389%20backend%20%7C%20147%20frontend%20passed-success.svg)]()

FinBoard to platforma SaaS klasy Enterprise dedykowana firmom doradztwa transakcyjnego (M&A, Due Diligence, Corporate Finance) oraz ich klientom (CFO, Zarządy). Aplikacja łączy w sobie zaawansowaną analitykę finansową w ujęciu wielo-najemcowym (Multi-Tenant) z bezpiecznym repozytorium dokumentów Virtual Data Room (VDR).

---

## 📌 Kluczowe Funkcjonalności

- **Architektura DDD (Domain-Driven Design) & CQRS**:
    - Wyraźny podział na Bounded Contexts: `Identity`, `Finance`, `DocumentManagement`, `Tenant`.
    - Rozdzielenie ścieżki zapisu (Commands) i odczytu (Queries).
    - Domenowe Value Objects (`Money` z precyzją `bcmath` do 4 miejsc po przecinku, `DateRange`, `FileMetadata`, `CompanyId`, `RoleType`, `Token`, `InvitationId`, `FinancialMetrics`, `FinancialBenchmarkId`, `BenchmarkStatus`, `BenchmarkMetricType`, `FinancialAuditLogId`, `AuditAction`).
    - Domenowy kalkulator finansowy (`FinancialCalculator`) oraz metody domenowe `FinancialRecord` wyliczające wskaźniki P&L (Gross Profit, OPEX, EBIT, EBITDA, Zysk Netto, marże) oraz bilansu i płynności (Current Ratio, Quick Ratio, Debt-to-Assets).
    - Zapytanie CQRS `CalculateFinancialDynamicsQuery` i dedykowany handler `CalculateFinancialDynamicsHandler` precyzyjnie enkapsulujące dynamikę finansową rok-do-roku (YoY) i miesiąc-do-miesiąca (MoM) z kwotowymi i procentowymi wariancjami.
    - Zapytanie CQRS `GetAvailableFiscalYearsQuery` oraz metoda repozytorium skanująca historię transakcyjną spółki i zwracająca aktywne lata obrachunkowe z bezpiecznym fallbackiem dla nowych firm.
    - Encja domenowa `FinancialBenchmark` realizująca ewaluację wskaźników spółki z przypisaniem flag statusu (`OPT`, `WARN`, `CRIT`, `UNKNOWN`) oraz repozytorium `FinancialBenchmarkRepositoryInterface` trwale zapisujące cele w PostgreSQL.
    - Encja domenowa `FinancialAuditLog` i repozytorium `FinancialAuditLogRepositoryInterface` zapewniające niezmienny rejestr ścieżki audytowej (Audit Trail) dla operacji finansowych, konfiguracji celów i importów.
    - Reaktywne listenery zdarzeń domenowych (`LogFinancialRecordCreatedListener`, `LogFinancialRecordUpdatedListener`, `LogFinancialRecordDeletedListener`, `LogBenchmarkConfiguredListener`, `LogBenchmarkResetListener`, `LogCsvImportAuditListener`) automatycznie utrwalające zdarzenia w dzienniku audytowym z metadanymi żądania (IP, User-Agent, identyfikator użytkownika).
    - Kontroler `AuditLogController` serwujący bezpieczny, wielonajemcowy rejestr ścieżki audytowej (`/api/v1/finance/audit-logs`) z filtrowaniem akcji, typów encji, użytkowników i zakresu dat oraz statystykami zagregowanymi (`stats`).
    - Serwis aplikacyjny `KpiCalculationService` kalkulujący dynamikę YoY oraz MoM na danych historycznych ze ścisłą ochroną przed dzieleniem przez zero.
    - Serwis aplikacyjny `KpiEvaluationService` ewaluujący dynamicznie metryki finansowe spółki wobec skonfigurowanych celów doradcy (lub rynkowych wartości domyślnych) wraz z wyznaczaniem statusów semaforowych (`OPT`, `WARN`, `CRIT`), syntetycznego wskaźnika `health_score` i zagregowanego stanu zdrowia finansowego.
    - Kontroler `BenchmarkController` w warstwie prezentacji REST API obsługujący odczyt, konfigurację progów, masową aktualizację i resetowanie celów finansowych spółek portfelowych przez Doradców i Administratorów.
    - Kontroler `KpiController` w warstwie prezentacji API serwujący dynamiczne wskaźniki P&L, bilansowe oraz wariancje okresowe YoY/MoM zintegrowany z serwisem ewaluacji progów branżowych.
- **Bezpieczeństwo i Izolacja Multi-Tenant**:
    - Pełna separacja danych pomiędzy firmami (Tenant Isolation).
    - Hierarchiczny model uprawnień: **Super Admin** (Partner z globalnym zarządzaniem), **Doradca** (Advisor przypisany do wybranych spółek portfela) oraz **Klient** (Client ze ścisłym dostępem wyłącznie do własnej spółki).
    - Wielo-stronne relacje doradca-spółka (`CompanyAdvisorAssignment`) z audytem przypisań i zdarzeniami domenowymi.
    - Przypadki użycia aplikacyjne (`AssignAdvisorToCompanyUseCase`, `RevokeAdvisorFromCompanyUseCase`) ze ścisłą autoryzacją ról i uprawnień.
    - Ścisła izolacja doradców: doradca ma dostęp i widzi w przełączniku wyłącznie przypisane sobie podmioty gospodarcze.
    - Kompleksowy audyt bezpieczeństwa weryfikujący odporność na próby odczytu, mutacji, usuwania cudzych rekordów oraz manipulacji nagłówkami `X-Company-Id`.
- **Asynchroniczny Import Danych Finansowych (CSV)**:
    - Automatyczne wykrywanie delimiterów (przecinek, średnik, tabulator).
    - Obsługa wielojęzycznych nagłówków (PL/EN) i polskich formatów liczbowych (np. `15 000,50 zł`).
    - Walidacja danych wiersz po wierszu z natychmiastowym podglądem (dry-run preview).
    - Kolejkowanie zadań przetwarzania w Redis (`ProcessFinancialCsvJob`) w kontenerze workera.
- **Wirtualny Pokój Danych (Virtual Data Room - VDR)**:
    - Bezpieczne repozytorium dokumentów transakcyjnych, audytowych i finansowych.
    - Szyfrowanie spoczynkowe AES-256 oraz weryfikacja sum kontrolnych SHA-256 plików.
    - Pełny, niezmienny rejestr audytowy zdarzeń (upload, download, archive, unarchive) w dzienniku `DocumentAccessLog` z rejestracją IP i User-Agent.
    - Dedykowany interfejs drag & drop, kategoryzacja taksonomiczna M&A oraz natychmiastowe pobieranie plików.
- **Generator Raportów Zarządczych i Memorandów M&A (PDF)**:
    - Dedykowany konfigurator parametrów raportu (okresy LTM/FY, waluta przeliczeniowa, klauzule poufności, komentarz analityczny doradcy).
    - Dwu-panelowy interfejs w dashboardzie z podglądem na żywo i asynchronicznym generowaniem dokumentów PDF.
    - Precyzyjny szablon raportu w formacie A4 z certyfikatem integralności SHA-256.
- **Wielowalutowość i Konwersja FX w Czasie Rzeczywistym**:
    - Centralny serwis wymiany walut `FxRateService` z obsługą par walutowych PLN, EUR, USD, GBP.
    - Globalny przełącznik waluty transakcyjnej z natychmiastowym przeliczaniem wskaźników finansowych.
- **Powiadomienia Transakcyjne i Integracja E-mail**:
    - Transakcyjne e-maile z zaproszeniami użytkowników z bezpiecznymi linkami aktywacyjnymi.
    - Zintegrowane środowisko Mailpit (Mailcatcher) do bezpiecznego podglądu wiadomości e-mail w fazie deweloperskiej.
- **Nowoczesny Interfejs Użytkownika (SPA)**:
    - Reaktywny frontend zbudowany w oparciu o React 18, Tailwind CSS i bibliotekę wykresów Recharts.
    - Estetyka profesjonalnego terminala transakcyjnego Deal Advisory (Dark Theme, akcenty szmaragdowe/bursztynowe, typografia `font-mono` / `tabular-nums`).
    - Dedykowane widoki: Dashboard ze wskaźnikami KPI, Analityka P&L i Płynności, Księga Główna Transakcji, Wirtualny Pokój Danych (VDR), Raporty Wykonawcze PDF oraz Zarządzanie Doradcami i Klientami.
    - Zastąpienie statycznych wartości na Pulpicie Zarządczym (`DashboardView`) i w Analityce (`AnalyticsView`) dynamicznymi danymi z API w czasie rzeczywistym z kalkulacją dynamiki okresowej (YoY/MoM), ewaluacją benchmarków doradcy i semaforami statusu (`OPT`, `WARN`, `CRIT`).
    - Interfejs edycji celów finansowych i benchmarków M&A dla Doradców z reaktywną ewaluacją statusów w czasie rzeczywistym (`BenchmarkConfigModal` oraz dedykowana matryca w `AnalyticsView`).
    - Standaryzowane tabele Rachunku Zysków i Strat (`FinancialTable`) zgodne ze standardami sprawozdawczości finansowej (PSR / MSR), ze ścisłą hierarchią pozycji, wcięciami, wskaźnikami dedukcji kosztów `(-)` oraz podwójną linią bilansową dla ostatecznego wyniku netto.

---

## 🛠️ Architektura Technologiczna

- **Backend**: PHP 8.2+, Laravel 11, Doctrine DBAL, spatie/laravel-data.
- **Baza Danych i Cache**: PostgreSQL 16, Redis Alpine.
- **Kolejki i Współbieżność**: Laravel Horizon / Redis Queue Workers.
- **Frontend**: React 18, Tailwind CSS, Lucide Icons, Recharts, Axios, Vitest, React Testing Library.
- **Infrastruktura**: Docker & Docker Compose, Nginx, Mailpit (lokalny serwer SMTP).

---

## 🚀 Uruchomienie Środowiska

### Wymagania wstępne
- Docker oraz Docker Compose zainstalowane na maszynie deweloperskiej.
- Node.js 18+ oraz npm (do uruchamiania testów frontendowych).

### Krok po kroku

1. **Sklonowanie repozytorium**:
```bash
git clone https://github.com/your-org/finboard.git
cd finboard
```

2. **Przygotowanie konfiguracji środowiska**:
```bash
cp .env.example .env
```

3. **Uruchomienie kontenerów Docker**:
```bash
docker compose up -d --build
```

4. **Instalacja zależności Composer i migracje**:
```bash
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

5. **Instalacja zależności frontendu i kompilacja aktywów**:
```bash
npm install
npm run build
```

Aplikacja będzie dostępna pod adresem: `http://localhost:8080`.
Pulpit Mailpit (podgląd e-maili deweloperskich): `http://localhost:8025`.

---

## 🧪 Uruchamianie Testów

### Testy Backendowe (PHPUnit)
Pakiet 389 testów jednostkowych i integracyjnych pokrywających warstwę domenową (DDD), zapytania CQRS, repozytoria, kalkulacje matematyczne `Money`, importy CSV, autoryzację wielonajemcową, system zaproszeń, logi audytowe oraz API benchmarków i analityki:
```bash
docker compose exec app ./vendor/bin/phpunit
```

### Testy Frontendowe (Vitest)
Pakiet 147 testów jednostkowych i integracyjnych dla komponentów React, kontekstu transakcyjnego, walidacji danych, kalkulatorów walutowych, konfiguratora celów benchmarkowych oraz przepływów integracyjnych E2E:
```bash
npm test
```

---

## 📡 Główne Endpointy API (REST v1)

### Uwierzytelnianie & Tożsamość (Identity Context)
- `POST /api/v1/auth/login` – Uwierzytelnienie użytkownika i wydanie tokena Sanctum
- `POST /api/v1/auth/logout` – Unieważnienie bieżącego tokena uwierzytelniającego
- `GET /api/v1/auth/me` – Pobranie profilu zalogowanego użytkownika z listą przypisanych firm

### Zarządzanie Doradcami i Zaproszeniami (SuperAdmin & Advisor)
- `GET /api/v1/admin/advisors` – Lista doradców z przypisanymi spółkami
- `POST /api/v1/admin/advisors/{id}/companies` – Przypisanie doradcy do spółki
- `DELETE /api/v1/admin/advisors/{id}/companies/{companyId}` – Odebranie doradcy dostępu do spółki
- `POST /api/v1/invitations` – Wysłanie zaproszenia dla nowego użytkownika (Doradca/Klient)
- `GET /api/v1/invitations/pending` – Lista oczekujących zaproszeń dla firmy
- `POST /api/v1/invitations/accept` – Aktywacja konta i nadanie hasła z tokena zaproszenia
- `POST /api/v1/companies` – Utworzenie nowej spółki portfelowej i powiązanie z doradcą

### Transakcje Finansowe & Import (Finance Context)
- `GET /api/v1/finance/records` – Lista rekordów finansowych z filtrami daty i typu
- `POST /api/v1/finance/records` – Rejestracja nowego rekordu (Przychód, Koszt, Aktywa, Pasywa)
- `PUT /api/v1/finance/records/{id}` – Aktualizacja istniejącego wpisu finansowego
- `DELETE /api/v1/finance/records/{id}` – Usunięcie rekordu finansowego
- `POST /api/v1/finance/import/csv` – Asynchroniczny upload pliku CSV z transakcjami
- `POST /api/v1/finance/import/preview` – Walidacja pliku i podgląd dry-run pierwszych wierszy

### Cele Finansowe & Benchmarki Branżowe (Finance Context)
- `GET /api/v1/finance/benchmarks` – Pobranie celów benchmarkowych spółki z ewaluacją bieżącą
- `PUT /api/v1/finance/benchmarks` – Zbiorcza konfiguracja celów docelowych i progów przez Doradcę
- `PUT /api/v1/finance/benchmarks/{metricType}` – Aktualizacja pojedynczego celu wskaźnikowego
- `POST /api/v1/finance/benchmarks/reset` – Przywrócenie domyślnych standardów rynkowych spółki

### Ścieżka Audytowa (Audit Trail)
- `GET /api/v1/finance/audit-logs` – Rejestr zdarzeń audytowych operacji finansowych i celów ze statystykami zagregowanymi

### Analityka Finansowa & KPI (Queries)
- `GET /api/v1/finance/analytics/metrics` – Syntetyczne wskaźniki P&L, bilansowe, dynamika YoY/MoM oraz ewaluacja celów
- `GET /api/v1/finance/analytics/dynamics` – Precyzyjne zapytanie CQRS o dynamikę finansową YoY oraz MoM wraz z wariancjami kwotowymi
- `GET /api/v1/finance/analytics/years` – Pobranie dostępnych lat obrachunkowych z transakcjami dla spółki
- `GET /api/v1/finance/analytics/trends` – Chronologiczne trendy miesięczne dla wykresów P&L (Recharts)
- `GET /api/v1/finance/analytics/breakdown` – Struktura kosztów i przychodów per kategoria z procentami
- `GET /api/v1/finance/analytics/liquidity` – Dynamika wskaźników płynności (Current & Quick Ratio)

### Wirtualny Pokój Danych (Virtual Data Room - VDR)
- `GET /api/v1/documents` – Lista dokumentów firmy z filtrami kategorii, archiwum i wyszukiwarką
- `POST /api/v1/documents` – Upload nowego dokumentu z wyliczeniem SHA-256 i wpisem audytowym
- `GET /api/v1/documents/{id}` – Metadane pojedynczego dokumentu
- `PUT /api/v1/documents/{id}` – Aktualizacja tytułu i kategorii dokumentu
- `GET /api/v1/documents/{id}/download` – Bezpieczne pobranie pliku z inkrementacją licznika i wpisem w dzienniku pobrań
- `PATCH /api/v1/documents/{id}/archive` – Przełączenie statusu archiwalnego dokumentu
- `DELETE /api/v1/documents/{id}` – Usunięcie pliku z magazynu i bazy danych
- `GET /api/v1/documents/{id}/audit-logs` – Rejestr zdarzeń i pobrań dla wskazanego dokumentu
- `GET /api/v1/documents/audit-logs` – Zbiorczy dziennik audytowy operacji na dokumentach firmy

---

## 📋 Status Realizacji Projektu (Roadmap)

- [x] **Faza 1: Infrastruktura DevOps i Inicjalizacja Projektu**
    - Konteneryzacja środowiska (PHP-FPM 8.2, Nginx, PostgreSQL, Redis, Worker, Scheduler).
    - Inicjalizacja aplikacji Laravel 11 oraz konfiguracja zmiennych środowiskowych.
- [x] **Faza 2: Architektura Domenowa (DDD), Bounded Context Identity & RBAC**
    - Struktura domenowa DDD i podział na konteksty.
    - Implementacja agregatu `User`, wartości `Role`, uwierzytelniania Sanctum oraz middleware RBAC i izolacji najemców.
- [x] **Faza 3: Bounded Context Finance (Domena & Import Danych)**
    - Domenowe obiekty wartości `Money` i `DateRange` oraz encje i agregat `FinancialRecord`.
    - Serwis domenowy `FinancialCalculator` (EBITDA, EBIT, marże, wskaźniki płynności).
    - Migracje bazodanowe, modele Eloquent, repozytoria i zasilenie 21 miesięcy danych demo dla firm Acme i Helvest.
- [x] **Faza 4: CQRS, Asynchroniczne Przetwarzanie i Bounded Context DocumentManagement**
    - Obsługa zapisu CQRS (Commands & Handlers dla CRUD transakcji finansowych).
    - Parser CSV z automatycznym wykrywaniem separatora i wielojęzycznymi aliasami nagłówków.
    - Asynchroniczny proces importu `ProcessFinancialCsvJob` oparty na kolejce Redis.
    - Utworzenie kontekstu `DocumentManagement` (Agregat `Document`, adapter magazynu plików, log audytowy).
    - Implementacja zapytań odczytu CQRS (Queries & Handlers) dla KPI, trendów P&L, struktury kosztów i płynności.
- [x] **Faza 5: Warstwa Prezentacji i REST API**
  - Endpointy REST API dla transakcji finansowych i asynchronicznego importu CSV.
  - Endpointy REST API analityki finansowej, wskaźników KPI i serii danych pod wykresy.
  - Endpointy REST API dla Wirtualnego Pokoju Danych (Virtual Data Room) z logiem pobrań.
  - Kompleksowe testy integracyjne API dla izolacji multi-tenant i uprawnień Sanctum.
- [x] **Faza 6: Frontend React & Dashboard Finansowy**
  - Konfiguracja SPA React z Tailwind CSS, Lucide Icons, klientem API Axios oraz szkieletem layoutu.
  - Refaktoryzacja wizualna: stylistyka terminala instytucjonalnego Deal Advisory (Dark Theme, akcenty szmaragdowe/bursztynowe, typografia `font-mono` / `tabular-nums`).
  - Typografia finansowa oraz liczby tabelaryczne (tabular-nums, font-mono dla kwot, wskaźników i dat).
  - Pasek kontekstu transakcyjnego Deal Advisory (poufność, wybór waluty raportowania, selektor okresu).
  - Zwarte tabele i komponenty analityczne w stylu narzędzi Bloomberg / FactSet / Ramp.
  - Moduł uwierzytelniania i przełącznik kontekstu firmy dla doradcy.
  - Główny Dashboard ze wskaźnikami KPI i wykresami Recharts (trendy, struktura kosztów, płynność).
  - Moduł tabeli transakcji finansowych z filtrami i kreatorem dodawania.
  - Dedykowany moduł analityki finansowej (AnalyticsView) z 4 trybami analitycznymi (Przegląd Kompleksowy, Rentowność i Marże, Płynność i Wskaźniki, Dekompozycja Przychodów / Kosztów) oraz seriami Recharts.
  - Interfejs importu plików CSV z podglądem na żywo i paskiem postępu.
  - Środowisko testowe Vitest i testy jednostkowe reguł matematycznych oraz formatowania walutowego.
  - Testy integracyjne komponentów: walidacja podglądu dry-run CSV oraz formularzy księgi głównej.
- [x] **Faza 7: Data Room UI, Raporty PDF i Wdrożenie Końcowe**
  - Interfejs Virtual Data Room (VDR) – przeglądarka dokumentów z kategoryzacją, sumami kontrolnymi SHA-256, audytem pobrań i drag & drop uploadem.
  - Generator podsumowań i raportów zarządczych PDF z certyfikatem integralności SHA-256 i formatem A4.
  - Testy E2E, audyt bezpieczeństwa izolacji multi-tenant i endpoint diagnostyczny Health Check.
  - Produkcyjny hardening środowiska Docker/Nginx, skrypt automatycznego wdrożenia zero-downtime oraz Runbook operacyjny.
- [x] **Faza 8: Rozbudowa Autoryzacji i Struktury Firm**
  - Aktualizacja encji `Role` i enumów dla trójpoziomowej hierarchii uprawnień (SuperAdmin, Advisor, Client).
  - Implementacja logiki domenowej relacji przypisania doradcy do firmy (`CompanyAdvisorAssignment`, `CompanyAdvisorRepositoryInterface`).
  - Migracja bazy danych dla tabeli pośredniej `advisor_company` i aktualizacja powiązań.
  - Implementacja przypadku użycia `AssignAdvisorToCompanyUseCase` ze ścisłą weryfikacją autoryzacji.
  - Testy jednostkowe i integracyjne weryfikujące dostęp doradców wyłącznie do przypisanych spółek.
- [x] **Faza 9: Bezpieczny System Zaproszeń (Invitation System)**
  - Encja `Invitation` i obiekt wartości `Token` z logiką wygasania (Identity).
  - Migracja bazy danych i repozytorium dla zaproszeń.
  - Przypadek użycia `InviteUserUseCase` z emisją zdarzenia domenowego `UserInvited`.
  - Klasy Mailable i listenery zdarzeń do asynchronicznej wysyłki e-maili z zaproszeniami.
  - Przypadek użycia `AcceptInvitationUseCase` z walidacją tokenu i bezpiecznym ustawieniem hasła.
- [x] **Faza 10: API i Frontend dla Zarządzania Użytkownikami**
  - Kontroler `InvitationController` mapujący endpointy REST dla zaproszeń.
  - Kontroler `AdvisorManagementController` dla SuperAdmina do zarządzania doradcami i przypisaniami.
  - Widok dashboardu SuperAdmina do zarządzania doradcami i przypisaniami spółek.
  - Modal zapraszania użytkownika z wyborem roli i przypisaniem firm dla doradców.
  - Bezpieczna strona aktywacji konta / ustawienia hasła na podstawie tokenu z linku e-mail.
- [x] **Faza 11: Zarządzanie Portfelem Spółek (Portfolio Management)**
  - Endpoint rejestracji spółek portfelowych i walidacji danych (Backend API).
  - Interfejs dodawania nowej spółki portfelowej z matrycy spółek (Frontend UI).
  - Reaktywna synchronizacja listy spółek w modalach zaproszeń i kontekstu bez przeładowania strony (Frontend UI).
  - Integracja kontenera Mailpit (Mailcatcher) dla testowania wysyłki e-maili i linków aktywacyjnych w środowisku lokalnym.
- [x] **Faza 12: Dynamiczne Obliczenia Wskaźników i Dynamiki (Finance)**
  - Implementacja logiki domenowej w `FinancialRecord` do wyliczania wskaźników płynności i zadłużenia (Current, Quick Ratios, Debt-to-Assets).
  - Implementacja logiki domenowej dla kalkulacji marż (Gross, EBITDA, EBIT, Net Margin).
  - Serwis aplikacyjny `KpiCalculationService` z dynamiczną kalkulacją dynamiki YoY i MoM z danych historycznych.
  - Testy jednostkowe dla kalkulacji wskaźników i dynamiki z uwzględnieniem edge-cases.
  - Aktualizacja kontrolera `KpiController` do zwracania dynamicznie wyliczonych wskaźników.
- [x] **Faza 13: Konfiguracja Benchmarków i Celów Finansowych (Finance)**
  - Encja `FinancialBenchmark`, enumy `BenchmarkStatus`, `BenchmarkMetricType` oraz reguły ewaluacji statusów KPI.
  - Migracja bazy danych, model Eloquent i repozytorium dla benchmarków spółek.
  - Serwis ewaluacji wskaźników z dynamicznym wyliczaniem flag statusów (OPT, WARN, CRIT).
  - Endpointy REST API do pobierania i konfiguracji benchmarków dla doradców.
  - Testy jednostkowe i integracyjne modułu benchmarków oraz weryfikacja uprawnień.
- [x] **Faza 14: Logi Audytowe i Dynamiczny Frontend (Finance & Deal Advisory)**
  - Encja `FinancialAuditLog`, migracja bazy danych i repozytorium dla operacji finansowych i konfiguracji celów.
  - Rejestracja listenerów zdarzeń domenowych utrwalających wpisy w dzienniku audytowym.
  - Endpointy REST API do pobierania logów audytowych przypisanych do spółki.
  - Zastąpienie statycznych wartości na Pulpicie Zarządczym i w Analityce P&L dynamicznymi danymi z API.
  - Interfejs edycji celów finansowych dla Doradcy z dynamicznymi wskaźnikami statusów i semaforami (OPT, WARN, CRIT).
- [x] **Faza 15: Dynamiczne Lata Obrachunkowe i Precyzyjne Rozbicie OPEX**
  - Implementacja zapytania domenowego `GetAvailableFiscalYearsQuery` oraz metody repozytorium do dynamicznego wyciągania aktywnych lat obrachunkowych spółki.
  - Endpoint REST API `GET /api/v1/finance/analytics/years`.
  - Rozszerzenie zapytania `GetCategoryBreakdownQuery` o filtrowanie `category_type` (OPEX vs COGS/TAX).
  - Testy jednostkowe i integracyjne dla dynamicznych lat i filtrowania kategorii.
  - Integracja `DealContext` z dynamiczną listą lat oraz zaktualizowanie wykresu struktury kosztów.
- [x] **Faza 16: Naprawa Kontraktu Wskaźników Płynności i Statusów Benchmarkowych**
  - Standaryzacja struktury DTO `FinancialMetrics` (ujednolicenie struktur `ratios`, `liquidity` i `solvency`).
  - Obsługa braku rekordów bilansowych w `KpiEvaluationService` (eliminacja fałszywych alarmów krytycznych).
  - Testy jednostkowe serializacji `FinancialMetrics` i ewaluacji wskaźników brzegowych.
  - Refaktoryzacja `DashboardView` i `FinancialMultiplesStrip` pod ujednolicony kontrakt wskaźników.
  - Wprowadzenie estetycznych stanów fallback ("—") dla brakujących danych bilansowych.
- [x] **Faza 17: Precyzja Dynamiki R/R i Optymalizacja Prezentacji Finansowej**
  - Analiza i rozszerzenie obliczeń dynamiki rok-do-roku (YoY) w `CalculateFinancialDynamicsQuery`.
  - Poprawa `PercentageBadge` i `FinancialTable` pod kątem rozróżnienia braku danych (`null`) od wzrostu `0.0%`.
  - Standaryzacja hierarchii i formatowania wierszy w zestawieniu Rachunku Zysków i Strat (P&L Table).
  - Testy jednostkowe i integracyjne dla precyzji obliczeń dynamiki oraz weryfikacji stanów brzegowych.
  - Weryfikacja spójności całego pulpitu zarządczego (Executive Overview) oraz generowanie pełnego buildu produkcyjnego.
- [x] **Faza 18: Naprawa Filtrowania RecordType i Układ Rodzajowy OPEX**
  - Usunięcie błędu wielkości liter w `GetCategoryBreakdownHandler` blokującego filtrowanie `record_type`.
  - Wprowadzenie dedykowanych kodów kategorii rodzajowych OPEX w encji domenowej `Category` i seederze bazy danych.
  - Aktualizacja `FinancialDataSeeder` i zbiorów danych o dystrybucję kosztów operacyjnych na subkategorie rodzajowe.
  - Testy jednostkowe izolacji kategorii REVENUE od EXPENSE i rekordów bilansowych.
  - Weryfikacja różnorodnego rozkładu kategorii OPEX na wykresie kołowym zamiast pojedynczego wpisu 100%.
- [x] **Faza 19: Domenowe Obliczanie Dynamiki R/R dla Podpozycji Kategorii**
  - Rozszerzenie `GetCategoryBreakdownQuery` i Handlera o kalkulację kwot porównawczych i dynamiki YoY per kategoria.
  - Ekspozycja dynamiki YoY na poziomie kategorii (`previous_amount`, `yoy_growth_pct`) w endpoincie `/finance/analytics/breakdown`.
  - Testy jednostkowe kalkulacji dynamiki YoY na poziomie kategorii z przypadkami brzegowymi (nowe kategorie, baza zerowa).
  - Testy integracyjne endpointu breakdown weryfikujące strukturę payloadu YoY.
  - Optymalizacja agregacji rekordów i zapytań bazodanowych dla okresów porównawczych.
- [x] **Faza 20: Integracja UI Tabeli P&L i Wykresu Struktury Kosztów**
  - Podpięcie dynamicznej dynamiki YoY per kategoria do podwierszy (children) przychodów i OPEX w `DashboardView`.
  - Zapewnienie ścisłej polaryzacji `reverseChange` dla kosztów OPEX i jej brak dla przychodów.
  - Optymalizacja wykresu `CostBreakdownChart` z auto-sortowaniem, paletą wielokategorialną i czytelną legendą.
  - Testy komponentów frontendowych w `DashboardView.test.jsx` weryfikujące rozwijane wiersze P&L i odznaki YoY.
  - Testy integracyjne weryfikujące poprawną izolację kategorii w zestawieniu przychodów.
- [ ] **Faza 21: Spójność Danych Historycznych OPEX i Strumienie Przychodów**
  - [x] Migracja danych rekwalifikująca archiwalne rekordy `cat-opex` do granularnych podkategorii OPEX.
  - [ ] Wprowadzenie granularnych podkategorii przychodowych (SaaS, Usługi, Doradztwo) w encji domenowej `Category` i schemacie.
  - [ ] Aktualizacja seedera `FinancialDataSeeder` i zbiorów danych o realne strumienie przychodowe.
  - [ ] Testy weryfikujące eliminację rekordów sierocych `cat-opex` i pełną spójność analityczną.
  - [ ] Refaktoryzacja `CategoryBreakdown` pod kątem obsługi grup jedno- i wielokategorialnych.

---

## 📜 Licencja
Projekt objęty licencją własną dla platformy FinBoard.
