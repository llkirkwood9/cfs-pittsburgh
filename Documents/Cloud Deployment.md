# Running CFS Fundraiser in the cloud

The cloud version runs on one small server of your own - a DigitalOcean droplet - managed through
**Coolify**, a free, open-source control panel installed on that server. Coolify gives you a web
dashboard, HTTPS certificates for your domain, logs, and deploys triggered from GitHub. Every
territory's tablets and phones reach the app at your address, and nothing has to be carried to the
venue but the devices.

It's the same two containers a cart's Raspberry Pi runs - the app and **PostgreSQL** - described for
Coolify in `docker-compose.coolify.yml`:

```
 push to Cloud-Support ─> GitHub Actions builds the image ─> ghcr.io
                                   └─ deploy webhook ─> Coolify: backup, pull the image, restart

 tablets, phones ──HTTPS──> Coolify's proxy ──> app :8080 ──> PostgreSQL ──> /opt/cfs/backups
 sales.example.com          (certificate)       (API +        (cfs-pgdata     (before each deploy,
                                                 dashboard)    volume)          and every night)
```

| File | What it is |
| --- | --- |
| `docker-compose.coolify.yml` | What Coolify runs: the app, PostgreSQL, a backup before each deploy and one every night |
| `.github/workflows/cloud-deploy.yml` | Builds the image on every push to `Cloud-Support`, then calls Coolify's deploy webhook |
| `docker/cloud/cfs-restore.sh` | Restores a backup - the cloud's own or a Raspberry Pi's - in one command, on the server |

The image is **built by GitHub Actions, never on the server** - Coolify only pulls it - so the
server stays small and a deploy takes seconds.

**Overview**

1. Create the server (DigitalOcean).
2. Open its firewall.
3. Install Coolify.
4. Point your domain at it (Squarespace).
5. Deploy the app in Coolify.
6. Let GitHub Actions deploy every change.
7. Sign in for the first time.
8. Email through SMTP2GO.

---

## Is the server big enough?

**Coolify's own minimum is 2 CPU cores and 2 GB of memory.** The 1 vCPU droplet planned earlier
(Basic, 2 GiB, 1 vCPU, 50 GiB) is below that, so choose:

