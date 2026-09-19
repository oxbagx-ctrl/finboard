# FinBoard – Financial Analytics & Virtual Data Room Platform

[![PHP Version](https://img.shields.io/badge/php-8.2%2B-blue.svg)](https://www.php.net/)
[![Laravel](https://img.shields.io/badge/laravel-11.x-red.svg)](https://laravel.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-alpine-red.svg)](https://redis.io/)
[![Architecture](https://img.shields.io/badge/architecture-DDD%20%2F%20CQRS-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-324%20backend%20%7C%2099%20frontend%20passed-success.svg)]()

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
    - Układ formalnego memorandumu transakcyjnego: karta wyników KPI, pełny rachunek zysków i strat (P&L), analiza płynności i kapitału obrotowego, struktura OPEX.
    - Cyfrowy certyfikat integralności danych ze skrótem kryptograficznym SHA-256 oraz blokiem podpisów partnerskich.
    - Zoptymalizowany wektorowy druk A4 w standardzie `@media print` (czysta biel, wysoki kontrast, brak elementów nawigacji).
- **Frontend SPA w Stylu Terminala Deal Advisory (Bloomberg / FactSet)**:
    - Estetyka o wysokim kontraście (Zinc 950/900), inżynieryjne krawędzie, brak sztucznych ozdobników AI.
    - Liczby tabelaryczne (`tabular-nums`, `font-mono`) dla kwot, marż i dat.
    - Pasek kontekstu transakcyjnego z selektorem waluty przeliczeniowej w locie (PLN, EUR, USD, GBP), statusem poufności oraz zakresem dat.
    - Interaktywne wykresy Recharts (trendy P&L, struktura kosztów OPEX, wskaźniki płynności z benchmarkami branżowymi).
    - Pełny moduł księgi operacji (General Ledger) z filtrami i paginacją serwerową.
    - Dedykowany moduł analityki finansowej i wskaźników Deal Advisory (`AnalyticsView`) z 4 dynamicznymi trybami analizy (Przegląd Kompleksowy, Rentowność i Marże, Płynność i Wskaźniki, Dekompozycja Przychodów / Kosztów) oraz interaktywnymi wykresami Recharts.
    - Widok importu CSV z podglądem walidacji dry-run i animowanym monitorem kolejki Redis.
    - Moduł VDR oraz globalny rejestr ścieżki audytowej (Audit Trail).
    - Widok zarządzania doradcami i przypisaniami spółek (`AdvisorsManagementView`) wraz z matrycą pokrycia portfela i modalem przypisań (`AdvisorAssignmentModal`).
    - Modal zapraszania nowych użytkowników (`InviteUserModal`) w paradygmacie Zero-Trust z podziałem ról i selekcją firm.
    - Bezpieczna strona aktywacji konta i ustanawiania hasła (`AcceptInvitationView`) weryfikująca token kryptograficzny w URL.
    - Zestaw 99 testów jednostkowych i integracyjnych Vitest (formatery, silnik walutowy, formularze, blokady Dry-Run, eksplorator VDR, raporty PDF, E2E workflow, analityka finansowa i wskaźniki Recharts, zarządzanie doradcami, zaproszenia i aktywacja konta, reaktywne dodawanie spółek).
- **Monitoring Produkcyjny, Bezpieczeństwo Nginx i Automatyzacja Wdrożenia**:
    - Dedykowany endpoint `/api/v1/health` badający stan bazy PostgreSQL, klastra Redis, uprawnień magazynu plików oraz zużycia zasobów.
    - Automatyczne konteneryzowane skrypty backupu (`scripts/backup.sh`) z rotacją 30 dni oraz zero-downtime deployment (`scripts/deploy.sh`).
    - Konfiguracja Nginx z certyfikatami SSL/TLS, nagłówkami bezpieczeństwa HSTS, Content-Security-Policy oraz blokadami exploitów.

---

## 🏗️ Architektura Systemu i Bounded Contexts

Platforma została zaprojektowana w oparciu o pryncypia Domain-Driven Design (DDD):

```
app/
├── Contexts/
│   ├── Identity/               # Bounded Context: Tożsamość, Konta, RBAC i Zaproszenia
│   │   ├── Domain/             # Agregaty (User, Invitation), Value Objects (Role, Token), Eventy
│   │   ├── Application/        # Use Cases (InviteUser, AcceptInvitation), DTOs, Listeners
│   │   └── Infrastructure/     # Repozytoria Eloquent, Hashers, Providers
│   ├── Finance/                # Bounded Context: Księgowość, Dynamiczne KPI, Importy, Benchmarki, Logi Audytowe
│   │   ├── Domain/             # Agregaty (FinancialRecord, FinancialBenchmark, FinancialAuditLog), Value Objects
│   │   │                       # Serwis domenowy FinancialCalculator, kalkulacje P&L i wskaźników płynności
│   │   ├── Application/        # Commands/Queries, KpiCalculationService (dynamika YoY/MoM), KpiEvaluationService (flagi OPT/WARN/CRIT), CsvFinancialDataParser, Jobs
│   │   └── Infrastructure/     # Repozytoria Eloquent (FinancialRecord, FinancialBenchmark, FinancialAuditLog), Providers
│   ├── DocumentManagement/     # Bounded Context: Virtual Data Room (VDR)
│   │   ├── Domain/             # Agregat Document, Logi audytowe, Value Objects (FileMetadata, Checksum)
│   │   ├── Application/        # DTOs, Handlers, Zarządzanie wersjami i audytem
│   │   └── Infrastructure/     # Dyskowe repozytorium szyfrowane, adaptery Storage
│   └── Tenant/                 # Bounded Context: Multi-Tenancy & Portfolio Assignments
│       ├── Domain/             # Agregat CompanyAdvisorAssignment, repozytoria powiązań
│       ├── Application/        # Use Cases przypisywania doradców (AssignAdvisor, RevokeAdvisor)
│       └── Infrastructure/     # EloquentCompanyAdvisorRepository
├── Models/                     # Modele Eloquent (User, Company, FinancialRecord, FinancialBenchmark, FinancialAuditLog, Document, etc.)
└── Presentation/
    └── Api/Controllers/        # Kontrolery REST API (Auth, Kpi, Benchmark, FinancialRecords, Analytics, VDR, Invitations, Advisors)
```

---

## 🛠️ Struktura Katalogów i Modułów

```
finboard/
├── app/
│   ├── Contexts/               # Domenowe Bounded Contexts (Identity, Finance, DocumentManagement, Tenant)
│   ├── Models/                 # Modele bazodanowe Eloquent
│   ├── Http/Middleware/        # Middleware autoryzacji Sanctum, RBAC, TenantContext
│   └── Presentation/Api/       # Kontrolery API pogrupowane domenowo
├── resources/
│   └── js/
│       ├── components/         # Komponenty UI (FinancialOverview, GeneralLedger, DataRoom, AnalyticsView, etc.)
│       ├── context/            # DealContext (stan sesji, waluta bazowa, okres raportowy, tenant)
│       └── tests/              # Testy jednostkowe i integracyjne Vitest
├── routes/
│   └── api.php                 # Definicje tras REST API (/api/v1/...)
├── database/
│   ├── migrations/             # Migracje schematu PostgreSQL
│   └── seeders/                # Idempotentne seedery danych demo (Acme & Helvest)
├── docker/                     # Konfiguracje Dockerfile, Nginx, PHP, php.ini
├── changelog/                  # Historia commitów i ewolucji architektury projektu
├── scripts/
│   ├── deploy.sh               # Skrypt bezprzerwowego wdrożenia produkcyjnego (zero-downtime)
│   └── backup.sh               # Automatyczny zrzut bazy PostgreSQL i archiwizacja plików VDR z rotacją 30 dni
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
- **`mailpit`**: Serwer SMTP oraz webowy interfejs inspekcji e-maili (Mailcatcher) w środowisku dev (port SMTP `1025`, web dashboard: [http://localhost:8025](http://localhost:8025))

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

Baza danych zasilona jest danymi demonstracyjnymi (21 miesięcy historii finansowej od stycznia 2025 do września 2026, relacje wielo-najemcowe oraz repozytorium VDR ze ścieżką audytową):

| Rola w Systemie | Użytkownik | Email | Hasło | Zakres Dostępu i Spółka Powiązana |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Partner Zarządzający (Helvest) | `superadmin@helvest.com` | `password123` | Helvest Advisory Sp. z o.o. *(Dostęp globalny: zarządzanie doradcami, przypisywanie spółek, zapraszanie użytkowników)* |
| **Doradca M&A** | Doradca Transakcyjny (Helvest) | `advisor@helvest.com` | `password123` | Helvest Advisory Sp. z o.o. *(Dostęp do przypisanych spółek portfela: Acme Manufacturing S.A., zapraszanie klientów)* |
| **Analityk (Admin)** | Analityk Finansowy (Helvest) | `admin@helvest.com` | `password123` | Helvest Advisory Sp. z o.o. *(Pełny wgląd analityczny i finansowy do całego portfela)* |
| **Klient / CFO** | Jan Kowalski (CFO Acme) | `klient@acme.com` | `password123` | Acme Manufacturing S.A. *(Ścisła izolacja multi-tenant: dostęp wyłącznie do Acme)* |

### Narzędzia Deweloperskie i Podgląd E-maili
- **Mailpit Web Dashboard**: [http://localhost:8025](http://localhost:8025)
  - Przechwytuje wszystkie wiadomości wychodzące (zaproszenia `UserInvitationMail`, powiadomienia, linki aktywacyjne) w środowisku lokalnym.
  - Port SMTP dla usług aplikacji: `1025` (host: `mailpit`).

---

## 📡 Przegląd Endpointów REST API (`/api/v1`)

### Diagnostyka i Monitoring Platformy
- `GET /api/v1/health` – Status zdrowia platformy (PostgreSQL, Redis, Storage disk, pamięć RAM, wersja środowiska)

### Autoryzacja i Profil
- `POST /api/v1/auth/login` – Logowanie i generowanie tokenu Sanctum
- `GET /api/v1/auth/me` – Dane zalogowanego użytkownika, uprawnienia i lista dostępnych spółek
- `PUT /api/v1/auth/profile` – Aktualizacja danych profilu oraz zmiana hasła z weryfikacją dotychczasowego
- `POST /api/v1/auth/logout` – Unieważnienie tokenu sesji

### Panel SuperAdmina – Zarządzanie Doradcami i Przypisaniami Spółek
- `GET /api/v1/admin/advisors` – Lista doradców i administratorów z przypisanymi firmami, filtrami i wyszukiwarką
- `GET /api/v1/admin/advisors/{id}` – Szczegóły profilu doradcy i lista powiązanych spółek portfela
- `POST /api/v1/admin/advisors/{id}/companies` – Przypisanie doradcy do jednej lub wielu spółek
- `DELETE /api/v1/admin/advisors/{id}/companies/{companyId}` – Odpięcie doradcy od wskazanej spółki
- `PUT /api/v1/admin/advisors/{id}/companies` – Synchronizacja pełnej listy spółek przypisanych doradcy
- `PATCH /api/v1/admin/advisors/{id}/toggle-status` – Zmiana statusu aktywności konta doradcy (aktywacja/dezaktywacja)
- `GET /api/v1/admin/companies` – Przegląd wszystkich firm w systemie z liczbą doradców i klientów
- `POST /api/v1/admin/companies` – Rejestracja nowej spółki portfelowej wraz z opcjonalnym przypisaniem początkowych doradców

### Zarządzanie Zaproszeniami i Aktywacja Konta (Invitation System)
- `POST /api/v1/invitations` – Utworzenie i wysyłka nowego zaproszenia użytkownika (SuperAdmin, Advisor)
- `GET /api/v1/invitations` – Lista zaproszeń z filtrami statusu i izolacją dla doradców
- `GET /api/v1/invitations/verify?token=...` – Publiczna weryfikacja tokenu zaproszenia przed aktywacją
- `GET /api/v1/invitations/tokens/{token}` – Publiczny odczyt parametrów zaproszenia na podstawie tokenu
- `POST /api/v1/invitations/accept` – Publiczna aktywacja konta, bezpieczne ustawienie hasła i wydanie tokenu Sanctum
- `POST /api/v1/invitations/{id}/resend` – Ponowne przesłanie zaproszenia z nowym 48-godzinnym tokenem
- `DELETE /api/v1/invitations/{id}` – Anulowanie i unieważnienie oczekującego zaproszenia

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

### Finanse – Benchmarki i Cele Finansowe (Industry Standards & Targets)
- `GET /api/v1/finance/benchmarks` – Lista 8 wskaźników benchmarkowych firmy (konfigurowane lub domyślne)
- `GET /api/v1/finance/benchmarks/{metricType}` – Szczegóły progów pojedynczego wskaźnika
- `PUT /api/v1/finance/benchmarks/{metricType}` – Aktualizacja progów wskaźnika przez doradcę/administratora
- `PUT /api/v1/finance/benchmarks` – Masowa aktualizacja celów finansowych spółki (batch update)
- `POST /api/v1/finance/benchmarks/reset` – Reset progów wskaźników do rynkowych standardów domyślnych

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
  - Refaktoryzacja wizualna: stylistyka terminala instytucjonalnego Deal Advisory (wysoki kontrast Zinc/Slate, precyzyjne kąty inżynieryjne, statusy bezpieczeństwa).
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
  - [x] Encja `FinancialBenchmark`, enumy `BenchmarkStatus`, `BenchmarkMetricType` oraz reguły ewaluacji statusów KPI.
  - [x] Migracja bazy danych, model Eloquent i repozytorium dla benchmarków spółek.
  - [x] Serwis ewaluacji wskaźników z dynamicznym wyliczaniem flag statusów (OPT, WARN, CRIT).
  - [x] Endpointy REST API do pobierania i konfiguracji benchmarków dla doradców.
  - [x] Testy jednostkowe i integracyjne modułu benchmarków oraz weryfikacja uprawnień.
- [ ] **Faza 14: Logi Audytowe i Dynamiczny Frontend (Finance & Deal Advisory)**
  - [x] Encja `FinancialAuditLog`, migracja bazy danych i repozytorium dla operacji finansowych i konfiguracji celów.
  - [ ] Rejestracja listenerów zdarzeń domenowych utrwalających wpisy w dzienniku audytowym.
  - [ ] Endpointy REST API do pobierania logów audytowych przypisanych do spółki.
  - [ ] Zastąpienie statycznych wartości na Pulpicie Zarządczym i w Analityce P&L dynamicznymi danymi z API.
  - [ ] Interfejs edycji celów finansowych dla Doradcy z dynamicznymi wskaźnikami statusów i semaforami (OPT, WARN, CRIT).

---

## 📜 Licencja
Projekt objęty licencją własną dla platformy FinBoard.
