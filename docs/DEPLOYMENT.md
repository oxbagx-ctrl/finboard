# FinBoard – Przewodnik Wdrożenia Produkcyjnego i Runbook Operacyjny (Ops Guide)

Niniejszy dokument stanowi oficjalny przewodnik operacyjny wdrożenia, konfiguracji i utrzymania platformy analityki finansowej oraz Virtual Data Room **FinBoard** w środowisku produkcyjnym.

---

## 1. Architektura Infrastruktury Produkcyjnej

Platforma FinBoard opiera się na konteneryzowanej architekturze mikro-usług wspierającej model **Multi-Tenant** z rygorystyczną izolacją danych:

```
                          [ Internet / Klient / CFO / Doradca M&A ]
                                            │
                                            ▼ HTTPS (443)
                         ┌─────────────────────────────────────┐
                         │   Nginx Reverse Proxy (finboard-web)│
                         │   - Wektorowy cache zasobów /build/ │
                         │   - Nagłówki bezpieczeństwa         │
                         │   - Kompresja Gzip (tabelaryczna)   │
                         └──────────────────┬──────────────────┘
                                            │ FastCGI (9000)
                         ┌──────────────────▼──────────────────┐
                         │   PHP-FPM 8.2 (finboard-app)        │
                         │   - Laravel 11 (DDD / CQRS)         │
                         │   - Bcmath (precyzja finansowa)     │
                         │   - Sanctum Token Authentication    │
                         └───────┬────────────────────┬────────┘
                                 │                    │
        PostgreSQL 16 (Port 5432)│                    │ Redis 7 (Port 6379)
        ┌────────────────────────▼──┐              ┌──▼────────────────────────┐
        │ PostgreSQL (RDBMS)        │              │ Redis (Cache & Queue)     │
        │ - Transakcje Finansowe    │              │ - Broker zadań asynchronicznych│
        │ - Virtual Data Room (VDR) │              │ - Cache zapytań analitycznych │
        │ - Logi audytowe SHA-256   │              │ - Przetwarzanie plików CSV│
        └───────────────────────────┘              └──┬────────────────────────┘
                                                      │
                                                      │ Pobieranie zadań importu
                                           ┌──────────▼────────────────────────┐
                                           │ Queue Worker (finboard-worker)    │
                                           │ - Kolejka: financial-imports      │
                                           │ - Asynchroniczny parser CSV       │
                                           └───────────────────────────────────┘
                                                      │
                                           ┌──────────▼────────────────────────┐
                                           │ Scheduler (finboard-scheduler)    │
                                           │ - Harmonogram cron zadań          │
                                           └───────────────────────────────────┘
```

---

## 2. Wymagania Sprzętowe i Systemowe

| Komponent | Minimalne | Zalecane Produkcyjnie |
| :--- | :--- | :--- |
| **System Operacyjny** | Linux (Ubuntu 22.04 LTS / Debian 12 / RHEL 9) | Linux (Ubuntu 24.04 LTS) |
| **CPU** | 2 rdzenie vCPU | 4–8 rdzeni vCPU (analityka P&L i parsowanie CSV) |
| **RAM** | 4 GB | 8–16 GB |
| **Dysk** | 30 GB SSD | 100+ GB NVMe SSD (repozytorium dokumentów VDR) |
| **Oprogramowanie** | Docker Engine 24+, Docker Compose v2+ | Docker Engine 26+, Docker Compose v2+ |

### Konfiguracja Jądra Systemu (Kernel Tuning)
Przed uruchomieniem bazy danych i klastra Redis zaleca się wprowadzenie poniższych parametrów w `/etc/sysctl.conf`:
```ini
vm.overcommit_memory = 1
net.core.somaxconn = 1024
fs.file-max = 2097152
```
Aplikacja zmian: `sudo sysctl -p`

---

## 3. Konfiguracja Środowiska Produkcyjnego (`.env`)

