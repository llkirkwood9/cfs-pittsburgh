#!/bin/bash
# Brings the CFS Fundraiser stack up to date and starts it. Run by cfs.service at every boot, and
# safe to run by hand at any time:
#
#   sudo /opt/cfs/docker/pi/cfs-update.sh
#
# Anything that needs the network is allowed to fail: at an event the Pi may have no internet, and
# the app still has to start from the image already on the card.
set -uo pipefail

CFS_DIR="${CFS_DIR:-/opt/cfs}"
COMPOSE_FILE="$CFS_DIR/docker-compose.pi.yml"

cd "$CFS_DIR" || { echo "No $CFS_DIR - clone the repository there first." >&2; exit 1; }

echo "Waiting for the network..."
for _ in $(seq 1 30); do
    if ping -c1 -W1 github.com >/dev/null 2>&1; then
        ONLINE=yes
        break
    fi
    sleep 2
done

if [ "${ONLINE:-no}" = "yes" ]; then
    echo "Updating the deployment files..."
    git pull --ff-only || echo "Could not update the files - carrying on with what is here."

    echo "Pulling the latest image..."
    docker compose -f "$COMPOSE_FILE" pull || echo "Could not pull - carrying on with the image already here."
else
    echo "No internet - starting with what is already on this Pi."
fi

echo "Starting..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Old images pile up on a small card; keep the ones in use and drop the rest.
docker image prune -f >/dev/null 2>&1 || true

echo "The app is at http://$(hostname -I | awk '{print $1}'):8080"
