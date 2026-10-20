# Running CFS Fundraiser in the cloud

One DigitalOcean droplet runs the same two containers as a cart's Raspberry Pi - the app and
**PostgreSQL** - with **Caddy** in front of them for HTTPS on your own domain. Every territory's
tablets and phones reach it at that address, and nothing has to be carried to the venue but the
devices. GitHub Actions builds the app and deploys it to the droplet on every push to the
`Cloud-Support` branch.

```
                   ┌─────────────────── one DigitalOcean droplet ───────────────────┐
 tablets, phones ──HTTPS──> Caddy :443 ──HTTP──> app :8080 ──────> PostgreSQL
 sales.example.com          cfs-caddy            cfs-app           cfs-db
                            (certificate)        (API + dashboard) (cfs-pgdata volume)
                   └────────────────────────────────────────────────────────────────┘
```

| File | What it is |
| --- | --- |
| `docker-compose.yml` | The app and PostgreSQL - the same file a Pi uses |
| `docker-compose.cloud.yml` | Adds Caddy, keeps the app's port off the internet, and tells the app it's behind HTTPS |
| `docker/cloud/Caddyfile` | Caddy's settings: your domain, passed on to the app |
| `docker/cloud/cfs-deploy.sh` | Run on the droplet by each deploy: backup, pull, restart, wait until healthy |
| `docker/pi/cfs-backup.sh` | Backs up and restores the database - the Pi's script, used here too |
| `.github/workflows/cloud-deploy.yml` | Builds the image and deploys it on every push to `Cloud-Support` |

The droplet holds no source code: each deploy copies just these files to `/opt/cfs` and pulls the
ready-made image. Your secrets live only in `/opt/cfs/.env` on the droplet.

---

## Is the droplet big enough?

**Yes.** The planned droplet - **Basic, 2 GiB memory, 1 vCPU, 50 GiB SSD, 2,000 GiB transfer**
(about $12 a month) - has plenty of room:

| | Uses |
| --- | --- |
| **Memory** | Ubuntu and Docker about 350 MB, the app 150-300 MB, PostgreSQL 50-150 MB, Caddy about 30 MB: under 1 GB of the 2 GB. (The app and its database run in about 175 MB on a 1 GB Pi.) |
| **CPU** | Light. Sales sheets and PDFs are made on the tablets, not the server; the server saves orders and answers each device's refresh every few seconds. |
| **Disk** | The images take about 1 GB, and the database stays well under 1 GB for years of events. The nightly backups are a few MB each. |
| **Transfer** | A busy event day is tens of MB per device. 2,000 GiB a month is far more than you'll use. |

Two things keep it comfortable: the image is **built by GitHub Actions, never on the droplet**
(building the .NET and React code would need more memory than it has), and Step 3 adds a 2 GB
swap file as a safety margin.

When to go bigger: if many territories run busy events at the same time - say more than 50 devices
at once - and pages start to feel slow, resize to 4 GiB / 2 vCPUs in the DigitalOcean console
(**Resize** → **CPU and RAM only**, which keeps the disk so you can resize back). The droplet's
**Graphs** tab shows whether memory or CPU is actually busy.

---

## What you need

- A **DigitalOcean** account.
- A **domain** you own and can change the DNS of, such as `cfsbeds.com`. The app will live at a
  name under it, such as `sales.cfsbeds.com`. This guide writes `sales.example.com`; use yours.
- **Admin access to the GitHub repository**, to add the deploy settings.
- A computer with an SSH client - Windows 10 and later, macOS and Linux all have `ssh`.
- For emailed receipts: a free **SMTP2GO** account (Step 9).

---

## Step 1 - Create the droplet

In the DigitalOcean console: **Create** → **Droplets**.

1. **Region**: the one nearest your territories (for Pittsburgh: New York or Toronto).
2. **Image**: **Ubuntu 24.04 (LTS) x64**.
3. **Size**: **Basic** → **Regular** → **2 GB / 1 CPU, 50 GB SSD, 2 TB transfer**.
4. **Authentication**: **SSH Key**. Add your computer's public key if you haven't before. To make
   one, run `ssh-keygen -t ed25519` on your computer and paste in the contents of the `.pub` file
   it reports (usually `~/.ssh/id_ed25519.pub`).
