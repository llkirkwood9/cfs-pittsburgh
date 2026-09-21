#!/bin/bash
# Starts SQL Server and the API side by side in one container, and stops the container if either
# of them exits so Docker's restart policy can bring the pair back up together.
set -euo pipefail

if [ -z "${MSSQL_SA_PASSWORD:-}" ]; then
    echo "MSSQL_SA_PASSWORD must be set (8+ characters with upper, lower, digit and symbol)." >&2
    exit 1
fi

case "$MSSQL_SA_PASSWORD" in
    *\;*) echo "MSSQL_SA_PASSWORD must not contain ';' - it would break the connection string." >&2; exit 1 ;;
esac

# Same check the SQL Server image normally runs first: fixes ownership on a mounted data volume.
if [ -x /opt/mssql/bin/permissions_check.sh ]; then
    /opt/mssql/bin/permissions_check.sh
fi

echo "Starting SQL Server..."
/opt/mssql/bin/sqlservr &
SQL_PID=$!

# Wait for the listener. The API also retries its first connection, which covers the few seconds
# between the port opening and SQL Server accepting logins.
for _ in $(seq 1 90); do
    if (exec 3<>/dev/tcp/127.0.0.1/1433) 2>/dev/null; then
        break
    fi
    if ! kill -0 "$SQL_PID" 2>/dev/null; then
        echo "SQL Server exited during startup." >&2
        exit 1
    fi
    sleep 1
done

export ConnectionStrings__DefaultConnection="Server=127.0.0.1,1433;Database=${CFS_DATABASE_NAME:-CfsFundraiser};User Id=sa;Password=${MSSQL_SA_PASSWORD};TrustServerCertificate=True;MultipleActiveResultSets=true"

echo "Starting CFS API and dashboard on port ${ASPNETCORE_HTTP_PORTS:-8080}..."
cd /app
dotnet api.dll &
API_PID=$!

shutdown() {
    echo "Stopping..."
    kill -TERM "$API_PID" 2>/dev/null || true
    kill -TERM "$SQL_PID" 2>/dev/null || true
    wait || true
}
trap shutdown TERM INT

# Whichever process ends first takes the container down with it.
set +e
wait -n "$API_PID" "$SQL_PID"
STATUS=$?
shutdown
exit "$STATUS"
