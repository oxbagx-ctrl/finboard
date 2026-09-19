# FinBoard – Financial Analytics & Virtual Data Room Platform

[![PHP Version](https://img.shields.io/badge/php-8.2%2B-blue.svg)](https://www.php.net/)
[![Laravel](https://img.shields.io/badge/laravel-11.x-red.svg)](https://laravel.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-alpine-red.svg)](https://redis.io/)
[![Architecture](https://img.shields.io/badge/architecture-DDD%20%2F%20CQRS-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-340%20backend%20%7C%20104%20frontend%20passed-success.svg)]()

FinBoard to platforma SaaS klasy Enterprise dedykowana firmom doradztwa transakcyjnego (M&A, Due Diligence, Corporate Finance) oraz ich klientom (CFO, Zarządy). Aplikacja łączy w sobie zaawansowaną analitykę finansową w ujęciu wielo-najemcowym (Multi-Tenant) z bezpiecznym repozytorium dokumentów Virtual Data Room (VDR).

---

## 📌 Kluczowe Funkcjonalności

- **Architektura DDD (Domain-Driven Design) & CQRS**:
    - Wyraźny podział na Bounded Contexts: `Identity`, `Finance`, `DocumentManagement`, `Tenant`.
    - Rozdzielenie ścieżki zapisu (Commands) i odczytu (Queries).
    - Domenowe Value Objects (`Money` z precyzją `bcmath` do 4 miejsc po przecinku, `DateRange`, `FileMetadata`, `CompanyId`, `RoleType`, `Token`, `InvitationId`, `FinancialMetrics`, `FinancialBenchmarkId`, `BenchmarkStatus`, `BenchmarkMetricType`, `FinancialAuditLogId`, `AuditAction`).
    - Domenowy kalkulator finansowy (`FinancialCalculator`) oraz metody domenowe `FinancialRecord` wyliczające wskaźniki P&L (Gross Profit, OPEX, EBIT, EBITDA, Zysk Netto, marże) oraz bilansu i płynności (Current Ratio, Quick Ratio, Debt-to-Assets).
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

---

## 🛠️ Architektura Technologiczna

```
finboard/
├── app/
│   ├── Contexts/
│   │   ├── Identity/              # Bounded Context: Uwierzytelnianie, Użytkownicy, Role, Zaproszenia
│   │   ├── Finance/               # Bounded Context: Transakcje, Analityka, Wskaźniki, Benchmarki, Audyt
│   │   │   ├── Application/       # Commands, Queries, Handlery, Serwisy aplikacyjne (KpiCalculation, KpiEvaluation)
│   │   │   ├── Domain/            # Agregaty, Encje, Value Objects, Zdarzenia, Repozytoria (Interfejsy)
│   │   │   └── Infrastructure/    # Repozytoria Eloquent, Listenery zdarzeń audytowych, Parsery
│   │   ├── DocumentManagement/    # Bounded Context: Repozytorium VDR, Sumy Kontrolne, Logi Pobrań
│   │   └── Tenant/                # Bounded Context: Izolacja Wielonajemcowa, Przypisania Spółek
│   ├── Shared/                    # Współdzielone elementy domenowe (AggregateRoot, Entity, DomainEvent)
│   ├── Models/                    # Modele Eloquent (Persistence Model)
│   ├── Presentation/              # Warstwa Prezentacji: Kontrolery REST API, Form Requests, Resources
│   └── Mail/                      # Szablony powiadomień e-mail (Mailable)
├── database/                      # Migracje, Fabryki, Seedery danych demonstracyjnych
├── resources/
│   ├── js/                        # Aplikacja Frontendowa React 18 SPA (Components, Context, Layouts)
│   └── views/                     # Widoki Blade (szablony raportów PDF, podstawa SPA)
├── tests/
│   ├── Unit/                      # Testy jednostkowe domeny DDD i reguł biznesowych
│   └── Feature/                   # Testy integracyjne API, autoryzacji i scenariuszy biznesowych
└── docker/                        # Konfiguracja środowiska kontenerowego (Nginx, PHP, Redis, Postgres)
```

---

## 🚀 Uruchomienie Środowiska (Lokalny Rozwój)

### Wymagania wstępne
- Zainstalowany `docker` oraz wtyczka `docker compose` (v2+)
- Opcjonalnie środowisko `node` (v20+) i `npm` do uruchamiania testów frontendowych poza kontenerem

### 1. Klonowanie repozytorium i konfiguracja środowiska
```bash
git clone <adres-repozytorium> finboard
cd finboard
cp .env.example .env
```

### 2. Uruchomienie kontenerów Docker
```bash
docker compose up -d --build
```
Kontenery wchodzące w skład infrastruktury:
- `finboard_app` – PHP-FPM 8.2 z rozszerzeniami `pdo_pgsql`, `redis`, `bcmath`, `gd`, `zip`
- `finboard_web` – Serwer Nginx serwujący aplikację i statyczne zasoby na porcie `8080`
- `finboard_db` – Baza danych PostgreSQL 16 na porcie `5432`
- `finboard_redis` – Pamięć podręczna i broker kolejki zadań na porcie `6379`
- `finboard_worker` – Asynchroniczny worker przetwarzający zadania kolejki (importy CSV, raporty)
- `finboard_mailpit` – Serwer SMTP/Web UI do przechwytywania wiadomości e-mail na portach `1025` (SMTP) i `8025` (Web UI)

### 3. Inicjalizacja bazy danych i danych demonstracyjnych
```bash
docker compose exec app php artisan migrate --force
docker compose exec app php artisan db:seed --force
```

Po zakończeniu seedowania w systemie dostępne są konta użytkowników:
- **Super Administrator (Partner)**: `admin@finboard.local` / hasło: `password`
- **Doradca Finansowy (Advisor)**: `advisor@helvest.com` / hasło: `password`
- **Klient Portfelowy (Client Acme Corp)**: `client@acme.com` / hasło: `password`

### 4. Dostęp do interfejsów
- **Aplikacja FinBoard (SPA)**: [http://localhost:8080](http://localhost:8080)
- **Web UI Mailpit (Mailcatcher)**: [http://localhost:8025](http://localhost:8025)

---

## 🧪 Uruchamianie Testów Automatycznych

### Testy Backendowe (PHPUnit)
```bash
docker compose exec app ./vendor/bin/phpunit
```
*Aktualny status: **340 testów** (2298 asercji), 100% zaliczonych.*

### Testy Frontendowe (Vitest)
```bash
npm test
```
*Aktualny status: **104 testy** (13 zestawów), 100% zaliczonych.*

---

## 📋 Główne Punkty Końcowe REST API

### Uwierzytelnianie i Zarządzanie Tożsamością
- `POST /api/v1/auth/login` – Uwierzytelnienie użytkownika i wydanie tokenu Sanctum
- `POST /api/v1/auth/logout` – Unieważnienie bieżącej sesji tokenu
- `GET /api/v1/auth/me` – Pobranie danych zalogowanego użytkownika, jego roli oraz przypisanych firm
- `POST /api/v1/auth/invite` – Zaproszenie nowego doradcy lub klienta z określeniem roli i firm
- `POST /api/v1/auth/accept-invitation` – Aktywacja konta na podstawie jednorazowego tokenu zaproszenia

### Spółki i Nadzór Transakcyjny
- `GET /api/v1/companies` – Lista dostępnych dla użytkownika spółek portfelowych
- `POST /api/v1/companies` – Utworzenie nowej spółki portfelowej (dla Doradcy/SuperAdmina)
- `GET /api/v1/companies/{id}/advisors` – Lista doradców przypisanych do spółki
- `POST /api/v1/companies/{id}/advisors` – Przypisanie doradcy do spółki (SuperAdmin)
- `DELETE /api/v1/companies/{id}/advisors/{userId}` – Odebranie doradcy dostępu do spółki

### Finanse – Księga Główna i Importy (CQRS Write Side)
- `GET /api/v1/finance/records` – Lista rekordów księgowych z filtrami dat, kategorii i typu
- `POST /api/v1/finance/records` – Dodanie pojedynczego rekordu księgowego
- `PUT /api/v1/finance/records/{id}` – Aktualizacja kwoty i szczegółów rekordu
- `DELETE /api/v1/finance/records/{id}` – Usunięcie rekordu księgowego
- `POST /api/v1/finance/import/preview` – Walidacja i podgląd pliku CSV (dry-run)
- `POST /api/v1/finance/import/upload` – Kolejkowanie pliku do asynchronicznego importu w tle

### Finanse – Benchmarki i Cele Finansowe
- `GET /api/v1/finance/benchmarks` – Lista progów i celów dla wszystkich wskaźników spółki
- `GET /api/v1/finance/benchmarks/{metricType}` – Szczegóły konfiguracji wybranego wskaźnika
- `PUT /api/v1/finance/benchmarks/{metricType}` – Aktualizacja lub utworzenie celów i progów ostrzegawczych
- `PUT /api/v1/finance/benchmarks` – Zbiorcza (batch) aktualizacja celów wskaźników spółki
- `POST /api/v1/finance/benchmarks/reset` – Przywrócenie domyślnych standardów rynkowych dla wskazanego lub wszystkich wskaźników

### Finanse – Ścieżka Audytowa (Audit Trail)
- `GET /api/v1/finance/audit-logs` – Stronicowana lista zdarzeń audytowych spółki z filtrami akcji, encji i dat (`AuditLogController`)
- `GET /api/v1/finance/audit-logs/stats` – Zbiorcze wskaźniki i liczby operacji audytowych per akcja ze statusem semaforowym
- `GET /api/v1/finance/audit-logs/{id}` – Szczegóły pojedynczego rekordu audytowego ze snapshotem zmian (old/new)

### Finanse – Analityka i Wykresy (CQRS Read Side & Dynamic KPI)
- `GET /api/v1/finance/kpi` – Dedykowany endpoint KPI ze wskaźnikami P&L, bilansem, płynnością oraz dynamikami YoY i MoM (`KpiController`)
- `GET /api/v1/finance/analytics/metrics` – Zbiorcze KPI wzbogacone o dynamiczne relacje roczne i miesięczne
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
- [ ] **Faza 14: Logi Audytowe i Dynamiczny Frontend (Finance & Deal Advisory)**
  - [x] Encja `FinancialAuditLog`, migracja bazy danych i repozytorium dla operacji finansowych i konfiguracji celów.
  - [x] Rejestracja listenerów zdarzeń domenowych utrwalających wpisy w dzienniku audytowym.
  - [x] Endpointy REST API do pobierania logów audytowych przypisanych do spółki.
  - [x] Zastąpienie statycznych wartości na Pulpicie Zarządczym i w Analityce P&L dynamicznymi danymi z API.
  - [ ] Interfejs edycji celów finansowych dla Doradcy z dynamicznymi wskaźnikami statusów i semaforami (OPT, WARN, CRIT).

---

## 📜 Licencja
Projekt objęty licencją własną dla platformy FinBoard.