5. **Backups**: turn on **Weekly** (or **Daily**) backups. It adds 20% (30% for daily) to the price
   and keeps whole-droplet copies you can restore with one click. The app also backs up its
   database every night (see *Backups*); the two together cover a lost droplet and a bad change.
6. **Monitoring**: tick it - it's free and gives you the memory and CPU graphs and alerts.
7. **Hostname**: `cfs-cloud`. Then **Create Droplet**.

Note the droplet's **IPv4 address** once it's ready; this guide writes `203.0.113.10`.

## Step 2 - Firewall

**Networking** → **Firewalls** → **Create Firewall**, named `cfs`:

| Inbound rule | Protocol | Port | Sources |
| --- | --- | --- | --- |
| SSH | TCP | 22 | All IPv4, All IPv6 |
| HTTP | TCP | 80 | All IPv4, All IPv6 |
| HTTPS | TCP | 443 | All IPv4, All IPv6 |
| Custom (HTTP/3) | UDP | 443 | All IPv4, All IPv6 |

Leave the outbound rules as they are (everything allowed). Under **Apply to Droplets**, choose
`cfs-cloud`, and create it.

Use this DigitalOcean firewall rather than `ufw` on the droplet: Docker opens the ports it
publishes in a way that goes around `ufw`. The app's own port, 8080, is only published on the
droplet itself anyway. SSH has to be open to everyone because GitHub's deploy runners don't come
from fixed addresses; it only accepts keys, never passwords.

## Step 3 - Prepare the droplet

From your computer, sign in as `root`:

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

Set the time zone, so the nightly backup runs at night where you are:

```bash
timedatectl set-timezone America/New_York
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
```

Cap the containers' log files, so they can't fill the disk over the months:

```bash
printf '{\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "10m", "max-file": "5" }\n}\n' > /etc/docker/daemon.json && systemctl restart docker
```

Create the **deploy** user that runs the app, and that GitHub Actions signs in as. It can use
Docker but not `sudo`, and it accepts the same SSH key as `root`:

```bash
adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy
```

```bash
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh && install -m 600 -o deploy -g deploy /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
```

```bash
install -d -o deploy -g deploy /opt/cfs /opt/cfs/backups
```

**Optional but recommended - security updates that need a restart.** Ubuntu installs security
updates by itself; this lets it restart for the few that need one, at 4 am. The containers come
back on their own.

```bash
printf 'Unattended-Upgrade::Automatic-Reboot "true";\nUnattended-Upgrade::Automatic-Reboot-Time "04:00";\n' > /etc/apt/apt.conf.d/52cfs-reboot
```

Restart to pick up the updates, then check you can sign in as **deploy** and use Docker:

```bash
reboot
```

```bash
ssh deploy@203.0.113.10
```

```bash
docker run --rm hello-world
```

## Step 4 - Point your domain at the droplet

Caddy can only get the HTTPS certificate once your domain leads to the droplet, so do this before
the first deploy.