> **Basic → Regular, 2 GB memory / 2 vCPUs, 60 GB SSD, 3 TB transfer** - about $18 a month (check
> DigitalOcean's current price).

What runs on it:

| | Memory |
| --- | --- |
| Ubuntu, Docker | about 350 MB |
| Coolify (its dashboard, its own database and cache, and the proxy) | several hundred MB |
| This app, PostgreSQL and the backup helper | about 200 MB (measured: 165 MB idle) |

That fits in 2 GB, with the 2 GB swap file Step 3 adds as a safety margin. The disk and transfer are
far more than the app needs: the database stays well under 1 GB for years of events, and a busy
event day is tens of MB per device.

The $12 droplet with 1 vCPU would probably still run, since nothing is built on the server, but
Coolify doesn't support it and its dashboard and deploys would be slow. The ~$5-6 plans have only
1 GB of memory, which isn't enough for Coolify. If many territories run busy events at once and
the app feels slow, resize to 4 GB / 2 vCPUs in the DigitalOcean console (**Resize** → **CPU and
RAM only** keeps the disk, so you can go back).

The same steps work on Hetzner Cloud or Linode/Akamai: pick a plan with at least 2 vCPUs and 2 GB.

---

## What you need

- A **DigitalOcean** account.
- Your **Squarespace** domain, such as `cfsbeds.com`. The app will live at a name under it, such as
  `sales.cfsbeds.com`, and Coolify's dashboard at `coolify.cfsbeds.com`. This guide writes
  `sales.example.com` and `coolify.example.com`; use yours.
- **Admin access to the GitHub repository** (`llkirkwood9/cfs-pittsburgh`).
- A **GitHub personal access token** with the `read:packages` scope, so the server can pull the
  app's image (Step 5). GitHub → **Settings** → **Developer settings** → **Personal access tokens**
  → **Tokens (classic)** → **Generate new token**, tick only `read:packages`.
- A computer with `ssh` - Windows 10 and later, macOS and Linux all have it.
- For emailed receipts: a free **SMTP2GO** account (Step 8).

---

## Step 1 - Create the server

In the DigitalOcean console: **Create** → **Droplets**.

1. **Region**: the one nearest your fundraisers (for Pittsburgh: New York or Toronto).
2. **Image**: **Ubuntu 24.04 (LTS) x64**.
3. **Size**: **Basic** → **Regular** → **2 GB / 2 CPUs** (see above).
4. **Authentication**: **SSH Key**. Add your computer's public key if you haven't before: run
   `ssh-keygen -t ed25519` on your computer and paste in the `.pub` file it reports (usually
   `~/.ssh/id_ed25519.pub`).
5. **Backups**: turn on **Weekly** (or **Daily**) backups - 20% (30% for daily) on top of the price,
   for one-click copies of the whole server. The app also backs up its own database (see *Backups*).
6. **Monitoring**: tick it - free memory and CPU graphs and alerts.
7. **Hostname**: `cfs-cloud`. Then **Create Droplet**.

Note the server's **public IPv4 address**; this guide writes `203.0.113.10`.

## Step 2 - Open the firewall

**Networking** → **Firewalls** → **Create Firewall**, named `cfs`:

| Inbound rule | Protocol | Port | Why |
| --- | --- | --- | --- |
| SSH | TCP | 22 | Signing in to the server |
| HTTP | TCP | 80 | Certificates, and the redirect to HTTPS |
| HTTPS | TCP | 443 | The app and Coolify's dashboard |
| Custom | UDP | 443 | HTTP/3 (optional) |
| Custom | TCP | 8000, 6001, 6002 | Coolify's dashboard by IP address - **only until Step 4**, then delete these |

Sources: **All IPv4** and **All IPv6**. Leave the outbound rules as they are. Under **Apply to
Droplets**, choose `cfs-cloud`, and create it.

Use this DigitalOcean firewall rather than `ufw` on the server: Docker opens the ports it publishes
in a way that goes around `ufw`.

## Step 3 - Install Coolify

From your computer, sign in to the server:

```bash
ssh root@203.0.113.10
```

Bring Ubuntu up to date:

```bash
apt update && apt full-upgrade -y
```

Add a 2 GB swap file, as a safety margin for memory:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Set the time zone, and make the folder the app's backups go in:

```bash
timedatectl set-timezone America/New_York && mkdir -p /opt/cfs/backups
```

Install Coolify with its official script (it installs Docker too, and takes a few minutes):

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

When it finishes, **straight away** open `http://203.0.113.10:8000` in your browser and create the
admin account - the first person to open that page becomes the admin. Use a long password, and
turn on two-factor authentication in your Coolify profile. When the onboarding asks where to
deploy, choose **This Machine** (localhost).

**Optional but recommended:** let Ubuntu restart for the security updates that need it, at 4 am.
Coolify and the app come back on their own:

```bash
printf 'Unattended-Upgrade::Automatic-Reboot "true";\nUnattended-Upgrade::Automatic-Reboot-Time "04:00";\n' > /etc/apt/apt.conf.d/52cfs-reboot
```

## Step 4 - Point your domain at the server (Squarespace)

1. Sign in to **Squarespace** → **Domains** → click your domain → **DNS** → **DNS Settings**.
2. Under **Custom records**, add two records:

   | Type | Host | Data |
   | --- | --- | --- |
   | `A` | `sales` | `203.0.113.10` |
   | `A` | `coolify` | `203.0.113.10` |

   Squarespace adds your domain to the host, so `sales` means `sales.example.com`.

> **Leave the `@` and `www` records alone** if your company website is on Squarespace - changing
> them would take the website down. The app lives on its own name (`sales`). Only point `@` and
> `www` at the server if the domain is just for this app.

Check from your computer that both names give the server's address (it can take a few minutes, and
occasionally a few hours, to spread):

