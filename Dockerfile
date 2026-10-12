# CFS Fundraiser - the app (API + dashboard) in one image, talking to a PostgreSQL server in its
# own container. The same image runs on an x86 PC or server, a Raspberry Pi and a cloud host.
#
#   docker compose up -d --build        (builds this image and starts it with PostgreSQL)
#
# Published for both architectures by .github/workflows/app-image.yml, or by hand:
#
#   docker buildx build --platform linux/amd64,linux/arm64 \
#       -t ghcr.io/<owner>/cfs-fundraiser:latest --push .
#
# Then browse to http://localhost:8080. The API serves the dashboard itself, so there is one origin
# and one port and no CORS to configure.

# ---------------------------------------------------------------------------------------------
# 1. Dashboard: static build. VITE_API_URL is left unset so every API call is same-origin.
#    DASHBOARD_VERSION (YYYY.MM.<build>) is passed in by the image workflow; without it the
#    dashboard calls itself this month's build 0.
# ---------------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:22-alpine AS dashboard
WORKDIR /src
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
ARG DASHBOARD_VERSION=
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
    DOTNET_RUNNING_IN_CONTAINER=true

# PostgreSQL can take a while to start (a Pi 3B especially), so wait longer for the first
# connection.
ENV Startup__DatabaseAttempts=30

EXPOSE 8080

# Asks the API's own /health endpoint over the loopback, using bash rather than adding curl.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080 && printf "GET /health HTTP/1.0\r\n\r\n" >&3 && grep -q Healthy <&3'

USER $APP_UID

ENTRYPOINT ["dotnet", "api.dll"]
