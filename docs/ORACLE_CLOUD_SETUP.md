# Oracle Cloud Always Free – Instrukcja Konfiguracji Serwera i Sieci

Kompletny poradnik krok po kroku pozwalający odtworzyć od zera darmowe środowisko serwerowe w chmurze **Oracle Cloud Infrastructure (OCI)** dla platformy **FinBoard** (lub dowolnej innej aplikacji opartej o kontenery Docker).

---

## 1. Założenie konta Oracle Cloud (Always Free)

### Wymagania wstępne:
* Adres e-mail, który nie był wcześniej używany w Oracle Cloud.
* Numer telefonu do weryfikacji SMS.
* Imienna karta debetowa lub kredytowa (włączone płatności internetowe). Podczas rejestracji Oracle zakłada tymczasową blokadę weryfikacyjną (ok. 1 EUR / 1 USD / ~4–5 PLN), która po kilku dniach jest automatycznie zwracana.

### Kluczowe decyzje podczas rejestracji:
1. **Typ konta:** Wybierz konto darmowe / **„Zawsze bezpłatne” (Always Free)**.
   * Przez pierwsze 30 dni otrzymujesz bonus próbny (Free Trial, ok. 300 USD). Po 30 dniach konto przechodzi w stały tryb bezpłatny (*Always Free*), bez pobierania jakichkolwiek opłat.
2. **Region macierzysty (Home Region):**
   * Wybierz **Germany Central (Frankfurt – `eu-frankfurt-1`)** lub opcjonalnie **Netherlands Northwest (Amsterdam – `eu-amsterdam-1`)**.
   * ⚠️ **Uwaga:** Regionu macierzystego dla konta darmowego **nie można zmienić po rejestracji**. Frankfurt zapewnia najniższe opóźnienia do Polski (15–25 ms) oraz największą dostępność darmowych maszyn Ampere A1.

---

## 2. Tworzenie maszyny wirtualnej (Compute Instance)

Po zalogowaniu do panelu OCI:
1. Kliknij menu główne (lewy górny róg) → **Compute** → **Instances**.
2. Kliknij przycisk **Create instance**.

### Krok 1: Basic Information & Placement
* **Name:** Wpisz dowolną nazwę (np. `finboard-demo`).
* **Placement (Strefa dostępności):**
  * Frankfurt posiada 3 strefy: `AD-1`, `AD-2`, `AD-3`.
  * Zaznacz **AD-1** (jeśli później pojawi się błąd braku wolnych maszyn *Out of capacity*, zmień na **AD-3** lub **AD-2**).
  * Opcje zaawansowane (*Advanced options*) pozostaw bez zmian.

### Krok 2: Image & Shape (System i zasoby)
* **Image (System operacyjny):**
  * Domyślnie zaznaczony jest Oracle Linux. Kliknij **Change image**.
  * Wybierz **Canonical Ubuntu**.
  * Zaznacz wersję: **`Canonical Ubuntu 24.04 Minimal aarch64`** (lub `22.04 Minimal aarch64`).
  * ⚠️ **Ważne:** Dopisek **`aarch64`** jest obowiązkowy dla procesorów ARM Ampere. Wersja *Minimal* jest najszybsza i pozbawiona zbędnego oprogramowania. Kliknij **Select image**.
* **Shape (Procesor i RAM):**
  * Kliknij **Change shape**.
  * Wybierz kafel **Ampere** (ARM-based Processor) → **VM.Standard.A1.Flex**.
  * Ustaw suwaki:
    * **OCPU:** `2` (lub `1` w przypadku ograniczeń strefy)
    * **Memory (RAM):** `12 GB` (lub `6 GB`)
  * Upewnij się, że widoczna jest zielona/szara etykieta **Always Free Eligible**. Kliknij **Select shape**.

### Krok 3: Security
* Opcje **Shielded Instance** oraz **Confidential Computing** pozostaw **wyłączone** (domyślnie).

### Krok 4: Networking (Sieć i Publiczne IP)
* **Primary network:** Wybierz **`Create new virtual cloud network`**.
* **Subnet:** Wybierz **`Create new public subnet`**.
* **Public IPv4 address assignment:**
  * *Uwaga:* Przełącznik może być wyszarzony z ostrzeżeniem *„You must select a public subnet...”*. Jest to normalne zachowanie panelu Oracle podczas tworzenia nowej sieci w tym samym formularzu. Wybranie opcji *Create new public subnet* gwarantuje, że serwer otrzyma publiczny adres IP.