```bash
nslookup sales.example.com
```

```bash
nslookup coolify.example.com
```

**Put Coolify's dashboard on its own HTTPS address.** In Coolify: **Settings** → **General** →
**Domain** (the instance's URL) → `https://coolify.example.com` → **Save**. Open
`https://coolify.example.com` - Coolify fetches its certificate on the first visit. From now on use
that address, and **delete the 8000, 6001 and 6002 rules** from the firewall (Step 2).

## Step 5 - Deploy the app in Coolify

**a. Let the server pull the app's image.** The image is private on GitHub's registry. In Coolify,
open **Registries** (or **Servers** → *localhost* → **Registries**) → **Log in**, choose the
**GHCR** preset, and enter username `llkirkwood9` and the `read:packages` token. (Or make the image
public instead: GitHub → your profile → **Packages** → `cfs-fundraiser` → **Package settings** →
**Change visibility** → Public - then no login is needed.)

**b. Check the image exists.** On GitHub, **Actions** → **Cloud deploy** should show a green
**build** for `Cloud-Support`. If it doesn't, click **Run workflow** (branch `Cloud-Support`) and
wait for the build (10-15 minutes the first time). Its deploy step does nothing yet; that's Step 6.

**c. Connect GitHub.** **Sources** → **+ Add** → **GitHub App**, and follow Coolify's steps: it
creates a GitHub App for you. When GitHub asks where to install it, choose **Only select
repositories** → `cfs-pittsburgh`.

**d. Create the resource.** **Projects** → **+ Add** a project (e.g. `CFS`) → open it → **+ New**
resource → **Private Repository (with GitHub App)** → pick the app from (c) and the repository, then:

| Setting | Value |
| --- | --- |
| Branch | `Cloud-Support` |
| Build Pack | **Docker Compose** |
| Base Directory | `/` |
| Docker Compose Location | `/docker-compose.coolify.yml` |

Click **Continue**. Coolify reads the file and lists its services: `db`, `backup-before-deploy`,
`app` and `backup`.

**e. Add the domain.** For the **app** service, set the domain to:

```
https://sales.example.com:8080
```

The `:8080` tells Coolify which port inside the container to send visitors to; people still just
open `https://sales.example.com`. (If your Coolify version asks for them separately: **Add domain**
→ service `app`, protocol `https`, host `sales.example.com`, port `8080`.) Leave the other services
without a domain - they aren't reachable from outside.

**f. Check the environment variables.** Under **Environment Variables**:

| Variable | Value |
| --- | --- |
| `SERVICE_PASSWORD_POSTGRES`, `SERVICE_PASSWORD_64_JWT` | Made up by Coolify - the database password and the key that signs sign-ins. **Don't change them** after the first deploy; save a copy in your password manager. |
| `SKIP_SEED_DATA` | `true` starts with an empty catalog; bring the real catalog in with **Restore catalog**. `false` loads the sample catalog. |
| `ALLOW_LEGACY_PINS` | `false`. Set `true` only while moving a Pi's data across (see *Moving a cart's data to the cloud*). |
| `SEED_ADMIN_PASSWORD` | Optional: the first account's starting password. Blank writes a random one to the app's log. |
| `TZ`, `CFS_BACKUP_TIME`, `CFS_BACKUP_KEEP` | The nightly backup: `America/New_York`, `03:15`, keep `30` |
| `CFS_IMAGE` | Leave as `ghcr.io/llkirkwood9/cfs-fundraiser:cloud` (see *Rolling back*) |
| `EMAIL_*` | Step 8 |

**g. Persistent storage.** Nothing to set up, but this is what keeps the sales safe: the database
lives in the `cfs-pgdata` volume and the backups in `/opt/cfs/backups` on the server - both listed
under **Persistent Storage**, and both kept through every deploy and update.

