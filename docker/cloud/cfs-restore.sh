#!/bin/bash
# Restores a database backup into the cloud app that Coolify runs (docker-compose.coolify.yml).
# Install it on the server once (Documents/Cloud Deployment.md, "Restoring a backup"), then:
#
#   cfs-restore cfs-20261101-090000.dump.gz      # a file in /opt/cfs/backups
#   cfs-restore /root/cfs-backup-2026-09-22.sql.gz
#   cfs-restore latest                           # the newest file in /opt/cfs/backups
#
# Takes any backup the app's helpers make: a Raspberry Pi's cfs-backup.sh (.dump.gz), the plain
# pg_dump in the Pi guide (.sql.gz), or the cloud's own nightly and before-deploy backups.
#
# It backs up what's there now, stops the app, replaces the whole database with the backup, starts
# the app again - which brings an older database up to date - and shows what came back.
set -euo pipefail

BACKUP_DIR="${CFS_BACKUP_DIR:-/opt/cfs/backups}"
DB_NAME=CfsFundraiser
DB_USER=cfs

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }
fail() { echo "$*" >&2; exit 1; }

ASSUME_YES=no
FILE=""
for arg in "$@"; do
    case "$arg" in
        -y|--yes) ASSUME_YES=yes ;;
        -h|--help) usage ;;
        *) FILE="$arg" ;;
    esac
done
[ -n "$FILE" ] || usage 2

if [ "$FILE" = "latest" ]; then
    FILE=$(ls -1t "$BACKUP_DIR"/cfs-*.gz 2>/dev/null | head -1 || true)
    [ -n "$FILE" ] || fail "No backups in $BACKUP_DIR."
elif [ ! -f "$FILE" ] && [ -f "$BACKUP_DIR/$FILE" ]; then
    FILE="$BACKUP_DIR/$FILE"
fi
[ -f "$FILE" ] || fail "No such file: $FILE (backups are in $BACKUP_DIR: ls -lt $BACKUP_DIR)"

# One container of each service. CFS_DB / CFS_APP / CFS_BACKUP name them if the server runs more
# than one app with these service names.
container() {
    local service="$1" override="$2" ids
    if [ -n "$override" ]; then echo "$override"; return; fi
    ids=$(docker ps -q --filter "label=com.docker.compose.service=$service")
    [ -n "$ids" ] || fail "No running '$service' container - is the app deployed and running in Coolify?"
    [ "$(echo "$ids" | wc -l)" -eq 1 ] \
        || fail "More than one '$service' container is running; name the right one with CFS_$(echo "$service" | tr a-z A-Z)=<container>."
    echo "$ids"
}
DB=$(container db "${CFS_DB:-}")
APP=$(container app "${CFS_APP:-}")
BACKUP=$(docker ps -q --filter "label=com.docker.compose.service=backup" | head -1)
[ -z "${CFS_BACKUP:-}" ] || BACKUP="$CFS_BACKUP"

# What the file holds: gzipped or not, and pg_dump's custom format (starts PGDMP) or plain SQL.
if gzip -t "$FILE" 2>/dev/null; then read_file() { gunzip -c "$FILE"; }; else read_file() { cat "$FILE"; }; fi
# Only the start is read, which cuts the reader off - hence the || true.
sample=$(read_file 2>/dev/null | head -c 4096 | tr -d '\0' || true)
if [ "${sample:0:5}" = "PGDMP" ]; then
    FORMAT=custom
elif grep -q "PostgreSQL database dump" <<< "$sample"; then
    FORMAT=sql
else
    fail "$FILE doesn't look like a database backup."
fi

echo "Backup:   $FILE ($(du -h "$FILE" | cut -f1), $FORMAT format)"
echo "Database: $DB_NAME in container $(docker inspect -f '{{.Name}}' "$DB" | tr -d /)"
echo
echo "This REPLACES everything in the cloud database - every order, event, crew member and"
echo "catalog item - with what is in this backup. The app is offline for a minute while it runs."
if [ "$ASSUME_YES" != "yes" ]; then
    read -r -p "Type RESTORE to continue: " reply
    [ "$reply" = "RESTORE" ] || fail "Nothing was changed."
fi

# In case this was the wrong file: what's there now, first.
if [ -n "$BACKUP" ]; then
    echo
    echo "Backing up the current database first..."
    docker exec "$BACKUP" cfs-backup || fail "That backup failed, so nothing was changed."
else
    echo "(No backup container is running, so the current database isn't backed up first.)"
fi

echo
echo "Stopping the app..."
docker stop "$APP" >/dev/null

restart_app() { docker start "$APP" >/dev/null || true; }
trap 'echo "Something went wrong - starting the app again." >&2; restart_app' ERR

echo "Emptying $DB_NAME..."
docker exec "$DB" dropdb -U "$DB_USER" --if-exists --force "$DB_NAME"
docker exec "$DB" createdb -U "$DB_USER" "$DB_NAME"

echo "Restoring..."
# Warnings (about roles or extensions a Pi had) are expected and don't stop the restore.
if [ "$FORMAT" = "custom" ]; then
    read_file | docker exec -i "$DB" pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges \
        || echo "pg_restore reported warnings - see above. Carrying on."
else
    read_file | docker exec -i "$DB" psql -q -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 >/dev/null \
        || echo "psql reported warnings - see above. Carrying on."
fi
trap - ERR

echo "Starting the app (it brings the database up to date as it starts)..."
docker start "$APP" >/dev/null
status=starting
for _ in $(seq 1 60); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$APP" 2>/dev/null || echo missing)
    [ "$status" = "healthy" ] && break
    sleep 5
done
if [ "$status" != "healthy" ]; then
    echo "The app is $status after five minutes. Its log:" >&2
    docker logs --tail 60 "$APP" >&2
    exit 1
fi

count() { docker exec "$DB" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" 2>/dev/null || echo "?"; }
echo
echo "Restored. The database now has:"
echo "  territories: $(count 'select string_agg("Name", '"', '"' order by "Name") from "Territories"')"
echo "  events:      $(count 'select count(*) from "Events"')"
echo "  orders:      $(count 'select count(*) from "Orders"')"
echo "  crew:        $(count 'select count(*) from "Users"')"
