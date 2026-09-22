# CFS Fundraiser - the app on its own (API + dashboard), talking to a PostgreSQL server.
#
# This is the image for small ARM hosts such as a Raspberry Pi, where SQL Server cannot run.
# The all-in-one Dockerfile alongside it (SQL Server in the same container) stays the x86 option.
#
#   docker compose -f docker-compose.pi.yml up -d
#
# Built for the Pi on a faster machine, then pulled by the Pi:
#
#   docker buildx build --platform linux/arm64 -f Dockerfile.app \
#       -t ghcr.io/<owner>/cfs-fundraiser:latest --push .

# ---------------------------------------------------------------------------------------------
# 1. Dashboard: static build. VITE_API_URL is left unset so every API call is same-origin.
# ---------------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:22-alpine AS dashboard
WORKDIR /src
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# ---------------------------------------------------------------------------------------------
# 2. API: published for the target architecture. The build itself always runs on the build
#    machine's own architecture, which keeps an emulated ARM build to a copy rather than a compile.
# ---------------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS api
ARG TARGETARCH
WORKDIR /src
COPY api/api.csproj ./
RUN dotnet restore api.csproj -a $TARGETARCH
COPY api/ ./
RUN dotnet publish api.csproj -c Release -a $TARGETARCH -o /out --no-restore /p:UseAppHost=false

# ---------------------------------------------------------------------------------------------
# 3. Runtime: just the ASP.NET runtime. The database lives in its own container.
# ---------------------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0

# Npgsql loads the system Kerberos library when it opens a connection; the slim runtime image
# does not carry it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=api /out /app
COPY --from=dashboard /src/dist /app/wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    Database__Provider=Postgres \
    DOTNET_RUNNING_IN_CONTAINER=true

# A Pi 3B takes its time starting PostgreSQL, so wait longer for the first connection.
ENV Startup__DatabaseAttempts=30

EXPOSE 8080

# Asks the API's own /health endpoint over the loopback, using bash rather than adding curl.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080 && printf "GET /health HTTP/1.0\r\n\r\n" >&3 && grep -q Healthy <&3'

USER $APP_UID

ENTRYPOINT ["dotnet", "api.dll"]