Wherever your domain's DNS is managed (usually the registrar - GoDaddy, Namecheap, Cloudflare,
Squarespace and so on), add a record:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| `A` | `sales` | `203.0.113.10` (the droplet's IPv4 address) | 1 hour, or the default |

If you turned on IPv6 for the droplet, add an `AAAA` record for `sales` with its IPv6 address too.
On **Cloudflare**, set the record to **DNS only** (grey cloud): Caddy handles HTTPS itself.

> **Prefer to manage DNS at DigitalOcean?** **Networking** → **Domains** → add `example.com`, then
> at your registrar change the domain's nameservers to `ns1.digitalocean.com`,
> `ns2.digitalocean.com` and `ns3.digitalocean.com`, and create the `A` record at DigitalOcean -
> it lets you pick the droplet from a list. Copy any records you already have (email, website)
> across first, or they stop working.

Check it from your computer; it should print the droplet's address. It can take a few minutes, and
occasionally a few hours, to spread:

```bash
nslookup sales.example.com
```

## Step 5 - Create the secrets file

Signed in as **deploy**, write `/opt/cfs/.env` with new random secrets in one go. Change
`sales.example.com` to your address first:

```bash
printf 'COMPOSE_FILE=docker-compose.yml:docker-compose.cloud.yml\nCFS_IMAGE=ghcr.io/llkirkwood9/cfs-fundraiser:cloud\nCFS_DOMAIN=%s\nPOSTGRES_PASSWORD=%s\nJWT_KEY=%s\nSKIP_SEED_DATA=true\nALLOW_LEGACY_PINS=false\nCFS_BACKUP_KEEP=30\n' 'sales.example.com' "$(openssl rand -hex 24)" "$(openssl rand -base64 48 | tr -d '\n/+=')" > /opt/cfs/.env
```

```bash
chmod 600 /opt/cfs/.env && cat /opt/cfs/.env
```

What each line does:

| Line | |
| --- | --- |
| `COMPOSE_FILE` | Makes every `docker compose` command in `/opt/cfs` use both compose files. Keep it exactly as it is. |
| `CFS_IMAGE` | The image to run: this branch's, built by the workflow. |
| `CFS_DOMAIN` | Your address. Caddy gets its certificate for this name. |
| `POSTGRES_PASSWORD`, `JWT_KEY` | The database password and the key that signs sign-ins. |
| `SKIP_SEED_DATA=true` | Starts with an empty catalog rather than the sample one; bring the real catalog in with **Restore catalog** (Catalog screen, system admins). Leave the line out to start with the sample catalog. |
| `ALLOW_LEGACY_PINS=false` | No sign-in with a PIN from before passwords. **Leave it out** if you're moving a Pi's data across (see *Moving a cart's data to the cloud*) until everyone has chosen a password. |
| `CFS_BACKUP_KEEP=30` | How many database backups to keep on the droplet. |

**Save a copy of this file in your password manager.** If `POSTGRES_PASSWORD` is changed later,
the existing database won't accept the new one.

**Optional - choose the first password.** The first account's starting password is otherwise
random and written to the app's log. To choose it, add `SEED_ADMIN_PASSWORD=...` to the file now,
and take it out again after the first sign-in.

## Step 6 - Connect GitHub Actions

GitHub Actions deploys by signing in to the droplet as **deploy** with a key of its own.

On your computer, make that key (it has no passphrase, because a robot uses it):

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f cfs-deploy
```

Let the droplet accept it:

```bash
cat cfs-deploy.pub | ssh deploy@203.0.113.10 "cat >> ~/.ssh/authorized_keys"
```

Read the droplet's own key, so GitHub can be sure it's talking to your droplet:

```bash
ssh-keyscan -t ed25519 203.0.113.10
```

Now on GitHub, open the repository → **Settings** → **Secrets and variables** → **Actions**:

- On the **Variables** tab, add:
  - `DEPLOY_HOST` = `203.0.113.10` (the IP address, so a DNS problem never blocks a deploy)
  - `DEPLOY_USER` = `deploy`
- On the **Secrets** tab, add:
  - `DEPLOY_SSH_KEY` = everything in the `cfs-deploy` file (not the `.pub`), including the
    `-----BEGIN` and `-----END` lines
  - `DEPLOY_KNOWN_HOSTS` = the line `ssh-keyscan` printed, starting `203.0.113.10 ssh-ed25519`

Then delete `cfs-deploy` and `cfs-deploy.pub` from your computer (or keep them in your password
manager). If the key is ever exposed, remove its line from `/home/deploy/.ssh/authorized_keys` on
the droplet and make a new one.

The workflow signs the droplet in to GitHub's container registry with a token that only lasts for
that run, so the image can stay private and nothing else needs setting up.

## Step 7 - First deploy

On GitHub: **Actions** → **Cloud deploy** → **Run workflow** → branch `Cloud-Support` → **Run
workflow**. From now on it also runs by itself on every push to `Cloud-Support` that changes the
app.

- **build** takes roughly 10-15 minutes the first time and a few minutes after that. The image is
  published as `ghcr.io/llkirkwood9/cfs-fundraiser:cloud`, and under its version, e.g.
  `:cloud-2026.10.1`, which the profile menu shows.
- **deploy** copies the files to `/opt/cfs`, backs up the database (from the second deploy on),
  pulls the images, starts the three containers and waits for the app to report healthy. If it
  doesn't within five minutes, the step fails and prints the app's log.

When it's green, open `https://sales.example.com/health`; it should say `Healthy`. The very first
request can take a few extra seconds while Caddy fetches the certificate.

To see the containers on the droplet (signed in as **deploy**):

```bash
cd /opt/cfs && docker compose ps
```

## Step 8 - First sign-in

Unless you set `SEED_ADMIN_PASSWORD`, read the first account's starting password from the log:

```bash
cd /opt/cfs && docker compose logs app | grep "Created the first account"
```

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

If you set `SEED_ADMIN_PASSWORD`, take that line out of `/opt/cfs/.env` now.

**The mobile app** signs in to the same place: type `sales.example.com` as the server address on
its sign-in screen (it adds `https://` to a domain name by itself).

## Step 9 - Email receipts and reports through SMTP2GO

The app emails a customer their receipt as a PDF (**Email** on a sales sheet) and an event's sheets
as one PDF (**Email report**). Until email is set up, those buttons say so.

[SMTP2GO](https://www.smtp2go.com) is a sending service built for app email like receipts. Its free
plan covers 1,000 emails a month, up to 200 a day (check its pricing page; limits can change). Mail
goes out from your own domain, signed for it, which is what keeps receipts out of spam.

> **DigitalOcean blocks the usual mail ports** (25, 465 and 587) on droplets, to stop spam.
> SMTP2GO also listens on **port 2525**, which isn't blocked - so this setup uses 2525.

1. **Sign up** at https://www.smtp2go.com and pick the free plan.
2. **Add your domain.** **Sending** → **Verified Senders** → **Add a Sender Domain**, enter your
   domain (for example `cfsbeds.com`) and choose **Continue with this domain**.
3. **Add the three DNS records it shows** - CNAME records covering SPF, DKIM and link tracking -
   where you added the `A` record in Step 4, copying each name and value exactly. Some providers
   add your domain to the name for you, so you may only need its first part. On Cloudflare, set
   them to **DNS only** (grey cloud). Any SPF record you already have stays as it is.
4. **Add a DMARC record** if the domain doesn't have one: a TXT record named `_dmarc` with the
   value `v=DMARC1; p=none; rua=mailto:you@example.com` (an address you read). Gmail and Yahoo
   expect one; `p=none` only asks for reports and never blocks mail.
5. **Verify.** Back in SMTP2GO, press **Verify**. The records can take minutes to a few hours to
   spread; until the domain is verified, SMTP2GO sends only 25 emails an hour.
6. **Create an SMTP user.** **Sending** → **SMTP Users** (on some dashboards under **Settings**) →
   **Add SMTP User**. Its username and password are separate from your SMTP2GO sign-in; copy both.
7. **Add them to the droplet's `.env`.** Signed in as **deploy**, open it with `nano /opt/cfs/.env`
   and add these lines with your own values (`Ctrl+O`, `Enter` to save, `Ctrl+X` to leave). The
   from address must be on the domain you verified:

   ```
   EMAIL_HOST=mail.smtp2go.com
   EMAIL_PORT=2525
   EMAIL_SECURITY=StartTls
   EMAIL_USERNAME=the-smtp-username
   EMAIL_PASSWORD=the-smtp-password
   EMAIL_FROM=receipts@cfsbeds.com
   EMAIL_FROM_NAME=Custom Fundraising Solutions
   EMAIL_REPLY_TO=office@cfsbeds.com
   ```

   `EMAIL_REPLY_TO` is where a customer's reply goes, so use an address someone reads. Without
   `EMAIL_FROM_NAME`, emails show the app name from **Settings** as the sender.
8. **Apply it** - this restarts the app with the new settings, in a few seconds:

   ```bash
   cd /opt/cfs && docker compose up -d
   ```

9. **Test it**: email a receipt to yourself from a completed sale. SMTP2GO's **Reports** list every
   message and whether it was delivered. In Gmail, **More** (⋮) → **Show original** should show
   SPF, DKIM and DMARC as **PASS**.

If sending fails:

- **A timeout or "can't connect"**: check `EMAIL_PORT=2525`; port 587 is blocked on the droplet.
- **"535 authentication failed"**: the SMTP2GO sign-in password was used instead of the SMTP
  user's, or the username was cut short when pasting.
- **A rejected sender**: `EMAIL_FROM` isn't on the verified domain.
- More detail: `cd /opt/cfs && docker compose logs --tail 50 app | grep -i email`

The Raspberry Pi guide's *If receipts go to spam* section applies here too.

---

## Backups

Three layers, each covering something the others don't:

1. **Before every deploy**, the deploy takes a database backup first - a new version can change the
   database as it starts.
2. **Every night**, a database backup into `/opt/cfs/backups`; the newest `CFS_BACKUP_KEEP` (30)
   are kept. Set it up once, signed in as **root**:

   ```bash
   printf '15 3 * * * deploy bash /opt/cfs/docker/pi/cfs-backup.sh backup >> /opt/cfs/backups/backup.log 2>&1\n' > /etc/cron.d/cfs-backup
   ```

3. **DigitalOcean's droplet backups** (Step 1) - a copy of the whole droplet, for when the droplet
   itself is lost.

**Keep a copy off the droplet too**, after each event or monthly. From your computer:

```bash
scp "deploy@203.0.113.10:/opt/cfs/backups/cfs-*.dump.gz" .
```

Signed in as **deploy**, these work at any time:

```bash
bash /opt/cfs/docker/pi/cfs-backup.sh backup
```

```bash
bash /opt/cfs/docker/pi/cfs-backup.sh list
```

**Restoring** replaces everything in the database with the backup. The app is stopped while it
runs, so do it outside an event. Type `RESTORE` when asked:

```bash
bash /opt/cfs/docker/pi/cfs-backup.sh restore latest
```

or name a file: `... restore /opt/cfs/backups/cfs-20261101-031500.dump.gz`. **Try one restore**
before you need it - on the droplet before it goes live is a good time.

## Moving a cart's data to the cloud

To carry on from a Raspberry Pi's orders, events, crew and catalog:

1. **On the Pi**, take a backup:

   ```bash
   sudo bash /opt/cfs/docker/pi/cfs-backup.sh backup
   ```

2. **On your computer**, copy it off the Pi and onto the droplet (use the file name the backup
   printed):

   ```bash
   scp cfs@cfs.local:/opt/cfs/backups/cfs-20261101-090000.dump.gz .
   ```

   ```bash
   scp cfs-20261101-090000.dump.gz deploy@203.0.113.10:/opt/cfs/backups/
   ```

3. **On the droplet**, as **deploy**, restore it (type `RESTORE` when asked):

   ```bash
   bash /opt/cfs/docker/pi/cfs-backup.sh restore /opt/cfs/backups/cfs-20261101-090000.dump.gz
   ```

The app brings the database up to date as it starts. Coming from a Pi that still used PINs,
everything goes into a territory called **Pittsburgh** (rename it under **Territories**), and each
person signs in once more with their old PIN as the password and is then asked to choose one. For
that, `ALLOW_LEGACY_PINS=false` mustn't be in `.env` yet; add it (and run `docker compose up -d`)
once everyone has a password.

## Updating

Push to `Cloud-Support`. The workflow builds a new image and deploys it, with a backup first.
Watch it under **Actions** → **Cloud deploy**; the new version shows in the profile menu.

To redeploy without building - after changing `.env`, say - run the workflow by hand and untick
**Build a new image**. Or, on the droplet: `cd /opt/cfs && docker compose up -d`.

**If an update goes wrong**: revert the change on GitHub (or `git revert` and push), and the
workflow deploys the previous code. If the bad version changed the database, restore the backup
the deploy took just before it (`... cfs-backup.sh list` shows when each was taken).

## Day-to-day

Signed in as **deploy**, in `/opt/cfs`:

| | |
| --- | --- |
| Is everything up? | `docker compose ps` - all three running, the app `healthy` |
| The app's log | `docker compose logs --tail 80 app` |
| HTTPS and the certificate | `docker compose logs --tail 40 caddy` |
| Restart everything | `docker compose restart` |
| Memory and CPU now | `docker stats --no-stream` |
| Free disk | `df -h /` and `docker system df` |

The containers start again by themselves after a crash or a reboot.

## Troubleshooting

**The site doesn't load, or the browser warns about the certificate.** Check that
`nslookup sales.example.com` gives the droplet's address and that `CFS_DOMAIN` in `.env` matches
it exactly. Then read `docker compose logs caddy`: Caddy says why it couldn't get a certificate -
usually DNS not pointing at the droplet yet, or ports 80 and 443 not open in the firewall. It keeps
retrying on its own.

**"502 Bad Gateway".** Caddy is up but the app isn't answering - normal for a minute after a start.
If it lasts, read `docker compose logs --tail 80 app`.

**The deploy fails at "Copy the deployment files" or later SSH steps.** Check `DEPLOY_HOST`,
`DEPLOY_USER`, and that the `.pub` half of `DEPLOY_SSH_KEY` is in
`/home/deploy/.ssh/authorized_keys`. "Host key verification failed" means `DEPLOY_KNOWN_HOSTS` is
wrong - or the droplet was rebuilt, in which case run `ssh-keyscan` again and update it.

**"denied" when pulling the image.** The workflow's token couldn't read the package. On GitHub,
open the package (your profile → **Packages** → `cfs-fundraiser`) → **Package settings** →
**Manage Actions access**, and make sure this repository is listed with **Read** access.

**A password mismatch after changing `.env`.** PostgreSQL keeps the password from its first start.
Put the old password back in `.env`.

---

## Security checklist

- [ ] `/opt/cfs/.env` is `chmod 600`, and a copy is in your password manager.
- [ ] The DigitalOcean firewall lets in only 22, 80 and 443.
- [ ] SSH accepts keys only. Droplets created with an SSH key already refuse passwords; as root,
      `sshd -T | grep passwordauthentication` should say `no`.
- [ ] Droplet backups are on, the nightly database backup is set up, a copy is kept off the
      droplet, and a restore has been tried.
- [ ] `SEED_ADMIN_PASSWORD` is out of `.env` after the first sign-in.
- [ ] `ALLOW_LEGACY_PINS=false` is in `.env` once nobody signs in with a PIN any more.
- [ ] Everyone has their own account - no shared sign-ins - and people who leave are switched off
      on the Crew screen (that signs them out everywhere at once).
- [ ] The deploy key is only in GitHub's secrets.

### What the app does itself

Passwords of at least 8 characters that aren't common ones, stored hashed; accounts locked for 15
minutes after 5 wrong passwords; sign-in rate-limited per address; 15-minute access tokens held
only in memory, with a session that is replaced every time it's used and stored only as a hash -
an httpOnly, SameSite=Strict cookie in the dashboard, the Keychain / Keystore in the mobile app;
every request checked against the database, so a switched-off account or territory stops working
at once; territory rules enforced by the API; security headers (Content-Security-Policy and the
rest) and HSTS on every response; and errors that don't reveal anything about the server. Behind
Caddy, the app believes the visitor's address and HTTPS only from Caddy, the one hop in front of
it. See the README's *Security* section for the details.
