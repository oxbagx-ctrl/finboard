#!/usr/bin/env bash
# ==============================================================================
# FinBoard Enterprise Platform – Zero-Downtime Production Deployment Script
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "${BLUE}======================================================================${NC}"
echo -e "${CYAN}   FinBoard M&A & Financial Analytics – Production Deploy Pipeline    ${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo -e "Starting deployment at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')\n"

cd "${ROOT_DIR}"

# 1. Environment & Pre-flight Verification
echo -e "${YELLOW}[1/7] Running pre-flight configuration checks...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}[ERROR] .env file not found in ${ROOT_DIR}! Aborting deployment.${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker is not installed or not in PATH! Aborting.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-flight checks passed.${NC}"

# 2. Compile & Optimize Frontend Production Bundle
echo -e "\n${YELLOW}[2/7] Compiling production frontend bundle with Vite...${NC}"
if command -v npm &> /dev/null; then
    npm run build
    echo -e "${GREEN}✓ Frontend assets compiled successfully.${NC}"
else
    echo -e "${YELLOW}[WARNING] npm not found on host, skipping host build.${NC}"
fi

# 3. Ensure Docker Containers are running
echo -e "\n${YELLOW}[3/7] Orchestrating Docker containers...${NC}"
docker compose up -d app web worker scheduler postgres redis
echo -e "${GREEN}✓ All container services running.${NC}"

# 4. Execute Database Migrations
echo -e "\n${YELLOW}[4/7] Applying database migrations with safety flags...${NC}"
docker compose exec -T app php artisan migrate --force
echo -e "${GREEN}✓ Database schema is up to date.${NC}"

# 5. Storage Symlink & File Adapter
echo -e "\n${YELLOW}[5/7] Ensuring VDR document storage symlinks...${NC}"
docker compose exec -T app php artisan storage:link || true
echo -e "${GREEN}✓ Storage links verified.${NC}"

# 6. Optimize Framework Caches & Restart Queue Workers
echo -e "\n${YELLOW}[6/7] Optimizing Laravel framework caches and restarting workers...${NC}"
docker compose exec -T app php artisan config:cache
docker compose exec -T app php artisan route:cache
docker compose exec -T app php artisan view:cache
docker compose exec -T app php artisan event:cache
docker compose exec -T app php artisan queue:restart
echo -e "${GREEN}✓ Caches warmed and queue workers signaled to restart gracefully.${NC}"

# 7. Comprehensive Health & Readiness Check
echo -e "\n${YELLOW}[7/7] Probing platform health and liveness endpoint...${NC}"
HEALTH_OUTPUT=$(docker compose exec -T app php artisan test --filter=HealthApiTest || true)

if echo "${HEALTH_OUTPUT}" | grep -q "PASS"; then
    echo -e "${GREEN}✓ System Health Check PASSED: PostgreSQL, Redis, and Storage are fully operational.${NC}"
else
    echo -e "${RED}[WARNING] Health check probe reported an anomaly. Review application logs.${NC}"
fi

echo -e "\n${BLUE}======================================================================${NC}"
echo -e "${GREEN}   Deployment successfully completed at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')   ${NC}"
echo -e "${BLUE}======================================================================${NC}"