* **Add SSH keys (Klucze dostępowe) – KROK KRYTYCZNY:**
  * Zaznacz **Generate a key pair for me**.
  * Kliknij przycisk **Download private key** i zapisz plik (np. `ssh-key.key`) na swoim komputerze. Bez tego pliku nie połączysz się z serwerem.

### Krok 5: Storage (Dysk twardy)
* Domyślny rozmiar to **46,6 GB** (jest w 100% darmowy i w zupełności wystarcza na system, Dockera i bazę danych).
* W pakiecie *Always Free* darmowy limit wynosi 200 GB. W razie potrzeby dysk można w każdej chwili powiększyć w panelu w locie (bez utraty danych).

### Krok 6: Podsumowanie (Review) i Uruchomienie
1. Jeśli klikniesz *View estimated cost* i zobaczysz kwotę (np. ~7,69 zł/mies. za dysk) – jest to wyłącznie suchy cennik katalogowy bez rabatów. Zgodnie z regulaminem Always Free, opłata wynosi **0,00 PLN**.
2. Kliknij czarny przycisk **Create**.
3. **Rozwiązanie ewentualnego błędu *Out of capacity*:**
   * Jeśli pojawi się błąd: `Out of capacity for shape VM.Standard.A1.Flex in availability domain AD-...`:
   * Wróć do edycji sekcji **Placement** i zmień strefę na inną (np. z AD-2 na **AD-1** lub **AD-3**).
   * Jeśli nadal występuje brak miejsc, zmniejsz zasoby do **1 OCPU i 6 GB RAM**.
4. Poczekaj 1–2 minuty, aż status serwera zmieni się z pomarańczowego `PROVISIONING` na zielony **`RUNNING`**.
5. W szczegółach serwera odczytaj **Public IP Address** (np. `130.61.x.x`).

---

## 3. Konfiguracja Zapory Ogniowej (Otwarcie portów 80 i 443)

Domyślnie Oracle Cloud przepuszcza tylko ruch na porcie 22 (SSH). Aby aplikacja otwierała się w przeglądarce internetowej:

1. W menu głównym OCI wybierz **Networking** → **Virtual Cloud Networks**.
2. Kliknij w nazwę swojej sieci (np. `vcn-20260921-...`).
3. W lewym menu w sekcji **Resources** kliknij **Security Lists**, a następnie kliknij w **Default Security List for vcn-...**.
4. Kliknij przycisk **Add Ingress Rules**.
5. Wypełnij pola:
   * **Stateless:** Wyłączone.
   * **Source Type:** `CIDR`
   * **Source CIDR:** `0.0.0.0/0` (ruch z całego internetu)
   * **IP Protocol:** `TCP`
   * **Source Port Range:** pozostaw puste (wszystkie)
   * **Destination Port Range:** `80,443` (HTTP i HTTPS)
   * **Description:** `HTTP and HTTPS for FinBoard Web`
6. Kliknij **Add Ingress Rules**.

---

## 4. Konfiguracja Domeny i DNS (na przykładzie rejestratora nazwa.pl)

Aby skierować domenę (np. `ethon.pl`) na publiczny adres IP serwera Oracle Cloud i umożliwić wygenerowanie darmowego certyfikatu SSL Let's Encrypt:

1. Zaloguj się do **Panelu Klienta nazwa.pl** ([admin.nazwa.pl](https://admin.nazwa.pl)).
2. W menu głównym przejdź do: **Domeny** → **Moje domeny** (lub *Zarządzanie domenami*).
3. Przy wybranej domenie kliknij przycisk **Konfiguruj** (lub kliknij nazwę domeny).
4. Przewiń na sam dół strony i kliknij pomarańczowy przycisk **ZMIEŃ**, aby odblokować formularz edycji.
5. Z listy dostępnych trybów wybierz:  
   👉 **`Ręczna konfiguracja DNS`** (trzecia opcja od góry).
6. W wyświetlonej tabeli rekordów strefy DNS zmodyfikuj dwa wiersze typu **A**:
   * **Wiersz dla domeny głównej (`twojadomena.pl`):**
     * Typ: `A`
     * Wartość: wpisz publiczny adres IP serwera Oracle (np. `130.61.229.63`).
   * **Wiersz dla subdomen (`*.twojadomena.pl` lub `www`):**
     * Typ: `A`
     * Wartość: wpisz ten sam publiczny adres IP serwera Oracle (np. `130.61.229.63`).
7. ⚠️ **Pozostałe rekordy:**
   * Rekordy `MX` (poczta e-mail), `TXT` (SPF, DKIM) oraz `NS` pozostaw bez zmian, aby nie przerwać działania poczty.
   * Upewnij się, że w rekordach `CAA` znajduje się wpis zezwalający na wystawianie certyfikatu przez Let's Encrypt (`issue "letsencrypt.org"` oraz `issuewild "letsencrypt.org"`).
8. Kliknij pomarańczowy przycisk **ZATWIERDŹ** w prawym dolnym rogu.
9. **Czas propagacji:** Zmiana rozgłasza się w globalnej sieci DNS w czasie od kilkunastu minut do 1–2 godzin.

---

## 5. Połączenie przez SSH

Otwórz terminal na swoim komputerze:

### System Linux / macOS:
1. Przejdź do folderu z pobranym kluczem prywatnym i nadaj mu odpowiednie uprawnienia (wymóg kluczy SSH):
   ```bash
   chmod 400 ~/Pobrane/ssh-key-*.key
   ```
2. Połącz się z serwerem (domyślny użytkownik w Oracle Ubuntu to `ubuntu`):
   ```bash
   ssh -i ~/Pobrane/ssh-key-*.key ubuntu@TWÓJ_PUBLICZNY_IP
   ```
3. Przy pierwszym połączeniu potwierdź tożsamość hosta wpisując `yes`.

### System Windows (PowerShell):
```powershell
ssh -i C:\Users\TwojaNazwa\Downloads\ssh-key.key ubuntu@TWÓJ_PUBLICZNY_IP
```

---

## 6. Instalacja Docker i Docker Compose (Ubuntu ARM64)

Po zalogowaniu się na serwer przez SSH skonfiguruj środowisko kontenerowe oraz lokalny firewall systemowy.

### Krok 1: Aktualizacja systemu i instalacja oficjalnego silnika Docker
Wklej w terminalu serwera:
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```
*Skrypt automatycznie rozpozna architekturę procesora Ampere (aarch64) i zainstaluje najnowszą wersję Docker Engine oraz wtyczkę `docker compose`.*

### Krok 2: Nadanie uprawnień użytkownikowi (praca bez sudo)
Aby móc uruchamiać kontenery bez wpisywania `sudo`:
```bash
sudo usermod -aG docker ubuntu
newgrp docker
```

### Krok 3: Otwarcie portów 80 i 443 w lokalnym firewallu iptables
Obrazy Ubuntu na Oracle Cloud mają fabrycznie skonfigurowane reguły `iptables`, które mogą odrzucać ruch przychodzący na porty HTTP/HTTPS. Otwórz je wewnątrz systemu i zapisz stan zapory:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### Krok 4: Test instalacji
Sprawdź wersje narzędzi oraz uruchom kontener testowy:
```bash
docker --version && docker compose version
docker run --rm hello-world
```
*Komunikat „Hello from Docker!” potwierdza gotowość serwera do uruchomienia aplikacji.*

---

## 7. Wdrożenie platformy FinBoard (Docker & Laravel)

Dzięki konteneryzacji na serwerze nie jest wymagana instalacja PHP, Node.js ani Composera na hoście.

### Krok 1: Pobranie kodu aplikacji
```bash
git clone https://github.com/oxbagx-ctrl/finboard.git ~/finboard
cd ~/finboard
```

### Krok 2: Konfiguracja produkcyjnego pliku `.env`
W katalogu `~/finboard` utwórz plik konfiguracyjny `.env`:
```bash
cat << 'EOF' > .env
APP_NAME=FinBoard
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_TIMEZONE=Europe/Warsaw
APP_URL=https://ethon.pl

APP_LOCALE=pl
APP_FALLBACK_LOCALE=en

LOG_CHANNEL=stack
LOG_LEVEL=info

DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=finboard
DB_USERNAME=finboard_user
DB_PASSWORD=finboard_secret_pass_2026

SESSION_DRIVER=redis
SESSION_LIFETIME=120

QUEUE_CONNECTION=redis
CACHE_STORE=redis
CACHE_PREFIX=finboard_cache

REDIS_CLIENT=phpredis
REDIS_HOST=redis
REDIS_PASSWORD=finboard_redis_secret_pass_2026
REDIS_PORT=6379

FILESYSTEM_DISK=local
FORWARD_HTTP_PORT=80
FORWARD_HTTPS_PORT=443
EOF
```

### Krok 3: Budowa kontenerów i instalacja zależności
```bash
# 1. Zbudowanie obrazów kontenerów (PHP-FPM, Postgres, Redis, Nginx)
docker compose -f docker-compose.prod.yml build

# 2. Instalacja zależności Composer z uprawnieniami roota (tworzy vendor i composer.lock)
docker compose -f docker-compose.prod.yml run --rm --user root app composer install --optimize-autoloader --no-dev

# 3. Wygenerowanie klucza szyfrowania APP_KEY
docker compose -f docker-compose.prod.yml run --rm --user root app php artisan key:generate

# 4. Kompilacja frontendu (React + Vite) w kontenerze Node
docker run --rm -v $(pwd):/app -w /app node:20-alpine sh -c "npm ci && npm run build"

# 5. Nadanie uprawnień do zapisu dla storage, cache oraz folderu public
sudo chmod -R 777 storage bootstrap/cache public
```

### Krok 4: Uruchomienie aplikacji i inicjalizacja bazy danych
```bash
# Start kontenerów w tle
docker compose -f docker-compose.prod.yml up -d

# Zastosowanie migracji PostgreSQL
docker compose -f docker-compose.prod.yml exec -T app php artisan migrate --force

# Wgranie przykładowych danych finansowych i kont użytkowników
docker compose -f docker-compose.prod.yml exec -T app php artisan db:seed --force

# Utworzenie dowiązania symbolicznego dla plików VDR
docker compose -f docker-compose.prod.yml exec -u 0 -T app php artisan storage:link
```

### Domyślne konta demonstracyjne w systemie:
* **Super Admin (Partner Helvest):** `superadmin@helvest.com` / hasło: `password123`
* **Doradca Transakcyjny:** `advisor@helvest.com` / hasło: `password123`
* **Analityk Finansowy:** `admin@helvest.com` / hasło: `password123`
* **Klient / CFO (Acme):** `klient@acme.com` / hasło: `password123`

---

## 8. Darmowy certyfikat SSL (Let's Encrypt) dla domeny ethon.pl

Gdy aplikacja odpowiada już na porcie HTTP (`http://ethon.pl`), zabezpiecz ją darmowym certyfikatem SSL.

### Krok 1: Instalacja narzędzia Certbot na serwerze
```bash
sudo apt update
sudo apt install -y certbot
```

### Krok 2: Wygenerowanie certyfikatu SSL (metoda Webroot)
Certbot wykorzysta działający serwer Nginx i folder `public` do przejścia weryfikacji domeny:
```bash
sudo certbot certonly --webroot -w /home/ubuntu/finboard/public -d ethon.pl -d www.ethon.pl --agree-tos --email twoj-email@domena.pl --non-interactive
```
*Certyfikaty zostaną zapisane w: `/etc/letsencrypt/live/ethon.pl/`.*

### Krok 3: Podpięcie certyfikatu pod Nginx w `docker-compose.prod.yml`
W pliku `docker-compose.prod.yml` dodaj montowanie katalogu `/etc/letsencrypt` do serwisu `web`:
```yaml
  web:
    image: nginx:1.25-alpine
    ...
    volumes:
      - ./:/var/www/html:ro
      - ./docker/nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

### Krok 4: Aktualizacja konfiguracji Nginx (`docker/nginx/conf.d/default.conf`)
Zastąp zawartość pliku `docker/nginx/conf.d/default.conf` konfiguracją z obsługą HTTPS oraz przekierowaniem z portu 80:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ethon.pl www.ethon.pl;

    location /.well-known/acme-challenge/ {
        root /var/www/html/public;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ethon.pl www.ethon.pl;
    root /var/www/html/public;

    ssl_certificate /etc/letsencrypt/live/ethon.pl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ethon.pl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Institutional Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    index index.php index.html;
    charset utf-8;
    client_max_body_size 64M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/x-javascript application/xml application/xml+rss image/svg+xml;

    location ^~ /build/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass app:9000;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
        fastcgi_buffers 16 16k;
        fastcgi_buffer_size 32k;
        fastcgi_read_timeout 300;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

### Krok 5: Restart serwera Nginx
```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate web
```
*Od tego momentu strona `https://ethon.pl` jest zabezpieczona certyfikatem SSL z bezpiecznym przekierowaniem z HTTP.*

### Krok 6: Automatyczne odnawianie certyfikatu (Deploy Hook)
Certyfikaty Let's Encrypt są ważne 90 dni. Aby certyfikat odnawiał się samoczynnie w tle, a Nginx w Dockerze automatycznie przeładowywał nowe pliki, utwórz skrypt *Deploy Hook*:
```bash
sudo bash -c 'cat << "EOF" > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
#!/usr/bin/env bash
docker compose -f /home/ubuntu/finboard/docker-compose.prod.yml exec -T web nginx -s reload
EOF'

sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Weryfikacja symulacji odnowienia (*Dry Run*):
```bash
sudo certbot renew --dry-run
```
*Komunikat „Congratulations, all simulated renewals succeeded” potwierdza, że proces odnawiania będzie przebiegać całkowicie bezobsługowo.*

---

## 10. Automatyczny Deploy po `git push` (GitHub Actions CI/CD)

Aby każda zmiana wypchnięta do gałęzi `master` na GitHubie automatycznie wdrażała się na serwerze Oracle:

### Krok 1: Dodanie sekretów w repozytorium GitHub
1. Wejdź do swojego repozytorium na GitHubie (`https://github.com/oxbagx-ctrl/finboard`).
2. Kliknij **Settings** (zakładka u góry) → w lewym menu wybierz **Secrets and variables** → **Actions**.
3. Kliknij zielony przycisk **New repository secret** i dodaj 3 sekrety:

| Nazwa sekretu | Wartość |
| :--- | :--- |
| **`SERVER_HOST`** | `130.61.229.63` *(lub domena `ethon.pl`)* |
| **`SERVER_USER`** | `ubuntu` |
| **`SSH_PRIVATE_KEY`** | Cała treść pliku klucza prywatnego pobranego z Oracle (plik `.key`, od `-----BEGIN RSA PRIVATE KEY-----` / `-----BEGIN OPENSSH PRIVATE KEY-----` do `-----END ...-----` włącznie). |

### Krok 2: Workflow GitHub Actions (`.github/workflows/deploy.yml`)
W projekcie znajduje się plik `.github/workflows/deploy.yml`, który po każdym `git push origin master`:
1. Łączy się z Twoim serwerem przez SSH za pomocą zapisanego klucza.
2. Pobiera najnowszy kod (`git pull origin master`).
3. Aktualizuje zależności Composer (`composer install --no-dev`).
4. Kompiluje frontend Vite w kontenerze Node (`npm ci && npm run build`).
5. Aktualizuje kontenery Docker (`docker compose up -d --build`).
6. Wykonuje migracje bazy danych (`php artisan migrate --force`).
7. Odświeża cache aplikacji Laravel i bezpiecznie restartuje workerów kolejki.

Od tego momentu wystarczy zrobić:
```bash
git add .
git commit -m "Nowa funkcjonalność"
git push origin master
```
...a GitHub Actions w ciągu ok. 1–2 minut sam zaktualizuje aplikację działającą pod adresem **`https://ethon.pl`**!

---

## 11. Przydatne operacje administracyjne

### Podstawowe polecenia zarządzania aplikacją na serwerze:
* **Podgląd logów na żywo:**  
  `docker compose -f ~/finboard/docker-compose.prod.yml logs -f app`
* **Restart wszystkich kontenerów:**  
  `docker compose -f ~/finboard/docker-compose.prod.yml restart`
* **Zatrzymanie aplikacji:**  
  `docker compose -f ~/finboard/docker-compose.prod.yml down`

### Jak poprawnie usunąć instancję (Terminate):
1. W liście instancji kliknij menu z trzema kropkami (`...`) przy serwerze → **Terminate**.
2. ⚠️ **Koniecznie zaznacz pole:** `Permanently delete the attached boot volume`.
   * Bez zaznaczenia tego pola sam serwer zostanie usunięty, ale dysk pozostanie w chmurze i będzie niepotrzebnie blokował Twoją pulę darmowych 200 GB.
3. Kliknij **Terminate instance**.