Utwórz produkcyjny plik `.env` bazując na `.env.example`:

```ini
APP_NAME=FinBoard
APP_ENV=production
APP_KEY=base64:... # Wygenerowane przez: php artisan key:generate
APP_DEBUG=false
APP_URL=https://finboard.twojadomena.com

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=info

# Baza danych PostgreSQL
DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=finboard_production
DB_USERNAME=finboard_prod_user
DB_PASSWORD=TWOJE_SILNE_HASLO_DB

# Pamięć podręczna i kolejki asynchroniczne Redis
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

REDIS_CLIENT=phpredis
REDIS_HOST=redis
REDIS_PASSWORD=TWOJE_SILNE_HASLO_REDIS
REDIS_PORT=6379

# Bezpieczeństwo sesji i cookies
SESSION_LIFETIME=120
SESSION_ENCRYPT=true
SESSION_PATH=/
SESSION_DOMAIN=.twojadomena.com
SESSION_SECURE_COOKIE=true
```

---

## 4. Procedura Wdrożenia Początkowego (Initial Bootstrap)

```bash
# 1. Klonowanie repozytorium
git clone git@github.com:twoja-organizacja/finboard.git /var/www/finboard
cd /var/www/finboard

# 2. Skonfigurowanie pliku .env
cp .env.example .env
# [Wprowadź docelowe hasła i konfigurację w .env]

# 3. Zbudowanie kontenerów produkcyjnych
docker compose -f docker-compose.prod.yml build

# 4. Uruchomienie usług bazodanowych i kolejkowych
docker compose -f docker-compose.prod.yml up -d postgres redis
sleep 5

# 5. Uruchomienie kontenera aplikacji i wygenerowanie klucza szyfrowania
docker compose -f docker-compose.prod.yml up -d app
docker compose -f docker-compose.prod.yml exec -T app php artisan key:generate --force

# 6. Wykonanie migracji bazodanowych
docker compose -f docker-compose.prod.yml exec -T app php artisan migrate --force

# 7. Zbudowanie zoptymalizowanych assetów frontendu (React)
npm ci --production=false
npm run build

# 8. Podpięcie magazynu plików Data Room (Storage Link)
docker compose -f docker-compose.prod.yml exec -T app php artisan storage:link

# 9. Uruchomienie pozostałych usług (Web, Worker, Scheduler)
docker compose -f docker-compose.prod.yml up -d
```

---

## 5. Zautomatyzowane Wdrożenie Bezprzerwowe (Zero-Downtime Deploy)

Do rutynowych aktualizacji kodu i wdrożeń produkcyjnych służy przygotowany skrypt:

```bash
./scripts/deploy.sh
```

### Etapy realizowane przez skrypt:
1. **Pre-flight Checks**: Walidacja obecności `.env` oraz dostępności silnika Docker.
2. **Kompilacja frontendu**: Budowanie minifikowanych paczek JS/CSS Vite (`npm run build`).
3. **Orkiestracja kontenerów**: Zapewnienie działania wszystkich kontenerów aplikacji.
4. **Migracje bazy danych**: Bezpieczne wykonanie ewentualnych nowych migracji (`migrate --force`).
5. **Weryfikacja magazynu**: Sprawdzenie symlinków do dokumentów VDR.
6. **Optymalizacja pamięci podręcznej**:
   - `php artisan config:cache`
   - `php artisan route:cache`
   - `php artisan view:cache`
   - `php artisan event:cache`
7. **Płynny restart workerów**: Wysłanie sygnału `php artisan queue:restart`, pozwalającego workerom dokończyć aktywne parsowanie CSV i przeładować kod.
8. **Automatyczna walidacja zdrowia (Liveness Probe)**: Wywołanie testu endpointu `/api/v1/health`.

---

## 6. Procedura Tworzenia i Odtwarzania Kopii Zapasowych (Disaster Recovery)

