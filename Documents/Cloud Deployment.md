# Running CFS Fundraiser in the cloud

The same app that runs on a cart's Raspberry Pi can run on any cloud host that runs a container -
Azure Container Apps, AWS App Runner or ECS, Google Cloud Run, Fly.io, Render, DigitalOcean App
Platform and the like - with a managed PostgreSQL database behind it. Every territory's tablets
then reach one app over the internet, and nothing has to be carried to the venue but the tablets.

This guide stays provider-neutral: each step says what to set up, and the provider's own console
or CLI does it.

```
 tablets ──HTTPS──> load balancer (TLS) ──HTTP──> app container :8080 ──TLS──> managed PostgreSQL
                    (the host's own)              (Dockerfile)                  (backups on)
```

---

## What you need

- A container host that gives you **HTTPS on your own domain** and passes requests to a container
  port. Every one listed above does.
- A **managed PostgreSQL** database, version 14 or newer, with automatic backups. The smallest
  size is plenty: a busy event writes a few thousand rows.
- A **container registry** the host can pull from (GitHub Container Registry, Docker Hub, or the
  provider's own).
- Optional: an SMTP account for emailed receipts and reports (see the Email section).

---

## Step 1 - Build and publish the image

The cloud uses the same `Dockerfile` as every other host: the API with the dashboard built into
it, talking to an outside PostgreSQL. It runs as an unprivileged user and keeps nothing on its own disk, so any number of
copies can be started and thrown away.

From the repository root, on any machine with Docker:

```bash
docker buildx build --platform linux/amd64 -t ghcr.io/<owner>/cfs-fundraiser:2026-10-01 --push .
```

Use a new tag for every release (a date works) rather than only `latest`, so a deploy is always a
known version and going back is just redeploying the previous tag. Most cloud hosts run x86-64;
add `linux/arm64` to `--platform` (comma-separated) if yours runs on ARM. Pushing to `main` also
publishes `:latest` (and a tag per commit) for both through `.github/workflows/app-image.yml`.

---

## Step 2 - Create the database

In the provider's console, create a PostgreSQL server and then:

1. A database, e.g. `cfs`.
2. A user just for the app, e.g. `cfs_app`, with a long random password, that owns that database
   (the app creates and updates its own tables on start-up).
3. **Turn on automatic backups** with point-in-time recovery, and keep at least 14 days.
4. **Require TLS** for connections, and don't open the database to the whole internet: allow only
   the container host (a private network / VPC connector, or the host's outbound addresses).

The connection string the app needs looks like this:

```
Host=<server host>;Port=5432;Database=cfs;Username=cfs_app;Password=<password>;SSL Mode=VerifyFull
```

`SSL Mode=VerifyFull` encrypts the connection and checks the server really is your database. It
works as it is when the provider's certificate comes from a public authority (Azure, for one). If
the provider signs with its own authority (AWS RDS, Google Cloud SQL), download its CA bundle,
mount it into the container and add `Root Certificate=/path/to/ca.pem`. `SSL Mode=Require`
encrypts without checking and is the fallback while setting up - don't leave it there.

---

## Step 3 - Create the app

Point the host at the image from Step 1 and set:

- **Port**: `8080`.
- **Health check**: `GET /health`, expecting `Healthy`. Give the first start a minute; it creates
  the tables.
- **Instances**: one is enough for any number of territories. More work too - sessions live in the
  database - but each copy keeps its own rate-limit counts. Keep at least one always running
  (no scale-to-zero), or the first tablet of the day waits several seconds for a cold start.
- **Memory**: 512 MB.

### Settings (environment variables)

Put everything marked *secret* in the host's secret store and reference it; never put secrets in
the image, the repository or a plain variable anyone with console access can read.

| Variable | Value | |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | the string from Step 2 | secret |
| `Jwt__Key` | a random secret, 32+ characters: `openssl rand -base64 48` | secret |
| `Seed__Skip` | `true` - start with an empty catalog instead of the sample one | |
| `Seed__AdminPassword` | the first account's starting password (see Step 5) | secret, optional |
| `Auth__SecureCookies` | `true` | |
| `Auth__AllowLegacyPins` | `false` for a new install; leave unset when moving a database that still has PINs | |
| `Email__Host`, `Email__Port`, `Email__Security`, `Email__Username`, `Email__Password`, `Email__From` | see Email below | password secret |

Already set by the image, so leave them: `ASPNETCORE_ENVIRONMENT=Production`,
`ASPNETCORE_HTTP_PORTS=8080`. PostgreSQL is the only database the app uses.

Rarely needed:

| Variable | Default | |
|---|---|---|
| `ForwardedHeaders__ForwardLimit` | `1` | Raise to `2` if a CDN or second proxy sits in front of the host's load balancer |
| `Jwt__AccessTokenMinutes` | `15` | How long a sign-in lasts without the session cookie (1-60) |
| `Jwt__RefreshTokenDays` | `7` | How long a tablet stays signed in without being used (1-30) |
| `Auth__MaxFailedAttempts` / `Auth__LockoutMinutes` | `5` / `15` | Wrong-password lockout |
| `Cors__AllowedOrigins__0` | none | Only if the dashboard is served from a different site than the API |

The app refuses to start without a real `Jwt__Key` and a connection string, and says which one in
its log.

---

## Step 4 - HTTPS and the domain

1. Add your domain (e.g. `sales.example.com`) to the app in the host's console and follow its DNS
   instructions. The host issues and renews the certificate.
2. Turn on the host's **redirect HTTP to HTTPS** option.
3. Open `https://sales.example.com/health` - it should say `Healthy`.

The app tells browsers to use HTTPS for a year from then on (HSTS), keeps its session cookie
HTTPS-only, and believes only the load balancer's own `X-Forwarded-For` entry for the visitor's
address.

---

## Step 5 - First sign-in

With an empty database the app creates one account, **admin**, as the system admin:

- If `Seed__AdminPassword` was set, that's its starting password. Remove the variable once you're
  in.
- Otherwise a random password is written **once** to the app's log on its first start - look for
  `Created the first account`.

Sign in and you'll be asked to choose your own password straight away. Then:

1. **Territories** - add your territories (or rename the first one).
2. **Crew** - add a manager for each territory, and anyone else who runs things company-wide as an
   administrator. Each new account gets a starting password to pass on; they choose their own at
   their first sign-in.
3. **Catalog** - add the global items every territory sells. Managers can add their own
   territory's items after that.
4. **Settings** - the company-wide details, terms and receipt email; each territory can then change
   what it needs to.

**The mobile app** signs in to the same app: type the domain (`sales.example.com`) as the server
address on its sign-in screen. It keeps its session in the device's Keychain / Keystore rather
than a cookie, so nothing extra is needed on the host.

---

## Moving an existing cart's data to the cloud

**From a Raspberry Pi (PostgreSQL)**: take a backup on the Pi
(`sudo /opt/cfs/docker/pi/cfs-backup.sh backup`), copy the `.dump.gz` off it, and restore it into
the empty cloud database:

```bash
gunzip -c cfs-20261001-090000.dump.gz | pg_restore --no-owner --role=cfs_app -d "host=<server> port=5432 dbname=cfs user=cfs_app sslmode=verify-full"
```

Then start the app (or restart it). It brings the database up to date on start: everything from
the cart goes into a territory called **Pittsburgh**, which you can rename, and everyone signs in
once more with their old PIN and is then made to choose a password. Leave `Auth__AllowLegacyPins`
unset until they all have.

**From the old all-in-one SQL Server image**: the app no longer runs on SQL Server, and there is
no direct copy between SQL Server and PostgreSQL. Start the cloud copy fresh - move the catalog
across with **Export catalog** / **Restore catalog** (system admins, on the Catalog screen) - and keep the
old box for looking back at past events.

---

## Backups

The managed database's automatic backups are the main ones: check they're on, and **try a
restore** into a scratch database once, so you know how before you need it.

For a copy you keep yourself - before a big event, or before an update - from any machine with the
PostgreSQL client tools:

```bash
pg_dump --format=custom --no-owner -d "host=<server> port=5432 dbname=cfs user=cfs_app sslmode=verify-full" -f cfs-$(date +%Y%m%d-%H%M).dump
```

and to put one back (it replaces everything):

```bash
pg_restore --clean --if-exists --no-owner --role=cfs_app -d "host=<server> port=5432 dbname=cfs user=cfs_app sslmode=verify-full" cfs-20261001-0900.dump
```

---

## Updating

1. Take a backup (above), or note the time for a point-in-time restore.
2. Build and push a new tag (Step 1) and point the app at it.
3. The new version updates the database on start. If anything is wrong, point the app back at the
   previous tag - and restore the backup if the update changed the database.

---

## Email

Emailed receipts and event reports need an SMTP account. Many cloud hosts block outgoing port 25,
so use a mail service on port 587 (`Email__Security=StartTls`) or 465 (`SslOnConnect`): Microsoft
365, Google Workspace (with an app password), SendGrid, Mailgun, Postmark, Amazon SES. Set
`Email__From` to an address the service lets you send from, and set up SPF and DKIM for that
domain so receipts don't land in spam.

---

## Security checklist

- [ ] `Jwt__Key`, the database password and the email password are in the host's secret store.
- [ ] The database only accepts TLS connections, and only from the app.
- [ ] Automatic database backups are on, and a restore has been tried.
- [ ] The app is only reachable over HTTPS; HTTP redirects.
- [ ] `Seed__AdminPassword` is removed after the first sign-in.
- [ ] `Auth__AllowLegacyPins=false` once nobody signs in with a PIN any more.
- [ ] Everyone has their own account - no shared sign-ins - and people who leave are switched off
      on the Crew screen (that signs them out everywhere at once).
- [ ] The host's logs are kept somewhere you can look back at (sign-in failures and errors are
      logged).

### What the app does itself

Passwords of at least 8 characters that aren't common ones, stored hashed; accounts locked for 15
minutes after 5 wrong passwords; sign-in rate-limited per address; 15-minute access tokens held
only in the tablet's memory plus an httpOnly, SameSite=Strict session cookie that is replaced
every time it's used and only stored as a hash; every request checked against the database, so a
switched-off account or territory stops working at once; territory rules enforced by the API;
security headers (Content-Security-Policy and the rest) and HSTS on every response; and errors that
don't reveal anything about the server. See section 2a of the README for the details.