**h. Turn off Coolify's own auto-deploy.** **Advanced** → untick **Auto Deploy**. GitHub Actions
deploys once the new image is built (Step 6); Coolify deploying on the push itself would start the
old image.

**i. Deploy.** Click **Deploy** and watch the log. Coolify backs up the (empty) database, pulls the
image and starts everything. When the app shows as running (healthy), open
`https://sales.example.com/health` - it should say `Healthy`. The very first request can take a few
seconds while the certificate is fetched.

## Step 6 - Let GitHub Actions deploy every change

The workflow is already in the repository (`.github/workflows/cloud-deploy.yml`). On every push to
`Cloud-Support` it builds the image and then calls Coolify's deploy webhook. It only needs two
secrets:

1. **Turn on Coolify's API.** **Settings** → **Advanced** → **API access**: **Enabled** → **Save**.
2. **Make a token.** **Keys & Tokens** → **API Tokens** → name it `github-actions`, tick **Deploy**
   and **Read** (Read lets the workflow follow the deployment to the end) → create, and copy it -
   it's only shown once.
3. **Copy the webhook.** Open the app's resource → **Webhooks** → copy the **Deploy Webhook URL**
   (it looks like `https://coolify.example.com/api/v1/deploy?uuid=...&force=false`).
4. **Store them on GitHub.** The repository → **Settings** → **Secrets and variables** →
   **Actions**:
   - **Secrets** tab: `COOLIFY_WEBHOOK` = the webhook URL, `COOLIFY_TOKEN` = the token.
   - **Variables** tab (optional): `CFS_URL` = `https://sales.example.com` - the workflow then also
     checks the app says `Healthy` after each deploy.

The deploy step of the workflow comes down to this:

```yaml
- name: Deploy with Coolify
  run: |
    curl --fail --request POST "$WEBHOOK" --header "Authorization: Bearer $TOKEN"
```

