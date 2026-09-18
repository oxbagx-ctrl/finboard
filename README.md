# FinBoard – Financial Analytics & Virtual Data Room Platform

[![PHP Version](https://img.shields.io/badge/php-8.2%2B-blue.svg)](https://www.php.net/)
[![Laravel](https://img.shields.io/badge/laravel-11.x-red.svg)](https://laravel.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-alpine-red.svg)](https://redis.io/)
[![Architecture](https://img.shields.io/badge/architecture-DDD%20%2F%20CQRS-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-118%20backend%20%7C%2027%20frontend%20passed-success.svg)]()

FinBoard to platforma SaaS klasy Enterprise dedykowana firmom doradztwa transakcyjnego (M&A, Due Diligence, Corporate Finance) oraz ich klientom (CFO, Zarządy). Aplikacja łączy w sobie zaawansowaną analitykę finansową w ujęciu wielo-najemcowym (Multi-Tenant) z bezpiecznym repozytorium dokumentów Virtual Data Room (VDR).

---

## 📌 Kluczowe Funkcjonalności

- **Architektura DDD (Domain-Driven Design) & CQRS**:
    - Wyraźny podział na Bounded Contexts: `Identity`, `Finance`, `DocumentManagement`.
    - Rozdzielenie ścieżki zapisu (Commands) i odczytu (Queries).
    - Domenowe Value Objects (`Money` z precyzją `bcmath` do 4 miejsc po przecinku, `DateRange`, `FileMetadata`).
    - Domenowy kalkulator finansowy (`FinancialCalculator`) wyliczający wskaźniki P&L (Gross Profit, OPEX, EBIT, EBITDA, Zysk Netto, marże) oraz bilansu i płynności (Current Ratio, Quick Ratio).
- **Bezpieczeństwo i Izolacja Multi-Tenant**:
    - Pełna separacja danych pomiędzy firmami (Tenant Isolation).
    - RBAC (Role-Based Access Control) oparty na Laravel Sanctum z rolami `admin` (doradca Helvest z dostępem do portfela spółek) oraz `client` (klient / CFO spółki ze ścisłym dostępem wyłącznie do własnych danych).
- **Asynchroniczny Import Danych Finansowych (CSV)**:
    - Automatyczne wykrywanie delimiterów (przecinek, średnik, tabulator).
    - Obsługa wielojęzycznych nagłówków (PL/EN) i polskich formatów liczbowych (np. `15 000,50 zł`).
    - Walidacja danych wiersz po wierszu z natychmiastowym podglądem (dry-run preview).
    - Kolejkowanie zadań przetwarzania w Redis (`ProcessFinancialCsvJob`) w kontenerze workera.
- **Wirtualny Pokój Danych (Virtual Data Room - VDR)**:
    - Bezpieczne repozytorium dokumentów transakcyjnych, audytowych i finansowych.
    - Obliczanie i weryfikacja sum kontrolnych SHA-256 plików.
    - Pełny rejestr audytowy zdarzeń (upload, download, archive) w dzienniku `DocumentAccessLog`.
- **Frontend SPA w Stylu Terminala Deal Advisory (Bloomberg / FactSet)**:
    - Estetyka o wysokim kontraście (Zinc 950/900), inżynieryjne krawędzie, brak sztucznych ozdobników AI.
    - Liczby tabelaryczne (`tabular-nums`, `font-mono`) dla kwot, marż i dat.
    - Pasek kontekstu transakcyjnego z selektorem waluty przeliczeniowej w locie (PLN, EUR, USD, GBP), statusem poufności oraz zakresem dat.
    - Interaktywne wykresy Recharts (trendy P&L, struktura kosztów OPEX, wskaźniki płynności z benchmarkami branżowymi).
    - Pełny moduł księgi operacji (General Ledger) z filtrami i paginacją serwerową.
    - Widok importu CSV z podglądem walidacji dry-run i animowanym monitorem kolejki Redis.
    - Zestaw testów jednostkowych i integracyjnych Vitest dla formaterów matematycznych i reguł decyzyjnych interfejsu.

---

## 🏗️ Architektura Systemu

Platforma została zaprojektowana zgodnie z pryncypiami **Domain-Driven Design (DDD)**, **CQRS (Command Query Responsibility Segregation)** oraz **Clean/Hexagonal Architecture** na backendzie, połączonymi z modułową architekturą **SPA React 18** na frontendzie:

### Backend (Laravel 11 / PHP 8.2 / DDD / CQRS)
```
app/
├── Contexts/
│   ├── Identity/                 # Bounded Context: Zarządzanie tożsamością i uprawnieniami
│   │   ├── Domain/               # User Aggregate Root, Role Entity, Value Objects (UserId, Email, HashedPassword), Domain Events
│   │   ├── Application/          # Serwisy aplikacyjne (UserRegistrationService) i interfejsy repozytoriów
│   │   └── Infrastructure/       # EloquentUserRepository, Sanctum Provider
│   │
│   ├── Finance/                  # Bounded Context: Finanse, Raportowanie i Analityka
│   │   ├── Domain/               # FinancialRecord Aggregate, Category, Money VO (bcmath), DateRange VO, FinancialCalculator
│   │   ├── Application/          # CQRS Commands & Handlers (CRUD transakcji), CQRS Queries & Handlers (KPI, Trends, Solvency), Parser CSV, Jobs
│   │   └── Infrastructure/       # EloquentFinancialRecordRepository, EloquentCategoryRepository
│   │
│   └── DocumentManagement/       # Bounded Context: Virtual Data Room (VDR)
│       ├── Domain/               # Document Aggregate Root, FileMetadata, DocumentType, Domain Events
│       ├── Application/          # Porty repozytorium (DocumentRepositoryInterface) i interfejs magazynu plików (DocumentStorageInterface)
│       └── Infrastructure/       # EloquentDocumentRepository, LocalStorageDocumentStorage
│
├── Models/                       # Modele Eloquent (User, Company, FinancialRecord, FinancialCategory, Document, DocumentAccessLog, CsvImport)
├── Presentation/                 # Warstwa Prezentacji i Komunikacji API
│   └── Api/
│       ├── Controllers/          # Kontrolery REST API (Auth, FinancialRecord, FinancialCategory, FinancialImport, FinancialAnalytics, Document)
│       ├── Middleware/           # RoleMiddleware, RequireCompanyAccessMiddleware (Tenant Isolation Guard)
│       ├── Requests/             # FormRequests z walidacją danych wejściowych
│       ├── Resources/            # API Resources (JSON serialization)
│       └── Traits/               # ResolvesCompanyContext (Multi-Tenant Context Resolver)
└── Shared/                       # Klasy bazowe architektury (ValueObject, AggregateRoot, DomainEvent, Entity)
```

### Frontend (React 18 / Tailwind CSS / Recharts / Terminal Deal Advisory)
```
resources/js/
├── api/                          # Klient Axios z automatyczną obsługą tokenów Bearer i nagłówków multi-tenant (X-Company-Id)
├── components/
│   ├── auth/                     # CompanySwitcherModal (wyszukiwarka spółek portfela), UserProfileModal (dane, zmiana hasła)
│   ├── charts/                   # PnlTrendChart, CostBreakdownChart, LiquidityTrendChart, CustomChartTooltip (ciemny monospace FactSet/Bloomberg)
│   ├── finance/                  # FinancialRecordModal (kreator/edycja wpisu księgi), DeleteRecordConfirmationModal
│   ├── import/                   # CsvDropzone (strefa drag & drop), CsvPreviewTable (dry-run), ImportJobProgress (polling Redis), ImportHistoryTable
│   ├── layout/                   # DealContextBar (waluta, poufność, okres), Header, Sidebar, Layout
│   └── ui/                       # Badge, Button, Card, MultiplesStrip (wskaźniki EV/EBITDA, P/E), FinancialTable
├── context/                      # AuthContext (tożsamość, role, kontekst spółki), DealContext (FX, okres), NotificationContext (toasty)
├── tests/                        # Setup Vitest, testy jednostkowe formatters.test.js i dealContext.test.jsx
├── utils/                        # formatters.js (liczby tabelaryczne tabular-nums, waluty PLN/EUR/USD/GBP, formatowanie wskaźników)
└── views/                        # DashboardView, RecordsView, ImportView, DataRoomView, ReportsView, LoginView
```

### Dane Testowe i Szablony Importu
```
samples/import/
├── 01_q3_2026_acme_manufacturing.csv         # Kompletne dane produkcyjne Q3 2026 (PLN, przecinek, 25 wierszy)
├── 02_q3_2026_helvest_advisory_eur.csv        # Transakcje M&A i advisory (EUR, średnik, kody REV/COGS/OPEX, 20 wierszy)
├── 03_monthly_batch_payroll_and_opex.csv      # Wsadowe pozycje OPEX i koszty płacowe (PLN, 12 wierszy)
├── 04_invalid_dry_run_testing_with_errors.csv   # Zbiór z celowymi błędami do testowania walidacji Dry-Run w UI
└── README.md                                  # Szczegółowy opis formatów i oczekiwanych wyników
```

---

## 🚀 Środowisko Docker i Uruchomienie

Środowisko developerskie oparte jest o Docker Compose:
- **`app`**: PHP-FPM 8.2 z rozszerzeniami `bcmath`, `pdo_pgsql`, `redis`, `gd`, `zip`
- **`web` / `nginx`**: Serwer HTTP przekierowujący ruch do PHP-FPM (port `8080`)
- **`postgres`**: PostgreSQL 16 (port `5432`)
- **`redis`**: Redis Alpine jako broker kolejek i cache (port `6379`)
- **`worker`**: Dedykowany kontener wykonujący zadania w tle (`php artisan queue:work --queue=financial-imports,default`)
- **`scheduler`**: Kontener harmonogramu zadań cron (`php artisan schedule:work`)

### Uruchomienie projektu

```bash
# 1. Start kontenerów
docker compose up -d

# 2. Instalacja zależności (jeśli wymagane)
docker compose exec app composer install
npm install

# 3. Migracje bazy danych i seeder danych demo
docker compose exec app php artisan migrate --seed

# 4. Kompilacja assetów frontendu (React / Tailwind)
npm run build

# 5. Uruchomienie testów backendowych (PHPUnit) oraz frontendowych (Vitest)
docker compose exec app php artisan test
npm test
```

Aplikacja jest dostępna pod adresem: `http://localhost:8080`

---

## 🔑 Dane Dostępowe Środowiska Demo

Baza danych zasilona jest danymi demonstracyjnymi (21 miesięcy historii finansowej od stycznia 2025 do września 2026):

| Rola | Użytkownik | Email | Hasło | Spółka powiązana |
| :--- | :--- | :--- | :--- | :--- |
| **Admin / Doradca M&A** | Analityk Finansowy (Helvest) | `admin@helvest.com` | `password123` | Helvest Advisory Sp. z o.o. *(Dostęp do wszystkich spółek)* |
| **Klient / CFO** | Jan Kowalski (CFO Acme) | `klient@acme.com` | `password123` | Acme Manufacturing S.A. *(Dostęp wyłącznie do Acme)* |

---

## 📡 Przegląd Endpointów REST API (`/api/v1`)

### Autoryzacja i Profil
- `POST /api/v1/auth/login` – Logowanie i generowanie tokenu Sanctum
- `GET /api/v1/auth/me` – Dane zalogowanego użytkownika, uprawnienia i lista dostępnych spółek
- `PUT /api/v1/auth/profile` – Aktualizacja danych profilu oraz zmiana hasła z weryfikacją dotychczasowego
- `POST /api/v1/auth/logout` – Unieważnienie tokenu sesji

### Finanse – Kategorie i Transakcje (CRUD)
- `GET /api/v1/finance/categories` – Lista kategorii analitycznych
- `GET /api/v1/finance/records` – Lista rekordów z wyszukiwaniem (`search`), filtrowaniem i paginacją
- `POST /api/v1/finance/records` – Dodanie rekordu transakcyjnego
- `GET /api/v1/finance/records/{id}` – Szczegóły pojedynczego rekordu
- `PUT /api/v1/finance/records/{id}` – Aktualizacja rekordu
- `DELETE /api/v1/finance/records/{id}` – Usunięcie rekordu

### Finanse – Import CSV (Asynchroniczny z kolejką Redis)
- `POST /api/v1/finance/imports/preview` *(lub `/finance/import/preview`)* – Walidacja w locie i podgląd dry-run pliku CSV
- `POST /api/v1/finance/imports` *(lub `/finance/import/csv`)* – Upload pliku i zakolejkowanie asynchronicznego zadania w Redis
- `GET /api/v1/finance/imports/{id}` *(lub `/finance/import/csv/{id}`)* – Sprawdzenie statusu realizacji i ewentualnych błędów zadania
- `GET /api/v1/finance/imports/history` *(lub `/finance/import/history`)* – Dziennik historycznych zadań importu spółki

### Finanse – Analityka i Wykresy (CQRS Read Side)
- `GET /api/v1/finance/analytics/metrics` – Zbiorcze KPI (Przychody, Marża, EBITDA, Zysk Netto, Wskaźniki płynności)
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
  - Refaktoryzacja wizualna: stylistyka terminala instytucjonalnego Deal Advisory (wysoki kontrast Zinc/Slate, precyzyjne kąty inżynieryjne, statusy bezpieczeństwa).
  - Typografia finansowa oraz liczby tabelaryczne (tabular-nums, font-mono dla kwot, wskaźników i dat).
  - Pasek kontekstu transakcyjnego Deal Advisory (poufność, wybór waluty raportowania, selektor okresu).
  - Zwarte tabele i komponenty analityczne w stylu narzędzi Bloomberg / FactSet / Ramp.
  - Moduł uwierzytelniania i przełącznik kontekstu firmy dla doradcy.
  - Główny Dashboard ze wskaźnikami KPI i wykresami Recharts (trendy, struktura kosztów, płynność).
  - Moduł tabeli transakcji finansowych z filtrami i kreatorem dodawania.
  - Interfejs importu plików CSV z podglądem na żywo i paskiem postępu.
  - Środowisko testowe Vitest i testy jednostkowe reguł matematycznych oraz formatowania walutowego.
- [ ] **Faza 7: Data Room UI, Raporty PDF i Wdrożenie Końcowe**
  - Interfejs Virtual Data Room (VDR) – przeglądarka dokumentów z kategoryzacją i pobieraniem.
  - Generator podsumowań i raportów zarządczych PDF.
  - Testy E2E, audyt bezpieczeństwa i finalna weryfikacja.

Szczegółowa dokumentacja zrealizowanych zmian znajduje się w katalogu [`changelog/`](changelog/README.md).

---

## 📜 Licencja
Projekt objęty licencją własną dla platformy FinBoard.
