#!/bin/bash
# Brings the cloud droplet up to date: backs up the database, pulls the newest images, restarts
# what changed and waits for the app to be healthy. Run by .github/workflows/cloud-deploy.yml after
# it copies the deployment files to /opt/cfs and signs the droplet in to the image registry. It can
# be run by hand too (sign in to ghcr.io first if the image is private):
#
#   bash /opt/cfs/docker/cloud/cfs-deploy.sh
#
# Exits non-zero, with the app's log, if the app isn't healthy within five minutes.
set -euo pipefail

CFS_DIR="${CFS_DIR:-/opt/cfs}"
cd "$CFS_DIR"

if [ ! -f .env ]; then
    echo "No $CFS_DIR/.env - create it first (Documents/Cloud Deployment.md, Step 5)." >&2
    exit 1
fi
if ! grep -q '^COMPOSE_FILE=docker-compose.yml:docker-compose.cloud.yml' .env; then
    echo "$CFS_DIR/.env needs the line COMPOSE_FILE=docker-compose.yml:docker-compose.cloud.yml" >&2
    exit 1
fi

# A new version may change the database as it starts, so keep a copy from just before - once
# there is a database to copy.
if [ -n "$(docker compose ps -q db 2>/dev/null)" ]; then
    bash docker/pi/cfs-backup.sh backup
fi

echo "Pulling the images..."
docker compose pull

echo "Starting..."
docker compose up -d --remove-orphans

echo "Waiting for the app to report healthy..."
status=missing
for _ in $(seq 1 60); do
    status=$(docker inspect -f '{{.State.Health.Status}}' cfs-app 2>/dev/null || echo missing)
    [ "$status" = "healthy" ] && break
    sleep 5
done

if [ "$status" != "healthy" ]; then
    echo "The app is $status after five minutes. Its log:" >&2
    docker compose logs --tail 80 app >&2
    exit 1
fi

# Keep the images in use and drop the old ones.
docker image prune -f >/dev/null 2>&1 || true

docker compose ps
echo "Deployed. The app is at https://$(sed -n 's/^CFS_DOMAIN=//p' .env | tail -1 | tr -d "\"'\r")"
