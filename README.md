# CFS Sales App

Order-taking, checkout, inventory and reporting for CFS mattress fundraisers, across any number
of territories. It runs as the same two containers - the app
and PostgreSQL - everywhere: on a DigitalOcean server managed by Coolify, with HTTPS, for the
whole business (see [Documents/Cloud Deployment.md](Documents/Cloud%20Deployment.md)), or on a
single box at the venue - a Docker host or a Raspberry Pi.

**Contents**

1. [Components](#1-components)
2. [Repository layout](#2-repository-layout)
3. [Quick start: the whole stack on one machine](#3-quick-start-the-whole-stack-on-one-machine)
4. [The API](#4-the-api)
5. [The database](#5-the-database)
6. [The dashboard](#6-the-dashboard)
7. [The mobile app](#7-the-mobile-app)
8. [Configuration reference](#8-configuration-reference)
9. [Testing](#9-testing)
10. [Deployment](#10-deployment)
11. [Contributing](#11-contributing)
12. [What it does, screen by screen](#12-what-it-does-screen-by-screen)
13. [How the domain is modelled](#13-how-the-domain-is-modelled)

---

## 1. Components

| Component | Folder | Technology | What it is |
|---|---|---|---|
| **API** | [`api/`](api) | ASP.NET Core 10 (net10.0), EF Core, Npgsql | Every rule and every number: orders, pricing, catalog, inventory, events, crew, settings, email, territories. Password sign-in, with short-lived JWTs and per-device sessions. |
| **Database** | (container) | PostgreSQL 16 | One database, `CfsFundraiser`. The API creates and migrates its tables and seeds the catalog itself. |
| **Dashboard** | [`dashboard/`](dashboard) | Vite, React 19, TypeScript, Tailwind CSS 4 | The web app the crew uses on the cart's tablets and any browser. |
| **Mobile app** | [`app/`](app) | Expo SDK 57, React Native 0.86, Expo Router, NativeWind 4 | The dashboard's screens as a native app for iPhone, iPad and Android. |
| **App image** | [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml), [`docker-compose.coolify.yml`](docker-compose.coolify.yml) | Docker (amd64 and arm64), Coolify | The API with the built dashboard inside it, on port 8080, beside a PostgreSQL container. In the cloud, Coolify runs them and adds HTTPS in front. |
| **Raspberry Pi scripts** | [`docker/pi/`](docker/pi) | bash, systemd | Start at boot, update, back up, restore and reset a Pi that runs the image at an event. |
| **CI/CD** | [`.github/workflows/`](.github/workflows) | GitHub Actions, EAS | Publishes the app image to ghcr.io and has Coolify deploy it to the cloud, and builds and ships the mobile app. |
| **Documents** | [`Documents/`](Documents) | Word, Markdown | The user guide for the crew, cloud deployment, the Raspberry Pi setup and the mobile app guide. |

How they fit together:

```
 Tablets / browsers ─┐
                     ├──>  App image (port 8080)  ──>  PostgreSQL
 Phones (the app) ───┘     API + dashboard files       (cfs-pgdata volume)
```

In production the API serves the built dashboard itself, so a browser sees one origin and one
port and there is no CORS to set up. In the cloud the same two containers run on one server,
managed by Coolify, whose proxy puts HTTPS on the business's own domain. The mobile app talks to the same API at an address fixed when it is
built: release builds use the live site (the `API_URL` repository secret), and a local copy uses
`EXPO_PUBLIC_API_URL` in `app/.env` - a local API or the live site. In development the three run separately (API on 5046, dashboard on 3000, app in Expo).

---

## 2. Repository layout

```
Dockerfile                  The app image: dashboard build + API publish + ASP.NET runtime
docker-compose.yml          The app image plus PostgreSQL, on port 8080
docker-compose.coolify.yml  What Coolify runs in the cloud: the app, PostgreSQL and backups
docker-compose.pi.yml       Includes docker-compose.yml, for Pis set up with this name
docker/cloud/               cfs-restore.sh: restores a backup on the cloud server, in one command
docker/pi/                  cfs.service, cfs-update.sh, cfs-backup.sh, cfs-reset-db.sh
.github/workflows/
├── cloud-deploy.yml        On a push to main: publishes the :cloud image, has Coolify deploy it
└── app-release.yml         Builds the mobile app on a push to app-release (APK + TestFlight)
.gitattributes              Keeps *.sh and Dockerfile at LF line endings

api/                        ASP.NET Core 10 Web API
├── Controllers/            One controller per resource, all inheriting BasicController
├── Dtos/                   Request/response shapes; EF models are never exposed directly
├── Models/                 EF entities
├── Data/                   ApplicationDbContext, its design-time factory, SeedData, CatalogSeed.json
├── Services/               TokenService (JWT, sessions, password hashing), EmailService (SMTP)
├── Utils/                  BasicController, AccessScope (who may see what), PasswordPolicy,
│                           OrderCalculator, LineOrder, Choices, CatalogTransfer,
│                           InventoryRules, PermanentDelete, SettingsStore, EmailTemplates, TraceControl
├── Migrations/             EF Core migrations for PostgreSQL
├── Program.cs              Configuration, auth, CORS, migrations and seeding, SPA hosting
├── appsettings*.json       Settings; appsettings.local.json (gitignored) holds your own
└── docker-compose.yml      PostgreSQL for local development

dashboard/                  Vite + React 19 + TypeScript SPA, styled with Tailwind CSS 4
├── public/                 Static files (mattress_sizes.png for the size guide)
└── src/
    ├── Components/         Elements (Button, Icon, Modal, TextField, ...), Navbar, Sales,
    │                       Checkout, Catalog, ... including the customer-facing screens
    ├── Context/            AuthContext (sign-in, roles), TerritoryContext, SettingsContext
    ├── Hooks/              UseTheme, UseLockBodyScroll
    ├── Lib/                api.ts (axios + token refresh), ErrorHandler, Toast, ModelHelpers,
    │                       Pricing, SheetPdf (print/email PDFs), Version, ...
    ├── Models/             One type per DTO
    ├── Pages/              One per route
    ├── Routes/             Routes.tsx, ProtectedRoute.tsx, RequireTerritory.tsx, HomeRedirect.tsx
    └── Services/           One file per API controller

app/                        Expo + React Native app; see app/README.md
├── src/app/                Expo Router routes: (tabs)/, receipt/, events/, login, ...
├── src/                    Components, Context, Hooks, Lib, Models, Pages, Routes, Services,
│                           laid out as in dashboard/src; Models and Services are copies
├── vendor/                 A patched decode-uri-component (see app/README.md)
├── app.json, app.config.js Expo config; app.config.js sets the version from version.json
└── eas.json                EAS build profiles and the App Store Connect app id

Documents/
├── CFS Sales App User Guide.docx   For the crew: every screen, by role
├── Cloud Deployment.md             The cloud server with Coolify: domain, deploys, email, backups
├── Mobile App Guide.md             Running, testing, building and releasing the app
└── Raspberry Pi Setup.md           Running the image on a Pi at an event, email, troubleshooting
```

---

## 3. Quick start: the whole stack on one machine

Prerequisites: [.NET 10 SDK](https://dotnet.microsoft.com/download), Node 20 or later (the image
builds with Node 22), and Docker. For the mobile app, also Expo Go on a phone (see section 7).

```bash
git clone https://github.com/llkirkwood9/cfs-pittsburgh.git
```

1. **Database.** Start PostgreSQL 16 in a container:

   ```bash
   docker compose -f api/docker-compose.yml up -d
   ```

2. **API.** Migrates and seeds on start, then listens on `http://localhost:5046`:

   ```bash
   cd api && dotnet run --launch-profile http
   ```

3. **Dashboard.** Create `dashboard/.env.local` (gitignored, so a fresh clone doesn't have it)
   with the API's address:

   ```
   VITE_API_URL=http://localhost:5046
   ```

   then:

   ```bash
   cd dashboard && npm install && npm run dev
   ```

   and open `http://localhost:3000`.

4. **Sign in** as `admin`, a system admin. Its starting password is `Seed:AdminPassword` from
   `api/appsettings.local.json` if you set one before the first start, or else the random one in
   the API's log (`Created the first account`). You choose your own straight away; then add
   territories and crew on `/territories` and `/crew`. Set your own `Jwt:Key` before the app goes
   anywhere real (section 8).

Or skip the separate pieces and run what production runs:

```bash
docker compose up -d --build
```

which builds the app image from source and serves everything on `http://localhost:8080` (it needs
a `.env` file first; see section 10).

---

## 4. The API

ASP.NET Core 10 Web API in [`api/`](api), PostgreSQL through EF Core and Npgsql.

**Run it**

```bash
cd api && dotnet run --launch-profile http
```

- Listens on `http://localhost:5046` (the `https` profile adds `https://localhost:7277`).
- On start it waits for the database, applies any pending migrations, and seeds the catalog,
  delivery options, a sample event and the first `admin` account from `Data/CatalogSeed.json` and
  `Data/SeedData.cs`. The seed fills in whatever is missing on every start; `Seed:Skip` turns it
  off (section 8).
- In Development the OpenAPI document is at `http://localhost:5046/openapi/v1.json`.
- `GET /health` answers `Healthy`; the image's health check uses it.
- If `wwwroot/` holds a built dashboard (`index.html`), the API serves it and sends every path
  that doesn't start with `api/` to `index.html`. That is how the image works; locally `wwwroot`
  is empty and the dashboard runs on its own.
- **A phone can't reach `localhost`.** To use the API from the mobile app or another device, bind
  it to every interface and use the PC's IP address:

  ```bash
  cd api && dotnet run --launch-profile http --urls http://0.0.0.0:5046
  ```

**Build**

```bash
cd api && dotnet build
```

**Migrations.** After changing a model or `ApplicationDbContext`, add a migration (with the
`dotnet-ef` tool installed: `dotnet tool install --global dotnet-ef`):

```bash
cd api && dotnet ef migrations add DescribeTheChange
```

The design-time factory (`Data/ApplicationDbContextFactory.cs`) points at the local container;
set `CFS_POSTGRES_CONNECTION` to use another server. Migrations run by themselves when the API
next starts, here and in the image.

**Auth and roles.** Sign-in is a username and a password; there is no self-service signup, and
accounts are made on `/crew`. The business is split into **territories**; every event, its crew,
its stock and any catalog items of its own belong to one. Roles, lowest first:

| Role | Territories | Can use |
|---|---|---|
| Sales | own | The sales floor |
| Checkout | own | The checkout table and inventory |
| SalesCheckout | own | Both of the above |
| Manager | own | Everything in their territory: its crew (Sales and Checkout roles), events, settings and its own catalog items |
| Admin | all | Everything, in every territory, including global catalog items and the Territories screen |
| SystemAdmin | all | Everything an Admin can, plus permanent deletes and catalog export/restore |

Orders, the sales sheet and the stat-sheet dashboard are open to every role, for their own
territory. Admins and system admins pick the territory in view (or All territories) in the menu
bar; it travels with each request as an `X-Territory-Id` header. The API enforces all of this on
every request (`Utils/AccessScope.cs`); the dashboard and app only hide what a role can't use.

**First sign-in.** An empty database gets one account, `admin`, made a system admin. Its starting
password is `SEED_ADMIN_PASSWORD` from the `.env` (`Seed:AdminPassword` locally) or, when that is
blank, a random one written once to the API's log (`Created the first account. Username: admin
Temporary password: ...`). Either way it has to be changed at the first sign-in.

**Upgrading from PINs.** A database from before passwords keeps working. The migration puts every
existing event, Sales / Checkout account and stock count into a first territory, **Pittsburgh**
(rename it on the Territories screen). Each person signs in once more with their old PIN as the
password and is then made to choose a real one. `Auth:AllowLegacyPins=false` turns the one-time
PIN sign-in off; then a manager sets a starting password for each account on the Crew screen.

**Security**

- **Passwords.** At least 8 characters (up to 128), not a commonly used one, and not containing
  the username or name; hashed with ASP.NET Core Identity's PBKDF2 hasher. A password set by a
  manager or above - a new account or a reset - has to be changed at the next sign-in. Five wrong
  passwords in a row lock the account for 15 minutes (`Auth:MaxFailedAttempts`,
  `Auth:LockoutMinutes`); a manager can unlock it sooner on the Crew screen.
- **Sessions.** Signing in returns a 15-minute access token (`Jwt:AccessTokenMinutes`, up to 60),
  kept only in memory, and a refresh token for this device. Each renewal replaces the refresh
  token, and only a SHA-256 of it is stored (`UserSessions`). Renewing, changing a password and
  signing out need an `X-CFS-Client` header, which another site can't send:
  - The **dashboard** (`X-CFS-Client: dashboard`) gets the refresh token as an httpOnly,
    SameSite=Strict cookie scoped to `/api/auth`, never readable by script.
  - The **app** (`X-CFS-Client: app`) has no cookies to rely on, so the API returns the refresh
    token in the response body instead. The app keeps it in the iOS Keychain / Android Keystore
    (`expo-secure-store`) and sends it back as an `X-Refresh-Token` header.
- Changing a password signs out every other device; switching an account or a territory off signs
  its people out at their next request. **Every request is checked against the database**
  (`AccessScopeMiddleware`), so a switched-off account or a changed role takes effect at once.
- **Rate limits.** Sign-in, renewal and sign-out: 30 a minute per address, on top of the
  per-account lockout. Everything else: 120 per 10 seconds per user.
- **Headers.** A Content-Security-Policy (same-origin scripts only), `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and
  HSTS outside development.
- **Errors.** A 500 says what failed but not why; the exception text is only returned in
  Development.
- **Configuration.** Outside Development the API refuses to start without a real `Jwt:Key` (32+
  characters, not the placeholder) and a connection string.
- **Behind a proxy** - Coolify's, in the cloud - the API reads `X-Forwarded-For` /
  `X-Forwarded-Proto`, believing only the hop the proxy added (`ForwardedHeaders:ForwardLimit`).
  `docker-compose.yml` turns this off, because on a Pi nothing sits in front of the app;
  `docker-compose.coolify.yml` turns it on, and publishes no port of its own.

---

## 5. The database

PostgreSQL 16, database `CfsFundraiser`, user `cfs`.

| Where | Container | Data volume | Password |
|---|---|---|---|
| Development ([`api/docker-compose.yml`](api/docker-compose.yml)) | `cfs-dev-postgres`, on `localhost:5432` | `cfs-dev-pgdata` | `cfs-dev` (matches `api/appsettings.json`) |
| Production ([`docker-compose.yml`](docker-compose.yml)) | `cfs-db`, not published to the host | `cfs-pgdata` | `POSTGRES_PASSWORD` from `.env` |

- Start over with an empty development database:

  ```bash
  docker compose -f api/docker-compose.yml down -v
  ```

- Any other PostgreSQL works too: put its connection string in
  `ConnectionStrings:DefaultConnection` in `api/appsettings.local.json`.
- The volumes survive restarts, rebuilds and image updates. On a Pi, `cfs-backup.sh` and
  `cfs-reset-db.sh` back up, restore and reset it (section 10).
- Orders you make while testing stay in the database. Void them or reset the development database
  before you look at real figures.

---

## 6. The dashboard

Vite + React 19 + TypeScript SPA in [`dashboard/`](dashboard), styled with Tailwind CSS 4.

**Run it**

```bash
cd dashboard && npm install && npm run dev
```

- Listens on `http://localhost:3000`.
- Reads the API's address from `VITE_API_URL` in `dashboard/.env.local` (see section 3). Without
  it, calls go to the page's own origin, which is what the image wants.
- The API only accepts browser calls from the origins in `Cors:AllowedOrigins`
  (`http://localhost:3000` by default).

**Scripts**

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-checks (`tsc -b`) and builds to `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Serves the built `dist/` |
| `npm run format` | Prettier |

**Version.** The profile menu shows the build's version, YYYY.MM.&lt;build&gt;, from the
`DASHBOARD_VERSION` environment variable at build time. The image workflow sets it; a build made
by hand calls itself this month's build 0 (e.g. `2026.10.0`).

**Browser support.** Tailwind CSS 4 needs **Safari / iPadOS 16.4 or later, or Chrome 111 or
later**. The 5th-generation iPad (2017) and later, iPad Air 3, iPad mini 5 and every iPad Pro run
it; an iPad Air 2, iPad mini 4 or older iPad stops at iPadOS 15 and won't style the dashboard
properly.

---

## 7. The mobile app

Expo SDK 57 + React Native 0.86 + Expo Router in [`app/`](app), styled with NativeWind 4 so it
looks like the dashboard. Every dashboard screen is there, on a native tab bar (Sell, Checkout,
Orders, Dashboard, and More for Inventory, Catalog, Events, Crew, Settings and Territories), with
the same territory picker in the menu bar. Sign-in is the same username and password; the app
keeps its session in the device's secure storage (section 4, *Security*). Sheets print and
email as the same picture-per-page PDF the dashboard makes. Each screen reads its data again,
quietly, whenever it comes back into view (`Hooks/UseRefreshOnFocus.ts`) - every one but Settings,
so a half-typed change there isn't lost.

**Run it**

```bash
cd app && npm install && npx expo start
```

- Scan the QR code with Expo Go, or press `w` for a browser build.
- Copy `app/.env.example` to `app/.env` and set `EXPO_PUBLIC_API_URL` to a server the phone can
  reach: the API bound to `0.0.0.0` (section 4) at `http://<your PC's IP>:5046`, or the live site.
- The browser build runs on its own port; to sign in from it, run it on 8082 and let the API
  accept that origin:

  ```bash
  npm --prefix app run web -- --port 8082
  ```

  with `Cors__AllowedOrigins__1=http://localhost:8082` in the API's environment.

**Checks**

```bash
cd app && npx tsc --noEmit && npx expo lint && npx expo-doctor
```

`npx expo export -p ios` (or `-p android`) bundles the JavaScript the way a store build does,
which catches a bundling problem before EAS does.

**Dependencies.** Add or update packages with `npx expo install`, never plain `npm install
<package>`, so they stay on the versions SDK 57 supports. `package.json` overrides a few packages
for security fixes, and `vendor/` holds a patched `decode-uri-component`;
[`app/README.md`](app/README.md) explains each and the two advisories that have no fix yet.

**Version.** YYYY.MM.&lt;build&gt;, from `app/version.json`, which only the release workflow writes;
any other build is this month's build 0. The bundle ID and Android package are
`com.cfsbeds.cfssales`.

[`Documents/Mobile App Guide.md`](Documents/Mobile%20App%20Guide.md) covers all of this in detail:
running, development builds, what to try on a device, store builds, TestFlight and the release
workflow.

---

## 8. Configuration reference

**API settings** come from, in order (later wins): `appsettings.json`,
`appsettings.local.json`, `appsettings.{Environment}.json`, `appsettings.local.{Environment}.json`,
then environment variables, where `:` becomes `__` (`Jwt__Key`, `Cors__AllowedOrigins__0`). The
`local` files are gitignored: keep your own connection string, JWT key and SMTP password there.

| Setting | Default | What it does |
|---|---|---|
| `ConnectionStrings:DefaultConnection` | the development container | PostgreSQL connection string |
| `Jwt:Key` | a placeholder | Signing key, at least 32 characters. **Replace it** anywhere real. |
| `Jwt:AccessTokenMinutes`, `Jwt:RefreshTokenDays` | 15, 7 | Access token lifetime (up to 60 minutes), and how long a device stays signed in unused (1-30 days) |
| `Auth:MaxFailedAttempts`, `Auth:LockoutMinutes` | 5, 15 | Wrong passwords in a row before an account is locked, and for how long |
| `Auth:AllowLegacyPins` | `true` | Lets an account from before passwords sign in once with its old PIN, then choose a password |
| `Auth:SecureCookies` | blank (follows the request) | Whether the dashboard's session cookie is HTTPS-only. Blank makes it secure over HTTPS and still work on a cart's plain-HTTP network; `true` or `false` forces it |
| `ForwardedHeaders:Enabled`, `ForwardLimit` | `true`, 1 | Read the client's address from a proxy in front (Coolify's, in the cloud); off in `docker-compose.yml` |
| `Seed:AdminPassword` | blank | The first `admin` account's starting password; blank writes a random one to the log |
| `Seed:Skip` | `false` | `true` starts without the sample catalog, delivery options and event. The first `admin` account is still created when there are no accounts at all, so a new database is never locked. |
| `Email:Host`, `Port`, `Security`, `Username`, `Password`, `From`, `FromName`, `ReplyTo` | off | SMTP for emailed receipts and reports. With no host, email is off and the dashboard says so. |
| `Cors:AllowedOrigins` | `http://localhost:3000`, `http://127.0.0.1:3000` | Browser origins allowed to call the API in development |
| `Startup:DatabaseAttempts` | (30 in the image) | How long to wait for PostgreSQL at start |

**The image's `.env`**, next to `docker-compose.yml` (gitignored):

| Variable | Required | Becomes |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | The database password, for both containers |
| `JWT_KEY` | yes | `Jwt__Key` |
| `CFS_IMAGE` | no | The image to run (default `ghcr.io/llkirkwood9/cfs-fundraiser:cloud` on this branch) |
| `CFS_BACKUP_KEEP` | no | How many backups `cfs-backup.sh` keeps (10) |

In the cloud the same settings are **Environment Variables** on the Coolify resource, read by
`docker-compose.coolify.yml`; Coolify makes up the database password and `Jwt__Key` itself. That
file also has `ALLOW_LEGACY_PINS` (`Auth__AllowLegacyPins`, `false` by default there) and the
nightly backup's `TZ`, `CFS_BACKUP_TIME` and `CFS_BACKUP_KEEP`, and email defaults to port 2525.
| `SKIP_SEED_DATA` | no | `Seed__Skip` |
| `SEED_ADMIN_PASSWORD` | no | `Seed__AdminPassword` |
| `EMAIL_HOST`, `EMAIL_PORT` (587), `EMAIL_SECURITY` (StartTls), `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM` | for email | `Email__*` |
| `EMAIL_FROM_NAME` | no | Overrides the sender name, which is otherwise the app name from Settings |
| `EMAIL_REPLY_TO` | no | Where customers' replies go, when the sending address isn't read |

**Email.** Gmail needs an app password. If receipts land in spam, the sender is usually the cause:
a new free account called "noreply", showing a company name and sending PDFs to strangers, is what
spam looks like. The lasting fix is sending from the company's own domain (Google Workspace, or a
service such as SMTP2GO, Postmark, Amazon SES or SendGrid) with SPF, DKIM and DMARC set up; only
the `EMAIL_*` settings change. [`Documents/Raspberry Pi Setup.md`](Documents/Raspberry%20Pi%20Setup.md)
walks through it.

**Settings in the app.** Business details, the sales sheet terms, the receipt email's wording,
financing, new-event rates and dashboard thresholds are set on `/settings` - company-wide by an
admin, or per territory - and stored in the `AppSettings` and `TerritorySettings` tables, not in
config files (section 12).

---

## 9. Testing

There are no automated test suites. Every change is checked with the build and lint steps below,
then by hand.

**Checks: run them before every push**

| Component | Command |
|---|---|
| API | `cd api && dotnet build` |
| Dashboard | `cd dashboard && npm run lint && npm run build` |
| Mobile app | `cd app && npx tsc --noEmit && npx expo lint` |
| Mobile app, after a dependency or config change | `cd app && npx expo-doctor && npx expo export -p ios` |
| App image, after a Dockerfile change | `docker compose build` |

---

## 10. Deployment

### The app image

[`.github/workflows/cloud-deploy.yml`](.github/workflows/cloud-deploy.yml) runs on
every push to `main` that touches the app or its deployment files, or by hand from the
Actions tab. It numbers the build from the `cloud-v*` tags, builds it for `linux/amd64` and
`linux/arm64`, pushes it as `:cloud`, `:cloud-<version>` and `:<commit sha>`, then calls Coolify's
deploy webhook (section *Cloud hosting*). Pis run `:cloud` too.


To build and push one by hand instead:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/<owner>/cfs-fundraiser:cloud --push .
```

### Running the image anywhere

The same `docker-compose.yml` runs on an x86 PC or server and on a Raspberry Pi. Put a `.env` next
to it with at least:

```
POSTGRES_PASSWORD=a-long-random-password
JWT_KEY=a-long-random-string-of-at-least-32-characters
```

then either pull the published image:

```bash
docker compose pull && docker compose up -d
```

or build it from this checkout:

```bash
docker compose up -d --build
```

Open `http://localhost:8080`, or `http://<this machine's IP>:8080` from a tablet. The first start
takes a few seconds while PostgreSQL initialises; the app then creates its tables and loads the
catalog. Updating is the same pull and up; the data stays in the `cfs-pgdata` volume.

### Raspberry Pi at an event

[`Documents/Raspberry Pi Setup.md`](Documents/Raspberry%20Pi%20Setup.md) is the step-by-step guide.
The scripts in [`docker/pi/`](docker/pi):

| File | What it does |
|---|---|
| `cfs.service` | systemd unit that runs `cfs-update.sh` at boot |
| `cfs-update.sh` | Pulls the latest image when there's internet and starts the app either way, so a Pi with no connection at the venue still comes up |
| `cfs-backup.sh` | `backup [dir]`, `list`, `restore latest\|<file>` for the database |
| `cfs-reset-db.sh` | Empties the database (`--yes` to skip the prompt, `--no-backup` to skip the backup first); the app re-seeds on the next start |

`docker-compose.pi.yml` only includes `docker-compose.yml`, so a Pi set up with that file name
carries on unchanged.

### Cloud hosting

One DigitalOcean server (2 vCPUs, 2 GB - Coolify's minimum) runs **Coolify**, a free, open-source
control panel, which runs [`docker-compose.coolify.yml`](docker-compose.coolify.yml): the same app
and PostgreSQL as a Pi, a backup before each deploy and one every night into `/opt/cfs/backups`.
Coolify's proxy puts HTTPS on the business's domain (Let's Encrypt), and its dashboard shows the
logs and deployments. The domain's records are in Squarespace.

`cloud-deploy.yml` builds the image on GitHub, never on the server, and then calls the Coolify
resource's deploy webhook (secrets `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN`) and follows the
deployment until it finishes. Coolify reads the compose file from the repository, pulls the new
`:cloud` image (`pull_policy: always`) and restarts the app. Without those secrets the deploy step
just says so.

[`Documents/Cloud Deployment.md`](Documents/Cloud%20Deployment.md) is the step-by-step guide:
sizing, the server and its firewall, installing Coolify, the Squarespace DNS records, creating the
resource, the GitHub settings, the first sign-in, email through SMTP2GO (on port 2525, since
DigitalOcean blocks the usual mail ports), backups and restoring, moving a cart's data across,
updating, rolling back and troubleshooting. The mobile app connects to the same domain.

### The mobile app

[`.github/workflows/app-release.yml`](.github/workflows/app-release.yml) releases the app when
`main` is pushed to the `app-release` branch:

```bash
git push origin main:app-release
```

1. Numbers the release YYYY.MM.&lt;build&gt; from the existing `app-v*` tags and reserves the tag
   `app-v<version>`.
2. **Android:** builds an APK with the EAS `preview` profile and attaches it to a GitHub release
   named `app-v<version>`.
3. **iOS:** builds with the EAS `production` profile and submits it to TestFlight
   (`--auto-submit`), using the App Store Connect app in `app/eas.json`.

It needs the `EXPO_TOKEN` repository secret and the App Store Connect API key stored in EAS; the
one-time setup is in sections 5 and 6 of the
[Mobile App Guide](Documents/Mobile%20App%20Guide.md#6-automatic-releases-with-github-actions),
along with building by hand with `eas build`.

---

## 11. Contributing

### Branches

| Branch | What it's for |
|---|---|
| `main` | Day-to-day work, and what the cloud runs. Every push that touches the API, dashboard or deployment files builds a new image and deploys it with Coolify. |
| `app-release` | Release trigger only: push `main` to it to ship the app. Never commit to it directly. |

For anything bigger than a small fix, work on a branch and open a pull request against `main`.

### Workflow

1. Run the stack locally (section 3) and make the change.
2. Run the checks for every component you touched (section 9) and test it by hand, including dark
   mode and a phone-sized screen.
3. If the change is visible to the crew, update the docs (below).
4. Commit with a short summary line that says which part changed and what it does, such as
   `App: keep swipe rows opaque when a swipe starts` or `Dashboard: ...`, and a body explaining
   why when it isn't obvious.
5. Push. Versions and tags are made by the workflows; never edit or tag them by hand.

### Keeping things in step

- **Dashboard and app.** `app/src` mirrors `dashboard/src`. `Models`, `Services` and most of `Lib`
  are copies: change both when the API changes. A new screen or feature usually belongs in both.
  The app has its own touch patterns - rows open on a tap and reveal their actions on a swipe, and
  lists are reordered by holding and dragging, where the dashboard has arrows.
- **API changes.** Add a migration for any model change. Keep DTOs nullable and never return EF
  models.
- **Docs to update** for a change the crew will notice:
  - This README.
  - `Documents/CFS Sales App User Guide.docx`, the crew's manual. Edit it in place in Word. It's
    written for the crew, so it never mentions the System Admin role.
  - `Documents/Mobile App Guide.md` for anything about running, testing or releasing the app.
  - `Documents/Raspberry Pi Setup.md` for anything about the image, its settings or the scripts.

### Conventions

**Backend**

- Every controller inherits `BasicController`, with primary-constructor dependency injection.
- Every action is wrapped in its own try/catch that traces the error and returns
  `ServerError(...)`: `{ error }`, plus `exception` in Development only.
- Access checks go through `Scope`, `IsAtLeast`, `CanSee` and `CanEditCatalog` on
  `BasicController`.
- Actions are grouped in `#region POST/GET/PATCH/DELETE Methods`.
- Validation is done by hand at the top of each mutating action.
- DTO properties are all nullable, and EF models are never returned.
- Money is computed only in `Utils/OrderCalculator.cs` (section 13).

**Dashboard and app**

- PascalCase folders and filenames.
- One service file per controller, with POST/GET/PATCH/DELETE banner comments. Services never
  throw: they call `HandleAxiosError` and return a safe default.
- All HTTP goes through `Lib/api.ts` (an in-memory bearer token, the client and territory
  headers, and a shared session-renewal interceptor).
- Tailwind utilities only, with an explicit `dark:` variant on every colour. No component library.
- Icons only through the local `Icon` wrapper; feedback only through `Toast`.
- Tablet first: controls are at least 48px tall, inputs are 16px so iPad Safari doesn't zoom on
  focus, modals are full-width sheets on a phone and centred cards on a tablet, and the navbar is
  a top bar on a tablet and a bottom tab bar on a phone.
- In the app: install packages with `npx expo install`, respect the safe areas, and keep inputs
  clear of the keyboard (`KeyboardAvoider`).

**Repository**

- Never commit secrets: `api/appsettings.local*.json`, `dashboard/.env.local` and `.env` are
  gitignored for that reason.
- Shell scripts and the Dockerfile keep LF line endings (`.gitattributes`), or the Pi can't run
  them.

---

## 12. What it does, screen by screen

The [user guide](Documents/CFS%20Sales%20App%20User%20Guide.docx) is the crew's version of this.
Routes are the dashboard's; the app has the same screens.

**Territories and roles**
- The business is split into **territories** (Pittsburgh, Cleveland, ...). Every event belongs to
  one, and so do its crew, its stock and any catalog items of its own. Each territory has one
  active event at a time.
- **System admins** and **administrators** work across every territory. The territory picker in
  the menu bar chooses which one the screens show - or **All territories**. Selling, checkout and
  stock counts need a single territory, so those screens ask for one when All is picked.
- Everyone else belongs to one territory and only sees its events, orders, stock and settings. A
  **manager** runs a territory: its crew, events, own catalog items and settings.

| | Sales / Checkout | Sales & Checkout | Manager | Admin | System Admin |
|---|---|---|---|---|---|
| Territories | own | own | own | all | all |
| Sell / checkout | one each | both | both | both | both |
| Events, crew, settings | - | - | own territory | everything | everything |
| Catalog | - | - | own territory's items | global and territory items | global and territory items |
| Territories screen | - | - | - | yes | yes |
| Permanent deletes, catalog files | - | - | - | - | yes |

**Sales floor** (`/sales`, Sales role)
- A rep holds as many drafts open at once as they have customers, each a tab across the top. Every
  change is saved to the server as it is made, so switching never loses anything. A new draft
  has no order number until its first item is added, and stays off the Orders screen until then,
  so a rep can open one just to check prices.
- The customer's first and last name are separate boxes, on the rep's form and the customer's, and
  checkout won't take the order until both are filled in.
- Items are added from the catalog: pick a category, a product, a size or configuration, any
  selections the product has (such as a sheet set's Color), and a shipping method. Quantity, a
  discount (a percent, or a fixed amount off each item) and a price for "Inquire" sizes are on the
  same screen. Every item gets a shipping row under it, including no-charge ones such as Drop Ship
  and Take With.
- **Size guide** (the ruler in the menu bar, and beside the sizes in Add item) shows the mattress
  size chart, drawn to scale, with each size's width and length.
- A product on sale shows a Sale badge and its sale prices. The sale comes off first, and the
  rep's own discount comes off the sale price, with the working shown before the item is added.
- A bundle - such as a mattress sold as a set with an adjustable base - gets each included item as
  its own no-charge "included" row, so the sheet shows exactly what is being delivered.
- **Add service** attaches a second in-home service (White Glove *and* Haul Away). **Add
  upcharge** puts an extra charge on an item with its reason (a special order, a custom size); it
  prints as its own row, follows the item's quantity and is taxed when the item is.
- Items can be put in a new order - with the arrows on the dashboard, or by holding and dragging
  in the app. An item's own rows move with it.
- **Hand device to customer** opens a plain-language, oversized form for the customer's own
  address, a delivery address if the bed is going elsewhere, and who referred them. No prices and
  no navigation are on screen while they have it.
- **Complete** hands the order to the checkout table.
- The item count on each order (draft tabs, the checkout queue, Orders) counts items sold and what
  comes with a bundle, by quantity - not shipping, services or upcharges.

**Checkout table** (`/checkout`, Checkout role)
- A queue of the orders the floor has handed over, oldest first, with how long each customer has
  been waiting. It refreshes itself every 5 seconds. Anywhere in the app, the Checkout tab shows
  how many customers are waiting: read every 20 seconds, at once when this device sends over,
  completes, reopens, voids or deletes an order, and with every refresh while Checkout is open.
- Items and comments can still be changed here, exactly as on the floor.
- If another device completes, voids or sends back the order on screen, it closes here with a
  message, once it drops out of the queue.
- Payment can be split across cash, check, credit/debit card, financing and layaway. Choosing
  Credit/Debit Card puts the card processing fee on the total at once, so the figure quoted is the
  figure charged; **No card fee on this order** waives it. Financing takes the type (from the
  catalog's financing options, or Other) and the financing number, both printed on the sheet.
- **Hand to customer** walks the customer through the acknowledgements one at a time, taking
  initials for each, then a finger-drawn signature, stored with the order and printed on the sheet.
  Only the statements that apply to the order are asked (see *Acknowledgements* in section 13): a
  pillow taken home goes straight to All sales are final and the signature, and the skipped ones
  print N/A.
- **Complete sale** closes the sale and opens the receipt.

**Sales sheet** (`/receipt/:id`, all roles)
- A reproduction of the CFS sales sheet, with the customer's initials and signature printed in
  place. A sheet that isn't completed is stamped NOT COMPLETED (or VOIDED) on screen and on paper.
- **Print** and **Email** use the same picture-per-page PDF, built in the browser (html2canvas-pro
  and jsPDF, loaded on demand) at paper width whatever the device, so every copy matches. A desktop
  browser prints it directly; a tablet, a phone or Safari opens it to print or share. Email sends
  it with a friendly note whose wording is set on `/settings`. The API accepts a PDF under 18 MB.

**Orders** (`/orders`, all roles)
- Every order for the event, filterable by status and searchable by customer, rep or order number,
  with a line above the list giving how many it shows, what they come to and what is still owed
  (voided orders aren't counted in the money).
- A manager or above also gets **All events** and a per-event picker for their territory (an
  admin: the territory in view, or every territory), and can **Reopen** a completed order -
  to the checkout table to fix a payment, initials or signature, or to the floor to change what was
  sold.

**Dashboard** (`/dashboard`, all roles)
- The stat sheet, live: total and net sales, units by category, mattresses plus adjustable bases,
  average sale, payment breakdown, best sellers, sales by the hour and stock to watch. Items inside
  a bundle count in their own unit column but aren't listed as best sellers - the bundle is.
- **All events** gives an overview of every event with each one's figures side by side, and the
  worst sellers: the catalog's products that have sold the fewest, including any never sold. Only
  completed sales feed the money figures; drafts and voided orders are reported separately.
- With **All territories** picked, admins also get **Territories side by side**: each territory's
  completed sales, total and net, average sale, mattresses and bases, and what is still owed, for
  today, 7 days, 30 days, this year or all time. Tapping a territory switches to it.

**Inventory** (`/inventory`, Checkout role)
- On-hand stock for the accessories kept at the cart (products marked Track inventory), by size
  and, where a selection counts stock, by choice. Take With sales come off automatically when an
  order is completed.
- **Start** and **end counts** (`/inventory/count/:phase`): checkout counts the shelf before the
  doors open and after they close; the counts feed the Accessory Inventory Sheet.

**Management** (Manager and up)
- `/catalog` - products, sizes and prices, bundles, delivery options and their prices per product,
  sales (per product, per size and per delivery option), a note for the rep on the product and on
  each size (shown in Add item), selections, Track inventory, warranty
  (whether a product has one, and its length, shown in Add item), financing
  options, and the order the floor offers delivery and financing in. System admins can **Export
  catalog** and **Restore catalog** as a JSON file (section 13). An item, delivery option or
  financing option is either **global** (sold in every territory) or one territory's own. Only
  admins change global ones; a manager adds and edits their territory's. A territory's item can
  include and offer global things and its own territory's; a global item only global ones.
- `/events` - each event's territory, organization, sales tax rate, card processing fee and order numbers, and
  which one is active in its territory. An event with no orders yet can move to another
  territory. **Close out** (`/events/:id/close`) lists what to check before the cart
  packs up - orders still open, balances owed, stock counts - then closes the event. An admin or
  system admin can
  clear the open orders from there, one at a time (a button on the dashboard, a swipe in the app)
  or all at once: a draft with nothing paid is discarded, anything at checkout or with a payment
  is voided.
  **Sales sheets** (`/events/:id/sheets`) shows the filled-in Fundraiser Stat Sheet and every
  completed sheet, to print as one PDF, download as CSV, or email (with the accessory inventory
  sheet) to up to 10 addresses.
- `/crew` - accounts, roles, territories, starting passwords and unlocking. A manager looks after
  their territory's Sales and Checkout crew.
- `/territories` (admins) - add, rename, switch off (which signs the territory's crew out and
  closes its active event) or delete an empty territory.
- `/settings` - business details (company name, customer service number, app name), the sales
  sheet terms the customer initials and when each is asked, the receipt email's subject and wording (with `{Placeholders}`
  and a live preview), whether financing allows Other, the rates a new event starts with (7% and
  2%), and the dashboard's star and running-low levels. Admins edit the **company-wide** settings
  or pick a territory to set its own; a territory follows the company for anything it hasn't
  changed, and **Follow company settings** on a card puts it back. Managers edit their own
  territory's. The app name is the same everywhere. Sales sheets, receipts and emails use the
  settings of the territory the sale was taken in. Stored in `AppSettings` (company-wide) and
  `TerritorySettings`, one row per setting that differs. `GET /api/settings/public` is open (the
  sign-in screen needs the app name); everything else needs a signed-in user.

---

## 13. How the domain is modelled

**Territories partition the business.** `Territory` has a name and an on/off switch. `Event`
always has a territory; `User` has one unless they're an admin or system admin; `Product`,
`DeliveryOption` and `FinanceOption` have one or none (none = global). `AccessScope` turns the
signed-in user plus the `X-Territory-Id` header into the one territory (or none = all) every query
filters by.

**Stock is counted per territory.** `InventoryStock` holds one row per territory and size (or size
and combination of counted choices), so a global pillow can have 12 on the Pittsburgh cart and 3
in Cleveland. Sales draw from, and reopened or voided sales go back to, the territory of the event
the sale was taken at; each `InventoryAdjustment` records its territory.

**A product owns its prices.** `Product` (model name, brand, category) has many `ProductVariant`
rows, each a size plus an optional configuration - `Queen / Mattress Only`, `Queen / Hi-Rise`,
`Queen / IMC61 Adjustable`, `Queen / ES200 Flex Head`. That is exactly how the price cards are
laid out, and any product can be given any set of sizes without a schema change.

**A null price means "Inquire."** Where the price card reads Inquire, or the supplied documents
don't give a price, the variant has a null price. The floor shows it as *Inquire* and makes the rep
key a price in. Nothing is ever sold at an invented number.

**Delivery differs per product.** `DeliveryOption` is a shared list (Drop Ship, Take With, White
Glove $79, Haul Away $99, Local Delivery). `ProductDeliveryOption` joins a product to the options
it offers and can override the price for that product alone.

**Shipping is always its own row.** Choosing a shipping method adds a `Delivery` line under the
item, whatever it costs, so the sheet always says how each item is leaving. Take With also ticks
the Take With box on the item. Each delivery option has a **Show on sales sheet** setting: when it
is off the row stays on the order, marked "Not on sales sheet", but is left off the printed sheet
and the CSV (Take With is off by default, since the item's Take With column already says it). A
row with a charge always prints, so the subtotal adds up, and the setting is copied onto each row,
so changing it never alters a sheet already printed.

**Bundles are real catalog items.** Any size of any product can include other catalog items at no
extra charge (`ProductVariantComponent`): `Agility 3000 / Queen / IMC61 Adjustable` includes
`IMC61 Adjustable Base / Queen`. Selling a bundle adds an `Included` line per item under it,
snapshotting the item's name, brand, size and category; those lines scale with the bundle's
quantity and can't be edited or removed on their own. Because an included item keeps its own
category, a set counts as one mattress *and* one base on the stat sheet. A product can't include
itself, and a bundle can't include another bundle.

**Lines are snapshots.** Brand, size, description, price and category are copied onto the order
line when it is added. Editing or retiring a catalog product never rewrites a printed receipt. A
product that has been sold is archived rather than deleted.

**Line order.** `Utils/LineOrder.cs` renumbers an order's `SortOrder`s whenever a line is added or
removed, and `PUT /api/order/order/{id}/lines/order` takes the items in a new order. Each item is
followed by its own rows - `Included`, then `Upcharge`, then `Delivery`, oldest first within each.
`SortLinesForPrint` applies the same pattern on screen and on the sheet.

**Sales and discounts.** A product can carry a sale (`SaleDiscountPercent` or
`SaleDiscountAmount`), and a size can override it (`HasOwnSale` plus its own pair, where an
override of nothing means no sale). The sale in force is copied onto the line, so ending a sale
never changes an order already written, and it only applies to sizes with a catalog price. The
rep's discount (`DiscountPercent` or `DiscountAmount`, never both) comes off the sale price; an
amount is per item, and nothing goes below $0. Shipping rows work the same way: a `DeliveryOption`
can carry a sale, a product's `ProductDeliveryOption` can override it, and `Choices.DeliverySaleFor`
picks the one in force.

**Selections.** `ProductOption` (e.g. Color) has `ProductOptionChoice` rows (Gray, White), each
with an optional price change. The picks are stored on the line as JSON (`ChoicesJson`) and printed
after the description. When a selection **counts stock**, each size keeps a count per combination
of counted choices, in each territory: `InventoryStocks` rows carry a `StockKey` such as
`3:12|4:20` (option id : choice id, ordered by option), and the empty key is the size's own count.
`Utils/Choices.cs` resolves picks and builds keys; `Utils/InventoryRules.cs` reads and changes the
counts.

**Inventory.** Only products marked Track inventory are counted, and each size can be left out
(a size not kept at the cart): it isn't counted and can't be sold as Take With, nor can a bundle
that includes it. `Utils/InventoryRules.cs` enforces it.

**Catalog files.** `GET /api/catalog/export` and `POST /api/catalog/import` (system admins only)
save and restore the catalog as JSON (`"format": "cfs-catalog", "version": 1`) - every product
setting, size (with its note and sale), bundle, selection, delivery and financing option, but no
stock counts - with no database ids: products are matched by territory, brand and name, sizes by
size and configuration, and everything else by name, so a matched item keeps its stock counts and
past sales. Each item, delivery option and financing option names its territory (blank when
global); on restore it goes to the territory with that name, or comes in as global with a warning
when there isn't one. Replacing clears every territory's items. `mode: "update"` brings matches
in line and adds the rest; `mode: "replace"` runs `PermanentDelete.CatalogAsync` first. The file is
checked in full and the restore runs in one transaction, so a bad file changes nothing.
`Utils/CatalogTransfer.cs` does the work.

**An event is named by its organization**, e.g. "New York Marching Band", which heads the stat sheet and is
copied onto each order. Each territory has one active event at a time, and new orders can only be
taken while one is.

**Rates are snapshots too.** Each order stores the tax rate and card fee rate it was written under,
so changing an event's rate only affects orders from then on.

**The card fee follows the chosen method.** An order's `ApplyCcProcessingFee` flag is set when
checkout picks Credit/Debit Card and cleared otherwise (the stored method is still `VisaMc`). Once
a card payment is keyed in, that amount caps the fee, so a payment that already includes the fee
never compounds it. `WaiveCcProcessingFee` treats the fee rate as zero; a checkout role can set it
until the sale is complete.

**Acknowledgements.** Each statement under Settings has an `AskWhen`: `always`, `shipped` (some
item isn't Take With) or `warranty` (some item has a warranty). `Utils/Acknowledgements.cs` works
out the order's `RequiredTerms` from its lines - a product's `HasWarranty` and `WarrantyLength` are
copied onto the line when it is added - and completing checks only those. A completed order is
judged by the terms it kept (`TermsJson`). Defaults: details and drop ship when something ships,
warranty when an item has one, all sales final always. Mattresses and adjustable bases have a
warranty unless an admin unticks it.

**Upcharges are lines.** An `OrderLineType.Upcharge` row has the reason as its description, the
amount per item as its unit price and the item as its `ParentLineId`. `OrderCalculator` keeps its
quantity and taxability in step with the item, and the dashboard tallies leave it out.

**Money is computed in one place.** `Utils/OrderCalculator.cs` recalculates lines and totals on
every change, and the API returns the recalculated order. The screen and the receipt show the same
numbers because neither does arithmetic.

### Order lifecycle

```
Draft ──Complete──> AwaitingCheckout ──Complete sale──> Completed
  ^                        │                               │
  └────── Send back ───────┘        Reopen (manager) <─────┘
                                      Void ──> Voided (kept, excluded from totals)
```

A draft takes the event's next order number when its first item is added, in one statement
(`UPDATE ... RETURNING`), so two reps can't get the same number. `BillingName` is kept as the
first and last name together, for printing and search; an app that still sends the whole name has
it split at the first space.

Completing with a balance outstanding is allowed - that is how layaway and financing sales are
recorded - and checkout warns when one will remain. A completed order keeps a copy of the terms it
was signed with (`Orders.TermsJson`), so a reprint never shows wording the customer didn't see.

---
