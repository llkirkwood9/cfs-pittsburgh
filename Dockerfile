# CFS Fundraiser - the whole app in one container: SQL Server, the API, and the dashboard.
#
#   docker compose up -d --build        (uses docker-compose.yml alongside this file)
#
# or without compose:
#
#   docker build -t cfs-fundraiser .
#   docker run -d -p 8080:8080 -e MSSQL_SA_PASSWORD='Str0ng!Passw0rd' -e Jwt__Key='<long secret>' \
#       -v cfs-data:/var/opt/mssql --name cfs-fundraiser cfs-fundraiser
#
# Then browse to http://localhost:8080. The API serves the dashboard itself, so there is one origin
# and one port and no CORS to configure.

# ---------------------------------------------------------------------------------------------
# 1. Dashboard: static build. VITE_API_URL is left unset so every API call is same-origin.
# ---------------------------------------------------------------------------------------------
FROM node:22-alpine AS dashboard
WORKDIR /src
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# ---------------------------------------------------------------------------------------------
# 2. API: framework-dependent publish.
# ---------------------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY api/api.csproj ./
RUN dotnet restore api.csproj
COPY api/ ./
RUN dotnet publish api.csproj -c Release -o /out --no-restore /p:UseAppHost=false

# ---------------------------------------------------------------------------------------------
# 3. Runtime: SQL Server's own image, with the ASP.NET runtime added alongside it.
# ---------------------------------------------------------------------------------------------
FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

# ICU for .NET globalization; the SQL Server image is Ubuntu 22.04.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libicu70 \
    && rm -rf /var/lib/apt/lists/*

# The ASP.NET Core runtime, lifted from Microsoft's own image rather than a package feed.
COPY --from=mcr.microsoft.com/dotnet/aspnet:10.0 /usr/share/dotnet /usr/share/dotnet
RUN ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet

COPY --from=api /out /app
COPY --from=dashboard /src/dist /app/wwwroot
COPY docker/start.sh /usr/local/bin/start.sh

# Strip Windows line endings in case the script was checked out on Windows.
RUN sed -i 's/\r$//' /usr/local/bin/start.sh \
    && chmod +x /usr/local/bin/start.sh \
    && chown -R mssql /app

USER mssql

# Express is free for production use (10 GB per database - far more than an event needs).
# Change MSSQL_PID if you hold a different licence.
ENV ACCEPT_EULA=Y \
    MSSQL_PID=Express \
    ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_RUNNING_IN_CONTAINER=true

EXPOSE 8080
VOLUME ["/var/opt/mssql"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080 && printf "GET /health HTTP/1.0\r\n\r\n" >&3 && grep -q Healthy <&3'

# start.sh is PID 1 so that `docker stop` reaches its trap and SQL Server shuts down cleanly. It
# runs the SQL Server image's own permissions check before anything else.
ENTRYPOINT ["/usr/local/bin/start.sh"]
CMD []
