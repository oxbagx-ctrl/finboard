# FinBoard – Financial Analytics & Virtual Data Room Platform

[![PHP Version](https://img.shields.io/badge/php-8.2%2B-blue.svg)](https://www.php.net/)
[![Laravel](https://img.shields.io/badge/laravel-11.x-red.svg)](https://laravel.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-alpine-red.svg)](https://redis.io/)
[![Architecture](https://img.shields.io/badge/architecture-DDD%20%2F%20CQRS-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-426%20backend%20%7C%20224%20frontend%20passed-success.svg)]()

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
- **Nowoczesny Interfejs Użytkownika (SPA) & Architektura Routingu URL**:
    - Reaktywny frontend zbudowany w oparciu o React 19, bibliotekę nawigacyjną `react-router-dom` (v7), Tailwind CSS i bibliotekę wykresów Recharts.
    - Pełna obsługa historii przeglądarki, przyjaznych adresów URL, głębokiego linkowania (deep linking) oraz eliminacja anomalii zamrożonego adresu URL.
    - Architektura układu oparta na zagnieżdżonym gnieździe `<Outlet />` z dynamiczną rezolucją nagłówka i kontekstu odświeżania (`AppLayout`, `Header`).
    - Hierarchia strażników tras z kontrolą uprawnień RBAC (`ProtectedRoute`, `GuestRoute`, `RoleGuard`) oraz dedykowany widok błędu 404 Not Found (`NotFoundView`) w stylistyce dark terminal.
    - Estetyka profesjonalnego terminala transakcyjnego Deal Advisory (Dark Theme, akcenty szmaragdowe/bursztynowe, typografia `font-mono` / `tabular-nums`).
    - Dedykowane widoki: Dashboard ze wskaźnikami KPI, Analityka P&L i Płynności, Księga Główna Transakcji, Wirtualny Pokój Danych (VDR), Raporty Wykonawcze PDF oraz Zarządzanie Doradcami i Klientami.
    - Zastąpienie statycznych wartości na Pulpicie Zarządczym (`DashboardView`) i w Analityce (`AnalyticsView`) dynamicznymi danymi z API w czasie rzeczywistym z kalkulacją dynamiki okresowej (YoY/MoM), ewaluacją benchmarków doradcy i semaforami statusu (`OPT`, `WARN`, `CRIT`).
    - Interfejs edycji celów finansowych i benchmarków M&A dla Doradców z reaktywną ewaluacją statusów w czasie rzeczywistym (`BenchmarkConfigModal` oraz dedykowana matryca w `AnalyticsView`).
    - Standaryzowane tabele Rachunku Zysków i Strat (`FinancialTable`) zgodne ze standardami sprawozdawczości finansowej (PSR / MSR), ze ścisłą hierarchią pozycji, wcięciami, wskaźnikami dedukcji kosztów `(-)` oraz podwójną linią bilansową dla ostatecznego wyniku netto.
- **Księga Operacji Finansowych (General Ledger) i Kontrakt Danych `RecordType`**:
    - Ścisłe typowanie transakcji w oparciu o domenowy enum `RecordType` (`revenue`, `expense`, `asset`, `liability`) ze wsparciem dla wstecznej kompatybilności i aliasu `income`.
    - Normalizacja zapytań `record_type` w backendzie (`FinancialRecordController`) w trybie case-insensitive z eliminacją niepoprawnych wartości.
    - Szybkie kafelki analityczne widoku ("Przychody (Strona)", "Koszty OPEX (Strona)", "Saldo Operacji (Netto)") z separacją pozycji bilansowych od operacyjnych.
    - Pływający pasek akcji masowych `BatchActionBar` z selekcją wielostronicową, agregacją kwot i bezpiecznym resetem stanu przy zmianie filtrów.
    - Eksport zestawienia do formatu CSV z zachowaniem kanonicznych nagłówków (`ID,Data,Kategoria,Typ,Kwota,Waluta,Opis,Zrodlo`) i znormalizowanych kodów typów operacji.

---

## 🛠️ Architektura Technologiczna

- **Backend**: PHP 8.2+, Laravel 11, Doctrine DBAL, spatie/laravel-data.
- **Baza Danych i Cache**: PostgreSQL 16, Redis Alpine.
- **Kolejki i Współbieżność**: Laravel Horizon / Redis Queue Workers.
- **Frontend**: React 19, React Router (v7), Tailwind CSS, Lucide Icons, Recharts, Axios, Vitest, React Testing Library.
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
# Opcjonalnie: ponowne zasilenie samego projektu inwestycyjnego demonstracyjnego
# docker compose exec app php artisan db:seed --class=InvestmentProjectSeeder
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
Pakiet ponad 600 testów jednostkowych i integracyjnych pokrywających warstwę domenową (DDD), zapytania CQRS, repozytoria, kalkulacje matematyczne `Money`, importy CSV, autoryzację wielonajemcową, system zaproszeń, odporność kolejek pocztowych, logi audytowe oraz API benchmarków i analityki:
```bash
docker compose exec app ./vendor/bin/phpunit
```

### Testy Frontendowe (Vitest)
Pakiet ponad 600 testów jednostkowych i integracyjnych dla komponentów React, kontekstu transakcyjnego, walidacji danych, kalkulatorów walutowych, konfiguratora celów benchmarkowych, księgi operacji, diagnostyki poczty oraz przepływów integracyjnych E2E:
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
- `GET /api/v1/invitations/tokens/{token}` / `GET /api/v1/invitations/verify` – Publiczna weryfikacja ważności tokenu zaproszenia
- `POST /api/v1/invitations/{id}/resend` – Regeneracja tokenu zaproszenia z nowym 48-godzinnym okresem ważności
- `POST /api/v1/invitations/accept` – Aktywacja konta i nadanie hasła z tokena zaproszenia
- `POST /api/v1/companies` – Utworzenie nowej spółki portfelowej i powiązanie z doradcą

### Diagnostyka Poczty & SMTP (SuperAdmin & Admin)
- `GET /api/v1/admin/mail/status` – Stan konfiguracji serwera pocztowego, szyfrowania i weryfikacja gniazda TCP
- `POST /api/v1/admin/mail/test` – Wysłanie diagnostycznej wiadomości e-mail w ciemnym motywie FinBoard z kalkulacją latencji

### Transakcje Finansowe & Import (Finance Context)
- `GET /api/v1/finance/records` – Paginowana lista transakcji z filtrami (`search`, `category_id`, `start_date`, `end_date`, `record_type` z obsługą kanonicznych kodów `revenue`, `expense`, `asset`, `liability`, case-insensitivity oraz aliasu `income`)
- `POST /api/v1/finance/records` – Rejestracja nowego rekordu (Przychód, Koszt, Aktywa, Pasywa) z walidacją enumu `RecordType`
- `PUT /api/v1/finance/records/{id}` – Aktualizacja istniejącego wpisu finansowego z walidacją `RecordType`
- `DELETE /api/v1/finance/records/{id}` – Usunięcie pojedynczego rekordu finansowego z wpisem audytowym
- `DELETE /api/v1/finance/records/batch` – Bezpieczne masowe usunięcie paczki rekordów (do 500 wpisów) z atomowością transakcyjną, audytem i zdarzeniem `FinancialRecordsBatchDeleted`
- `POST /api/v1/finance/import/csv` – Asynchroniczny upload pliku CSV z transakcjami (kolejkowany w Redis)
- `POST /api/v1/finance/import/preview` – Walidacja pliku i podgląd dry-run pierwszych wierszy

### Cele Finansowe & Benchmarki Branżowe (Finance Context)
- `GET /api/v1/finance/benchmarks` – Pobranie celów benchmarkowych spółki z ewaluacją bieżącą
- `PUT /api/v1/finance/benchmarks` – Zbiorcza konfiguracja celów docelowych i progów przez Doradcę
- `PUT /api/v1/finance/benchmarks/{metricType}` – Aktualizacja pojedynczego celu wskaźnikowego
- `POST /api/v1/finance/benchmarks/reset` – Przywrócenie domyślnych standardów rynkowych spółki

### Ścieżka Audytowa (Audit Trail)
- `GET /api/v1/finance/audit-logs` – Rejestr zdarzeń audytowych z filtrami (`action`, `entity_type`, `user_id`, `search`, `from_date`, `to_date`, `page`, `per_page`)
- `GET /api/v1/finance/audit-logs/stats` – Zagregowane metryki KPI audytu (łączna liczba, usunięcia pojedyncze i masowe, rozbicie po akcjach)
- `GET /api/v1/finance/audit-logs/{id}` – Szczegóły pojedynczego wpisu audytowego ze zrzutami `old_values` i `new_values`

### Analityka Finansowa & KPI (Queries)
- `GET /api/v1/finance/analytics/metrics` – Syntetyczne wskaźniki P&L, bilansowe, dynamika YoY/MoM oraz ewaluacja celów
- `GET /api/v1/finance/analytics/dynamics` – Precyzyjne zapytanie CQRS o dynamikę finansową YoY oraz MoM wraz z wariancjami kwotowymi
- `GET /api/v1/finance/analytics/years` – Pobranie dostępnych lat obrachunkowych z transakcjami dla spółki
- `GET /api/v1/finance/analytics/trends` – Chronologiczne trendy miesięczne dla wykresów P&L (Recharts)
- `GET /api/v1/finance/analytics/breakdown` – Struktura kosztów i przychodów per kategoria z procentami
- `GET /api/v1/finance/analytics/liquidity` – Dynamika wskaźników płynności (Current & Quick Ratio)

### Wirtualny Pokój Danych (Virtual Data Room - VDR)
- `GET /api/v1/documents` – Lista dokumentów firmy z filtrami kategorii, folderu, archiwum i wyszukiwarką
- `POST /api/v1/documents` – Upload nowego dokumentu z wyliczeniem SHA-256, opcjonalnym folderem i indeksem Dewey oraz wpisem audytowym
- `GET /api/v1/documents/{id}` – Metadane pojedynczego dokumentu z informacją o przypisanym folderze transakcyjnym
- `PUT /api/v1/documents/{id}` – Aktualizacja tytułu, kategorii oraz przypisania folderu i indeksu dokumentu
- `GET /api/v1/documents/{id}/download` – Bezpieczne pobranie pliku z inkrementacją licznika, wpisem w dzienniku pobrań oraz dynamicznym znakiem wodnym (jeśli wymagany)
- `GET /api/v1/documents/{id}/preview` – Bezpieczny podgląd pliku PDF bezpośrednio w przeglądarce (`inline`) z automatycznym znakiem wodnym
- `PATCH /api/v1/documents/{id}/archive` – Przełączenie statusu archiwalnego dokumentu
- `DELETE /api/v1/documents/{id}` – Usunięcie pliku z magazynu i bazy danych
- `GET /api/v1/documents/{id}/audit-logs` – Rejestr zdarzeń i pobrań dla wskazanego dokumentu
- `GET /api/v1/documents/audit-logs` – Zbiorczy dziennik audytowy operacji na dokumentach firmy
- `GET /api/v1/documents/folders` – Lista folderów transakcyjnych firmy (płaska lub zagnieżdżone drzewo `?tree=1` z liczbą dokumentów)
- `POST /api/v1/documents/folders` – Tworzenie nowego folderu transakcyjnego z indeksem dziesiętnym Dewey
- `POST /api/v1/documents/folders/init-standard` – Inicjalizacja standardowej taksonomii M&A (33 foldery dla 8 obszarów Due Diligence)
- `GET /api/v1/documents/folders/{id}` – Szczegóły folderu wraz z folderami podrzędnymi i liczbą dokumentów
- `PUT /api/v1/documents/folders/{id}` – Aktualizacja nazwy, opisu, sortowania lub indeksu Dewey folderu
- `DELETE /api/v1/documents/folders/{id}` – Usunięcie folderu (z zachowaniem dokumentów – `ON DELETE SET NULL`)
- `GET /api/v1/documents/permissions/matrix` – Pobranie pełnej matrycy uprawnień VDR dla aktywnej spółki
- `GET /api/v1/documents/permissions/effective` – Wyznaczenie efektywnych uprawnień użytkownika do folderu lub dokumentu
- `POST /api/v1/documents/permissions/folders/{folderId}` – Konfiguracja grantu uprawnienia dla folderu transakcyjnego
- `POST /api/v1/documents/permissions/documents/{documentId}` – Konfiguracja bezpośredniego nadpisania uprawnień dla dokumentu
- `DELETE /api/v1/documents/permissions/{type}/{id}` – Odwołanie uprawnienia dla wskazanego folderu lub dokumentu

### Planowanie Inwestycyjne & Wycena DCF (Deal Advisory & Project Finance)
- `GET /api/v1/investment-projects` – Lista projektów inwestycyjnych przypisanych do aktywnej spółki
- `POST /api/v1/investment-projects` – Inicjalizacja nowego projektu inwestycyjnego (budżet, waluta, daty, horyzont)
- `GET /api/v1/investment-projects/{id}` – Pobranie szczegółów projektu wraz ze strukturą montażu finansowego, etapami CAPEX i instrumentami dłużnymi
- `PUT /api/v1/investment-projects/{id}` – Aktualizacja parametrów makro, założeń operacyjnych, mnożników wyceny i stóp WACC
- `DELETE /api/v1/investment-projects/{id}` – Bezpieczne usunięcie projektu i powiązanych harmonogramów długu
- `POST /api/v1/investment-projects/{projectId}/capex-stages` – Utworzenie etapu CAPEX z kodem KŚT i roczną stawką amortyzacji
- `PUT /api/v1/investment-projects/{projectId}/capex-stages/{stageId}` – Edycja parametrów nakładu i czasu trwania etapu
- `DELETE /api/v1/investment-projects/{projectId}/capex-stages/{stageId}` – Usunięcie pojedynczego etapu inwestycyjnego
- `GET /api/v1/investment-projects/{id}/statements/three-statement` – Kompletny 15-letni model 3-Statement (RZiS, Bilans Zero-Variance, Cash Flow) w ujęciu rocznym lub miesięcznym
- `GET /api/v1/investment-projects/{id}/statements/income-statement` – Projekcja Rachunku Zysków i Strat z marżami EBITDA, EBIT, EBT i zyskiem netto
- `GET /api/v1/investment-projects/{id}/statements/balance-sheet` – Projekcja Bilansu z zachowaniem tożsamości Aktywa = Pasywa
- `GET /api/v1/investment-projects/{id}/statements/cash-flow` – Zestawienie Przepływów Pieniężnych (OCF, ICF, FCF) i salda gotówki
- `GET /api/v1/investment-projects/{id}/statements/depreciation` – Harmonogram amortyzacji środków trwałych w podziale na grupy KŚT
- `GET /api/v1/investment-projects/{id}/appraisal` – Wycena DCF, kalkulacja dynamicznego WACC, FCFF, FCFE, NPV, Project/Equity IRR i Payback Period
- `POST /api/v1/investment-projects/{id}/waterfall` – Rozliczenie kaskady podziału wpływów (Pari Passu vs 2-Tier Hurdle z Carried Interest)

---

## ✉️ Konfiguracja Poczty i Diagnostyka SMTP w Środowisku Produkcyjnym

Platforma FinBoard posiada zintegrowany, wysoce odporny podsystem pocztowy dedykowany dla powiadomień transakcyjnych oraz dystrybucji zaproszeń użytkowników do portfela Deal Advisory.

### 🛡️ Restrykcje Portu 25 w Chmurze (OCI / AWS / GCP / Azure)
> [!WARNING]
> Dostawcy chmury publicznej (w szczególności **Oracle Cloud Infrastructure - OCI**, **AWS**, **GCP**) bezwzględnie blokują wychodzący ruch TCP na porcie 25 w celu przeciwdziałania rozsyłaniu spamu.
> Użycie portu 25 w środowisku chmurowym skutkuje błędem `Connection timed out (errno 110)` lub `Unable to connect to tcp://...:25`.

**Wymagane porty i protokoły szyfrowania (MSA - Mail Submission Agent):**
- **Port 587 (STARTTLS / TLS) – Rekomendowany**: Standard RFC 6409. Sesja rozpoczyna się w trybie jawnym, po czym następuje podniesienie do szyfrowanego TLS.
- **Port 465 (SMTPS / SSL) – Alternatywny**: Standard RFC 8314. Sesja TLS/SSL jest negocjowana natychmiast po zestawieniu gniazda TCP.

### ⚙️ Wzorcowa Konfiguracja Środowiska Produkcyjnego (`.env`)
```dotenv
MAIL_MAILER=smtp
MAIL_HOST=mail.helvest.pl
MAIL_PORT=587
MAIL_USERNAME=powiadomienia@helvest.pl
MAIL_PASSWORD=Silne_Haslo_SMTP_Deal_Advisory_2026!
MAIL_ENCRYPTION=tls
MAIL_TIMEOUT=15
MAIL_FROM_ADDRESS="powiadomienia@helvest.pl"
MAIL_FROM_NAME="FinBoard Deal Advisory"
```

### ⚡ Odporność Kolejki Zadań (Queue Worker & Retry Policy)
Wysyłka wiadomości e-mail jest w pełni asynchroniczna (`ShouldQueue` w `SendInvitationEmailListener`). W przypadku chwilowych zakłóceń sieciowych lub obciążenia serwera SMTP system stosuje politykę wykładniczego wycofywania (Exponential Backoff):
- **Limit prób:** 3 próby dostarczenia (`$tries = 3`, `$maxExceptions = 3`).
- **Timeout wykonania:** 30 sekund na próbę (`$timeout = 30`).
- **Harmonogram opóźnień:** Próba 1 -> 10s opóźnienia (`release(10)`), Próba 2 -> 60s opóźnienia (`release(60)`), Próba 3 -> trwałe niepowodzenie.
- **Dziennik audytowy i logi:** W przypadku ostatecznego niepowodzenia generowane jest zdarzenie audytowe `user_invitation_mail_failed` z pełnym kontekstem technicznym (ID zaproszenia, odbiorca, host, port, treść błędu).
- **Polecenie uruchomienia workera produkcyjnego:**
  ```bash
  php artisan queue:work --queue=default --tries=3 --timeout=35 --sleep=3 --backoff=10,60,180
  ```

### 🔗 Awaryjna Ścieżka Aktywacji (Fallback Activation Flow)
W sytuacji niedostępności skrzynki pocztowej odbiorcy lub awarii serwera SMTP, administratorzy i doradcy FinBoard mogą przekazać unikalny link aktywacyjny bezpośrednio:
1. **Modal po utworzeniu zaproszenia:** Natychmiast po wysłaniu formularza w `InviteUserModal` pojawia się okno z bezpośrednim linkiem (`activation_url`) i przyciskiem kopiowania.
2. **Kopiowanie z tabeli zaproszeń:** W widoku `AdvisorsManagementView` każdy wiersz oczekującego zaproszenia posiada przycisk *Kopiuj link aktywacyjny*.
3. **Regeneracja tokenu:** Przycisk *Wyślij ponownie* generuje świeży kryptograficzny token ważny przez kolejne 48 godzin.
4. **Bezpośrednia aktywacja:** Odbiorca otwiera link w przeglądarce, przechodząc do dedykowanego widoku `AcceptInvitationView` w modelu Zero-Trust (weryfikacja tokenu, nadanie hasła, automatyczne logowanie).

### 🩺 Narzędzia Diagnostyczne i Rozwiązywanie Problemów (Troubleshooting)
1. **Weryfikacja CLI (z poziomu kontenera produkcyjnego):**
   ```bash
   # Pełny test handshake'u i wysyłka diagnostycznego maila
   php artisan mail:test admin@helvest.pl

   # Szybka weryfikacja otwarcia gniazda TCP (bez wysyłki)
   php artisan mail:test admin@helvest.pl --check-socket --skip-send

   # Diagnostyka z niestandardowym limitem czasu
   php artisan mail:test admin@helvest.pl --timeout=10
   ```
2. **Diagnostyka w Panelu FinBoard (UI):**
   - Dostępna w widoku `Zarządzanie Doradcami & Uprawnieniami Portfela` w zakładce **Diagnostyka SMTP**.
   - Widżet `SmtpStatusWidget` w czasie rzeczywistym prezentuje status gniazda, host, port, szyfrowanie oraz latencję handshake'u w milisekundach.
   - Przycisk **Testuj SMTP** otwiera modal umożliwiający natychmiastową wysyłkę testowego e-maila w motywie Deal Advisory.

---

## 🏛️ Moduł Deal Advisory, Project Finance & Investment Valuation

Moduł **Deal Advisory, Project Finance & Investment Valuation** (Fazy 38–45) to instytucjonalnej klasy podsystem analityczny i silnik modelowania wieloletnich projektów kapitałowych platformy FinBoard, dedykowany dla funduszy Private Equity, bankowości inwestycyjnej, doradców M&A oraz komitetów kredytowych.

### 📐 Architektura Domenowa i Silnik Obliczeniowy
- **Backend (PHP 8.2 / Laravel 11 / PostgreSQL)**:
  - Architektura Domain-Driven Design (DDD) i CQRS ze ścisłą separacją warstw *Domain*, *Application* i *Infrastructure*.
  - Agregat `InvestmentProject` zarządzający encjami: `CapexStage`, `FinancingStructure`, `DebtFacility`, `GrantAllocation`.
  - Serwisy domenowe: `DebtAmortizationService`, `VatBridgeLoanService`, `GrantAllocationService`, `DepreciationScheduleService`, `IncomeStatementService`, `BalanceSheetService`, `CashFlowService`, `LiquidityBalancingService`, `WaccCalculatorService`, `InvestmentAppraisalService`, `EquityWaterfallSolverService`.
- **Frontend & Web Worker (React 19 / TypeScript)**:
  - Dedykowany proces roboczy w tle [`investmentCalculationWorker.ts`](resources/js/workers/investmentCalculationWorker.ts) realizujący 15-letnie symulacje w ujęciu miesięcznym (180 okresów) w czasie poniżej 1 ms, eliminując blokowanie głównego wątku przeglądarki.
  - Klient singleton [`InvestmentWorkerClient.js`](resources/js/workers/InvestmentWorkerClient.js) zarządzający asynchroniczną kolejką zapytań i memoizacją wyników.

### 📊 15-letni Model 3-Statement & Rygor Bilansowy (Zero Variance)
- **Rachunek Zysków i Strat (P&L)**:
  - Dynamika przychodów z krzywą rozruchu technologicznego (Ramp-up mocy).
  - Klasyfikacja kosztów na zmienne (surowce, media, prowizje), koszty stałe oraz koszty wynagrodzeń z indeksacją płac.
  - Odpisy amortyzacyjne powiązane z ewidencją Klasyfikacji Środków Trwałych (KŚT).
  - Obsługa tarczy podatkowej CIT (19%) oraz rozliczania strat podatkowych z lat ubiegłych (Tax Loss Carry-Forward do 50% rocznie).
- **Bilans (Balance Sheet)**:
  - Rygorystyczna tożsamość podwójnego zapisu **Zero-Variance**:
    $$\text{Aktywa Trwałe (Net PPE)} + \text{Aktywa Obrotowe} = \text{Kapitał Własny} + \text{Dług Bankowy} + \text{Zobowiązania Bieżące}$$
  - Zero-Variance utrzymywane automatycznie we wszystkich 15 latach prognozy z marginesem błędu $\Delta < 1,00\text{ PLN}$.
- **Rachunek Przepływów Pieniężnych (Cash Flow)**:
  - Metoda pośrednia uzgadniająca zysk netto z EBITDA, podatkiem CIT oraz zmianami kapitału obrotowego netto ($\Delta\text{NWC}$ bazujące na wskaźnikach rotacji DSO, DPO, DIO).
  - Ciągłość gotówkowa: $\text{Cash}_t = \text{Cash}_{t-1} + \text{Net Cash Flow}_t$.

### 🏦 Standard Bankowości Inwestycyjnej & Kowenanty LMA
- **Audyt Bankowalności (LMA Standard)**:
  - $\text{DSCR} = \frac{\text{CFADS}}{\text{Debt Service}} \ge 1,20\text{x}$ (wskaźnik pokrycia obsługi długu).
  - $\text{ICR} = \frac{\text{EBITDA}}{\text{Interest}} \ge 2,50\text{x}$ (wskaźnik pokrycia odsetek).
  - $\text{Leverage} = \frac{\text{Net Debt}}{\text{EBITDA}} \le 3,50\text{x}$ (dźwignia finansowa długu netto).
  - $\text{Current Ratio} \ge 1,10\text{x}$ (wskaźnik płynności bieżącej).
  - $\text{DSRF} \ge 6\text{ miesięcy}$ (rezerwa obsługi długu Debt Service Reserve Facility).
- Komponent [`BankingCovenantsStrip`](resources/js/components/investments/BankingCovenantsStrip.jsx) w czasie rzeczywistym ostrzega o ryzyku naruszenia progów ostrożnościowych i identyfikuje rok krytyczny (Pinch Year).

### 📈 Wycena Inwestycji DCF & Kaskada Wyjścia (Equity Waterfall)
- **Dynamiczny WACC & DCF**:
  - Model CAPM z lewarowaną betą, stopą wolną od ryzyka i premią rynkową ERP.
  - Dyskontowanie wolnych przepływów pieniężnych FCFF (dla firmy) i FCFE (dla właścicieli).
  - Kalkulacja wartości rezydualnej Terminal Value (model renty wieczystej Gordona-Shapiro).
- **Nakładka Wyceny Wyjścia ([`ExitValuationOverlay`](resources/js/components/investments/ExitValuationOverlay.jsx))**:
  - Mostek Enterprise Value do Equity Value przy horyzoncie wyjścia w latach 3–10.
  - Wycena z perspektywy kupującego (Buyer EBITDA Yield, FCFF Yield, FCFE Yield i spread ponad WACC).
  - Dwuwymiarowa macierz wrażliwości 5x5 (lata wyjścia $\times$ mnożniki EV/EBITDA).
- **Kaskada Przepływów Kapitałowych ([`ExitWaterfallVisualizer`](resources/js/components/investments/ExitWaterfallVisualizer.jsx))**:
  - Modelowanie podziału wpływów ze sprzedaży i dywidend: *Pari Passu* (pro-rata) oraz *Two-Tier Hurdle* (Hurdle Rate 8% + Carried Interest 80% GP / 20% LP).
  - Wyliczanie wielokrotności zainwestowanego kapitału (MoIC) oraz wewnętrznej stopy zwrotu (Equity IRR) dla każdego z partnerów.

### 📋 Diagnostyka Organizacyjna, Raporty Definiowane & Dossier PDF
- **Karta Gotowości Inwestycyjnej ([`InvestmentReadinessScorecard`](resources/js/components/investments/InvestmentReadinessScorecard.jsx))**:
  - 100-punktowa ocena dojrzałości projektu podzielona na 4 filary: Gotowość Formalno-Prawna, Techniczno-Operacyjna, Rynkowa (Offtake/PPA) oraz Finansowa (Bankowalność LMA).
  - Audyt warunków zawieszających (Conditions Precedent) wymaganych przed uruchomieniem finansowania (Financial Close).
- **Kreator Raportów Definiowanych ([`CustomReportBuilder`](resources/js/components/investments/CustomReportBuilder.jsx))**:
  - Dowolne zestawianie pozycji ze sprawozdań finansowych na interaktywnej osi czasu (horyzont 5, 10 lub 15 lat).
  - Dynamiczny wybór wykresów słupkowych i liniowych, skalowanie kwot (PLN, tys. PLN, mln PLN) oraz eksport do pliku CSV.
- **Generator Dossier Inwestorskiego ([`InvestmentDossierPdfGenerator`](resources/js/components/investments/InvestmentDossierPdfGenerator.jsx))**:
  - Kompilacja 15-letniego modelu w oficjalne memorandum inwestycyjne w formacie A4 ze znakami wodnymi (`POUFNE`, `OFICJALNE DOSSIER BANKOWE`, `DRAFT`).
  - **Certyfikat Integralności SHA-256**: kryptograficzny hash wyliczany z kanonicznych parametrów projektu gwarantujący brak manipulacji danymi (tamper detection).
  - Natywny wektorowy druk PDF (`window.print`) oraz eksport pełnego dossier audytowego w formacie JSON.

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
- [x] **Faza 21: Spójność Danych Historycznych OPEX i Strumienie Przychodów**
  - Migracja danych rekwalifikująca archiwalne rekordy `cat-opex` do granularnych podkategorii OPEX.
  - Wprowadzenie granularnych podkategorii przychodowych (SaaS, Usługi, Doradztwo) w encji domenowej `Category` i schemacie.
  - Aktualizacja seedera `FinancialDataSeeder` i zbiorów danych o realne strumienie przychodowe.
  - Testy weryfikujące eliminację rekordów sierocych `cat-opex` i pełną spójność analityczną.
  - Refaktoryzacja `CategoryBreakdown` pod kątem obsługi grup jedno- i wielokategorialnych.
- [x] **Faza 22: Naprawa Dynamiki R/R dla Okresów Otwartych i Podpozycji**
  - Wyliczanie dynamicznego zakresu porównawczego w `GetCategoryBreakdownHandler` przy braku jawnego zakresu dat (`startDate === null`, `endDate === null`).
  - Ciągłość historyczna kategorii w repozytorium analitycznym i kalkulatorze domenowym.
  - Testy jednostkowe kalkulacji YoY dla otwartych zakresów dat (Pełna historia).
  - Testy integracyjne weryfikujące endpoint `GET /finance/analytics/breakdown` dla podkategorii OPEX i przychodów.
  - Weryfikacja spójności formatu danych porównawczych między metrykami a breakdown.
- [x] **Faza 23: Poprawa Typografii Tabeli P&L i Warunkowej Grupowalności**
  - Usunięcie prefiksu `(-)` przed numeracją pozycji w `FinancialTable` z zachowaniem semantyki kosztu.
  - Warunkowa obsługa rozwijania wierszy (chevron tylko dla grup posiadających więcej niż 1 pozycję).
  - Formatowanie ujemnych potrąceń w `FinancialValue` bez zaburzania numeracji wierszy.
  - Aktualizacja testów komponentu `FinancialTable`.
  - Testy regresyjne E2E w `DashboardView.test.jsx` dla czystej hierarchii P&L.
- [x] **Faza 24: Perfekcyjna Typografia i Wyrównanie Siatki P&L**
  - Wyrównanie wierszy głównych (1–9) P&L do jednolitego dopełnienia bazowego (`px-4`) i usunięcie wcięcia `pl-6`.
  - Standaryzacja odstępów i typografii znacznika potrącenia `(-)` przy kodach kategorii.
  - Wyrównanie pikselowe szerokości expandera chevron i elementu placeholder spacer (`w-3.5`).
  - Aktualizacja testów jednostkowych `FinancialTable.test.jsx` weryfikujących ścisłe pionowe wyrównanie pozycji głównych (1–9).
  - Dodanie testu weryfikującego, że wcięcia (`pl-8` / `pl-10`) posiadają wyłącznie elementy podrzędne.
- [x] **Faza 25: Spójność Raportów i Regresja Wizualna**
  - Synchronizacja styli `ExecutivePdfReport` z ujednoliconą siatką tabeli `FinancialTable`.
  - Weryfikacja stabelaryzowanego wyrównania liczb monospace o wysokiej gęstości w `FinancialValue` dla wierszy potrąceń.
  - Aktualizacja testów komponentu `ExecutivePdfReport` dla spójnej hierarchii wierszy P&L i czystej typografii.
  - Testy regresyjne E2E w `DashboardView.test.jsx` po przełączeniu roku i firmy.
  - Aktualizacja dokumentacji design systemu UI i changeloga pod kątem instytucjonalnych standardów tabelarycznych P&L.
- [x] **Faza 26: Architektura Domenowa i Bezpieczne API Masowego Usuwania**
  - Wprowadzenie komendy CQRS `BatchDeleteFinancialRecordsCommand` i handlera domenowego z izolacją tenanta.
  - Rozszerzenie interfejsu `FinancialRecordRepositoryInterface` i implementacji Eloquent o usuwanie masowe.
  - Rejestracja zdarzenia domenowego `FinancialRecordsBatchDeleted` i listenera audytu `financial_audit_logs`.
  - Wystawienie endpointu `DELETE /api/v1/finance/records/batch` z walidacją `BatchDeleteFinancialRecordsRequest`.
  - Testy jednostkowe i integracyjne weryfikujące masowe usuwanie, izolację spółek i audyt.
- [x] **Faza 27: Interfejs Zaznaczania i Pasek Akcji Masowych w Księdze**
  - Stan zaznaczenia, checkboxy wierszy i master-checkbox w nagłówku tabeli `RecordsView`.
  - Pływający pasek akcji masowych `BatchActionBar` z sumowaniem kwot i liczbą zaznaczonych pozycji.
  - Dwuetapowy modal potwierdzenia `BatchDeleteConfirmationModal` z podsumowaniem i zabezpieczeniem "USUŃ".
  - Integracja wywołania API masowego usuwania z optymistycznym czyszczeniem i powiadomieniami.
  - Testy komponentów w `RecordsView.test.jsx` dla interakcji zaznaczania i modalu usuwania.
- [x] **Faza 28: Zaawansowane Czyszczenie Zbiorów i Testy Regresji**
  - Walidacja limitu masowego usuwania (max 500 rekordów) i obsługa skrajnych payloadów.
  - Utrzymanie/reset stanu zaznaczeń przy paginacji i przełączaniu kontekstu spółki/filtrów.
  - Testy integracyjne przypadków brzegowych (obce ID spółek, puste paczki, rollback DB).
  - Testy E2E w `RecordsView.test.jsx` dla pełnego przepływu masowego usuwania.
  - Dokumentacja wytycznych bezpieczeństwa operacji masowych i ścieżki audytowej w changelogu.
- [x] **Faza 29: Komponent Modalu Szczegółów Audytu i Architektura Zakładek**
  - Utworzenie komponentu `FinancialAuditDetailModal` z inspekcją zrzutów JSON dla `old_values` i `new_values`.
  - Implementacja terminalowego przełącznika zakładek (Audyt Finansowy vs Audyt VDR) w `AuditLogsView`.
  - Implementacja kafelków podsumowujących KPI dla statystyk audytu (`/finance/audit-logs/stats`).
  - Dodanie pigułek filtrów akcji finansowych ze wskaźnikami liczbowymi i stylami aktywnego stanu.
  - Testy jednostkowe dla `FinancialAuditDetailModal` renderującego metadane i diffy `old_values`/`new_values`.
- [x] **Faza 30: Integracja Tabeli Audytu Finansowego, Wyszukiwarki i Paginacji**
  - Implementacja tabeli audytu finansowego wysokiej gęstości z czasem CET, profilami operatorów i badge'ami akcji.
  - Połączenie tabeli audytu z wyszukiwarką tekstową (debounce) i paginacją backendową.
  - Powiązanie przycisku inspekcji wiersza z otwarciem modalu `FinancialAuditDetailModal`.
  - Rygorystyczna synchronizacja kontekstu `activeCompany` oraz obsługa stanów ładowania i pustych wyników.
  - Testy komponentów w `AuditLogsView.test.jsx` dla zakładki finansowej, przełączania VDR, filtrów i modalu.
- [x] **Faza 31: Testy Integracyjne, Bezpieczeństwo i Dokumentacja**
  - Testy integracyjne E2E dla filtrowania zdarzeń audytowych według akcji usunięcia, modyfikacji i importu CSV.
  - Harmonizacja palety kolorów badge'y i mapowania ikon w kategoriach audytowych.
  - Weryfikacja izolacji najemcy (tenant isolation) przy przełączaniu spółek przez DealContext.
  - Testy regresji weryfikujące paginację i filtrowanie audytu dokumentów VDR.
  - Aktualizacja dokumentacji systemu audytu i przewodnika po zrzutach JSON w changelogu.
- [x] **Faza 32: Normalizacja Kontraktu RecordType w Backendzie i Obsługa Aliasów**
  - Normalizacja parametru `record_type` w kontrolerze (wielkość liter, walidacja enumu, alias `income` -> `revenue`).
  - Wzbogacenie zasobu `FinancialRecordResource` o etykietę `record_type_label` i kod kanoniczny.
  - Testy integracyjne w `FinancialRecordsApiTest` dla zapytań case-insensitive i aliasu `income`.
  - Walidacja i egzekwowanie kanonicznych wartości `RecordType` w command handlerach.
  - Testy jednostkowe walidacji enumu `RecordType` i lokalizacji etykiet.
- [x] **Faza 33: Naprawa Obliczeń Metryk i Filtrów w Księdze Transakcji**
  - Aktualizacja opcji filtra typu w `RecordsView` do wartości kanonicznych.
  - Poprawa logiki sumowania kafelków metryk strony (przychody, koszty, saldo).
  - Poprawa agregacji `selectedMetrics` w pływającym pasku akcji masowych.
  - Zapewnienie poprawnego formatowania badge'y typów i kolorów kwot.
  - Zastąpienie legacy `'INCOME'` wartościami kanonicznymi w mockach testowych.
- [x] **Faza 34: Testy Regresyjne, Walidacja E2E i Dokumentacja**
  - Testy komponentowe wyświetlania niezerowych wartości w kafelkach podsumowań.
  - Testy reaktywnego filtrowania po typie operacji w tabeli księgowej.
  - Testy eksportu CSV z zachowaniem kanonicznych nagłówków i wartości typów.
  - Aktualizacja dokumentacji changelogu i reguł filtrowania kontraktu danych.
  - Aktualizacja dokumentacji `README.md` w zakresie księgi transakcji i kryteriów filtrowania.
- [x] **Faza 35: Narzędzia Diagnostyczne SMTP i Weryfikacja Połączenia Pocztowego**
  - Implementacja narzędzia CLI `TestMailConnectionCommand` (`mail:test`) do weryfikacji handshake SMTP, poświadczeń i transportu.
  - Wystawienie endpointów `POST /api/v1/admin/mail/test` i `GET /api/v1/admin/mail/status` dla administratorów.
  - Szablon mailable `TestDiagnosticMail` z czasem systemowym, latencją i ciemnym motywem FinBoard.
  - Testy jednostkowe i integracyjne dla komendy `mail:test` i endpointów diagnostycznych.
  - Aktualizacja dokumentacji `ORACLE_CLOUD_SETUP.md` oraz `.env.example` o bezpieczne porty SMTP (587/465).
- [x] **Faza 36: Obsługa Błędów Wysyłki, Rejestr Audytowy i Link Aktywacyjny w UI**
  - Ekspozycja bezpiecznego `activation_url` w `InvitationResource` dla oczekujących zaproszeń.
  - Obsługa błędów wysyłki w `SendInvitationEmailListener` z logowaniem i rejestracją w ścieżce audytowej.
  - Przycisk "Kopiuj link aktywacyjny" z powiadomieniem w tabeli zaproszeń.
  - Widżet weryfikacji poczty SMTP i modal testowy w widoku ustawień administracyjnych.
  - Testy komponentów dla kopiowania linku aktywacyjnego i akcji zaproszeń.
- [x] **Faza 37: Odporność Kolejek, Testy Integracyjne i Dokumentacja**
  - Konfiguracja polityki ponowień (retry/backoff) dla maili zaproszeń w `SendInvitationEmailListener`.
  - Testy integracyjne symulujące timeouty połączeń SMTP i odporność kolejki zadań.
  - Testy E2E dla tworzenia zaproszeń, regeneracji tokenów i awaryjnego przepływu aktywacji.
  - Aktualizacja changelogu z architekturą doręczania poczty, restrykcjami portu 25 i wytycznymi SMTP.
  - Aktualizacja dokumentacji `README.md` opisującej produkcyjną konfigurację i diagnostykę poczty.
- [x] **Faza 38: Fundamenty Domenowe Kontekstu InvestmentProject i Schematy Bazy Danych**
  - Inicjalizacja struktury katalogów kontekstu InvestmentProject (warstwy Domain, Application, Infrastructure).
  - Domenowe Value Objects dla budżetu, stóp procentowych, parametrów pożyczek i stawek VAT.
  - Agregat InvestmentProject z encjami CapexStage, FinancingStructure i DebtFacility.
  - Migracje bazy danych dla projektów inwestycyjnych, etapów CAPEX, instrumentów dłużnych i dotacji.
  - Implementacja InvestmentProjectRepositoryInterface i repozytorium Eloquent z izolacją wielonajemcową.
- [x] **Faza 39: Inżynieria Finansowa, Kredyt Inwestycyjny, Kredyt Pomostowy VAT i Dotacje**
  - Komendy i handlery CQRS dla inicjalizacji projektu oraz zarządzania etapami CAPEX.
  - Serwis DebtAmortizationService obsługujący raty równe vs malejące z WIBOR, marżą i prowizjami.
  - Serwis VatBridgeLoanService modelujący finansowanie VAT od nakładów budowlanych i zwroty z US.
  - Serwis GrantAllocationService obliczający koszty kwalifikowane, dofinansowanie i transze refundacji.
  - Testy jednostkowe i integracyjne weryfikujące krzywe amortyzacji długu, obrót kredytu VAT i reguły dotacji.
- [x] **Faza 40: 15-letni Silnik 3-Statement (RZiS, Bilans, Cash Flow & Test Płynności)**
  - Serwis DepreciationScheduleService generujący ruch środków trwałych i amortyzację liniową KŚT.
  - Serwis IncomeStatementService modelujący 15-letni RZiS ze strumieniami przychodów, OPEX, płacami i CIT.
  - Serwisy BalanceSheetService i CashFlowService z domknięciem bilansowym w ujęciu miesięcznym i rocznym.
  - Serwis LiquidityBalancingService z detekcją luki gotówkowej, symulacją limitu i alertami ujemnego salda.
  - Kompleksowe testy PHPUnit weryfikujące spójność matematyczną 3-Statement i zerową wariancję bilansową.
- [x] **Faza 41: Dynamiczny WACC, Wycena Efektywności (NPV, IRR) i Equity Waterfall**
  - Serwis WaccCalculatorService wyliczający średni ważony koszt kapitału z tarczą podatkową i inflacją.
  - Serwis InvestmentAppraisalService obliczający zdyskontowane FCFF/FCFE, NPV, Project IRR, RV i okres zwrotu.
  - Numeryczny solver EquityWaterfallSolverService wyznaczający udziały inwestorów i docelowe stopy IRR.
  - Kontrolery REST API dla zarządzania projektami, pobierania sprawozdań i wskaźników wyceny.
  - Testy API weryfikujące endpointy wyceny inwestycji, wielonajemcowość i kalkulacje waterfall.
- [x] **Faza 42: Frontend: Kreator Założeń Inwestycyjnych i Harmonogramu CAPEX**
  - Konfiguracja routingu, nawigacji i layoutu dla modułu Planowania Inwestycji w interfejsie FinBoard.
  - Komponent CapexScheduleManager z podziałem na etapy, walidacją dat i przypisaniem stawek KŚT.
  - Komponent FinancingStructureConfigurator z suwakami wkładu własnego, kredytem, pożyczką VAT i dotacjami.
  - Komponent OperatingAssumptionsForm z liniami przychodów, driverami OPEX, cyklem NWC i matrycą etatów.
  - Testy komponentowe Vitest sprawdzające walidację stanu CapexScheduleManager i konfiguratora finansowania.
- [x] **Faza 43: Reaktywny Silnik w Przeglądarce i Cockpit Analizy Wrażliwości Real-Time**
  - Implementacja Web Workera investmentCalculationWorker w TypeScript dla 15-letnich symulacji w tle.
  - Widok SensitivityCockpitView z suwakami What-If dla CAPEX, przychodów, kosztów zmiennych/stałych i płac.
  - Komponent ReinvestmentManager obsługujący cykliczne nakłady odtworzeniowe (Nakłady A, B, C).
  - Przełącznik scenariuszy (Bazowy, Pesymistyczny, Optymistyczny) i trybu spłaty długu.
  - Testy integracyjne Vitest weryfikujące komunikację z Web Workerem i natychmiastowe odświeżanie KPI.
- [x] **Faza 44: Prezentacja 15-letnich Sprawozdań i Nakładka Inwestorska Exit Valuation**
  - Komponent ThreeStatementGrid renderujący 15-letni RZiS, Bilans i Cash Flow (widok miesięczny/roczny).
  - Komponent ExitValuationOverlay modelujący moment wyjścia, mnożniki EV/EBITDA i yield kupującego.
  - Komponent ExitWaterfallVisualizer prezentujący spłatę długu netto, podział wpływów, MoIC i Equity IRR.
  - Komponent BankingCovenantsStrip wyświetlający w czasie rzeczywistym wskaźniki DSCR, ICR i płynności.
  - Testy Vitest hierarchii ThreeStatementGrid, kalkulacji wyceny wyjścia i progów kowenantów bankowych.
- [x] **Faza 45: Diagnostyka Organizacyjna, Raporty Definiowane, Dossier PDF i Dokumentacja**
  - Komponent InvestmentReadinessScorecard oceniający gotowość formalno-prawną, techniczną i rynkową.
  - Komponent CustomReportBuilder umożliwiający dowolne zestawianie pozycji sprawozdań na osi czasu.
  - Generator InvestmentDossierPdfGenerator kompilujący 15-letni model, wykresy i pieczęć integralności SHA-256.
  - Testy end-to-end (E2E) weryfikujące pełny przepływ planowania inwestycji od założeń do dossier PDF.
  - Aktualizacja changelogu i README.md z pełną dokumentacją modułu Project Finance & Investment Valuation.
- [x] **Faza 46: Generowanie Danych Demonstracyjnych dla Modułu Inwestycyjnego**
  - Dedykowany seeder `InvestmentProjectSeeder` zasilający spółkę Acme Manufacturing S.A. (`22222222-2222-2222-2222-222222222222`).
  - Projekt o budżecie 32 000 000,00 PLN z 4 etapami CAPEX (Grunty KŚT 0, Hala KŚT 1, Linie CNC KŚT 4, Oprogramowanie WNiP).
  - Montaż finansowy: Wkład własny (8M PLN, podział 60/40), Kredyt Senioralny (14M PLN, WIBOR 1M + marża 2.4%, annuity), Dotacja FENG SMART (10M PLN, 3 transze) oraz Linia pomostowa VAT (5.5M PLN).
  - Kompletne założenia operacyjne: COD 2027-03-01 (14 m-cy), 2 linie przychodowe, ramp-up 40%–90%, cykl NWC (DSO 45, DPO 30, DIO 20), matryca płac 25 FTE, CIT 19%, reinwestycje Nakład A i B, wycena wyjścia EV/EBITDA 7.5x w R7 z kaskadą waterfall (8% hurdle, 80/20 carried interest).
  - Integracja w `DatabaseSeeder.php`, ślad audytowy doradcy w `FinancialAuditLog` i testy weryfikujące `InvestmentProjectSeederTest`.
- [x] **Faza 47: Stabilizacja i Poprawki Wizualne Interfejsu Planowania Inwestycyjnego**
  - Rozszerzenie konfiguracji Tailwind CSS o klasy `grid-cols-15` i `grid-cols-16` w `theme.extend.gridTemplateColumns`.
  - Naprawa układu horyzontalnej osi czasu w sekcji *Matryca Wdrożeń Reinvestmentu (15-Year Timeline)* w `ReinvestmentManager.jsx` z zabezpieczeniem stylu inline.
  - Weryfikacja spójności wizualnej kafelków lat Y1–Y15, plakietek programów A, B, C oraz kwot rocznego zapotrzebowania CAPEX.
- [x] **Faza 48: Poprawki Modułu Planowania Inwestycyjnego**
  - Usunięcie błędu retencji danych historycznych w oknie modalnym tworzenia projektu (`CreateProjectModal.jsx`).
  - Automatyczny reset stanu formularza przy otwarciu (`isOpen`), anulowaniu oraz pomyślnym utworzeniu projektu.
  - Warunkowe montowanie komponentu `{isCreateModalOpen && <CreateProjectModal ... />}` w widoku `InvestmentPlanningView.jsx`.
  - Testy automatyczne Vitest weryfikujące pełną czystość formularza przy dodawaniu kolejnych projektów portfelowych.
  - Usunięcie developerskich oznaczeń etapów wdrożeniowych (`Faza 42`, `Faza 43`, `Faza 44`, `Faza 45`) z zakładek nawigacyjnych widoku `InvestmentPlanningView.jsx`.
  - Zastąpienie tymczasowej plakietki `WORK IN PROGRESS` profesjonalnym identyfikatorem sekcji `PARAMETRY WEJŚCIOWE`, a w `ReinvestmentManager.jsx` zastąpienie `FAZA 43` technicznym oznaczeniem `KŚT / 15L`.
  - Dostosowanie i pomyślna weryfikacja asercji w testach jednostkowych i integracyjnych (`InvestmentPlanningView.test.jsx`, `investmentPlanningE2EWorkflow.test.jsx`, `ReinvestmentManager.test.jsx`).
  - Usunięcie zaszłości prototypowych (sztywnych strumieni OZE MWh, etatów inżynierów i kosztów stałych 350k PLN) z formularza założeń operacyjnych (`OperatingAssumptionsForm.jsx`).
  - Generator czystych parametrów początkowych (`getDefaultAssumptions`) oraz pełny reset stanu w `useEffect` i `handleReset` eliminujący wyciek danych między projektami.
  - Wprowadzenie profesjonalnych wierszy Empty State w tabelach strumieni przychodowych oraz matrycy etatów (Headcount Matrix) z możliwością usuwania wierszy powracając do czystego stanu początkowego.
  - Rozszerzenie testów Vitest weryfikujących zachowanie czystego projektu, dodawanie strumieni z Empty State i izolację projektów (`OperatingAssumptionsForm.test.jsx`, `InvestmentStateValidation.test.jsx`).
  - Naprawa reguł walidacji FormRequest (`UpdateInvestmentProjectRequest.php`) zapobiegająca odrzucaniu pól `reinvestment_programs` i `reinvestments_enabled` przez `$request->validated()`.
  - Usunięcie problemu resetowania wyłączonych nakładów odtworzeniowych (NAKŁAD A, B, C) i utraty założeń reinwestycyjnych po kliknięciu „Zapisz Założenia Reinvestmentu”.
  - Rozszerzenie testów integracyjnych Laravel Feature Test (`InvestmentValuationApiTest.php`) oraz frontendowych Vitest (`ReinvestmentManager.test.jsx`) weryfikujących trwałość flagi `enabled: false`.
  - Inteligentna obsługa wskaźników struktury kapitałowej w sekcji Montażu Finansowego (`FinancingStructureConfigurator.jsx`) dla projektów z zerowym CAPEX (tryb dualny: `% Kapitału` przy zdefiniowanym kapitale oraz fallback `0.0% CAPEX`).
  - Zabezpieczenie przycisków szybkiego wyboru (`20% CAPEX`, `30% CAPEX`, `50% LTV`, `70% LTV`, `VAT 23%`) przed zerowaniem wartości przy braku etapów w harmonogramie CAPEX.
  - Rozszerzenie testów Vitest o weryfikację wskaźników kapitałowych i stanów zerowego CAPEX (`FinancingStructureConfigurator.test.jsx`).
  - Odblokowanie edycji pól „Nazwa Programu” oraz „Opis i Zakres Rzeczowy” dla nakładów odtworzeniowych w `ReinvestmentManager.jsx` z eliminacją sztywnych danych OZE/SCADA.
  - Reaktywna synchronizacja zmienionych nazw programów z 15-letnią osią czasu (*Timeline Grid*) i dymkami zdarzeń odtworzeniowych.
  - Rozszerzenie testów Vitest weryfikujących edycję, zapis do API i odtwarzanie własnych nazw programów (`ReinvestmentManager.test.jsx`).
  - Dynamiczna legenda 15-letniej osi czasu reinvestmentu (`ReinvestmentManager.jsx`) odzwierciedlająca aktualne nazwy programów i kolory wskaźników.
  - Reaktywne filtrowanie legendy wykluczające wyłączone programy (`enabled === false`) oraz obsługa stanów pustych (*Brak aktywnych nakładów*, *Reinvestment wyłączony w modelu*).
  - Rozszerzenie testów Vitest o weryfikację reaktywności legendy, dynamicznych nazw i filtrowania aktywnych nakładów (`ReinvestmentManager.test.jsx`).
  - Wielotrybowy kokpit wizualizacji reinvestmentu (View Switcher) w `ReinvestmentManager.jsx` z 3 trybami: Siatka 15L (`matrix`), Słupki Skumulowane `BarChart` (`stacked_bars`) oraz Wykres Łączony `ComposedChart` / S-Curve (`combo_curve`).
  - Dedykowany institutional tooltip analityczny (`ReinvestmentChartTooltip`) prezentujący rok, wykaz programów z kwotami i procentowym udziałem, roczną sumę CAPEX oraz skumulowany wydatek od początku projektu.
  - Rozszerzenie testów jednostkowych Vitest o weryfikację selektora widoków, przełączania trybów oraz wskaźnika S-Curve w legendzie (`ReinvestmentManager.test.jsx`).
  - Trwałość i precyzja kwoty wydatków kwalifikowanych (Grant Eligible Amount) w harmonogramie etapów CAPEX (`investment_capex_stages`).
  - Migracja bazy danych dodająca kolumnę `grant_eligible_amount` (decimal 15,4, nullable) oraz mapowanie w encji Eloquent i modelu domenowym `CapexStage`.
  - Aktualizacja repozytorium domenowego `EloquentInvestmentProjectRepository` i zasobu API `CapexStageResource` gwarantująca bezstratny zapis i odczyt kwoty kwalifikowanej.
  - Dostosowanie okna modalnego `CapexStageModal.jsx` oraz widoku `CapexScheduleManager.jsx` zapewniające zachowanie ręcznie wprowadzonej kwoty zamiast nadpisywania maksymalną kwotą netto.
  - Rozszerzenie testów integracyjnych PHPUnit (`InvestmentValuationApiTest.php`) oraz frontendowych Vitest (`CapexScheduleManager.test.jsx`).
  - Eliminacja luki prezentacyjnej (UX/UI Feedback Gap) w sekcji *Założenia Operacyjne & Model P&L* (`OperatingAssumptionsForm.jsx`).
  - Dodanie interaktywnego panelu projekcji eskalacji kosztów stałych (`fixed-cost-projection-panel`) pod suwakiem *„Eskalacja Inflacyjna Kosztów Stałych (%)”*.
  - Kalkulacja w czasie rzeczywistym trajektorii wieloletniej (Rok 5, Rok 10, skumulowany narzut 15-letni $\Sigma$, dynamika wzrostu procentowego w R15) oraz nota objaśniająca formułę $Baza \times (1 + r)^{t-1}$.
  - Dodanie towarzyszącego panelu szacunków wieloletnich przychodów (`revenue-projection-panel`) uwzględniającego dynamikę organiczną i krzywą ramp-up.
  - Rozszerzenie zestawu testów Vitest (`OperatingAssumptionsForm.test.jsx`) o weryfikację reaktywności suwaków i projekcji wieloletniej.
- [x] **Faza 49: Bankowalny model podatkowy (CIT & Tax Loss Carry-Forward) zgodny z art. 7 ust. 5 i art. 19 ustawy o CIT**
  - Korekta UI, synchronizacja stawki CIT z tarczą podatkową WACC i parametryzacja FormRequest.
    - Eliminacja literówki w `OperatingAssumptionsForm.jsx` (*Limit Rocznego Odliczenia Straty (%)*).
    - Synchronizacja tarczy podatkowej długu WACC $K_d \cdot (1 - T)$ z dynamiczną stawką CIT projektu (19% lub preferencyjne 9% dla małych podatników).
    - Rozszerzenie metody fabrycznej `WaccParameters::defaultForPoland(?float $preTaxCostOfDebt = null, ?float $taxRatePercent = null)` oraz `WaccCalculatorService`.
    - Dodanie interaktywnej karty tarczy podatkowej WACC w zakładce *5. Podatki & CIT*.
    - Parametryzacja reguł walidacyjnych w żądaniach `UpdateInvestmentProjectRequest`, `InvestmentStatementQueryRequest` oraz `InvestmentAppraisalQueryRequest`.
    - Testy jednostkowe WACC (`WaccCalculatorServiceTest.php`) oraz frontendowe (`OperatingAssumptionsForm.test.jsx`).
  - Model domenowy rocznikowania strat podatkowych (Tax Loss Vintages & 5-Year Expiry).
    - Implementacja enum `TaxLossSettlementMode` (`standard_loss_cap`, `one_off_5m`, `ebt_cap`) zgodnie z art. 7 ust. 5 ustawy o CIT.
    - Implementacja obiektu wartości `TaxLossVintage` (rok powstania, kwota pierwotna, pozostała, rozliczona, rok wygaśnięcia $T+5$).
    - Implementacja agregatu wartości `TaxLossPool` z kolejką FIFO i bezpowrotnym wygaszaniem strat po upływie 5 lat podatkowych.
    - Wprowadzenie obiektu `TaxLossSettlementResult` rejestrującego kwoty rozliczone, wygasłe oraz salda otwarcia/zamknięcia.
    - Rozszerzenie `OperatingAssumptions`, `IncomeStatementPeriod` i `AnnualIncomeStatement` o atrybuty `taxLossExpired` i `taxLossCarryForwardOpening`.
    - Kompletny zestaw testów jednostkowych (`TaxLossPoolTest.php`).
  - Roczny model zaliczek CIT (YTD) i obsługa jednorazowego odliczenia 5 mln zł w IncomeStatementService.
    - Implementacja ustawowego, narastającego modelu zaliczek na CIT (YTD - Year-To-Date) zgodnie z art. 25 ust. 1 ustawy o CIT w `IncomeStatementService`.
    - Eliminacja błędu zniekształcenia podatkowego w ujęciu miesięcznym (zaliczka CIT należna wyłącznie przy dodatnim rocznym dochodzie narastającym po odliczeniu strat z lat ubiegłych).
    - Integracja agregatu domenowego `TaxLossPool` z mechanizmem rocznikowania (vintages) i obsługą trybów rozliczeń: standardowy limit 50% (`STANDARD_LOSS_CAP`), jednorazowe odliczenie do 5 mln zł (`ONE_OFF_5M`) wg art. 7 ust. 5 pkt 2 CIT oraz legacy limit EBT (`EBT_CAP`).
    - Obsługa bezpowrotnego wygasania strat podatkowych po 5 kolejno następujących po sobie latach podatkowych ($T+5$) oraz ewidencja salda otwarcia i wygasłych strat w okresach miesięcznych i rocznych.
    - Rozszerzenie zestawu testów jednostkowych w `IncomeStatementServiceTest.php` weryfikujących pełne odliczenie do 5 mln zł vs standardowe 50%, progresję miesięcznych zaliczek YTD oraz 5-letnie wygasanie strat.
  - Parzystość matematyczna w silniku Web Worker (financialCalculations.ts).
    - Implementacja struktur domenowych `TaxLossVintage` oraz `TaxLossPool` w TypeScript odzwierciedlających logikę backendową (kolejka FIFO, 5-letnie wygaszanie $T+5$, limit standardowy 50%, odliczenie jednorazowe do 5 mln zł wg art. 7 ust. 5 CIT).
    - Refaktoryzacja silnika symulacji 15-letniej `calculate15YearStatements` z wprowadzeniem rocznej pętli zewnętrznej i podziału na miesięczne zaliczki YTD (Year-To-Date) wg art. 25 ust. 1 ustawy o CIT.
    - Zapewnienie pełnej tożsamości sumy zaliczek miesięcznych z rocznym CIT ($\sum_{m=1}^{12} monthCit \equiv annualCit$) oraz 100% kompensacji bieżących strat śródrocznych w danym roku obrotowym.
    - Wzbogacenie modeli `MonthlyStatementPeriod` oraz `AnnualStatementPeriod` o atrybuty tarczy podatkowej (`taxLossCarryForwardOpening`, `taxLossExpired`, `taxLossUsed`, `taxLossCarryForwardClosing`, `taxableIncome`).
    - Dynamiczna synchronizacja stawki podatkowej w formule tarczy długu WACC z parametrami założeń operacyjnych projektu (`cit_rate_percent`).
    - Rozszerzenie zestawu testów Vitest w `investmentCalculationWorker.test.js` (8 nowych testów weryfikujących logikę klas podatkowych, porównanie trybów rozliczeń, równość sumy zaliczek YTD oraz wygasanie strat).
  - Interfejs UI fiskalnego panelu CIT i podgląd trajektorii tarczy podatkowej (Tax Loss Roll-Forward).
    - Rozszerzenie formularza założeń operacyjnych (`OperatingAssumptionsForm.jsx`) o obsługę trybów rozliczania strat podatkowych (`tax_loss_settlement_mode`: standardowy 50%, jednorazowy do 5 mln zł wg art. 7 ust. 5 pkt 2 CIT, limit dochodu EBT) oraz konfigurowalny limit jednorazowy `tax_loss_one_off_cap_amount`.
    - Wdrożenie live symulacji `taxRollForwardTrajectory` z natychmiastowym przeliczaniem 15-letniego modelu i prezentacją 5 syntetycznych wskaźników KPI (straty wygenerowane, wykorzystana tarcza, oszczędność CIT, wygasłe $T+5$, saldo końcowe).
    - Dedykowana tabela 15-letniej projekcji podatkowej (`tax-loss-rollforward-panel`) z przepływem salda otwarcia, EBT, odliczeń, podatku należnego i salda zamknięcia tarczy.
    - Rozszerzenie tabeli sprawozdań finansowych (`ThreeStatementGrid.jsx`) o interaktywne rozwijanie pozycji CIT na wiersze analityczne tarczy podatkowej oraz integrację z eksportem CSV.
    - Zestaw testów jednostkowych i integracyjnych w `OperatingAssumptionsForm.test.jsx`, `ThreeStatementGrid.test.jsx` oraz `InvestmentStateValidation.test.jsx`.
  - Kompleksowe testy integracyjne, regresja 3-Statement & aktualizacja dokumentacji README.md.
    - End-to-end test integracyjny w `ThreeStatementEngineIntegrationTest.php` weryfikujący pełną symulację 15-letnią dla trybów `STANDARD_LOSS_CAP` (50%) oraz `ONE_OFF_5M` (jednorazowe do 5 mln zł).
    - Weryfikacja zerowej wariancji bilansu ($Assets = Liabilities + Equity$) we wszystkich 180 okresach miesięcznych w obu trybach rozliczeń.
    - Weryfikacja tożsamości sumy miesięcznych zaliczek YTD z rocznym podatkiem CIT ($\sum_{m=1}^{12} \text{CIT}_m \equiv \text{CIT}_{rok}$) dla wszystkich 15 lat.
    - Weryfikacja endpointu API w `InvestmentValuationApiTest.php` dla aktualizacji parametrów podatkowych oraz ekspozycji analitycznych danych tarczy podatkowej w sprawozdaniu 3-statement.
    - Frontendowy test integracyjny w `phase44StatementsAndValuationIntegration.test.jsx` sprawdzający parzystość kalkulacji Web Worker, akcelerację odliczenia w roku 2 oraz interaktywne rozwijanie sub-wierszy CIT w `ThreeStatementGrid`.
    - Poprawa izolacji bazy danych w `InvestmentProjectSeederTest.php` z użyciem `DatabaseTransactions`.
    - Zapewnienie 100% zielonego wyniku testów: 603 testy PHPUnit (7915 asercji) oraz 477 testów Vitest (52 pliki testowe).
- [x] **Faza 50: Ulepszenie interaktywności, transparentności symulatora What-If oraz wizualizacja DCF i CAPEX w Kokpicie Wrażliwości**
  - Przełącznik trybów prezentacji wykresu 15-letniego w `SensitivityCockpitView.jsx` (Segmented Control: tryb *Nominalne (P&L i CF)* vs *Zdyskontowane (DCF & NPV)*).
  - Wzbogacenie wykresu nominalnego o dedykowaną serię słupkową nakładów majątkowych *CAPEX & Reinwestycje* (#818cf8) i etykietowanie lat z odtworzeniami na osi X (`Rok X (CAPEX)`).
  - Pełna wizualizacja trajektorii zdyskontowanych przepływów pieniężnych (słupki *Zdyskontowany FCFF*) oraz narastającej krzywej wartości bieżącej netto (*Skumulowane NPV*) reagującej na żywo na suwak WACC.
  - Efekt wizualnego kotwiczenia (Visual Anchoring glow) kart KPI (*PROJECT NPV*, *PROJECT IRR*, *EQUITY MoIC*) po modyfikacji stopy dyskontowej WACC wraz z notą objaśniającą mechanikę DCF.
  - Dynamiczne obliczanie i prezentacja 15-letniej zagregowanej sumy nakładów odtworzeniowych pod suwakiem Reinvestmentu oraz obsługa stanu pustego (0 PLN) z bezpośrednim linkiem do konfiguratora `ReinvestmentManager`.
  - Utrzymanie pełnej zgodności i spójności 10-wierszowej macierzy wariancji Base Case vs What-If.
  - Rozszerzenie zestawu testów jednostkowych Vitest w `SensitivityCockpitView.test.jsx` (14 testów) oraz pełna weryfikacja regresji (482 testy Vitest, 603 testy PHPUnit).

- [x] **Faza 51: Wyeliminowanie krytycznych rozbieżności między silnikiem przepływów pieniężnych a modułem audytu kowenantów LMA**
  -  Wyeliminowanie rozbieżności Cash Flow dotacji unijnych (EU Grants) i guardraile wskaźników płynności w audycie kowenantów LMA (`BankingCovenantsStrip` & `financialCalculations.ts`).
    - Likwidacja sztucznej 10-milionowej dziury płynnościowej w fazie CAPEX poprzez włączenie transz dotacji unijnych (`grant_disbursement_schedule` oraz fallback na zakończenie kwalifikowanych etapów CAPEX) do miesięcznych przepływów finansowych Web Workera (`fcf = debtDrawdown + grantReceived - debtRepaid - upfrontFee`) oraz rocznych agregacji `grantReceived` w Cash Flow Statement.
    - Wprowadzenie dynamicznych kontenerów (tło/obramowanie `bg-zinc-950/70 border-zinc-800` vs `bg-rose-950/20 border-rose-800/40`) oraz kolorystyki kafelków Płynności Bieżącej (CR) i Rezerwy DSRF w `BankingCovenantsStrip.jsx`.
    - Trójstopniowa logiczna ewaluacja statusów bankowych: dla CR (`ZGODNY`, `OSTRZEŻENIE`, `DEFICYT PŁYNNOŚCI`) i DSRF (`ZABEZPIECZONE`, `NISKI BUFOR`, `BRAK REZERWY`), eliminująca mylące, statyczne etykiety.
    - Rygorystyczne guardraile prezentacyjne zapobiegające wyświetlaniu ujemnych wartości wskaźników płynności i buforów czasowych: automatyczna konwersja wartości ujemnych do `0.00x (Deficyt NWC)` dla CR oraz `0.0 m. (Luka gotówkowa)` dla DSRF na kafelkach, w opisach naruszeń kowenantów oraz w 15-letniej tabeli analitycznej.
    - Zestaw dedykowanych testów w `BankingCovenantsStrip.test.jsx` oraz `investmentCalculationWorker.test.js`, osiągający 100% PASS w pełnym pakiecie Vitest (52 pliki testowe, 486 testów).
  -  Wdrożenie wskaźnika LLCR (Loan Life Coverage Ratio), dedykowanego bufora DSRA oraz asystenta dokapitalizowania naprawczego (Equity Cure Simulator).
    - Implementacja formuły LLCR (Loan Life Coverage Ratio) według standardu Loan Market Association (LMA) dla Project Finance: $\text{LLCR}_t = \frac{\sum_{i=t}^{\text{tenor}} \frac{\text{CFADS}_i}{(1 + K_d)^{i-t}} + \text{Rezerwa DSRA}_t}{\text{Saldo Zadłużenia}_t}$ z dyskontowaniem stopą $K_d$ i wyznaczaniem `minLlcr`, `avgLlcr` oraz `llcrHeadroom`.
    - Bilansowe wyodrębnienie rezerwy DSRA (`dsraReserve`: środki zablokowane na rachunku escrow w wysokości 6 miesięcy obsługi zadłużenia) od wolnych środków pieniężnych (`freeCash = closingCash - dsraReserve`), z automatycznym zwolnieniem rezerwy do wolnej gotówki po całkowitej spłacie długu.
    - Autonomiczny silnik Deal Advisory kalkulacji zastrzyku naprawczego (`calculateEquityCureRequirement`), wyliczający skumulowaną kwotę wsparcia kapitałowego w PLN, szczytowy transfer roczny, harmonogram transz z przyczynami deficytu oraz rekomendacjami instrumentów strukturyzacyjnych (pożyczka podporządkowana, kredyt obrotowy, akredytywa Standby LC).
    - Oficjalny Certyfikat Bankowalności LMA (Project Bankability Certificate) generowany w pod-zakładce wąskiego gardła dla projektów spełniających wszystkie wymogi ostrożnościowe komitetu kredytowego.
    - Rozszerzenie paska `BankingCovenantsStrip.jsx` o 6. kafelek KPI (LLCR), kolumnę LLCR w 15-letniej rocznej matrycy kowenantów, interaktywny suwak progu LLCR w konfiguratorze oraz dynamiczny panel Equity Cure vs Certyfikat LMA.
    - Zestaw dedykowanych testów jednostkowych Vitest w `investmentCalculationWorker.test.js` (32 testy) i `BankingCovenantsStrip.test.jsx` (17 testów) oraz pełna spójność bilansowa $Aktywa = Pasywa$.
  -  Kompleksowe testy integracyjne i regresyjne w PHPUnit oraz Vitest dla modułu kowenantów LMA, rezerwy DSRA i certyfikacji bankowalności.
    - Opracowanie backendowego pakietu testów integracyjnych w `tests/Feature/InvestmentProject/ProjectFinanceLmaCovenantsIntegrationTest.php` (4 testy, 148 asercji): weryfikacja zapisu i izolacji multi-tenant harmonogramu dotacji w strukturze finansowania, zerowej wariancji 15-letniego bilansu (Assets = Liabilities + Equity) przy spłacie długu senioralnego i dotacjach unijnych, profilu spłaty długu LMA (CFADS i obsługa długu w 120-miesięcznym tenorze z karencją) oraz ekspozycji API.
    - Opracowanie frontendowego pakietu testów integracyjnych w `resources/js/tests/integration/phase51CovenantsAndProjectFinanceIntegration.test.jsx` (6 testów): weryfikacja 15-letniej symulacji z separacją rezerwy DSRA i zerową wariancją gotówkową, formuły dyskontowania LLCR stopą Kd z uwzględnieniem bufora DSRA, reguł prezentacyjnych LMA (brak ujemnych wartości dla CR i DSRF), algorytmu Deal Advisory Equity Cure dla projektów zagrożonych, certyfikatu bankowalności LMA dla projektów w 100% bankowalnych oraz interaktywnego suwaka progów i presetów bankowych.
    - Zapewnienie 100% zielonego wyniku testów: 607 testów PHPUnit (8063 asercje) oraz 500 testów Vitest (53 pliki testowe).

- [x] **Faza 52: Uszczelnienie Bezpieczeństwa Multi-Tenant, Integralność Audytu WORM i Poprawki Krytyczne**
  - Harmonizacja weryfikacji dostępu multi-tenant w `DocumentController` za pomocą `User::canAccessCompany`.
    - Likwidacja sztucznej blokady `403 Forbidden` dla użytkowników z rolą `super_admin` oraz Doradców transakcyjnych (`advisor`) przypisanych do spółek przez relację `advisor_company`.
    - Zastąpienie sztywnego porównania roli `'admin'` i `company_id` domenową metodą `$user->canAccessCompany($companyId)`.
    - Pełna integracja autoryzacji domenowej w metodach `show`, `download`, `update`, `archive`, `destroy` oraz `auditLogs`.
  - Nienaruszalność ścieżki audytowej WORM i usunięcie kaskadowego kasowania logów.
    - Wdrożenie mechanizmu `SoftDeletes` dla tabeli `documents` oraz modelu `Document`.
    - Usunięcie reguły `cascadeOnDelete()` z klucza obcego `document_id` w `document_access_logs` i zastąpienie jej regułą `nullOnDelete()`.
    - Dodanie kolumn snapshotowych `document_title` oraz `company_id` w `document_access_logs`, gwarantujących czytelność i filtrację logów po usunięciu dokumentu.
    - Zabezpieczenie zapytań audytowych z wykorzystaniem `withTrashed()` zapobiegające utracie historii zdarzeń.
  - Rejestracja audytowa operacji modyfikacji (update) i likwidacji (destroy) dokumentów VDR.
    - Zabezpieczenie pełnego cyklu życia pliku: automatyczna rejestracja zdarzeń `update` oraz `destroy` w `DocumentController`.
    - Utrwalanie tożsamości użytkownika, adresu IP, User-Agent oraz snapshotu metadanych pliku przed fizycznym usunięciem.
    - Rozszerzenie frontendowej palety akcji audytowych `AuditActionBadge` oraz filtrów VDR `VDR_ACTION_FILTERS` w widoku `AuditLogsView`.
  - Synchronizacja limitów uploadu (50 MB), walidacja MIME i standard RFC 5987 / RFC 6266.
    - Podniesienie limitu wielkości pliku w `UploadDocumentRequest` do `max:51200` (50 MB) usuwające rozbieżność z interfejsem React.
    - Ścisła walidacja rozszerzeń i typów MIME (`pdf`, `xlsx`, `xls`, `doc`, `docx`, `zip`) zabezpieczająca przed złośliwymi skryptami.
    - Implementacja kodowania znaków UTF-8 (np. polskich znaków diakrytycznych) w nagłówku `Content-Disposition` z wykorzystaniem `HeaderUtils::makeDisposition` i bezpiecznym fallbackiem ASCII.
  - Testy regresyjne bezpieczeństwa i integralności VDR.
    - Zestaw testów w `tests/Feature/DocumentManagement/VdrHardeningSecurityRegressionTest.php` weryfikujący dostęp doradców transakcyjnych (`advisor`), administratorów (`super_admin`), blokadę 403 dla obcych spółek, WORM audit retention przy soft delete, walidację limitu 50MB i typów MIME oraz nagłówek RFC 5987.
    - 100% PASS w pełnym pakiecie testów: 614 testów PHPUnit (8119 asercji) oraz 500 testów Vitest (53 pliki testowe).

- [x] **Faza 53: CQRS, Storage Rollback & Server-side Audit Filtering**
  - Transakcyjny menedżer pamięci masowej (Transactional Storage Manager) z rollbackiem plików.
    - Zapobieganie powstawaniu osieroconych plików (orphan files) na dysku w przypadku błędu transakcji bazodanowej lub wyjątku SQL.
    - Implementacja interfejsu domenowego `TransactionalStorageManagerInterface` oraz klasy infrastruktury `TransactionalStorageManager`.
    - Dwufazowa koordynacja: automatyczny rollback (`delete`) plików utworzonych w transakcji w przypadku `Throwable`, oraz odroczone fizyczne usuwanie plików (`stageDeletion`) dopiero po zatwierdzeniu transakcji DB.
    - Integracja w `DocumentController::store` oraz `DocumentController::destroy`.
    - Zestaw dedykowanych testów jednostkowych w `TransactionalStorageManagerTest.php` (5 testów, 14 asercji).
  - Wzorzec CQRS Query dla logów audytowych VDR z filtrowaniem serwerowym.
    - Wprowadzenie `GetVdrAuditLogsQuery` oraz `GetVdrAuditLogsHandler` w warstwie Application modułu `DocumentManagement`.
    - Filtrowanie po stronie SQL (backend) według typu zdarzenia (`action`: pojedyncza akcja lub lista oddzielona przecinkami) oraz frazy wyszukiwania (`search` z wykorzystaniem `ilike` po tytule dokumentu, nazwisku i adresie email użytkownika oraz adresie IP).
    - Eliminacja problemu pustych stron przy paginacji dzięki przeniesieniu filtrowania przed zapytanie `paginate()`.
    - Integracja handlera w metodach `allAuditLogs` oraz `auditLogs` w `DocumentController`.
    - Dedykowane testy jednostkowe `GetVdrAuditLogsQueryTest` oraz weryfikacja endpointu REST w `DocumentsApiTest`.
  - Integracja frontendu AuditLogsView z backendowym filtrowaniem VDR.
    - Eliminacja obcinania paginacji (client-side pagination truncation) przez usunięcie lokalnego filtrowania tablicy `records.filter()`.
    - Przekazywanie parametrów `action` oraz `search` bezpośrednio do zapytania `apiClient.get('/documents/audit-logs')`.
    - Wprowadzenie mechanizmu debouncingu 300ms dla pola wyszukiwania VDR (`vdrSearchInput` -> `vdrSearchQuery`) oraz resetowania do strony 1 przy zmianie filtrów.
    - Dodanie przycisku czyszczenia wyszukiwania oraz przycisku czyszczenia filtrów w stanie pustym.
    - Testy jednostkowe i integracyjne Vitest w `AuditLogsView.test.jsx` oraz `vdrAuditRegression.test.jsx` (100% PASS w pełnym pakiecie 502 testów).
  - Wzorzec CQRS (Query & Command Handlers) dla repozytorium dokumentów VDR.
    - Pełne rozdzielenie operacji odczytu (Queries) i zapisu (Commands) w warstwie `Application` modułu `DocumentManagement`.
    - Implementacja zapytań: `GetDocumentsQuery` & `GetDocumentsHandler` (filtrowanie, wyszukiwanie, paginacja) oraz `GetDocumentByIdQuery` & `GetDocumentByIdHandler` (wyszukiwanie po UUID, obsługa `withTrashed`, domenowy `DocumentNotFoundException`).
    - Implementacja komend: `UploadDocumentCommand` & `UploadDocumentHandler` (transakcyjny storage manager, wyliczenie SHA-256, audyt uploadu), `UpdateDocumentCommand` & `UpdateDocumentHandler`, `ArchiveDocumentCommand` & `ArchiveDocumentHandler`, `DeleteDocumentCommand` & `DeleteDocumentHandler` (soft-delete + odroczone usuwanie z dysku `stageDeletion`), `DownloadDocumentCommand` & `DownloadDocumentHandler` (inkrementacja pobrań, obsługa `FileNotFoundInStorageException`).
    - Przekształcenie `DocumentController` w cienki kontroler HTTP delegujący wszystkie operacje bezpośrednio do handlerów CQRS przy zachowaniu harmonizacji autoryzacji multi-tenant.
    - Dedykowany pakiet testów jednostkowych w `DocumentCqrsHandlersTest.php` (7 testów, 25 asercji) ze 100% PASS w testach jednostkowych, integracyjnych i regresyjnych.
  - Testy integracyjne rollbacku storage i serwerowej paginacji audytu VDR.
    - Opracowanie zaawansowanego pakietu testów integracyjnych w `tests/Feature/DocumentManagement/VdrStorageRollbackAndAuditPaginationIntegrationTest.php` (5 testów, 159 asercji).
    - Weryfikacja automatycznego usuwania fizycznych plików z dysku w przypadku zakleszczenia lub błędu transakcji bazy danych (eliminacja orphan files).
    - Weryfikacja odroczenia i anulowania usunięcia pliku z dysku przy błędzie DB w trakcie kasowania oraz pomyślnego usunięcia po commit.
    - Weryfikacja wielostronicowej paginacji audytu VDR, filtracji po pojedynczej lub wielu akcjach (`action=upload,download`), wyszukiwania frazowego (`search`) oraz szczelnej izolacji multi-tenant.
    - Zapewnienie 100% zielonego wyniku testów: 636 testów PHPUnit (8369 asercji) oraz 502 testy Vitest (53 pliki testowe).

- [x] **Faza 54: Standard M&A Due Diligence – Hierarchia Folderów i Indeks Dziesiętny Dewey**
  - Agregat TransactionFolder oraz system indeksowania dziesiętnego Dewey.
    - Wdrożenie migracji tabeli `transaction_folders` (UUID, `company_id`, rekurencyjny `parent_id`, `index_code`, `name`, `description`, `sort_order`, klucz unikalny na parze firma-indeks).
    - Implementacja obiektów wartości `FolderId` oraz `DeweyIndexCode` (walidacja, normalizacja do formatu `01.00`, wyznaczanie poziomu hierarchii, kod rodzica, generowanie podkodów potomnych, sortowanie segmentowe).
    - Implementacja korzenia agregatu `TransactionFolder` ze zdarzeniami domenowymi `TransactionFolderCreated`, `TransactionFolderUpdated`, `TransactionFolderDeleted`.
    - Serwis domenowy `DeweyMnaStructureGenerator` dostarczający standardową taksonomię 8 głównych obszarów Due Diligence (ponad 25 folderów transakcyjnych).
    - Implementacja repozytorium `EloquentTransactionFolderRepository` powiązanego z interfejsem domenowym `TransactionFolderRepositoryInterface` z sortowaniem Dewey.
    - Zestaw testów jednostkowych w `DeweyIndexCodeTest`, `TransactionFolderTest` oraz `TransactionFolderRepositoryTest` (17 testów, 62 asercje).
  - Aktualizacja encji Document, migracji i REST API dla zagnieżdżonej hierarchii folderów i indeksów Dewey.
    - Migracja `documents` dodająca `folder_id` (relacja z `transaction_folders`, `ON DELETE SET NULL`) oraz `index_code` (indeks B-tree, format dziesiętny Dewey).
    - Rozszerzenie encji domenowej `Document` o metody `assignToFolder()` oraz `updateIndexCode()`.
    - Aktualizacja modeli Eloquent, komend i zapytań CQRS (`UploadDocumentCommand`, `UpdateDocumentCommand`, `GetDocumentsQuery`) z obsługą filtrowania po `folder_id` i eager loadingiem folderu.
    - Wdrożenie `TransactionFolderController`, `TransactionFolderResource` oraz żądań walidacji (`CreateTransactionFolderRequest`, `UpdateTransactionFolderRequest`).
    - Zapewnienie pełnej izolacji wielodostępowej (multi-tenant) i autoryzacji opartej o `ResolvesCompanyContext`.
    - Pakiet testów integracyjnych API w `TransactionFolderApiTest.php` (9 testów, 38 asercji), 100% PASS w pełnym zestawie 662 testów PHPUnit oraz 502 testów Vitest.
  - Nawigacja po drzewie folderów Dewey i odznaki indeksów w DocumentTable.
    - Komponent nawigacji po hierarchii `FolderTreeNav` z rozwijaniem/zwijaniem węzłów, szybkim filtrowaniem ("Wszystkie dokumenty", "Nieprzypisane") oraz dynamicznymi licznikami plików `documents_count`.
    - Wdrożenie przycisku inicjalizacji taksonomii M&A (33 kategorie Due Diligence) bezpośrednio z panelu bocznego pokoju danych.
    - Wizualizacja odznak kodów Dewey (np. `01.01.01`) o wysokim kontraście oraz etykiet folderów nadrzędnych w tabeli `DocumentTable`.
    - Elastyczny, responsywny układ dwukolumnowy z możliwością ukrywania/pokazywania paska bocznego folderów i chipem aktywnego filtra.
    - 100% PASS w 53 plikach testowych Vitest (502 testy) oraz pełnym zestawie 662 testów PHPUnit (8469 asercji).
  - Modal tworzenia folderów CreateFolderModal i przypisywanie dokumentów w DataRoomView.
    - Komponent `CreateFolderModal` do tworzenia niestandardowych folderów transakcyjnych (wybór rodzica z wcięciem głębokości, walidacja i dynamiczna sugestia prefiksów kodu Dewey, nazwa, opis, kolejność sortowania).
    - Rozszerzenie `DocumentUploadModal` o wybór folderu docelowego i automatyczne uzupełnianie indeksu Dewey pliku.
    - Rozszerzenie `DocumentEditModal` o możliwość przenoszenia dokumentów pomiędzy folderami, odpinania (`folder_id: null`) i aktualizacji indeksów Dewey.
    - Integracja w `FolderTreeNav` (przycisk "+ Nowy Folder Dewey") oraz automatyczna synchronizacja liczników w `DataRoomView`.
    - 100% PASS w 53 plikach testowych Vitest (502 testy) oraz pełnym pakiecie PHPUnit (662 testy).
  - Testy jednostkowe i komponentowe drzewa nawigacji, indeksowania Dewey i modali.
    - Nowy pakiet testów komponentowych `FolderTreeNav.test.jsx` (weryfikacja renderowania kodów Dewey, liczników dokumentów, filtrów, rozwijania/zwijania gałęzi, inicjalizacji taksonomii oraz otwierania modalu).
    - Nowy pakiet testów komponentowych `CreateFolderModal.test.jsx` (weryfikacja walidacji kodu Dewey i nazwy, hierarchii folderów nadrzędnych, automatycznej podpowiedzi prefiksu, obsługi żądań API POST).
    - Rozszerzenie `DataRoom.test.jsx` o asercje odznak indeksu Dewey w tabeli dokumentów oraz modali przypisywania.
    - Poprawka renderowania błędów walidacji po stronie klienta w `CreateFolderModal.jsx`.
    - 100% PASS w pełnym pakiecie 515 testów Vitest (55 plików testowych) oraz 662 testów PHPUnit (8469 asercji).

- [x] **Faza 55: Permission Matrix, Dynamic PDF Watermarking & Final VDR Security**
  - Agregat domenowy Matrycy Uprawnień VDR, obiekty wartości i migracje bazy danych.
    - Obiekty wartości: `PermissionLevel` (`none`, `view`, `download`, `manage`), `AccessSubject` (role transakcyjne `role:{name}` oraz konkretni użytkownicy `user:{uuid}`), `VdrPermissionId`, `EffectivePermission` ze śledzeniem źródła grantu.
    - Korzenie agregatu i zdarzenia domenowe: `VdrFolderPermission` (`VdrFolderPermissionGranted`, `VdrFolderPermissionRevoked`), `VdrDocumentPermission` (`VdrDocumentPermissionGranted`, `VdrDocumentPermissionRevoked`).
    - Agregat / silnik domenowy `VdrPermissionMatrix` realizujący hierarchiczne wyznaczanie uprawnień efektywnych (nadpisywanie ról przez użytkowników, nadpisywanie folderów przez dokumenty, rekurencyjne dziedziczenie z folderów nadrzędnych Dewey).
    - Migracja bazy danych `2026_03_30_100000_create_vdr_permissions_tables.php` tworząca tabele `vdr_folder_permissions` oraz `vdr_document_permissions` z indeksami unikalnymi i kaskadami kluczy obcych.
    - Modele Eloquent `VdrFolderPermission` i `VdrDocumentPermission` oraz repozytorium `EloquentVdrPermissionRepository` powiązane z `VdrPermissionRepositoryInterface`.
    - Pakiet testów jednostkowych i integracyjnych: `PermissionLevelTest`, `VdrPermissionMatrixTest`, `VdrPermissionRepositoryDatabaseTest` (18 testów, 115 asercji), 100% PASS w pełnym zestawie 680 testów PHPUnit (8584 asercje).
  - Komendy/zapytania CQRS i punkty końcowe REST API dla Matrycy Uprawnień VDR.
    - Komendy CQRS: `SetVdrFolderPermissionCommand` i `SetVdrFolderPermissionHandler`, `SetVdrDocumentPermissionCommand` i `SetVdrDocumentPermissionHandler`, `RevokeVdrPermissionCommand` i `RevokeVdrPermissionHandler`.
    - Zapytania CQRS: `GetVdrPermissionMatrixQuery` i `GetVdrPermissionMatrixHandler` (pełna matryca z nazwami folderów, indeksami Dewey, tytułami dokumentów i etykietami), `GetEffectiveVdrPermissionQuery` i `GetEffectiveVdrPermissionHandler` (hierarchiczne wyznaczanie uprawnień efektywnych).
    - Warstwa REST API: `VdrPermissionController`, `SetVdrPermissionRequest`, trasy `api.documents.permissions.*` (`GET matrix`, `GET effective`, `POST folders/{folderId}`, `POST documents/{documentId}`, `DELETE {type}/{id}`).
    - Bezpieczeństwo i autoryzacja: restrykcja modyfikacji wyłącznie dla doradców (`advisor`) i administratorów (`super_admin`), ścisła izolacja multi-tenant.
    - Pakiety testów: jednostkowe CQRS `VdrPermissionCqrsHandlersTest` (8 testów, 42 asercje), funkcjonalne REST API `VdrPermissionApiTest` (10 testów, 58 asercji), 100% PASS w pełnym zestawie 698 testów PHPUnit (8684 asercje) oraz 515 testów Vitest.
  - Usługa dynamicznego nakładania znaków wodnych PDF (Dynamic PDF Watermarking Service).
    - Obiekt wartości: `WatermarkOptions` (identyfikacja użytkownika, email, IP, znacznik czasu UTC, nazwa spółki, klauzula poufności, przezroczystość alfa, kąt obrotu, rozmiar fontu, formatowanie ukośnych linii, nagłówka i stopki).
    - Silnik FPDI: instalacja `setasign/fpdf` i `setasign/fpdi`, rozszerzenie `WatermarkFpdi` z obsługą przezroczystości PDF 1.4+ (`/ExtGState`) oraz rotacji współrzędnych `rotate()`.
    - Serwis domenowy: `FpdiPdfWatermarkService` implementujący `PdfWatermarkServiceInterface` ze skalowaniem do oryginalnej geometrii stron (A4/Letter, pion/poziom) oraz odpornym fallbackiem przy plikach nie-PDF.
    - Integracja pobierania i podglądu: rozszerzenie `DownloadDocumentCommand` i `DownloadDocumentHandler`, aktualizacja `DocumentController::download` z wymuszeniem znaku wodnego wg uprawnienia efektywnego (`watermarkRequired()`) oraz nowy endpoint podglądu w przeglądarce `GET /api/v1/documents/{id}/preview` (`inline`).
    - Pakiety testów: `WatermarkOptionsTest` (5 testów, 23 asercje), `PdfWatermarkServiceTest` (4 testy, 22 asercje), `PdfWatermarkIntegrationTest` (6 testów, 22 asercje), 100% PASS w pełnym zestawie 713 testów PHPUnit (8751 asercji) oraz 515 testów Vitest.
  - Interfejs zarządzania matrycą uprawnień VDR, odznaka znaku wodnego i strażnik dostępu.
    - Komponenty etykiet: `VdrPermissionBadge` (wizualizacja poziomów `none`, `view`, `download`, `manage` ze specjalną paletą kolorów i ikonami) oraz `WatermarkBadge` (bursztynowa odznaka `ZNAK WODNY` z tarczą ostrzegawczą dla dokumentów chronionych).
    - Modal zarządzania matrycą uprawnień: `VdrPermissionMatrixModal` dostępny dla doradców i administratorów (`canManagePermissions`) z dwoma zakładkami (`📁 Foldery M&A`, `📄 Nadpisania Plików`), tabelą grantów, formularzem konfiguracji ról/użytkowników oraz akcją natychmiastowego odwoływania (`DELETE /documents/permissions/:type/:id`).
    - Bezpieczny podgląd dokumentów: `DocumentPreviewModal` z osadzonym zabezpieczonym PDF w ramce `<iframe>`, metadanymi, kodem Dewey, sumą SHA-256, banerem ostrzegawczym `POUFNY PODGLĄD VDR` oraz blokadą pobierania przy braku uprawnień.
    - Tabela dokumentów i DataRoomView: przycisk `Matryca Uprawnień` w nagłówku, przycisk natychmiastowego podglądu dokumentu `onPreview` (ikona oka), blokada przycisku pobierania (`can_download === false`) z etykietą tooltip oraz odznaka `WatermarkBadge` przy plikach PDF.
    - Pakiety testów: `VdrPermissionBadge.test.jsx` (6 testów), `DocumentPreviewModal.test.jsx` (6 testów), `VdrPermissionMatrixModal.test.jsx` (7 testów), rozszerzony `DataRoom.test.jsx` (14 testów), 100% PASS w 58 plikach testowych Vitest (537 testów) oraz 713 testach PHPUnit (8751 asercji).
  - Audyt bezpieczeństwa VDR, testy penetracyjno-regresyjne i finalne zamknięcie Fazy 55.
    - Kompleksowy pakiet testów penetracyjnych i regresyjnych: `VdrSecurityPenetrationRegressionTest.php` (10 testów, 31 asercji).
    - Weryfikacja 10 kluczowych wektorów ataków: eskalacja uprawnień klienta (403), brak uwierzytelnienia (401), izolacja wielodostępowa doradców między spółkami (403), bezpieczne blokowanie cross-tenant resource spoofing (404), hierarchiczne pierwszeństwo restrykcji dokumentu nad folderem (`none`), nadpisywanie ról przez granty konkretnych użytkowników (UUID), uniemożliwienie pobrania czystego oryginału w trybie View-Only z wymuszeniem stempla tożsamości w podglądzie inline, odporność na próby ominięcia znaku wodnego w parametrach żądania, rekurencyjne dziedziczenie uprawnień w taksonomii Dewey oraz integralność nienaruszalnego rejestru audytowego WORM (`document_access_logs`).
    - Uodpornienie kontrolera `VdrPermissionController`: obsługa wyjątków `\InvalidArgumentException` z mapowaniem na czyste kody HTTP 404 (`NotFoundHttpException`).
    - 100% PASS w pełnym zestawie 723 testów PHPUnit (8782 asercje) oraz 58 plikach testowych Vitest (537 testów).

- [x] **Faza 56: Wdrożenie Systemu Tooltipów @floating-ui/react, Audyt Dostępności WCAG 2.1/2.2 AA oraz Wyjaśnialność Wskaźników Finansowych**
  - Implementacja dostępnych komponentów Tooltip i InfoTooltip z WAI-ARIA role="tooltip" i nawigacją klawiaturą (@floating-ui/react).
    - Nowoczesny silnik podpowiedzi oparty o `@floating-ui/react` eliminujący ograniczenia natywnego `title="..."` (zgodność z WCAG 2.1/2.2 AA 1.4.13 i 2.1.1).
    - Komponent `<Tooltip />` z obsługą `useFloating`, `flip()`, `shift({ padding: 8 })`, `offset(8)`, `arrow()` i `safePolygon()`.
    - Obsługa urządzeń mobilnych/tabletów (toggle on tap) oraz odrzucanie klawiszem Escape bez utraty fokusu.
    - Dedykowany komponent `<InfoTooltip />` ze wskaźnikiem ikony dla metryk finansowych i nagłówków tabel.
    - Pakiet testów jednostkowych `Tooltip.test.jsx` (14 testów).
  - Migracja natywnych atrybutów HTML title na dostępne komponenty Tooltip w VDR, layout i tabelach danych.
    - Eliminacja natywnego `title="..."` z `DocumentTable.jsx`, `VdrPermissionBadge.jsx`, `FolderTreeNav.jsx`, `BatchActionBar.jsx`, `Header.jsx`, `Sidebar.jsx` oraz `FinancialTable.jsx`.
    - Interaktywny tooltip kopiowania sumy kontrolnej SHA-256 z dynamicznym feedbackiem ("Kopiuj pełną sumę kontrolną SHA-256" / "Skopiowano sumę SHA-256!").
    - Dostępne podpowiedzi dla odznaki dynamicznego znaku wodnego oraz wskaźników pozycji pomniejszającej wynik `(-)` i kodów P&L.
    - Dostępne etykiety `aria-label` dla przycisków ikonowych oraz synchronizacja testów komponentowych.
  - Kontekstowe podpowiedzi finansowe i definicje kowenantów bankowych LMA w kokpicie i pasku mnożników.
    - Wzbogacenie pasków wskaźników rynkowych (`FinancialMultiplesStrip.jsx`) o szczegółowe dymki metodologiczne dla EV/EBITDA, EV/EBIT, P/E, Długu Netto / EBITDA i P/BV wraz ze wzorami matematycznymi i interpretacją benchmarków.
    - Wdrożenie komponentów `<InfoTooltip />` w module kowenantów bankowych (`BankingCovenantsStrip.jsx`) z definicjami LMA dla DSCR, ICR, Current Ratio, Peak Leverage, DSRF oraz LLCR.
    - Integracja pomocniczych podpowiedzi informacyjnych w matrycy suwaków What-If analizy wrażliwości (`SensitivityCockpitView.jsx`): CAPEX, Przychody ze Sprzedaży, Koszty Zmienne, Koszty Stałe OPEX, Fundusz Płac, Stopa Dyskontowa WACC oraz Reinwestycje A/B/C.
    - Weryfikacja testowa: `FinancialMultiplesStrip.test.jsx` (3/3), `BankingCovenantsStrip.test.jsx` (17/17), `SensitivityCockpitView.test.jsx` (15/15).
  - Audyt dostępności WCAG 2.1/2.2 AA, testy regresyjne i integracyjne oraz bezkolizyjne współistnienie z Recharts.
    - Kompleksowy pakiet testów integracyjnych i regresyjnych `TooltipAccessibilityRegression.test.jsx` (7 testów).
    - Weryfikacja kryteriów WCAG: Dismissible (klawisz Escape bez utraty fokusu), Hoverable (bezpieczne najechanie na treść podpowiedzi), Persistent (brak przedwczesnego wygasania).
    - Potwierdzenie bezkolizyjnego współistnienia w DOM i nasłuchiwaczach pomiędzy dymkami UI a wykresem Recharts (`CustomChartTooltip`).
    - 100% PASS w pełnym zestawie testów Vitest oraz pomyślna kompilacja produkcyjna (`npm run build`).
  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w widoku Pulpitu Zarządczego (Executive Overview).
    - Rozszerzenie `MetricCard` o obsługę `tooltipContent` z dedykowaną ikonką `<InfoTooltip size="xs" />`.
    - Dostępne objaśnienia metodologiczne dla 4 głównych kart KPI: Przychody ze Sprzedaży, Wynik EBITDA, Zysk Operacyjny (EBIT) oraz Wskaźnik Płynności Bieżącej.
    - Zastąpienie natywnego `title="..."` na przycisku celów benchmarkowych M&A oraz dodanie podpowiedzi dla odznaki spółki, NIP, filtru zakresu, waluty i silnika CQRS/DDD.
    - Wzbogacenie nagłówków i przełączników wykresów (`TREND P&L` / `PŁYNNOŚĆ CR/QR`) oraz dziennika audytowego WORM (`AuditTrailSnippet`) o interaktywne dymki.
    - Weryfikacja testowa: `MetricCard.test.jsx` (4/4), `DashboardView.test.jsx` (9/9), `dashboardViewE2EWorkflow.test.jsx` (6/6).
  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w widoku Analityki P&L, Marż i Wskaźników Płynności.
    - Eliminacja natywnych atrybutów `title="..."` z etykiet legendy w `CostBreakdownChart.jsx` z aliasowaniem `UiTooltip` zapobiegającym kolizji z Recharts `<Tooltip />`.
    - Wzbogacenie nagłówka kontekstowego `AnalyticsView.jsx`: podpowiedzi dla odznaki spółki, NIP, filtru dat, waluty oraz przycisku odświeżania z etykietą `aria-label`.
    - Dostępne podpowiedzi nawigacyjne na wszystkich 5 zakładkach: Podsumowanie P&L, Rentowność i Marże, Płynność i Zadłużenie, Dekompozycja Pozycji oraz Cele Benchmarkowe.
    - Wdrożenie `tooltipContent` w 4 głównych kartach KPI (Przychody, EBITDA, EBIT, Zysk Netto) oraz `<InfoTooltip size="xs" />` w nagłówkach wykresów i tabel marżowych.
    - Dodanie dymków metodologicznych dla wskaźników płynności (Current Ratio, Quick Ratio, NWC), statusów ewaluacji, wykresu dekompozycji oraz matrycy celów M&A.
    - Weryfikacja testowa: `AnalyticsView.test.jsx` (6/6), `CostBreakdownChart.test.jsx` (4/4), 100% PASS w pełnym zestawie 60 plików Vitest (562 testy) i bezbłędny build Vite.
  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w widoku Księgi Transakcji Finansowych (RecordsView).
    - Refaktoryzacja bazowego komponentu `Button.jsx` z obsługą `React.forwardRef` do bezkolizyjnej integracji z `@floating-ui/react`.
    - Eliminacja natywnych atrybutów `title="..."` z przycisków akcji wiersza (Edytuj/Usuń zapis), przycisku eksportu CSV oraz modali transakcyjnych (`BatchDeleteConfirmationModal`, `DeleteRecordConfirmationModal`, `FinancialRecordModal`).
    - Wzbogacenie nagłówka modułu `RecordsView.jsx`: `<Tooltip>` dla ikony modułu, kodu podmiotu, przycisku eksportu CSV i nowego zapisu oraz `<InfoTooltip size="xs">` dla tytułu księgi głównej.
    - Dodanie dymków objaśniających `<InfoTooltip size="xs">` do 4 kart szybkiego podsumowania: Łącznie Pozycji, Przychody, Koszty OPEX i Saldo Operacji Netto.
    - Dostępne podpowiedzi dla paska filtrów: wyszukiwarka, selektor typu transakcji, selektor kategorii, przycisk resetu filtrów oraz filtry zakresu dat z pełnymi etykietami `aria-label`.
    - Dostępne nagłówki kolumn tabeli, master checkbox, checkboxy wierszy, kody kategorii, odznaki klasyfikacji (`getTypeBadge`) oraz dymki paginacji.
    - Weryfikacja testowa: `RecordsView.test.jsx` (22/22), `FinancialRecordModal.test.jsx` (7/7), `BatchDeleteConfirmationModal.test.jsx` (6/6), `BatchActionBar.test.jsx` (5/5), 100% PASS w 60 plikach Vitest (563 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w widoku Importu Wyciągów i Zbiorów CSV (ImportView).
    - Refaktoryzacja komponentu `Badge.jsx` z obsługą `React.forwardRef` do bezkolizyjnego montowania dymków Floating UI na odznakach.
    - Eliminacja natywnych atrybutów `title="..."` z przycisku pobierania szablonu CSV i przycisku zmiany wybranego pliku.
    - Wzbogacenie nagłówka modułu `ImportView.jsx`: `<Tooltip>` dla ikony modułu, odznaki spółki portfelowej, wskaźnika workera Redis, tarczy Dry-Run oraz `<InfoTooltip size="xs">` dla asynchronicznej kolejki importu.
    - Dostępne podpowiedzi w strefie upuszczania `CsvDropzone.jsx`: dymek specyfikacji kolumn formatu CSV, dostępny trigger klawiaturowy (`role="button"`) oraz szczegóły wybranego pliku (rozmiar KB, data modyfikacji).
    - Dostępne podpowiedzi w tabeli weryfikacji wstępnej `CsvPreviewTable.jsx`: baner walidacji Dry-Run, rejestr błędów wierszy, przyciski akcji (Rozpocznij Import / Anuluj), nagłówki kolumn tabeli i komórki próbki rekordów.
    - Integracja dymków w monitorze postępu `ImportJobProgress.jsx` (identyfikator zadania kolejki Redis, odznaki statusu, pasek postępu, przyciski nawigacyjne) oraz w dzienniku audytowym `ImportHistoryTable.jsx` (nagłówki kolumn, odznaki statusów, przycisk odświeżania z `aria-label`).
    - Weryfikacja testowa: `ImportView.test.jsx` (7/7), `CsvPreviewTable.test.jsx` (4/4), 100% PASS w pełnym zestawie 61 plików Vitest (570 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w module Virtual Data Room (VDR) i modalach transakcyjnych.
    - Wzbogacenie nagłówka modułu `DataRoomView.jsx`: `<Tooltip>` dla ikony kryptograficznego skarbca VDR, odznaki spółki transakcyjnej, przycisków akcji ("Foldery M&A", "Odśwież", "Matryca Uprawnień", "Wgraj Dokument"), filtru ścieżki folderu, 7 zakładek kategorii Due Diligence, pola wyszukiwarki i paginacji.
    - Dodanie dymków objaśniających `<InfoTooltip size="xs">` w `DataRoomStats.jsx` do 4 kart KPI (Dokumenty VDR, Wolumen Danych, Pobrania Audytowe, Kategorie Due Diligence) oraz dymków `<Tooltip>` dla certyfikatów bezpieczeństwa (AES-256 GCM, SHA-256, WORM).
    - Dostępne podpowiedzi w tabeli dokumentów `DocumentTable.jsx`: nagłówki wszystkich 7 kolumn, kod taksonomii dziesiętnej Dewey, tytuł dokumentu, ostrzeżenie o dynamicznym znaku wodnym, suma kontrolna SHA-256 wraz z przyciskiem kopiowania (`aria-label`) oraz 6 przycisków akcji wiersza (Podgląd, Pobierz, Ścieżka audytowa, Edytuj, Archiwum, Usuń).
    - Wdrożenie dymków `<Tooltip>` i `<InfoTooltip>` we wszystkich 7 modalach transakcyjnych VDR: `CreateFolderModal.jsx`, `DeleteDocumentModal.jsx`, `DocumentAuditModal.jsx`, `DocumentEditModal.jsx`, `DocumentPreviewModal.jsx`, `DocumentUploadModal.jsx` oraz `VdrPermissionMatrixModal.jsx` z zachowaniem atrybutów `title` wymaganych przez testy iframe i przycisków zamykania.
    - Weryfikacja testowa: `DataRoomTooltips.test.jsx` (8/8), `DataRoom.test.jsx` (14/14), `DocumentPreviewModal.test.jsx` (6/6), `VdrPermissionMatrixModal.test.jsx` (7/7), `FolderTreeNav.test.jsx` (5/5), `CreateFolderModal.test.jsx` (5/5), `VdrPermissionBadge.test.jsx` (6/6), 100% PASS w pełnym zestawie 62 plików Vitest (578 testów) oraz bezbłędny build produkcyjny (`npm run build`).
  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w module Raporty Zarządcze & Generator PDF (ReportsView, ReportConfigurator, ExecutivePdfReport).
    - Wzbogacenie nagłówka modułu `ReportsView.jsx`: `<Tooltip>` dla ikony raportów finansowych, aktywnej odznaki spółki portfelowej i odznaki wektorowego PDF A4 oraz `<InfoTooltip size="xs">` z dedykowanym `ariaLabel` dla generatora memorandów zarządczych.
    - Dostępne podpowiedzi w konfiguratorze parametrów `ReportConfigurator.jsx`: dymki dla przycisków akcji ("Przelicz", "Eksport JSON", "Drukuj / Eksportuj PDF") z zachowaniem atrybutów `title="..."` dla testów, objaśnienia sekcji konfiguracyjnych (horyzont czasowy, waluta prezentacji, klauzule poufności, zakres sekcji, komentarz analityczny) oraz dymki dla szablonów komentarzy i przełączników sekcji.
    - Wdrożenie dymków w podglądzie wektorowego raportu PDF `ExecutivePdfReport.jsx`: bezpieczne dymki informacyjne z klasą `print:hidden` (ukrywane podczas druku PDF A4 do formatu fizycznego), objaśnienia 4 kart KPI, 9 kodów klasyfikacji P&L, wskaźników płynności i kowenantów LMA, dekompozycji OPEX oraz pieczęci kryptograficznej SHA-256 z blokami podpisów członków zarządu.
    - Weryfikacja testowa: dedykowany zestaw testowy `ExecutiveReportsTooltips.test.jsx` (7/7), `ExecutiveReports.test.jsx` (6/6), `dealAdvisoryE2EWorkflow.test.jsx` (2/2), 100% PASS w pełnym zestawie 63 plików Vitest (585 testów) oraz bezbłędny build produkcyjny (`npm run build`).
  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w module Rejestr Nadzoru i Ścieżka Audytowa (AuditLogsView, AuditActionBadge, FinancialAuditDetailModal).
    - Refaktoryzacja komponentu odznaki audytowej `AuditActionBadge.jsx` z obsługą `React.forwardRef` do bezkolizyjnego montowania podpowiedzi `@floating-ui/react`.
    - Wzbogacenie nagłówka modułu `AuditLogsView.jsx`: `<Tooltip>` dla ikony tarczy kryptograficznej WORM (`role="img"`, `aria-label`), odznaki spółki portfelowej, przycisku odświeżania z `aria-label` oraz `<InfoTooltip size="xs">` dla dziennika nadzoru SOX/RODO.
    - Nawigacja zakładkowa z dymkami `<Tooltip>` i etykietami `aria-label` dla audytu transakcji finansowych oraz dokumentów VDR.
    - Dostępne podpowiedzi w kartach KPI: objaśnienia `<InfoTooltip size="xs">` dla łącznej liczby zdarzeń (z odznaką LIVE), operacji niszczących (z odznaką MASOWE), modyfikacji i importów CSV (z odznaką ZAPISY) oraz czasu ostatniego zdarzenia CET (z odznaką REAL-TIME).
    - Dostępne filtry i wyszukiwanie: dymki `<Tooltip>` i atrybuty `aria-label` dla 6 pigułek akcji finansowych (`FINANCE_ACTION_PILLS`), 7 filtrów akcji VDR (`VDR_ACTION_FILTERS`) oraz przycisków czyszczenia wyszukiwania.
    - Dostępne tabele audytowe i kontrolki: podpowiedzi dla nagłówków kolumn obu tabel, przycisk inspekcji *"Szczegóły"* (`audit-row-inspect-${log.id}`) z zachowaniem atrybutu `title="Podgląd szczegółów i snapshotów JSON"`, komórki operatora, adresu IP, tytułów dokumentów i UUID oraz dymki na kontrolkach paginacji.
    - Wdrożenie dymków w modalnym oknie inspekcji `FinancialAuditDetailModal.jsx`: nagłówek z tarczą, odznaką akcji, czasem i UUID, przycisk zamykania z zachowaniem `title="Zamknij"` i `aria-label`, objaśnienia sekcji opisu, operacji usunięcia rekordów, profilu operatora, środowiska sieciowego oraz porównania zrzutów migawkowych JSON diff (`old_values` vs `new_values`).
    - Weryfikacja testowa: dedykowany zestaw testowy `AuditLogsTooltips.test.jsx` (8/8), `AuditLogsView.test.jsx` (10/10), `FinancialAuditDetailModal.test.jsx` (6/6), `AuditActionBadge.test.jsx` (10/10), `vdrAuditRegression.test.jsx` (4/4), 100% PASS w pełnym zestawie 64 plików Vitest (593 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).

  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w module Doradcy & Przypisania (AdvisorsManagementView, modale operacyjne i diagnostyka SMTP).
    - Wzbogacenie paska nagłówka `AdvisorsManagementView.jsx`: `<Tooltip>` dla ikony tarczy Deal Advisory (`role="img"`, `tabIndex={0}`), odznak ról (`SUPER ADMIN`, `DORADCA M&A`, `MULTI-TENANT RBAC`), przycisków akcji ("Testuj SMTP", "Dodaj Spółkę", "Zaproś Użytkownika", "Odśwież") oraz `<InfoTooltip size="xs">` objaśniający architekturę Multi-Tenant RBAC i separację danych podmiotów.
    - Dostarczenie objaśnień metodologicznych w 4 kartach KPI (`MetricCard` z `tooltipContent`): Doradcy & Partnerzy, Spółki w Portfelu, Oczekujące Zaproszenia oraz Aktywowane Konta.
    - Dostępna nawigacja zakładkowa z dymkami `<Tooltip>` i etykietami `aria-label` dla Rejestru Doradców, Matrycy Spółek Portfelowych, Wysłanych Zaproszeń i Diagnostyki SMTP.
    - Dostępne podpowiedzi w tabeli doradców (filtry wyszukiwania, nagłówki kolumn, awatary inicjałów, odznaki ról i spółek, przyciski operacyjne "Spółki" i "Dezaktywuj / Aktywuj"), w matrycy pokrycia spółek (tickery, NIP, obsada analityczna, liczniki doradców i klientów) oraz w rejestrze zaproszeń (statusy, 48h limit tokena, link aktywacyjny, akcje "Kopiuj link", "Wyślij ponownie", "Anuluj").
    - Wdrożenie dymków `<Tooltip>` i komponentów `<InfoTooltip>` w modalach operacyjnych: `AdvisorAssignmentModal.jsx` (przypisania spółek, masowe akcje, baner audytu WORM), `CreateCompanyModal.jsx` (izolacja podmiotu, nazwa, ticker, NIP, checklist doradców), `InviteUserModal.jsx` (standard Zero-Trust, email, role RBAC, ważność 48h) oraz `TestMailModal.jsx` (weryfikacja handshake SMTP, diagnostyka).
    - Integracja dostępnych dymków w komponencie telemetrii `SmtpStatusWidget.jsx` (kompaktowy i pełny widok, wskaźniki gniazda TCP, detekcja blokady portu 25 w OCI, karty konfiguracji i terminal powitalny kod 220).
    - Weryfikacja testowa: dedykowany zestaw testowy `AdvisorsTooltips.test.jsx` (8/8), `AdvisorsManagement.test.jsx` (15/15), `CreateCompanyModal.test.jsx` (8/8), `InviteUserModal.test.jsx` (9/9), `MailDiagnostics.test.jsx` (9/9), 100% PASS w pełnym zestawie 65 plików Vitest (601 testów) oraz bezbłędny build produkcyjny (`npm run build`).

  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w module Planowanie Inwestycji i Montaż Finansowy (InvestmentPlanningView, CreateProjectModal).
    - Wzbogacenie paska nagłówka `InvestmentPlanningView.jsx`: `<Tooltip>` dla ikony kalkulatora inżynierii finansowej CAPEX, odznaki modułu Project Finance, aktywnego kodu podmiotu gospodarczego oraz `<InfoTooltip size="sm">` szczegółowo objaśniający wieloletnie modelowanie nakładów CAPEX (zgodnie z KŚT), optymalizację struktury długu (DSCR/LLCR), 15-letni model 3-Statement oraz wycenę DCF/WACC.
    - Dostępny selektor projektu (`<select data-testid="project-selector">`) oraz dymki `<Tooltip>` zintegrowane w odznakach statusów projektu (`getStatusBadge` dla wariantów approved, active, completed, under_review, draft).
    - Dymki `<Tooltip>` dla przycisków akcji nagłówka ("Nowy Projekt") oraz pustego stanu inicjalizacji ("Zainicjalizuj Pierwszy Projekt").
    - Dostarczenie objaśnień metodologicznych we wszystkich 5 kartach KPI (`MetricCard` z `tooltipContent`): Sumaryczny CAPEX, Wkład Własny (Equity), Kredyt Bankowy (Dług Senior), Dotacje & Subcydia oraz Horyzont Modelu (15 lat / COD).
    - Dostępna nawigacja zakładkowa z dymkami `<Tooltip content={tab.sublabel}>` i atrybutami `aria-label` dla 4 sub-modułów: 1. Założenia & CAPEX, 2. Symulator What-If, 3. Model 15-letni & Wycena, 4. Scoring & Dossier PDF.
    - Podpowiedzi w nagłówku założeń projektowych: dymek na ikonie suwaków, `<InfoTooltip size="xs">` dla konfiguratora założeń oraz dymek dla odznaki parametrów wejściowych.
    - Wdrożenie dymków `<Tooltip>` i komponentów `<InfoTooltip size="xs">` w formularzu tworzenia projektu `CreateProjectModal.jsx`: przycisk zamykania z `aria-label`, objaśnienia etykiet pól (nazwa projektu, data startu, horyzont planowania, waluta bazowa, equity, senior debt, opis strategiczny) oraz dymki dla przycisków w stopce ("Anuluj", "Utwórz Projekt").
    - Weryfikacja testowa: dedykowany zestaw testowy `InvestmentPlanningTooltips.test.jsx` (6/6), `InvestmentPlanningView.test.jsx` (9/9), 100% PASS w pełnym zestawie 66 plików Vitest (607 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).

  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w komponentach zakładki "1. Założenia & CAPEX" modułu Project Finance (CapexScheduleManager, CapexStageModal, CapexStageDeleteModal, FinancingStructureConfigurator, ReinvestmentManager, OperatingAssumptionsForm).
    - `CapexScheduleManager.jsx`: dymki nagłówka, `InfoTooltip` tytułu z definicją etapowania nakładów brutto/netto i przypisań KŚT, przycisk "Dodaj Etap CAPEX", 4 karty podsumowań KPI (Nakłady netto, Wydatki kwalifikowane, Średnia stawka KŚT, Status), nagłówki 7 kolumn tabeli, odznaki KŚT i dotacji, akcje wierszy (Edytuj/Usuń) oraz segmenty paska nakładów wraz z legendą.
    - `CapexStageModal.jsx`: przycisk zamykania, 8 etykiet pól z `InfoTooltip` (Nazwa, KŚT, Stawka amortyzacji, Kwota netto, Kolejność, Start, Czas trwania, Dotacja/Kwota kwalifikowana), separacja przycisku informacyjnego poza znacznikiem `<label>` oraz przyciski stopki "Anuluj" i "Dodaj Etap / Zapisz Zmiany".
    - `CapexStageDeleteModal.jsx`: dymki `<Tooltip>` na przyciskach "Anuluj" oraz "Usuń Etap".
    - `FinancingStructureConfigurator.jsx`: nagłówek z `InfoTooltip`, odznaka statusu luki montażu, 4 metryki kapitałowe, pasek Capital Stack, szybkie przyciski proporcji (20%, 30%, 50%, 70%, pokryj lukę), parametry kredytu (stopa bazowa, marża, tenor, karencja, profile spłaty Annuity/Linear/Bullet), kalkulator kredytu VAT oraz przyciski resetu i zapisu.
    - `ReinvestmentManager.jsx`: nagłówek z odznaką KŚT/15L i `InfoTooltip`, 4 karty KPI odtworzeń (Suma 15L, Średnioroczny, Liczba interwencji, Tarcza podatkowa CIT), suwak What-If, przełączniki i pola programów A/B/C, matryca wdrożeń, przełączniki trybów (Siatka 15L, Słupki, S-Curve) i przyciski stopki.
    - `OperatingAssumptionsForm.jsx`: nagłówek z odznaką COD i `InfoTooltip`, 4 karty KPI (Przychody, EBITDA, CCC, FTE), 5 podzakładek (Przychody, OPEX, NWC, Kadry, CIT), suwaki wzrostu i ramp-up, tabele strumieni przychodowych i etatów z akcjami, opcje CIT/tarczy podatkowej oraz tabela projekcji wieloletniej.
    - Weryfikacja testowa: rozszerzony zestaw `InvestmentPlanningTooltips.test.jsx` (10/10), 100% PASS we wszystkich 6 zestawach testowych modułu inwestycji (66 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).

  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w komponentach zakładki "2. Symulator What-If" modułu Project Finance (SensitivityCockpitView, ScenarioPresetSelector, DebtRepaymentModeSwitcher).
    - `SensitivityCockpitView.jsx`: dymki ikony aktywności, `InfoTooltip` tytułu symulatora What-If, odznaki `REAL-TIME` i telemetrii Web Workera (`Worker: X.X ms`), `InfoTooltip` i dymki we wszystkich 5 kartach KPI (Project NPV z deltami, Project IRR ze spreadem WACC, Equity MoIC z Equity NPV, Okres Zwrotu ze zdyskontowanym DPB, Kowenant DSCR z odznaką bankowalności i min DSCR), nagłówek sekcji suwaków z `InfoTooltip`, dostępne etykiety `aria-label` dla 7 suwaków wejściowych (CAPEX, Przychody, Koszty zmienne, Koszty stałe OPEX, Fundusz płac, WACC, Reinvestment), dymki dla przycisku przywrócenia modelu WACC, checkboxa aktywacji reinvestmentu oraz przycisków konfiguracji programów A/B/C, nagłówek wykresu 15-letniego z `InfoTooltip`, przełącznik trybów wykresu (Nominalne vs Zdyskontowane), dymki legendy serii danych i odznaki WACC, nagłówek tabeli Base vs What-If z `InfoTooltip`, odznaka statusu wariantu, dymki 5 nagłówków kolumn tabeli oraz precyzyjne dymki dla odznak wierszy.
    - `ScenarioPresetSelector.jsx`: migracja natywnych atrybutów `title` do komponentów `<Tooltip>`, dymek informacyjny `<InfoTooltip size="xs">` obok etykiety `SCENARIUSZ:`, dymki `<Tooltip>` z etykietami `aria-label` dla 5 przycisków scenariuszy (Bazowy, Optymistyczny, Stres-Test Bankowy, Stagflacja, Presja Płacowa), dymek dla przycisku akcji *"Przywróć Bazę"*, dymki dla odznak profilu ryzyka oraz odznaki scenariusza manualnego (`Własny`), dymki parametrów odchyleń (CAPEX, Przychody, Koszty zmienne, Płace, WACC).
    - `DebtRepaymentModeSwitcher.jsx`: migracja natywnego `title` do `<Tooltip>`, dymek na ikonie banku i `<InfoTooltip>` tytułu modułu spłat kapitałowych, dymki dla odznak statusu umowy oraz przycisku *"Przywróć umowę"*, pełna obsługa klawiatury (`role="button"`, `tabIndex={0}`, Enter/Space) z dymkami dla 3 kart amortyzacji długu (Annuity, Linear, Bullet), komponenty `<InfoTooltip size="xs">` i dymki statusu w pasku *Live Covenant & Cost Impact Bar* (Kowenant Min DSCR z odznaką bankowalności, Średni DSCR, Łączny koszt odsetek, Oszczędność/koszt wobec bazy).
    - Weryfikacja testowa: dedykowany zestaw testowy `SensitivityCockpitTooltips.test.jsx` (3/3), `SensitivityCockpitView.test.jsx` (15/15), `investmentSimulationRealTimeIntegration.test.jsx` (17/17), 100% PASS we wszystkich 5 zestawach testowych modułu inwestycji (54 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).

  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w komponentach zakładki "3. Model 15-letni & Wycena" modułu Project Finance (BankingCovenantsStrip, ExitValuationOverlay, ExitWaterfallVisualizer, ThreeStatementGrid).
    - `BankingCovenantsStrip.jsx`: eliminacja natywnego atrybutu `title` z listy naruszeń na rzecz dostępnego `<Tooltip>`, podpowiedzi na ikonie Landmark, badge statusu bankowalności, przełącznikach presetów ostrożnościowych (Standard LMA / Konserwatywny / Indywidualny), przełączniku skali (tys. / mln / pełne), przycisku zwijania, nagłówkach kolumn tabeli (Okres, EBITDA, CFADS, Obsługa Długu, DSCR, LLCR, ICR, CR, Dźwignia, DSRF, Zgodność), podpowiedzi dla komórek z bezpiecznym sprawdzaniem wartości null/undefined oraz wsparcie ARIA dla suwaków konfiguratora.
    - `ExitValuationOverlay.jsx`: dymki nagłówka i telemetrii (EV, MoIC, IRR, Buyer Yield), selektor skali, przycisk zwijania, komponenty `<InfoTooltip>` dla suwaków horyzontu wyjścia (Exit Timing z presetami Y3–Y15) i mnożnika EV/EBITDA z benchmarkami branżowymi, objaśnienia pojęć finansowych w 4 Executive KPI Cards, dymki w zakładce mostu wyceny (EV to Equity Bridge) oraz ekonomii nabywcy, pełna dostępność komórek dwuwymiarowej macierzy wrażliwości (`role="button"`, `tabIndex={0}`, obsługa klawiszy Enter / Space, etykiety ARIA i Floating UI tooltips).
    - `ExitWaterfallVisualizer.jsx`: dymki na ikonie sekcji Layers, podsumowaniu zwrotów (Sponsor MoIC, Partner MoIC, Total EqV), selektorze skali, przełączniku widoczności, komponenty `<InfoTooltip>` dla 4 paneli kontrolnych (Rok Wyjścia, Mnożnik EV, Struktura Podziału Pari Passu vs Two-Tier Hurdle, Udział Sponsora/LP), dymki dla zakładek podrzędnych, pasków poziomych mostu kaskadowego, kart inwestorów GP/LP oraz kolumn tabeli harmonogramu wypłat.
    - `ThreeStatementGrid.jsx`: migracja natywnego `title` na wskaźniku integralności bilansu (`balance-integrity-badge`) oraz przycisku tarczy podatkowej CIT do komponentów `<Tooltip>`, dymki dla przełącznika sprawozdań (RZiS, Bilans, Cash Flow, Zbiorczy), granularności (15 Lat vs 180M), skali (PLN / tys. / mln), przycisku eksportu do CSV oraz kontrolek rozwijania i zwijania sekcji.
    - Weryfikacja testowa: dedykowany zestaw testowy `InvestmentStatementsValuationTooltips.test.jsx` (7/7), `BankingCovenantsStrip.test.jsx` (17/17), `ExitValuationOverlay.test.jsx` (11/11), `ExitWaterfallVisualizer.test.jsx` (10/10), `ThreeStatementGrid.test.jsx` (11/11), 100% PASS we wszystkich 5 zestawach testowych modułu (56 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).

  - Wdrożenie dostępnych podpowiedzi Tooltip i InfoTooltip w komponentach zakładki "4. Scoring & Dossier PDF" modułu Project Finance (InvestmentDossierPdfGenerator, InvestmentReadinessScorecard, CustomReportBuilder).
    - `InvestmentDossierPdfGenerator.jsx`: bezkolizyjny import wykresów Recharts (`Tooltip as RechartsTooltip`), migracja natywnego `title` z pieczęci SHA-256 do `<Tooltip>`, dymki dla ikony nagłówka, odznaki LMA, przycisków akcji („Zwiń/Pokaż Podgląd”, „Dossier JSON”, „Drukuj / Pobierz PDF”), selektora skali kwot, selektora znaku wodnego, przycisku kopiowania SHA-256 oraz 7 checkboxów sekcji dossier, dymki w podglądzie wydruku A4 (sekcje, KPI, scorecard, warunki CP, parametry długu, tabela 15-letnia i wycena).
    - `InvestmentReadinessScorecard.jsx`: dymki na ikonie nagłówka, `InfoTooltip` dla scorecardu i presetów, tarcza punktacji (`overall-score-dial`), odznaka bankowalności, kafelki CPs i braków, pasek postępu, presety etapów dojrzałości (Greenfield, Development, RTB, COD), przyciski resetu (z zachowaniem wstecznej kompatybilności `title`), eksportu CSV i zapisu oceny, 4 karty filarów audytu, pasek filtrów, wskaźniki Auto-Sync oraz przyciski ewaluacji statusu kryteriów.
    - `CustomReportBuilder.jsx`: bezkolizyjny import wykresów Recharts (`Tooltip as RechartsTooltip`), dymki nagłówka, badge 15-Year Horizon, przyciski „Dodaj Pozycję”, „Pokaż/Ukryj Wykres”, „Eksportuj CSV”, komponenty `<InfoTooltip>` dla szablonów, horyzontu (5L, 10L, 15L), skali kwot oraz nagłówków tabeli, dymki dla przełączników wykresów liniowych i słupkowych, akcji wierszy (widoczność, góra, dół, usuń) oraz modalu wyboru wskaźników finansowych z dostępnym `aria-label="Zamknij bibliotekę"`.
    - Weryfikacja testowa: dedykowany zestaw testowy `InvestmentScoringDossierTooltips.test.jsx` (6/6), `InvestmentDossierPdfGenerator.test.jsx` (11/11), `InvestmentReadinessScorecard.test.jsx` (12/12), `CustomReportBuilder.test.jsx` (8/8), 100% PASS we wszystkich 4 zestawach testowych zakładki 4 (37 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).

- [x] **Faza 57: Fundament Architektury Routingu i Ochrona Tras**
  - Instalacja biblioteki react-router-dom oraz konfiguracja bazowej infrastruktury routingu.
    - Dodanie zależności `react-router-dom` (^7.18.4) w `package.json`.
    - Utworzenie centralnego rejestru tras `ROUTES` oraz słownika nagłówków widoków `ROUTE_TITLES` w `resources/js/constants/routes.js`.
    - Opakowanie korzenia aplikacji `<App />` w dostawcę kontekstu `<BrowserRouter>` w `resources/js/app.jsx`.
  - Implementacja strażników tras ProtectedRoute, GuestRoute oraz RoleGuard z RBAC.
    - Implementacja komponentów ochrony tras w `resources/js/components/routing/`: `ProtectedRoute.jsx` (przekierowanie na `/login` z zapamiętaniem `state.from`), `GuestRoute.jsx` (ochrona ekranów uwierzytelniania przed zalogowanymi użytkownikami) oraz `RoleGuard.jsx` (kontrola uprawnień RBAC z ostrzeżeniem i przekierowaniem na `/dashboard`).
    - Zbudowanie kompletnej deklaracji drzewa tras `<Routes>` w `resources/js/App.jsx` z powłoką `ProtectedLayout` i przekazywaniem kontekstu odświeżania (`Outlet context`).
    - Dedykowane zabezpieczenie trasy domenowej `/advisors` za pomocą `<RoleGuard allowedRoles={['super_admin', 'admin', 'advisor']}>`.
    - Weryfikacja testowa: 100% PASS w pełnym zestawie 69 plików Vitest (627 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
  - Synchronizacja przepływów uwierzytelniania i autoryzacji z historią React Router.
    - `LoginView.jsx`: integracja hooków `useNavigate` i `useLocation`, płynne przekierowanie na żądany pierwotnie adres (`location.state?.from?.pathname`) lub `/dashboard` po udanym logowaniu.
    - `Sidebar.jsx`: implementacja asynchronicznego `handleLogout` z czyszczeniem sesji i nawigacją na `/login`.
    - `client.js`: zsynchronizowanie interceptora HTTP 401 z adresem `ROUTES.LOGIN` oraz czyszczeniem pamięci podręcznej spółek.
    - `AcceptInvitationView.jsx` & `App.jsx`: obsługa parametrów ścieżki i query params za pomocą `useParams` oraz `useSearchParams`, wsparcie dla wariantów `/accept-invitation/:token` i `/invitation/accept`.
    - Weryfikacja testowa: 100% PASS w pełnym zestawie 69 plików Vitest (627 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).

- [x] **Faza 58: Integracja Układu Aplikacji i Semantycznej Nawigacji**
  - Przekształcenie AppLayout w układ oparty na gnieździe Outlet z dynamiczną rezolucją nagłówka.
    - `AppLayout.jsx`: wdrożenie komponentu `<Outlet context={{ onRefreshData, refreshing, refreshKey }} />` wewnątrz kontenera `<main>` z zachowaniem wsparcia dla propa `children` dla pełnej kompatybilności wstecznej.
    - `Header.jsx`: wdrożenie bezpiecznej rezolucji `useLocation()`, integracja stałych `ROUTE_TITLES` oraz hierarchicznego fallbacku tytułu ekranu (ścieżka URL -> strona główna -> parametry wsteczne -> domyślna nazwa 'FinBoard').
    - `App.jsx`: uproszczenie powłoki `ProtectedLayout` do natywnego użycia samonawigującego `<AppLayout />` i propagacji kontekstu odświeżania do `RouteView`.
    - Weryfikacja testowa: 100% PASS w pełnym zestawie 69 plików Vitest (627 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
  - Migracja nawigacji w Sidebarze na komponenty NavLink z dynamicznymi stanami aktywności.
    - `Sidebar.jsx`: powiązanie wszystkich modułów analitycznych i administracyjnych ze ścieżkami `ROUTES`, zastąpienie elementów `<button>` semantycznymi linkami `<NavLink to={item.path}>` z dynamicznym formatowaniem aktywnego modułu (`border-l-2 border-zinc-100`, kolory ikon i kodów modułów) oraz bezpiecznym fallbackiem `useInRouterContext()` dla odizolowanych testów jednostkowych.
    - `App.jsx`: usunięcie manualnego sterowania trasą `currentRoute` i procedurą `onRouteChange` z `ProtectedLayout`, powierzając nawigację komponentom `<NavLink>` i gniazdu `<Outlet />`.
    - Weryfikacja testowa: 100% PASS w pełnym zestawie 69 plików Vitest (627 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
  - Eliminacja przestarzałej nawigacji hash i dedykowany widok błędu 404 Not Found.
    - `ImportView.jsx`: eliminacja instrukcji `window.location.hash = '#records'` i zastąpienie jej semantyczną nawigacją `navigate(ROUTES.RECORDS)`.
    - `NotFoundView.jsx`: implementacja dedykowanego widoku błędu 404 w stylistyce dark terminal FinBoard Deal Advisory z diagnostyką ścieżki (`404-requested-path`), statusem sesji, symulacją polecenia CLI routera oraz przyciskami powrotu do Pulpitu / Ekranu Logowania i cofania w historii (`navigate(-1)`).
    - `routes.js` & `App.jsx`: rejestracja stałej `ROUTES.NOT_FOUND` (`/404`) oraz podpięcie `<NotFoundView />` pod jawną trasę `/404` i łapacz wszystkich nieznanych ścieżek (`*`).
    - Weryfikacja testowa: 100% PASS w pełnym zestawie 69 plików Vitest (627 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).

- [x] **Faza 59: Adaptacja Środowiska Testowego, Weryfikacja Regresji i Dokumentacja**
  - Pomocnik testowy renderWithRouter oraz testy jednostkowe strażników tras i Sidebara.
    - `renderWithRouter.jsx`: implementacja uniwersalnego pomocnika testowego dostarczającego `MemoryRouter`, sparametryzowane wpisy historii oraz instytucjonalne mocki kontekstów autoryzacji (`AuthContext`) i powiadomień (`NotificationContext`).
    - `RouteGuards.test.jsx`: stworzenie zestawu 12 testów jednostkowych weryfikujących zachowanie strażników `ProtectedRoute`, `GuestRoute` oraz `RoleGuard` (stany ładowania, przekierowania z zachowaniem `state.from`, autoryzację ról RBAC, ostrzeżenia i renderowanie `<Outlet />`).
    - `Sidebar.test.jsx`: stworzenie zestawu 8 testów jednostkowych weryfikujących atrybuty `href` linków `<NavLink>`, dynamiczne formatowanie aktywnej trasy, kontrolę dostępu do modułów doradczych oraz odporność na brak routera w trybie fallbacku przyciskowego.
    - Weryfikacja testowa: 100% PASS w pełnym zestawie 71 plików Vitest (647 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
  - Adaptacja istniejących zestawów testowych Vitest pod routing i weryfikacja zerowej regresji.
    - `spaRoutingNavigationWorkflow.test.jsx`: stworzenie zestawu 6 kompleksowych testów integracyjnych SPA weryfikujących w trybie end-to-end:
      1. Przekierowanie nieuwierzytelnionego użytkownika z `/dashboard` na `/login`.
      2. Zachowanie parametru docelowego deep-link (`/records`) w stanie lokalizacji i automatyczne przekierowanie po zalogowaniu.
      3. Płynne przechodzenie pomiędzy modułami platformy za pośrednictwem linków `<NavLink>` w menu bocznym ze zmianą nagłówka i stylów aktywnych.
      4. Egzekwowanie reguł kontroli dostępu RBAC na trasie `/advisors` z blokadą dla roli `client` i przekierowaniem na `/dashboard`.
      5. Obsługę nieznanych ścieżek URL przez dedykowany widok diagnostyczny 404 (`NotFoundView`) z powrotem do pulpitu.
      6. Pełną procedurę wylogowania użytkownika, zniszczenie tokena sesyjnego w `localStorage` i powrót na ekran logowania.
    - Weryfikacja testowa: 100% PASS w pełnym zestawie 72 plików Vitest (653 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
  - Aktualizacja dokumentacji architektonicznej, README i changelogów.
    - `docs/ROUTING_ARCHITECTURE.md`: opracowanie kompletnej, instytucjonalnej dokumentacji technicznej architektury nawigacji SPA, rejestru tras `ROUTES`, strażników tras (`ProtectedRoute`, `GuestRoute`, `RoleGuard`), powłoki `<Outlet />`, dynamicznej rezolucji nagłówka, semantycznego paska `Sidebar`, obsługi błędów 404, infrastruktury testowej `renderWithRouter` oraz wytycznych deweloperskich.
    - `README.md` & `changelog/README.md`: aktualizacja spisu technologii, opisu interfejsu SPA i rejestru zmian dokumentująca pełną eliminację problemu zamrożonego adresu URL i wdrożenie nowoczesnego routingu w całej aplikacji.
    - Weryfikacja testowa: 100% PASS w pełnym zestawie 72 plików Vitest (653 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
- [ ] **Faza 60: Wielomotywowość (Light, Dark & System Theme Architecture) (Commity 295–302)**
    - [x] Konfiguracja strategii Dark Mode w Tailwind CSS i eliminacja zjawiska FOUC za pomocą skryptu bootstrapowego.
        - `tailwind.config.js`: aktywacja strategii `darkMode: 'class'` umożliwiającej warunkowe stosowanie stylów motywu ciemnego za pośrednictwem wariantów `dark:*` sterowanych klasą `.dark` na elemencie `<html>`.
        - `resources/views/app.blade.php`: implementacja synchronicznego, odpornego na błędy skryptu bootstrapowego w sekcji `<head>`, natychmiast aplikującego klasę `dark` na podstawie `localStorage` (`finboard_theme`) lub preferencji systemowych `prefers-color-scheme: dark`, zapobiegając zjawisku FOUC.
        - Adaptacja klas bazowych kontenera `<html>` i `<body>` do elastycznych barw `bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-150`.
        - Weryfikacja testowa: 100% PASS w pełnym zestawie 72 plików Vitest (653 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
    - [x] Implementacja ThemeContext, hooka useTheme oraz synchronizacja z preferencjami systemowymi.
        - `resources/js/context/ThemeContext.jsx`: centralny silnik stanu motywu obsługujący tryby `light`, `dark` oraz `system` z trwałością w `localStorage` (`finboard_theme`).
        - Reaktywne wyznaczanie `resolvedTheme` i dynamiczne nasłuchiwanie zdarzeń systemowych `window.matchMedia('(prefers-color-scheme: dark)')` z automatyczną manipulacją klasą `.dark` na `document.documentElement`.
        - `resources/js/App.jsx`: integracja dostawcy `<ThemeProvider>` na szczycie hierarchii providerów platformy FinBoard.
        - Weryfikacja testowa: 100% PASS w pełnym zestawie 72 plików Vitest (653 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
    - [x] Budowa dostępnego komponentu ThemeToggle i integracja w nagłówku aplikacji.
        - `resources/js/components/ui/ThemeToggle.jsx`: intuicyjna kontrolka wyboru motywu z ikonami Lucide (`Sun`, `Moon`, `Monitor`), dynamicznym triggerem i menu wyboru z pełną obsługą ARIA (`role="menu"`, `role="menuitemradio"`, `aria-checked`).
        - Pełna obsługa klawiatury (`ArrowUp`, `ArrowDown`, `Escape`, `Enter`, `Space`), auto-zamykanie przy kliknięciu poza komponentem oraz integracja z systemem `<Tooltip>`.
        - `resources/js/components/layout/Header.jsx`: osadzenie przełącznika w pasku akcji nagłówka obok przycisku odświeżania i przełącznika spółek.
        - Weryfikacja testowa: 100% PASS w pełnym zestawie 72 plików Vitest (653 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
    - [x] Adaptacja powłoki układu aplikacji i komponentów nawigacyjnych do motywu jasnego i ciemnego.
        - `resources/js/components/layout/AppLayout.jsx`: przejście z ciemnego szkieletu na adaptacyjne `bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100` z płynną animacją `transition-colors duration-150`.
        - `resources/js/components/layout/Header.jsx`: implementacja tła `bg-white/95 dark:bg-zinc-950/95` z rozmyciem `backdrop-blur`, obramowaniem `border-zinc-200 dark:border-zinc-800` i zbalansowanym kontrastem przycisków akcji.
        - `resources/js/components/layout/Sidebar.jsx`: pełne wsparcie dla jasnego motywu (`bg-white dark:bg-zinc-950`), adaptacja sygnetu FB, aktywnego stanu linków `NavLink` i boksu spółki z zachowaniem pełnej zgodności testowej.
        - `resources/js/components/layout/DealContextBar.jsx` & `CompanySwitcherModal.jsx`: dostosowanie kontrastu tła, przełączników walutowych, selektorów okresów fiskalnych oraz listy spółek portfelowych.
        - Weryfikacja testowa: 100% PASS w pełnym zestawie 72 plików Vitest (653 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
    - [x] Dostosowanie komponentów bazowych UI (`Card`, `FinancialTable`, `Button`, `Badge`, `Tooltip`, `FinancialValue`, `PercentageBadge`, `UserProfileModal`) do motywu jasnego i ciemnego.
        - `resources/js/components/ui/Card.jsx` & `MetricCard`: wyeliminowanie sztywnego ciemnego tła, wdrożenie adaptacyjnych tokenów barwnych (`bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100`) oraz wariantów trendów KPI o wysokim kontraście.
        - `resources/js/components/ui/FinancialTable.jsx`: dostosowanie nagłówka tabeli `thead`, wierszy danych z `hover`, linii podziału `divide-zinc-200 dark:divide-zinc-850`, wierszy podsumowań PSR/MSR oraz wierszy zagnieżdżonych.
        - `resources/js/components/ui/Button.jsx`: zaktualizowanie stylizacji wszystkich wariantów przycisków (`primary`, `secondary`, `outline`, `ghost`, `danger`, `success`).
        - `resources/js/components/ui/Badge.jsx` & `PercentageBadge`: adaptacja etykiet statusowych oraz wskaźników zmian procentowych (wzrost, spadek, neutralne 0.0%, brak danych) do standardu WCAG 2.1 AA.
        - `resources/js/components/ui/Tooltip.jsx` & `InfoTooltip`: adaptacja dymków pływających i strzałek Floating UI do jasnego i ciemnego motywu.
        - `resources/js/components/ui/FinancialValue.jsx`: czytelna typografia kwot walutowych (`text-zinc-900 dark:text-zinc-100`, `text-emerald-600 dark:text-emerald-400`, `text-rose-600 dark:text-rose-400`).
        - `resources/js/components/auth/UserProfileModal.jsx`: dostosowanie okna modalnego profilu, pól formularzy tożsamości i haseł oraz sekcji audytu Sanctum.
        - Weryfikacja testowa: 100% PASS w pełnym zestawie 72 plików Vitest (653 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
    - [x] Adaptacja wykresów analitycznych Recharts i tooltipów do motywu jasnego i ciemnego.
        - `resources/js/components/charts/CustomChartTooltip.jsx` & `ReinvestmentManager.jsx`: adaptacja kontenera tooltipa wykresu (`bg-white/95 dark:bg-zinc-950/95 border-zinc-200 dark:border-zinc-750`), etykiet serii i wartości.
        - `resources/js/components/charts/LiquidityTrendChart.jsx`: dynamiczne tokeny siatki `CartesianGrid` (`#27272a` vs `#e4e4e7`), osi i punktów `dot` wyznaczane przez `useTheme()`; formatter etykiet legendy.
        - `resources/js/components/charts/PnlTrendChart.jsx`: adaptacja siatki, osi, obrysów linii EBITDA i zysku netto oraz wskaźnika podświetlenia kursora (`cursorFill`).
        - `resources/js/components/charts/CostBreakdownChart.jsx`: dynamiczny obrys wycinków `pieStroke` (`#ffffff` vs `#09090b`), plakietka sumy kosztów oraz adaptacyjna mikro-legenda z dynamiką YoY.
        - `resources/js/components/investments/SensitivityCockpitView.jsx` & `ReinvestmentManager.jsx`: pełna spójność kolorystyczna siatek i osi wykresów symulacyjnych i odtworzeniowych CAPEX.
        - Weryfikacja testowa: 100% PASS w pełnym zestawie 72 plików Vitest (653 testy) oraz bezbłędna kompilacja produkcyjna (`npm run build`).
    - [x] Implementacja testów jednostkowych i integracyjnych dla ThemeContext i ThemeToggle.
        - `resources/js/tests/unit/ThemeContext.test.jsx`: 10 kompleksowych testów weryfikujących inicjalizację z `prefers-color-scheme`, trwałość w `localStorage`, przełączanie trybów `light`, `dark` i `system`, dynamiczne nasłuchiwanie zdarzeń systemowych `matchMedia`, bezpieczny fallback poza providerem oraz walidację danych wejściowych.
        - `resources/js/tests/components/ThemeToggle.test.jsx`: 7 testów komponentowych sprawdzających renderowanie przycisku, atrybuty WAI-ARIA (`role="menu"`, `role="menuitemradio"`, `aria-checked`), otwieranie/zamykanie menu, interakcję wyboru motywu z powrotem fokusu oraz pełną obsługę klawiatury (`ArrowDown`, `ArrowUp`, `Escape`) i outside click.
        - Weryfikacja testowa: 100% PASS w pełnym zestawie 74 plików Vitest (670 testów) oraz bezbłędna kompilacja produkcyjna (`npm run build`).

---



## 📜 Licencja
Projekt objęty licencją własną dla platformy FinBoard.

