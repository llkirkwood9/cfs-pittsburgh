#!/bin/bash
# Backs up and restores the CFS Fundraiser database. Worth running before an event and after one.
#
#   sudo /opt/cfs/docker/pi/cfs-backup.sh backup                   # write a new backup
#   sudo /opt/cfs/docker/pi/cfs-backup.sh backup /media/usb        # ...somewhere else
#   sudo /opt/cfs/docker/pi/cfs-backup.sh list                     # what is on hand
#   sudo /opt/cfs/docker/pi/cfs-backup.sh restore latest           # put the newest one back
#   sudo /opt/cfs/docker/pi/cfs-backup.sh restore /opt/cfs/backups/cfs-20260923-101500.dump.gz
#
# Backups are custom-format pg_dump files, gzipped. Restoring replaces everything in the database.
#
# COMPOSE_FILE in .env names other compose files than docker-compose.pi.yml, and CFS_BACKUP_KEEP
# there sets how many backups are kept. (The cloud's backups are made by docker-compose.coolify.yml.)
set -euo pipefail

CFS_DIR="${CFS_DIR:-/opt/cfs}"

usage() { sed -n '2,15p' "$0"; }

cd "$CFS_DIR" || { echo "No $CFS_DIR - clone the repository there first." >&2; exit 1; }

# One setting from .env. The file isn't sourced: a line such as EMAIL_FROM_NAME=Custom Fundraising
# Solutions is fine for Docker Compose but not for the shell.
env_value() {
    [ -f "$CFS_DIR/.env" ] || return 0
    sed -n "s/^$1=//p" "$CFS_DIR/.env" | tail -1 | tr -d "\"'\r"
}

# The Pi runs docker-compose.pi.yml unless .env names other files.
COMPOSE_FILE="${COMPOSE_FILE:-$(env_value COMPOSE_FILE)}"
export COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.pi.yml}"
BACKUP_DIR="${CFS_BACKUP_DIR:-$CFS_DIR/backups}"

DB_NAME="${POSTGRES_DB:-CfsFundraiser}"
DB_USER="${POSTGRES_USER:-cfs}"
PGPASSWORD="$(env_value POSTGRES_PASSWORD)"
PGPASSWORD="${PGPASSWORD:-Change_Me_2026}"

# A card fills up quietly, so only the most recent few are kept.
KEEP="${CFS_BACKUP_KEEP:-$(env_value CFS_BACKUP_KEEP)}"
KEEP="${KEEP:-10}"

compose() { docker compose "$@"; }

wait_for_db() {
    for _ in $(seq 1 30); do
        if compose exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
            return 0
        fi
        sleep 2
    done
    echo "The database container never came ready." >&2
    return 1
}

do_backup() {
    local dest_dir="${1:-$BACKUP_DIR}"
    mkdir -p "$dest_dir"

    local file="$dest_dir/cfs-$(date +%Y%m%d-%H%M%S).dump.gz"

    wait_for_db
    echo "Backing up $DB_NAME..."

    # Written to a temporary name first so a backup interrupted halfway is never mistaken for a
    # good one by `restore latest`.
    if compose exec -T -e PGPASSWORD="$PGPASSWORD" db \
        pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom \
        | gzip > "$file.partial"; then
        mv "$file.partial" "$file"
    else
        rm -f "$file.partial"
        echo "The backup failed." >&2
        return 1
    fi

    echo "Wrote $file ($(du -h "$file" | cut -f1))"

    # Only prune where the backups are managed; a USB stick handed to someone is left alone.
    if [ "$dest_dir" = "$BACKUP_DIR" ] && [ "$KEEP" -gt 0 ]; then
        local old
        old=$(ls -1t "$BACKUP_DIR"/cfs-*.dump.gz 2>/dev/null | tail -n +$((KEEP + 1)) || true)
        if [ -n "$old" ]; then
            echo "Removing backups older than the newest $KEEP:"
            echo "$old" | sed 's/^/  /'
            echo "$old" | while IFS= read -r stale; do rm -f "$stale"; done
        fi
    fi
}

do_list() {
    if ! ls -1t "$BACKUP_DIR"/cfs-*.dump.gz >/dev/null 2>&1; then
        echo "No backups in $BACKUP_DIR."
        return 0
    fi
    ls -lht "$BACKUP_DIR"/cfs-*.dump.gz | awk '{print $9, "\t", $5, "\t", $6, $7, $8}'
}

do_restore() {
    local source="${1:-}"
    [ -n "$source" ] || { echo "Which backup? Use 'latest' or a path." >&2; exit 2; }

    if [ "$source" = "latest" ]; then
        source=$(ls -1t "$BACKUP_DIR"/cfs-*.dump.gz 2>/dev/null | head -1 || true)
        [ -n "$source" ] || { echo "No backups in $BACKUP_DIR." >&2; exit 1; }
    fi
    [ -f "$source" ] || { echo "No such backup: $source" >&2; exit 1; }

    if [ "${ASSUME_YES:-no}" != "yes" ]; then
        echo "This replaces everything in $DB_NAME with $source."
        read -r -p "Type RESTORE to continue: " reply
        [ "$reply" = "RESTORE" ] || { echo "Nothing was changed."; exit 1; }
    fi

    # The app would keep writing (and holds connections that block the drop), so it stands down.
    echo "Stopping the app..."
    compose stop app
    wait_for_db

    # Into an empty database, so a backup from an older version restores cleanly too; the app
    # brings it up to date as it starts.
    echo "Emptying $DB_NAME..."
    compose exec -T -e PGPASSWORD="$PGPASSWORD" db dropdb -U "$DB_USER" --if-exists --force "$DB_NAME"
    compose exec -T -e PGPASSWORD="$PGPASSWORD" db createdb -U "$DB_USER" "$DB_NAME"

    echo "Restoring..."
    # The exit code is ignored because pg_restore also counts harmless warnings.
    gunzip -c "$source" \
        | compose exec -T -e PGPASSWORD="$PGPASSWORD" db \
            pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges \
        || echo "pg_restore reported warnings - check the output above."

    echo "Starting the app..."
    compose up -d app

    local domain
    domain="$(env_value CFS_DOMAIN)"
    if [ -n "$domain" ]; then
        echo "Done. The app is at https://$domain"
    else
        echo "Done. The app is at http://$(hostname -I | awk '{print $1}'):8080"
    fi
}

ASSUME_YES=no
COMMAND="${1:-}"
[ $# -gt 0 ] && shift

ARGS=()
for arg in "$@"; do
    case "$arg" in
        -y|--yes) ASSUME_YES=yes ;;
        *) ARGS+=("$arg") ;;
    esac
done

case "$COMMAND" in
    backup) do_backup "${ARGS[0]:-}" ;;
    restore) do_restore "${ARGS[0]:-}" ;;
    list|ls) do_list ;;
    -h|--help|"") usage ;;
    *) echo "Unknown command: $COMMAND" >&2; usage; exit 2 ;;
esac
