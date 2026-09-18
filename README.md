# FinBoard – Financial Analytics & Virtual Data Room Platform

[![PHP Version](https://img.shields.io/badge/php-8.2%2B-blue.svg)](https://www.php.net/)
[![Laravel](https://img.shields.io/badge/laravel-11.x-red.svg)](https://laravel.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-alpine-red.svg)](https://redis.io/)
[![Architecture](https://img.shields.io/badge/architecture-DDD%20%2F%20CQRS-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-221%20backend%20%7C%2057%20frontend%20passed-success.svg)]()

FinBoard to platforma SaaS klasy Enterprise dedykowana firmom doradztwa transakcyjnego (M&A, Due Diligence, Corporate Finance) oraz ich klientom (CFO, Zarządy). Aplikacja łączy w sobie zaawansowaną analitykę finansową w ujęciu wielo-najemcowym (Multi-Tenant) z bezpiecznym repozytorium dokumentów Virtual Data Room (VDR).

---

## 📌 Kluczowe Funkcjonalności

- **Architektura DDD (Domain-Driven Design) & CQRS**:
    - Wyraźny podział na Bounded Contexts: `Identity`, `Finance`, `DocumentManagement`, `Tenant`.
    - Rozdzielenie ścieżki zapisu (Commands) i odczytu (Queries).
    - Domenowe Value Objects (`Money` z precyzją `bcmath` do 4 miejsc po przecinku, `DateRange`, `FileMetadata`, `CompanyId`, `RoleType`, `Token`, `InvitationId`).
    - Domenowy kalkulator finansowy (`FinancialCalculator`) wyliczający wskaźniki P&L (Gross Profit, OPEX, EBIT, EBITDA, Zysk Netto, marże) oraz bilansu i płynności (Current Ratio, Quick Ratio).
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
    - Układ formalnego memorandumu transakcyjnego: karta wyników KPI, pełny rachunek zysków i strat (P&L), analiza płynności i kapitału obrotowego, struktura OPEX.
    - Cyfrowy certyfikat integralności danych ze skrótem kryptograficznym SHA-256 oraz blokiem podpisów partnerskich.
    - Zoptymalizowany wektorowy druk A4 w standardzie `@media print` (czysta biel, wysoki kontrast, brak elementów nawigacji).
- **Frontend SPA w Stylu Terminala Deal Advisory (Bloomberg / FactSet)**:
    - Estetyka o wysokim kontraście (Zinc 950/900), inżynieryjne krawędzie, brak sztucznych ozdobników AI.
    - Liczby tabelaryczne (`tabular-nums`, `font-mono`) dla kwot, marż i dat.
    - Pasek kontekstu transakcyjnego z selektorem waluty przeliczeniowej w locie (PLN, EUR, USD, GBP), statusem poufności oraz zakresem dat.
    - Interaktywne wykresy Recharts (trendy P&L, struktura kosztów OPEX, wskaźniki płynności z benchmarkami branżowymi).
    - Pełny moduł księgi operacji (General Ledger) z filtrami i paginacją serwerową.
    - Widok importu CSV z podglądem walidacji dry-run i animowanym monitorem kolejki Redis.
    - Moduł VDR oraz globalny rejestr ścieżki audytowej (Audit Trail).
    - Zestaw 57 testów jednostkowych i integracyjnych Vitest (formatery, silnik walutowy, formularze, blokady Dry-Run, eksplorator VDR, raporty PDF, E2E workflow).
- **Monitoring Produkcyjny, Bezpieczeństwo Nginx i Automatyzacja Wdrożenia**:
    - Dedykowany endpoint `/api/v1/health` badający stan bazy PostgreSQL, klastra Redis, uprawnień magazynu plików oraz zużycia zasobów.
    - Reguły kompresji Gzip i instytucjonalne nagłówki bezpieczeństwa Nginx (`SAMEORIGIN`, `nosniff`, `strict-origin-when-cross-origin`).
    - Skrypt bezprzerwowego wdrożenia produkcyjnego `./scripts/deploy.sh` oraz automatycznych kopii zapasowych `./scripts/backup.sh`.
    - Kompletny przewodnik wdrożeniowy i Runbook w [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 🏗️ Architektura Systemu

Platforma została zaprojektowana zgodnie z pryncypiami **Domain-Driven Design (DDD)**, **CQRS (Command Query Responsibility Segregation)** oraz **Clean/Hexagonal Architecture** na backendzie, połączonymi z modułową architekturą **SPA React 18** na frontendzie:

### Backend (Laravel 11 / PHP 8.2 / DDD / CQRS)
```
app/
├── Contexts/
│   ├── Identity/                 # Bounded Context: Zarządzanie tożsamością i uprawnieniami
│   │   ├── Domain/               # User Aggregate Root, Invitation Entity, Role Entity, Value Objects (UserId, Email, HashedPassword, RoleType, Token, InvitationId), Domain Events
│   │   ├── Application/          # Use cases (InviteUserUseCase, AcceptInvitationUseCase), Commands (InviteUserCommand, AcceptInvitationCommand), Exceptions, Repositories interfaces
│   │   └── Infrastructure/       # EloquentUserRepository, EloquentInvitationRepository, Mailables (UserInvitationMail), Listeners (SendInvitationEmailListener), Sanctum Provider
│   │
│   ├── Tenant/                   # Bounded Context: Zarządzanie firmami i relacjami doradców
│   │   ├── Domain/               # CompanyAdvisorAssignment Entity, CompanyId VO, Domain Events, Repository Interfaces
│   │   ├── Application/          # Use cases przypisań i odwołań (AssignAdvisorToCompanyUseCase, RevokeAdvisorFromCompanyUseCase), wyjątki domenowe
│   │   └── Infrastructure/       # EloquentCompanyAdvisorRepository, EloquentCompanyRepository, TenantServiceProvider
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
├── Models/                       # Modele Eloquent (User, Company, FinancialRecord, FinancialCategory, Document, DocumentAccessLog, CsvImport, Invitation)
├── Presentation/                 # Warstwa Prezentacji i Komunikacji API
│   └── Api/
│       ├── Controllers/          # Kontrolery REST API (Auth, FinancialRecord, FinancialCategory, FinancialImport, FinancialAnalytics, Document, Health)
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
│   ├── dataroom/                 # DataRoomStats, DocumentTable, DocumentUploadModal, DocumentEditModal, DocumentAuditModal, DeleteDocumentModal
│   ├── finance/                  # FinancialRecordModal (kreator/edycja wpisu księgi), DeleteRecordConfirmationModal
│   ├── import/                   # CsvDropzone (strefa drag & drop), CsvPreviewTable (dry-run), ImportJobProgress (polling Redis), ImportHistoryTable
│   ├── layout/                   # DealContextBar (waluta, poufność, okres), Header, Sidebar, Layout
│   ├── reports/                  # ReportConfigurator (parametryzacja, waluty, okresy), ExecutivePdfReport (układ memorandumu A4, SHA-256)
│   └── ui/                       # Badge, Button, Card, MultiplesStrip (wskaźniki EV/EBITDA, P/E), FinancialTable
├── context/                      # AuthContext (tożsamość, role, kontekst spółki), DealContext (FX, okres), NotificationContext (toasty)
├── tests/                        # Vitest setup, unit tests (formatters, dealContext) & component integration tests (CsvPreviewTable, FinancialRecordModal, DataRoom, ExecutiveReports, DealAdvisoryE2E)
├── utils/                        # formatters.js (liczby tabelaryczne tabular-nums, waluty PLN/EUR/USD/GBP, formatowanie wskaźników, formatFileSize, formatDateTime)
└── views/                        # DashboardView, RecordsView, ImportView, DataRoomView, AuditLogsView, ReportsView, AnalyticsView, LoginView
```

### Skrypty Wdrożeniowe i Operacyjne
```
scripts/
├── deploy.sh                     # Zautomatyzowany skrypt bezprzerwowego wdrożenia produkcyjnego (zero-downtime)
└── backup.sh                     # Automatyczny zrzut bazy PostgreSQL i archiwizacja plików VDR z rotacją 30 dni
```

---

## 🚀 Środowisko Docker i Uruchomienie

Środowisko developerskie i produkcyjne oparte jest o konteneryzację Docker Compose:
- **`app`**: PHP-FPM 8.2 z rozszerzeniami `bcmath`, `pdo_pgsql`, `redis`, `gd`, `zip`
- **`web` / `nginx`**: Nginx 1.25 z kompresją Gzip i nagłówkami bezpieczeństwa (port `8080` / prod `80`/`443`)
- **`postgres`**: PostgreSQL 16 (port `5432`) z wolumenem danych
- **`redis`**: Redis Alpine jako broker kolejek i cache (port `6379`)
- **`worker`**: Dedykowany kontener wykonujący zadania w tle (`php artisan queue:work --queue=financial-imports,default`)
- **`scheduler`**: Kontener harmonogramu zadań cron (`php artisan schedule:work`)

### Uruchomienie Środowiska Developerskiego

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

# 5. Uruchomienie pełnego zestawu testów
docker compose exec app php artisan test
npm test
```

### Automatyczne Wdrożenie Produkcyjne (Zero-Downtime)

Wdrożenie produkcyjne wraz z optymalizacją pamięci podręcznej i weryfikacją liveness probe:

```bash
./scripts/deploy.sh
```

Szczegółowy przewodnik operacyjny dla inżynierów DevOps i konfiguracja produkcyjna `docker-compose.prod.yml` znajdują się w dokumencie: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 🔑 Dane Dostępowe Środowiska Demo

Baza danych zasilona jest danymi demonstracyjnymi (21 miesięcy historii finansowej od stycznia 2025 do września 2026 oraz repozytorium VDR ze ścieżką audytową):

| Rola | Użytkownik | Email | Hasło | Spółka powiązana |
| :--- | :--- | :--- | :--- | :--- |
| **Admin / Doradca M&A** | Analityk Finansowy (Helvest) | `admin@helvest.com` | `password123` | Helvest Advisory Sp. z o.o. *(Dostęp do wszystkich spółek)* |
| **Klient / CFO** | Jan Kowalski (CFO Acme) | `klient@acme.com` | `password123` | Acme Manufacturing S.A. *(Dostęp wyłącznie do Acme)* |

---

## 📡 Przegląd Endpointów REST API (`/api/v1`)

### Diagnostyka i Monitoring Platformy
- `GET /api/v1/health` – Status zdrowia platformy (PostgreSQL, Redis, Storage disk, pamięć RAM, wersja środowiska)

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
  - [x] Encja `Invitation` i obiekt wartości `Token` z logiką wygasania (Identity).
  - [x] Migracja bazy danych i repozytorium dla zaproszeń.
  - [x] Przypadek użycia `InviteUserUseCase` z emisją zdarzenia domenowego `UserInvited`.
  - [x] Klasy Mailable i listenery zdarzeń do asynchronicznej wysyłki e-maili z zaproszeniami.
  - [x] Przypadek użycia `AcceptInvitationUseCase` z walidacją tokenu i bezpiecznym ustawieniem hasła.
- [ ] **Faza 10: API i Frontend dla Zarządzania Użytkownikami**
  - [ ] Kontroler `InvitationController` mapujący endpointy REST dla zaproszeń.
  - [ ] Kontroler `AdvisorManagementController` dla SuperAdmina do zarządzania doradcami i przypisaniami.
  - [ ] Widok dashboardu SuperAdmina do zarządzania doradcami i przypisaniami spółek.
  - [ ] Modal zapraszania użytkownika z wyborem roli i przypisaniem firm dla doradców.
  - [ ] Bezpieczna strona aktywacji konta / ustawienia hasła na podstawie tokenu z linku e-mail.

---

## 📜 Licencja
Projekt objęty licencją własną dla platformy FinBoard.
