#!/bin/bash
# Wipes the CFS Fundraiser database and puts it back to the freshly seeded state - the catalog,
# delivery options, crew accounts and opening event from CatalogSeed.json, and nothing else.
# Every event, order, payment and inventory count is destroyed.
#
#   sudo /opt/cfs/docker/pi/cfs-reset-db.sh            # asks first, takes a backup first
#   sudo /opt/cfs/docker/pi/cfs-reset-db.sh --yes      # no questions (for scripts)
#   sudo /opt/cfs/docker/pi/cfs-reset-db.sh --no-backup
#
# The app rebuilds the schema and re-seeds it on the next start, so this only has to empty it.
set -euo pipefail

CFS_DIR="${CFS_DIR:-/opt/cfs}"
COMPOSE_FILE="$CFS_DIR/docker-compose.pi.yml"
BACKUP_SCRIPT="$CFS_DIR/docker/pi/cfs-backup.sh"

DB_NAME="${POSTGRES_DB:-CfsFundraiser}"
DB_USER="${POSTGRES_USER:-cfs}"

ASSUME_YES=no
TAKE_BACKUP=yes

for arg in "$@"; do
    case "$arg" in
        -y|--yes) ASSUME_YES=yes ;;
        --no-backup) TAKE_BACKUP=no ;;
        -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
        *) echo "Unknown option: $arg" >&2; exit 2 ;;
    esac
done

cd "$CFS_DIR" || { echo "No $CFS_DIR - clone the repository there first." >&2; exit 1; }

# The password lives in .env next to the compose file; nothing else here needs it.
if [ -f "$CFS_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$CFS_DIR/.env"
    set +a
fi
PGPASSWORD="${POSTGRES_PASSWORD:-Change_Me_2026}"

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

if [ "$ASSUME_YES" != "yes" ]; then
    echo "This deletes every event, order and payment in $DB_NAME and cannot be undone."
    read -r -p "Type RESET to continue: " reply
    [ "$reply" = "RESET" ] || { echo "Nothing was changed."; exit 1; }
fi

if [ "$TAKE_BACKUP" = "yes" ] && [ -x "$BACKUP_SCRIPT" ]; then
    echo "Taking a backup first..."
    "$BACKUP_SCRIPT" backup || { echo "The backup failed - nothing was changed." >&2; exit 1; }
fi

# The app holds open connections and would re-seed mid-wipe, so it stops while the schema goes.
echo "Stopping the app..."
compose stop app

echo "Waiting for the database..."
for _ in $(seq 1 30); do
    if compose exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

echo "Emptying $DB_NAME..."
compose exec -T -e PGPASSWORD="$PGPASSWORD" db \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
    -c 'DROP SCHEMA public CASCADE;' \
    -c 'CREATE SCHEMA public;' \
    -c "GRANT ALL ON SCHEMA public TO \"$DB_USER\";" \
    -c 'GRANT ALL ON SCHEMA public TO public;'

echo "Starting the app - it will rebuild and re-seed the database..."
compose up -d app

echo "Done. The app is at http://$(hostname -I | awk '{print $1}'):8080"
echo "Give it a few seconds to finish migrating before signing in."