and then follows the deployment until Coolify reports it finished (or fails the run if it didn't).

**Try it:** **Actions** → **Cloud deploy** → **Run workflow** → branch `Cloud-Support`, and untick
**Build a new image** for a quick redeploy. From now on, every push or merge to `Cloud-Support`
that changes the app builds and deploys by itself.

## Step 7 - First sign-in

> **Moving a Raspberry Pi's data to the cloud?** Do *Moving a cart's data to the cloud* (below)
> now, instead of this step: the restore replaces the cloud's accounts with the Pi's, and you sign
> in with those.

Unless you set `SEED_ADMIN_PASSWORD`, find the first account's starting password: in Coolify, open
the resource → **Logs** → the `app` service, and look for `Created the first account`.

Open `https://sales.example.com` and sign in as **admin** with it. You'll be asked to choose your
own password straight away. Then:

1. **Territories** - rename the first territory and add the others.
2. **Crew** - add a manager for each territory, and administrators for anyone who runs things
   company-wide. Each new account gets a starting password to pass on; they choose their own at
   their first sign-in.
3. **Catalog** - bring in the catalog with **Restore catalog**, or add the global items every
   territory sells. Managers can add their own territory's items after that.
4. **Settings** - the company-wide details, terms and receipt email; each territory can then change
   what it needs to.

If you set `SEED_ADMIN_PASSWORD`, clear it in Coolify now.

**The mobile app** signs in to the same place: type `sales.example.com` as the server address on
its sign-in screen (it adds `https://` to a domain name by itself).

## Step 8 - Email receipts and reports through SMTP2GO

The app emails a customer their receipt as a PDF (**Email** on a sales sheet) and an event's sheets
as one PDF (**Email report**). Until email is set up, those buttons say so.

[SMTP2GO](https://www.smtp2go.com) is a sending service built for app email like receipts. Its free
plan covers 1,000 emails a month, up to 200 a day (check its pricing page; limits can change). Mail
goes out from your own domain, signed for it, which is what keeps receipts out of spam.

> **DigitalOcean blocks the usual mail ports** (25, 465 and 587) on droplets, to stop spam.
> SMTP2GO also listens on **port 2525**, which isn't blocked - the app uses 2525 unless told
> otherwise.

1. **Sign up** at https://www.smtp2go.com and pick the free plan.
2. **Add your domain.** **Sending** → **Verified Senders** → **Add a Sender Domain**, enter your
   domain (e.g. `cfsbeds.com`) and choose **Continue with this domain**.
3. **Add the three CNAME records it shows** in Squarespace (**DNS Settings** → **Custom records**,
   as in Step 4). In the **Host** box put only the part before your domain - for
   `em123.cfsbeds.com`, just `em123` - and paste the **Data** exactly. Any SPF record you already
   have stays as it is.
4. **Add a DMARC record** if the domain doesn't have one: type `TXT`, host `_dmarc`, data
   `v=DMARC1; p=none; rua=mailto:you@example.com` (an address you read). Gmail and Yahoo expect
   one; `p=none` only asks for reports and never blocks mail.
5. **Verify.** Back in SMTP2GO, press **Verify**. The records can take minutes to a few hours to
   spread; until the domain is verified, SMTP2GO sends only 25 emails an hour.
6. **Create an SMTP user.** **Sending** → **SMTP Users** (on some dashboards under **Settings**) →
   **Add SMTP User**. Its username and password are separate from your SMTP2GO sign-in; copy both.
7. **Enter them in Coolify**, on the resource's **Environment Variables**. The from address must be
   on the domain you verified:

   | Variable | Value |
   | --- | --- |
   | `EMAIL_HOST` | `mail.smtp2go.com` |
   | `EMAIL_PORT` | `2525` |
   | `EMAIL_SECURITY` | `StartTls` |
   | `EMAIL_USERNAME`, `EMAIL_PASSWORD` | the SMTP user's |
   | `EMAIL_FROM` | e.g. `receipts@cfsbeds.com` |
   | `EMAIL_FROM_NAME` | e.g. `Custom Fundraising Solutions` (blank: the app name from **Settings**) |
   | `EMAIL_REPLY_TO` | an address someone reads, e.g. `office@cfsbeds.com` |

8. **Redeploy** the resource, so the app picks the settings up.
9. **Test it**: email a receipt to yourself from a completed sale. SMTP2GO's **Reports** list every
   message and whether it was delivered. In Gmail, **More** (⋮) → **Show original** should show
   SPF, DKIM and DMARC as **PASS**.

If sending fails:

- **A timeout or "can't connect"**: check `EMAIL_PORT` is `2525`; 587 is blocked on the droplet.
- **"535 authentication failed"**: the SMTP2GO sign-in password was used instead of the SMTP
  user's, or the username was cut short when pasting.
- **A rejected sender**: `EMAIL_FROM` isn't on the verified domain.
- More detail: the `app` service's log in Coolify.

The Raspberry Pi guide's *If receipts go to spam* section applies here too.

---

## Backups

Three layers, each covering something the others don't:

1. **Before every deploy** - the `backup-before-deploy` service copies the database before the app
   starts, because a new version can change the database as it starts. (Its name ends `-deploy`.)
2. **Every night** - the `backup` service, at `CFS_BACKUP_TIME`, keeping the newest
   `CFS_BACKUP_KEEP` (30) of all the backups.
3. **DigitalOcean's droplet backups** (Step 1) - for when the whole server is lost.

They're files in `/opt/cfs/backups` on the server. **Keep a copy off the server too**, after each
event or monthly - from your computer:

```bash
scp "root@203.0.113.10:/opt/cfs/backups/cfs-*.dump.gz" .
```

The commands below are run on the server (`ssh root@203.0.113.10`). To take a backup now:

```bash
docker exec $(docker ps -qf label=com.docker.compose.service=backup) cfs-backup
```

To see the backups:

```bash
ls -lt /opt/cfs/backups
```

### Restoring a backup

`cfs-restore` does the whole restore in one command. It's in the repository at
`docker/cloud/cfs-restore.sh`; put it on the server once.

**Install it (once).** On your computer, in a terminal (PowerShell on Windows), in your copy of the
repository on the `Cloud-Support` branch - for example `C:\Workspace\CFS-cloud`:

```bash
scp docker/cloud/cfs-restore.sh root@203.0.113.10:/usr/local/bin/cfs-restore
```

```bash
ssh root@203.0.113.10 chmod +x /usr/local/bin/cfs-restore
```

**Restore.** On the server (`ssh root@203.0.113.10`), see which backups there are, then restore one
by its name:

```bash
ls -lt /opt/cfs/backups
```

```bash
cfs-restore cfs-20261101-031500.dump.gz
```

`cfs-restore latest` restores the newest; a file somewhere else is given by its full path. It
shows what it's about to restore and asks you to type `RESTORE`, then:

1. backs up the database as it is now (so a wrong file can be undone with the backup it just made),
2. stops the app,
3. empties the database and loads the backup into it,
4. starts the app again - which brings an older database up to date - and waits until it's healthy,
5. and shows what's there now:

```
Restored. The database now has:
  territories: Pittsburgh
  events:      3
  orders:      212
  crew:        9
```

The app is offline for a minute or so, so do it outside an event. It takes either kind of backup:
`.dump.gz` (from `cfs-backup.sh`, the nightly backups and the ones before each deploy) and
`.sql.gz` (the plain `pg_dump` in the Raspberry Pi guide). **Try one restore** before you need it -
before the server goes live is a good time.

## Moving a cart's data to the cloud

To carry on from a Raspberry Pi's orders, events, crew and catalog. Do it **before** setting up
accounts and the catalog in the cloud (Step 7): the restore replaces everything in the cloud
database - including the admin account you made there - with what was on the Pi.

**1. Take a backup on the Pi.** From your computer, sign in to the Pi and run the backup script:

```bash
ssh cfs@cfs.local
```

```bash
sudo bash /opt/cfs/docker/pi/cfs-backup.sh backup
```

It prints the file it wrote, for example:

```
Wrote /opt/cfs/backups/cfs-20261101-090000.dump.gz (84K)
```

Note that name, then `exit` to leave the Pi. (If the Pi has no `cfs-backup.sh`, take the plain
backup from the Raspberry Pi guide instead: it writes `~/cfs-backup-<date>.sql.gz` in the Pi
user's home folder - use that path below.)

**2. Copy it from the Pi to your computer.** In a terminal on your computer (PowerShell on Windows),
in any folder - the file lands in the folder you're in (`.`):

```bash
scp cfs@cfs.local:/opt/cfs/backups/cfs-20261101-090000.dump.gz .
```

**3. Copy it from your computer to the server**, into its backups folder:

```bash
scp cfs-20261101-090000.dump.gz root@203.0.113.10:/opt/cfs/backups/
```

**4. Let the Pi's crew sign in with their PINs.** A Pi set up from `main` still uses PINs. In Coolify,
open the resource → **Environment Variables** → set `ALLOW_LEGACY_PINS` to `true` → **Save**, then
**Redeploy** and wait for it to finish. (Skip this if the Pi already ran the `Cloud-Support`
version with passwords.)

**5. Restore it on the server.** Install `cfs-restore` if you haven't (*Restoring a backup*, above),
then:

```bash
ssh root@203.0.113.10
```

```bash
cfs-restore cfs-20261101-090000.dump.gz
```

Type `RESTORE` when asked. When it says `Restored`, the counts should match what the Pi had.

**6. Sign in with the Pi's accounts.** Open `https://sales.example.com`. The accounts are now the
Pi's: sign in as the Pi's `admin` (or any account) with its **old PIN** as the password, and you'll
be asked to choose a real password straight away. `admin` is made the system admin if no account
is one yet. Everything the Pi had is in a territory called **Pittsburgh** - rename it under
**Territories** if it should be called something else - and everyone else does the same at their
first sign-in.

**7. Turn PIN sign-in off again** once everyone has chosen a password: set `ALLOW_LEGACY_PINS` back
to `false` in Coolify and **Redeploy**.

If something looks wrong, the restore's own safety backup is the newest file in
`/opt/cfs/backups` from just before it: `cfs-restore` it to go back.

## Updating

Push (or merge) to `Cloud-Support`. GitHub Actions builds a new image and has Coolify deploy it,
with a backup first; follow it under **Actions** → **Cloud deploy** or on the resource's
**Deployments** page in Coolify. The new version shows in the app's profile menu.

To redeploy without building - after changing an environment variable, say - click **Redeploy** in
Coolify, or run the workflow by hand with **Build a new image** unticked.

### Rolling back

Every build is also kept under its version, e.g. `ghcr.io/llkirkwood9/cfs-fundraiser:cloud-2026.10.3`
(the **Packages** page on GitHub lists them). To go back, set `CFS_IMAGE` to the previous version in
Coolify and **Redeploy**. If the bad version changed the database, restore the backup taken just
before it (its name ends `-deploy`). Fix the problem, push it, and set `CFS_IMAGE` back to
`ghcr.io/llkirkwood9/cfs-fundraiser:cloud` - otherwise later deploys keep running the old version.

### Coolify itself

Coolify updates itself unless you turn that off in **Settings**; an update restarts its dashboard,
not your app. If you'd rather choose the moment, turn auto-update off and update between events.

## Troubleshooting

**The site doesn't load, or the browser warns about the certificate.** Check that
`nslookup sales.example.com` gives the server's address and that the domain on the `app` service
is exactly `https://sales.example.com:8080`. Ports 80 and 443 must be open in the firewall. The
proxy's log says why a certificate failed: **Servers** → *localhost* → **Proxy** → **Logs**.

**"Bad Gateway" or "no available server".** The proxy can't reach the app - normal for a minute
after a deploy. If it lasts, read the `app` service's log, and check its domain ends in `:8080`.

**"denied" or "unauthorized" when pulling the image.** The server's registry login is missing or
the token has expired (Step 5a).

**The workflow's deploy step fails with 401 or 403.** API access is off in Coolify, or the token
doesn't have the Deploy permission (Step 6).

**The app keeps restarting.** Read its log in Coolify. A database password mismatch means
`SERVICE_PASSWORD_POSTGRES` was changed after the first deploy - put the old value back.

**Running out of disk.** Coolify can clean up old images: **Servers** → *localhost* → **Docker
Cleanup**. `df -h /` on the server shows what's free.

---

## Security checklist

- [ ] Coolify's admin account has a long password and two-factor authentication.
- [ ] The firewall lets in only 22, 80 and 443 once Coolify is on its own domain.
- [ ] SSH accepts keys only (droplets created with an SSH key already refuse passwords).
- [ ] The Coolify API token has only **Deploy** and **Read**, and lives only in GitHub's secrets.
- [ ] The registry token has only `read:packages`.
- [ ] Droplet backups are on, a copy of the backups is kept off the server, and a restore has
      been tried.
- [ ] `SEED_ADMIN_PASSWORD` is cleared after the first sign-in.
- [ ] `ALLOW_LEGACY_PINS` is `false`.
- [ ] Everyone has their own account - no shared sign-ins - and people who leave are switched off
      on the Crew screen (that signs them out everywhere at once).

### What the app does itself

Passwords of at least 8 characters that aren't common ones, stored hashed; accounts locked for 15
minutes after 5 wrong passwords; sign-in rate-limited per address; 15-minute access tokens held
only in memory, with a session that is replaced every time it's used and stored only as a hash -
an httpOnly, SameSite=Strict cookie in the dashboard, the Keychain / Keystore in the mobile app;
every request checked against the database, so a switched-off account or territory stops working
at once; territory rules enforced by the API; security headers (Content-Security-Policy and the
rest) and HSTS on every response; and errors that don't reveal anything about the server. Behind
Coolify's proxy, the app believes the visitor's address and HTTPS only from that one hop. See the
README's *Security* section for the details.