### Wykonanie Kopii Zapasowej
Wykonywane automatycznie przez skrypt:
```bash
./scripts/backup.sh
```
Skrypt generuje:
- Spójny zrzut bazy PostgreSQL: `storage/backups/finboard_db_YYYYMMDD_HHMMSS.dump.gz`
- Skompresowane archiwum dokumentów VDR: `storage/backups/finboard_vdr_documents_YYYYMMDD_HHMMSS.tar.gz`
- Automatyczną rotację plików starszych niż 30 dni.

### Procedura Odtworzenia po Awarii (Restore)
```bash
# 1. Zatrzymanie ruchu aplikacyjnego
docker compose exec -T app php artisan down --secret="finboard-emergency-access"

# 2. Odtworzenie bazy danych PostgreSQL
gunzip -c /var/backups/finboard_db_20260918_120000.dump.gz > /tmp/restore.dump
docker compose exec -T postgres dropdb -U finboard_user --if-exists finboard
docker compose exec -T postgres createdb -U finboard_user finboard
docker compose exec -T postgres pg_restore -U finboard_user -d finboard /tmp/restore.dump

# 3. Odtworzenie plików Data Room
tar -xzf /var/backups/finboard_vdr_documents_20260918_120000.tar.gz -C storage/app/

# 4. Przywrócenie ruchu
docker compose exec -T app php artisan up
```

---

## 7. Monitoring i Diagnostyka Produkcyjna

### Endpoint Health Check
Platforma udostępnia endpoint `GET /api/v1/health` przeznaczony dla systemów monitoringu (np. Prometheus, Datadog, Uptime Robot, AWS ALB / Kubernetes Probes).

**Przykładowa odpowiedź:**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-18T19:30:00+00:00",
  "platform": "FinBoard Enterprise Financial Platform",
  "environment": "production",
  "php_version": "8.2.33",
  "services": {
    "database": {
      "status": "ok",
      "latency_ms": 1.42
    },
    "redis": {
      "status": "ok"
    },
    "storage": {
      "status": "ok",
      "disk": "local"
    }
  },
  "memory_usage": "18 MB"
}
```

### Inspekcja Logów Usług
```bash
# Logi aplikacji PHP
docker compose logs -f --tail=100 app

# Logi asynchronicznego workera kolejek
docker compose logs -f --tail=100 worker

# Logi zapytań serwera WWW Nginx
docker compose logs -f --tail=100 web

# Logi bazy PostgreSQL
docker compose logs -f --tail=100 postgres
```

---

## 8. Procedury Awaryjne (Troubleshooting Playbook)

### Problem: Zablokowanie kolejki importu plików CSV
**Objawy**: Pasek postępu w interfejsie importu zatrzymuje się na statusie `PENDING` lub `PROCESSING`.
**Rozwiązanie**:
1. Sprawdź stan workera: `docker compose ps worker`
2. Sprawdź błędy w kolejce:
   ```bash
   docker compose exec -T app php artisan queue:failed
   ```
3. W razie potrzeby ponów przetworzenie zadania:
   ```bash
   docker compose exec -T app php artisan queue:retry all
   ```
4. Zrestartuj proces workera:
   ```bash
   docker compose restart worker
   ```

### Problem: Odmowa dostępu do dokumentu VDR (403 Forbidden)
**Objawy**: Użytkownik nie może otworzyć lub pobrać pliku z pokoju danych.
**Rozwiązanie**:
Sprawdź weryfikację uprawnień w dzienniku audytowym:
```bash
docker compose exec -T app php artisan tinker --execute="
    \$user = App\Models\User::where('email', 'klient@acme.com')->first();
    \$doc = App\Models\Document::find('doc-uuid');
    echo 'User company: ' . \$user->company_id . ' | Doc company: ' . \$doc->company_id;
"
```
Jeżeli identyfikatory są różne, mechanizm izolacji Multi-Tenant poprawnie zablokował nieautoryzowany dostęp transakcyjny.
