# CFS Mattress Fundraiser

Order-taking, checkout, inventory and reporting for CFS mattress fundraisers. Reps write orders on
tablets and phones on the sales floor, the checkout table takes payment and the customer's
signature, and the result is a printed or emailed copy of the CFS sales sheet, plus a stat sheet
for the event.

The catalog and the printed receipt are both built from the supplied source documents: the
9/12/26 price cards and the Hampton 9/12 sales sheets.

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
14. [Seeded catalog, and what still needs prices](#14-seeded-catalog-and-what-still-needs-prices)
15. [Deviations from the blueprint](#15-deviations-from-the-blueprint)

---

## 1. Components

| Component | Folder | Technology | What it is |
|---|---|---|---|
| **API** | [`api/`](api) | ASP.NET Core 10 (net10.0), EF Core, Npgsql | Every rule and every number: orders, pricing, catalog, inventory, events, crew, settings, email. JWT sign-in with a username and PIN. |
| **Database** | (container) | PostgreSQL 16 | One database, `CfsFundraiser`. The API creates and migrates its tables and seeds the catalog itself. |
| **Dashboard** | [`dashboard/`](dashboard) | Vite, React 19, TypeScript, Tailwind CSS 4 | The web app the crew uses on the cart's tablets and any browser. |
| **Mobile app** | [`app/`](app) | Expo SDK 57, React Native 0.86, Expo Router, NativeWind 4 | The dashboard's screens as a native app for iPhone, iPad and Android. |
| **App image** | [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml) | Docker (amd64 and arm64) | The API with the built dashboard inside it, on port 8080, beside a PostgreSQL container. |
| **Raspberry Pi scripts** | [`docker/pi/`](docker/pi) | bash, systemd | Start at boot, update, back up, restore and reset a Pi that runs the image at an event. |
| **CI/CD** | [`.github/workflows/`](.github/workflows) | GitHub Actions, EAS | Publishes the app image to ghcr.io, and builds and ships the mobile app. |
| **Documents** | [`Documents/`](Documents) | Word, Markdown | The user guide for the crew, the Raspberry Pi setup and the mobile app guide. |

How they fit together:

```
 Tablets / browsers ─┐
                     ├──>  App image (port 8080)  ──>  PostgreSQL
 Phones (the app) ───┘     API + dashboard files       (cfs-pgdata volume)
```

In production the API serves the built dashboard itself, so a browser sees one origin and one
port and there is no CORS to set up. The mobile app talks to the same API: its server address is
typed in on the sign-in screen (for example `http://192.168.1.50:8080`) and remembered on the
device. In development the three run separately (API on 5046, dashboard on 3000, app in Expo).

---

## 2. Repository layout

```
Dockerfile                  The app image: dashboard build + API publish + ASP.NET runtime
docker-compose.yml          The app image plus PostgreSQL, on port 8080
docker-compose.pi.yml       Includes docker-compose.yml, for Pis set up with this name
docker/pi/                  cfs.service, cfs-update.sh, cfs-backup.sh, cfs-reset-db.sh
.github/workflows/
├── app-image.yml           Numbers and publishes the app image to ghcr.io on a push to main
└── app-release.yml         Builds the mobile app on a push to app-release (APK + TestFlight)
.gitattributes              Keeps *.sh and Dockerfile at LF line endings

api/                        ASP.NET Core 10 Web API
├── Controllers/            One controller per resource, all inheriting BasicController
├── Dtos/                   Request/response shapes; EF models are never exposed directly
├── Models/                 EF entities
├── Data/                   ApplicationDbContext, its design-time factory, SeedData, CatalogSeed.json
├── Services/               TokenService (JWT, refresh tokens, PIN hashing), EmailService (SMTP)
├── Utils/                  BasicController, OrderCalculator, LineOrder, Choices, CatalogTransfer,
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
    ├── Context/            AuthContext (sign-in, roles), SettingsContext
    ├── Hooks/              UseTheme, UseLockBodyScroll
    ├── Lib/                api.ts (axios + token refresh), ErrorHandler, Toast, ModelHelpers,
    │                       Pricing, SheetPdf (print/email PDFs), Version, ...
    ├── Models/             One type per DTO
    ├── Pages/              One per route
    ├── Routes/             Routes.tsx, ProtectedRoute.tsx, HomeRedirect.tsx
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

4. **Sign in** with one of the seeded accounts:

   | Username | PIN | Role |
   |---|---|---|
   | `admin` | `1234` | Admin |
   | `sales` | `1111` | Sales |
   | `checkout` | `2222` | Checkout |

   **Change these before the app goes anywhere near a real event** (`/crew`), and set your own
   `Jwt:Key` (section 8).

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
  delivery options, a sample event and the three sign-ins from `Data/CatalogSeed.json` and
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

**Auth and roles.** Sign-in is a username and a numeric PIN; the API issues a JWT bearer access
token and an opaque refresh token. There is no self-service signup: an admin creates accounts on
`/crew`. Roles:

| Role | Can use |
|---|---|
| Sales | The sales floor |
| Checkout | The checkout table and inventory |
| SalesCheckout | Both of the above |
| Admin | Everything, including the catalog, events, crew and settings |
| SystemAdmin | Everything an Admin can, plus permanent deletes and catalog export/restore |

Orders, the sales sheet and the stat-sheet dashboard are open to every role.

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
Orders, Dashboard, and More for Inventory, Catalog, Events, Crew and Settings). Sheets print and
email as the same picture-per-page PDF the dashboard makes.

**Run it**

```bash
cd app && npm install && npx expo start
```

- Scan the QR code with Expo Go, or press `w` for a browser build.
- On the sign-in screen, enter a server address the phone can reach: the API bound to
  `0.0.0.0` (section 4) at `http://<your PC's IP>:5046`, or an image at `http://<IP>:8080`.
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
| `Jwt:ExpiresInMinutes`, `Jwt:RefreshTokenDays` | 720, 7 | Token lifetimes |
| `Seed:Skip` | `false` | `true` starts without the sample catalog, delivery options and event. The first `admin` account is still created when there are no accounts at all, so a new database is never locked. |
| `Email:Host`, `Port`, `Security`, `Username`, `Password`, `From`, `FromName`, `ReplyTo` | off | SMTP for emailed receipts and reports. With no host, email is off and the dashboard says so. |
| `Cors:AllowedOrigins` | `http://localhost:3000`, `http://127.0.0.1:3000` | Browser origins allowed to call the API in development |
| `Startup:DatabaseAttempts` | (30 in the image) | How long to wait for PostgreSQL at start |

**The image's `.env`**, next to `docker-compose.yml` (gitignored):

| Variable | Required | Becomes |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | The database password, for both containers |
| `JWT_KEY` | yes | `Jwt__Key` |
| `CFS_IMAGE` | no | The image to run (default `ghcr.io/llkirkwood9/cfs-fundraiser:latest`) |
| `SKIP_SEED_DATA` | no | `Seed__Skip` |
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
financing, new-event rates and dashboard thresholds are set by an admin on `/settings` and stored
in the `AppSettings` table, not in config files (section 12).

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

**By hand**

- Run the change against a local stack (section 3) as each role it affects. The seeded `sales` and
  `checkout` accounts show what a non-admin sees.
- **Pricing reference.** The pricing was checked against a real sheet: Hampton order **No. 1614**
  (Therapedic King Agility 3000 at 10% off, White Glove, Haul Away, a King mattress protector taken
  with) reproduces through the API to the cent. Anything touching `OrderCalculator`, sales,
  discounts, tax or the card fee should still produce it:

  | | Paper sheet | App |
  |---|---|---|
  | Subtotal | $2,526.10 | $2,526.10 |
  | Sales tax | $176.83 | $176.83 |
  | Total | $2,702.93 | $2,702.93 |
  | Balance due | $0.00 | $0.00 |

- **Sales sheets.** Print and email a sheet after any change to the receipt or its PDF; the
  printed and emailed copies are the same PDF and should match.
- **The mobile app.** Section 3 of the
  [Mobile App Guide](Documents/Mobile%20App%20Guide.md#3-testing) lists what to try on a real
  iPhone and Android device (keyboard, safe areas, dark mode, swipe and drag, printing).
- Clean up afterwards: void test orders or reset the development database (section 5).

---

## 10. Deployment

### The app image

[`.github/workflows/app-image.yml`](.github/workflows/app-image.yml) runs on every push to `main`
that touches `api/`, `dashboard/`, the `Dockerfile` or the workflow, or by hand from the Actions
tab. It:

1. Numbers the build YYYY.MM.&lt;build&gt; (the first in October 2026 is `2026.10.1`) from the
   existing `dashboard-v*` tags and pushes the tag `dashboard-v<version>`.
2. Builds the image for `linux/amd64` and `linux/arm64`, with that version in the dashboard.
3. Pushes it to `ghcr.io/llkirkwood9/cfs-fundraiser` as `:latest`, `:<version>` and `:<commit sha>`.

To build and push one by hand instead:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/<owner>/cfs-fundraiser:latest --push .
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

Hosting in the cloud, with territories, lives on the `Cloud-Support` branch; see
`Documents/Cloud Deployment.md` on that branch.

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
| `main` | Day-to-day work. Every push that touches the API or dashboard publishes a new image. |
| `Cloud-Support` | The cloud-hosted version, which adds territories. API and dashboard changes made on `main` are ported to it by hand, since the code differs; the mobile app lives on `main` only. |
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
  `{ error, exception }`.
- Actions are grouped in `#region POST/GET/PATCH/DELETE Methods`.
- Validation is done by hand at the top of each mutating action.
- DTO properties are all nullable, and EF models are never returned.
- Money is computed only in `Utils/OrderCalculator.cs` (section 13).

**Dashboard and app**

- PascalCase folders and filenames.
- One service file per controller, with POST/GET/PATCH/DELETE banner comments. Services never
  throw: they call `HandleAxiosError` and return a safe default.
- All HTTP goes through `Lib/api.ts` (bearer token plus a queued refresh interceptor).
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

**Sales floor** (`/sales`, Sales role)
- A rep holds as many drafts open at once as they have customers, each a tab across the top. Every
  change is saved to the server as it is made, so switching never loses anything.
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
- **Hand tablet to customer** opens a plain-language, oversized form for the customer's own
  address, a delivery address if the bed is going elsewhere, and who referred them. No prices and
  no navigation are on screen while they have it.
- **Complete** hands the order to the checkout table.

**Checkout table** (`/checkout`, Checkout role)
- A queue of the orders the floor has handed over, oldest first, with how long each customer has
  been waiting. It refreshes itself every 8 seconds.
- Items and comments can still be changed here, exactly as on the floor.
- Payment can be split across cash, check, credit/debit card, financing and layaway. Choosing
  Credit/Debit Card puts the card processing fee on the total at once, so the figure quoted is the
  figure charged; **No card fee on this order** waives it. Financing takes the type (from the
  catalog's financing options, or Other) and the financing number, both printed on the sheet.
- **Hand to customer** walks the customer through the acknowledgements one at a time, taking
  initials for each, then a finger-drawn signature, stored with the order and printed on the sheet.
- **Complete sale** closes the sale and opens the receipt.

**Sales sheet** (`/receipt/:id`, all roles)
- A reproduction of the CFS sales sheet, with the customer's initials and signature printed in
  place. A sheet that isn't completed is stamped NOT COMPLETED (or VOIDED) on screen and on paper.
- **Print** and **Email** use the same picture-per-page PDF, built in the browser (html2canvas-pro
  and jsPDF, loaded on demand) at paper width whatever the device, so every copy matches. A desktop
  browser prints it directly; a tablet, a phone or Safari opens it to print or share. Email sends
  it with a friendly note whose wording is set on `/settings`. The API accepts a PDF under 18 MB.

**Orders** (`/orders`, all roles)
- Every order for the event, filterable by status and searchable by customer, rep or order number.
- An admin also gets **All events** and a per-event picker, and can **Reopen** a completed order -
  to the checkout table to fix a payment, initials or signature, or to the floor to change what was
  sold.

**Dashboard** (`/dashboard`, all roles)
- The stat sheet, live: total and net sales, units by category, mattresses plus adjustable bases,
  average sale, payment breakdown, best sellers, sales by the hour and stock to watch. Items inside
  a bundle count in their own unit column but aren't listed as best sellers - the bundle is.
- **All events** gives an overview of every event with each one's figures side by side. Only
  completed sales feed the money figures; drafts and voided orders are reported separately.

**Inventory** (`/inventory`, Checkout role)
- On-hand stock for the accessories kept at the cart (products marked Track inventory), by size
  and, where a selection counts stock, by choice. Take With sales come off automatically when an
  order is completed.
- **Start** and **end counts** (`/inventory/count/:phase`): checkout counts the shelf before the
  doors open and after they close; the counts feed the Accessory Inventory Sheet.

**Admin** (Admin role)
- `/catalog` - products, sizes and prices, bundles, delivery options and their prices per product,
  sales (per product, per size and per delivery option), selections, Track inventory, financing
  options, and the order the floor offers delivery and financing in. System admins can **Export
  catalog** and **Restore catalog** as a JSON file (section 13).
- `/events` - each event's organization, sales tax rate, card processing fee and order numbers, and
  which one is active. **Close out** (`/events/:id/close`) lists what to check before the cart
  packs up - orders still open, balances owed, stock counts - then closes the event.
  **Sales sheets** (`/events/:id/sheets`) shows the filled-in Fundraiser Stat Sheet and every
  completed sheet, to print as one PDF, download as CSV, or email (with the accessory inventory
  sheet) to up to 10 addresses.
- `/crew` - accounts, PINs and roles.
- `/settings` - business details (company name, customer service number, app name), the sales
  sheet terms the customer initials, the receipt email's subject and wording (with `{Placeholders}`
  and a live preview), whether financing allows Other, the rates a new event starts with (7% and
  2%), and the dashboard's star and running-low levels. Stored in `AppSettings`, one row per
  setting that differs from its default. `GET /api/settings/general` is open (the sign-in screen
  needs the app name); everything else is admin-only.

---

## 13. How the domain is modelled

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
of counted choices in `ChoiceStocks`, keyed by a `StockKey` such as `3:12|4:20` (option id : choice
id, ordered by option); the empty key means the size's own `QuantityOnHand`. `Utils/Choices.cs`
resolves picks, builds keys and reads and changes counts.

**Inventory.** Only products marked Track inventory are counted, and each size can be left out
(a size not kept at the cart): it isn't counted and can't be sold as Take With, nor can a bundle
that includes it. `Utils/InventoryRules.cs` enforces it.

**Catalog files.** `GET /api/catalog/export` and `POST /api/catalog/import` (system admins only)
save and restore the catalog as JSON (`"format": "cfs-catalog", "version": 1`) with no database
ids: products are matched by brand and name, sizes by size and configuration, and everything else
by name, so a matched item keeps its stock counts and past sales. `mode: "update"` brings matches
in line and adds the rest; `mode: "replace"` runs `PermanentDelete.CatalogAsync` first. The file is
checked in full and the restore runs in one transaction, so a bad file changes nothing.
`Utils/CatalogTransfer.cs` does the work.

**An event is named by its organization**, e.g. "Hampton Band", which heads the stat sheet and is
copied onto each order. Only one event is active at a time, and new orders can only be taken while
one is.

**Rates are snapshots too.** Each order stores the tax rate and card fee rate it was written under,
so changing an event's rate only affects orders from then on.

**The card fee follows the chosen method.** An order's `ApplyCcProcessingFee` flag is set when
checkout picks Credit/Debit Card and cleared otherwise (the stored method is still `VisaMc`). Once
a card payment is keyed in, that amount caps the fee, so a payment that already includes the fee
never compounds it. `WaiveCcProcessingFee` treats the fee rate as zero; a checkout role can set it
until the sale is complete.

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
  └────── Send back ───────┘          Reopen (admin) <─────┘
                                      Void ──> Voided (kept, excluded from totals)
```

Completing with a balance outstanding is allowed - that is how layaway and financing sales are
recorded - and checkout warns when one will remain. A completed order keeps a copy of the terms it
was signed with (`Orders.TermsJson`), so a reprint never shows wording the customer didn't see.

---

## 14. Seeded catalog, and what still needs prices

From the 9/12/26 price cards, complete:

- **24 CFS models** (TSS, Southerland, Therapedic) with Twin through King in Mattress Only,
  Hi-Rise and IMC61 Adjustable, plus ES200 Flex Head on the seven premium Therapedic models.
  Twin is omitted for adjustable bases and Full is stored as Inquire, as the cards show.
- **9 premium models** (Helix, Purple, Brooklyn Bedding, Beautyrest) with their sale-price notes.
  Sizes the PDF shows as a dash are simply not created.

Read off the Hampton order sheets:

- Mattress protectors: Twin $69, Queen $89, King $99.
- Pillows: SoftCell Chill (2.0) $149, Replenish $129.
- Delivery: White Glove $79, Haul Away $99.

**Still needs prices before an event** - seeded as *Inquire* rather than guessed, so they are safe
to leave but slow a rep down:

- Mattress protectors in Twin XL and Full.
- Shoulder Carbon Cool, Sub 0 Down Complete, Shattered Ice and Snowflake pillows; King in every
  pillow.
- Sheet sets, bed frames and bean bag chairs (no prices appear in the supplied documents).
- Standalone adjustable bases (the cards only quote them bundled with a mattress).
- Monarch Euro Top, King, ES200 Flex Head - the price isn't legible on the supplied card.

Fill them in at `/catalog`.

Two notes on the source data: the Agility 3000, Agility 5000 and Monarch Euro Top share identical
Hi-Rise prices in the price guide, and the Callista Extra Firm and Callista X Firm rows are
identical throughout. Both are transcribed as printed rather than corrected.

---

## 15. Deviations from the blueprint

Three, each deliberate:

1. **One SPA, not two.** The blueprint's `frontend/` is a public guest site; every user here is
   crew, so there is only `dashboard/` (and the app, which mirrors it).
2. **PIN sign-in instead of Google OAuth.** Floor reps share a tablet at a school gym and often
   have no Google account on it, so sign-in is a username and a numeric keypad. The rest is
   unchanged: JWT bearer access tokens, opaque refresh tokens on the user row, the same
   `TokenService` shape, and no self-service signup.
3. **Only the FontAwesome solid set is registered.** `library.add(fas, far, fab)` roughly doubles
   the bundle and nothing here uses a regular or brand icon; on venue wifi that is worth it.

One lint rule is also turned off beyond the blueprint's two: `react-hooks/set-state-in-effect`,
which rejects fetch-on-mount into `useState` wholesale - the pattern this codebase uses throughout,
having no query library.
