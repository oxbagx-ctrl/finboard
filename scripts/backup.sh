#!/usr/bin/env bash
# ==============================================================================
# FinBoard Platform – Automated Database & VDR Document Backup Script
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/storage/backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

mkdir -p "${BACKUP_DIR}"

echo "Starting FinBoard automated backup: ${TIMESTAMP}"

# 1. PostgreSQL Database Dump
echo "Dumping PostgreSQL database..."
docker compose exec -T postgres pg_dump -U finboard_user -d finboard -Fc > "${BACKUP_DIR}/finboard_db_${TIMESTAMP}.dump"
gzip -c "${BACKUP_DIR}/finboard_db_${TIMESTAMP}.dump" > "${BACKUP_DIR}/finboard_db_${TIMESTAMP}.dump.gz"
rm "${BACKUP_DIR}/finboard_db_${TIMESTAMP}.dump"
echo "Database backup created: ${BACKUP_DIR}/finboard_db_${TIMESTAMP}.dump.gz"

# 2. VDR Documents Archive
if [ -d "${ROOT_DIR}/storage/app" ]; then
    echo "Archiving Virtual Data Room documents..."
    tar -czf "${BACKUP_DIR}/finboard_vdr_documents_${TIMESTAMP}.tar.gz" -C "${ROOT_DIR}/storage/app" .
    echo "VDR documents backup created: ${BACKUP_DIR}/finboard_vdr_documents_${TIMESTAMP}.tar.gz"
fi

# 3. Retention Policy: Keep backups for 30 days
echo "Purging backups older than 30 days..."
find "${BACKUP_DIR}" -type f -name "finboard_*" -mtime +30 -delete

echo "Backup process finished successfully."
