# Running CFS Fundraiser on a Raspberry Pi 3B

This sets up a Raspberry Pi 3B as the cart's server. It starts on its own when the Pi is powered
on, updates itself when it can reach the internet, and everyone on the same network opens it at
`http://<the Pi's IP>:8080`.

---

## Before you start: how it's put together

The app runs the same way everywhere - a PC, a venue server and this Pi - as two containers: the app
itself and **PostgreSQL**, which has an ARM build and is light enough for a Pi 3B.

| File | What it is |
| --- | --- |
| `Dockerfile` | The app (API + dashboard), no database inside - built for x86 and ARM |
| `docker-compose.yml` | Two containers: the app and PostgreSQL |
| `docker-compose.pi.yml` | Simply includes `docker-compose.yml`; the boot script below uses this name |
| `docker/pi/cfs-update.sh` | Pull the newest image and start everything |
| `docker/pi/cfs.service` | Runs that script at every boot |
| `.github/workflows/app-image.yml` | Builds the image for you whenever you push to `main` |

On the Pi this uses roughly **175 MB of RAM** (about 135 MB for the app, 40 MB for PostgreSQL),
which leaves plenty of room on a 1 GB board.

### What you need

- Raspberry Pi 3B, its power supply, and a microSD card (16 GB or larger).
- A wired or Wi-Fi connection on the same network as the tablets.
- A computer to flash the card and to run these commands over SSH.

> **The 64-bit version of Raspberry Pi OS is required.** PostgreSQL and .NET both publish ARM64
> images; the old 32-bit Pi OS cannot run them. A Pi 3B supports 64-bit fine.

---

## Step 1 - Flash the card

1. Install **Raspberry Pi Imager** on your computer and open it.
2. **Choose device**: Raspberry Pi 3.
3. **Choose OS**: `Raspberry Pi OS (other)` → **Raspberry Pi OS Lite (64-bit)**. Lite has no
   desktop, which is what you want on a 1 GB board.
4. **Choose storage**: your microSD card.
5. Click **Next** → **Edit Settings** and fill in:
   - **Hostname**: `cfs` (so you can also reach it at `http://cfs.local:8080`)
   - **Username and password**: for example `cfs` and a password you'll remember
   - **Wireless LAN**: your event Wi-Fi name and password, if you aren't using Ethernet
   - **Locale**: your time zone
   - On the **Services** tab, tick **Enable SSH** → *Use password authentication*
6. Write the card, put it in the Pi, and power it on. Give it a couple of minutes on first boot.

## Step 2 - Connect to the Pi

From your computer:

```bash
ssh cfs@cfs.local
```

If `cfs.local` doesn't resolve, find the Pi's IP address in your router's device list and use that
instead (`ssh cfs@192.168.1.50`).

Check you're on 64-bit - this must say `aarch64`:

```bash
uname -m
```

Then update the system:

```bash
sudo apt update && sudo apt full-upgrade -y && sudo reboot
```

## Step 3 - Install Docker

Reconnect after the reboot, then:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker $USER && sudo systemctl enable --now docker
```

Log out and back in (`exit`, then `ssh` again) so your account picks up Docker access, and check it:

```bash
docker run --rm hello-world
```

## Step 4 - Get the deployment files onto the Pi

```bash
sudo mkdir -p /opt/cfs && sudo chown $USER:$USER /opt/cfs
```

```bash
git clone https://github.com/llkirkwood9/cfs-pittsburgh.git /opt/cfs
```

If the repository is private, GitHub will ask for your username and a personal access token instead
of a password. (See the note in Step 6 about tokens.)

## Step 5 - Create the secrets file

The stack reads two secrets from `/opt/cfs/.env`. Generate them on the Pi and write the file in one
go:

```bash
printf 'CFS_IMAGE=ghcr.io/llkirkwood9/cfs-fundraiser:latest\nPOSTGRES_PASSWORD=%s\nJWT_KEY=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -base64 48 | tr -d '\n/+=')" > /opt/cfs/.env
```

```bash
chmod 600 /opt/cfs/.env && cat /opt/cfs/.env
```

Keep a copy of that file somewhere safe. If you change `POSTGRES_PASSWORD` later, the existing
database won't accept the new password. (See *Changing the database password* at the end.)

**Optional - start with an empty catalog.** On its first start the app loads a sample catalog of
products, delivery options and a sample event, and on every start after that it puts back any of
those that are missing - so sample items you delete come back. To skip all of that and build your
own catalog from scratch, add this line to the same file:

```bash
echo 'SKIP_SEED_DATA=true' >> /opt/cfs/.env
```

You can add it later too; it takes effect at the next restart and leaves everything already in the
database alone. Either way, a brand-new database still gets one account to sign in with -
`admin`, PIN `1234` - so change that PIN as soon as you sign in.

## Step 6 - Publish the app image

The Pi doesn't build anything - it pulls a ready-made image. GitHub Actions builds it for you, for
both ARM (the Pi) and x86:

1. Push this branch to `main`. The **App image** workflow starts automatically.
2. Watch it on GitHub under **Actions** → **App image**. The first run takes roughly 10-15 minutes.
3. When it finishes, the image exists at `ghcr.io/llkirkwood9/cfs-fundraiser:latest`.

**Let the Pi read it.** Packages start out private, so do one of these:

- *Keep it private (recommended):* on GitHub go to **Settings → Developer settings → Personal
  access tokens → Tokens (classic)**, generate a token with the **`read:packages`** scope, then on
  the Pi:

  ```bash
  echo 'YOUR_TOKEN_HERE' | docker login ghcr.io -u llkirkwood9 --password-stdin
  ```

- *Or make it public:* open the package from your GitHub profile → **Packages** →
  **Package settings** → **Change visibility** → Public. Then the Pi needs no login.

> **Prefer to build it yourself?** On a computer with Docker Desktop:
> ```bash
> docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/llkirkwood9/cfs-fundraiser:latest --push .
> ```

## Step 7 - First run

```bash
cd /opt/cfs && docker compose pull
```

```bash
docker compose up -d
```

The first start takes a minute or two: PostgreSQL sets itself up, then the app creates its tables
and loads the product catalogue. Watch it happen with:

```bash
docker compose logs -f app
```

Press `Ctrl+C` to stop watching. Both containers should say `healthy`:

```bash
docker compose ps
```

Now open `http://cfs.local:8080` (or `http://<the Pi's IP>:8080`) from any device on the network and
sign in as **admin / 1234**. That first account is made the **System Admin** automatically, the one
role that can permanently delete events, orders and crew.

> **Change that PIN straight away**: tap your initials in the top-right corner, then **Change PIN**.
> Then add accounts for the rest of the team under **Crew**.

## Step 8 - Start it automatically at boot

```bash
chmod +x /opt/cfs/docker/pi/cfs-update.sh
```

```bash
sudo cp /opt/cfs/docker/pi/cfs.service /etc/systemd/system/cfs.service && sudo systemctl daemon-reload && sudo systemctl enable --now cfs.service
```

At every boot the Pi now:

1. waits for the network (up to a minute),
2. runs `git pull` for the deployment files,
3. pulls the newest app image,
4. starts both containers.

If there's no internet - at an event, for example - it skips the update and starts the image it
already has. Nothing blocks the app from starting.

Test it:

```bash
sudo reboot
```

Wait a minute, then load `http://cfs.local:8080` again.

## Step 9 - Make the address predictable

The Pi's IP can change when it reconnects, which is annoying when the tablets have it bookmarked.
Either:

- **Reserve the address on your router** (usually "DHCP reservation" or "static lease") against the
  Pi's MAC address, which you can see with `ip a`, or
- **use the hostname** `http://cfs.local:8080`, which works from iPads, Macs, and Windows 10 or
  newer without any setup.

To see the current address at any time:

```bash
hostname -I
```

---

## Day-to-day

**Updating the app.** Push to `main`, wait for the App image workflow to finish, then on the Pi:

```bash
sudo systemctl restart cfs.service
```

Or just reboot the Pi. Either way it pulls the new image and restarts. Your data stays put - it
lives in a Docker volume, not in the image.

**Checking on it.**

```bash
cd /opt/cfs && docker compose ps
```

```bash
cd /opt/cfs && docker compose logs --tail 50 app
```

**Stopping and starting by hand.**

```bash
cd /opt/cfs && docker compose stop
```

```bash
sudo systemctl restart cfs.service
```

**Backing up the database.** Do this after every event. It writes a single file you can copy off
the Pi:

```bash
cd /opt/cfs && docker compose exec -T db pg_dump -U cfs CfsFundraiser | gzip > ~/cfs-backup-$(date +%F).sql.gz
```

Copy it to your computer (run this on the computer, not the Pi):

```bash
scp cfs@cfs.local:~/cfs-backup-*.sql.gz .
```

**Restoring a backup** onto a fresh Pi, after Step 7:

```bash
gunzip -c ~/cfs-backup-2026-09-22.sql.gz | docker compose -f /opt/cfs/docker-compose.yml exec -T db psql -U cfs -d CfsFundraiser
```

---

## Optional - Email receipts and reports

The app can email a customer their receipt as a PDF (the **Email** button on a sales sheet) and
email an event's sheets as a single PDF (the **Email report** button on an event's sales sheets).
The PDF is made on the tablet, so this adds no work for the Pi. It sends through an ordinary email
account over SMTP. Until it's set up, those buttons just say email isn't set up.

A Gmail account works well. Gmail won't accept your normal password here, so turn on 2-Step
Verification for the account, then create an **app password** at
https://myaccount.google.com/apppasswords and use that 16-letter code below.

Add these lines to `/opt/cfs/.env` (with your own address and app password):

```bash
cat >> /opt/cfs/.env <<'END'
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURITY=StartTls
EMAIL_USERNAME=cfs.pittsburgh@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_FROM=cfs.pittsburgh@gmail.com
END
```

Emails show the app name from the app's **Settings** screen as the sender ("CFS" unless
you change it there). To use a different sender name, add an `EMAIL_FROM_NAME=...` line too.
If nobody reads the sending account, add `EMAIL_REPLY_TO=...` with an address someone does read,
so a customer who replies to their receipt reaches a person.

Then restart so the app picks them up:

```bash
sudo systemctl restart cfs.service
```

Other providers use the same settings with their own server: Outlook.com is `smtp-mail.outlook.com`
on port 587, and most web hosts give you a server name and port in their email setup page. For a
server on port 465, set `EMAIL_SECURITY=SslOnConnect`.

Email needs an internet connection at the time you press Send. At a venue with no internet,
print instead, or email the report afterwards from home - the report and receipts can be sent any
time after the event.

### If receipts go to spam

Spam filters judge the sender more than the message. A brand-new free Gmail account - more so one
named "noreply" that shows a company name - sending PDFs to people who have never written to it
looks a lot like spam, however tidy the receipt is. In order of how much they help:

1. **Send from the company's own domain.** Use an address such as `receipts@yourcompany.com` from
   Google Workspace, Microsoft 365, or a sending service built for receipts (Postmark, Amazon SES,
   SendGrid, Mailgun, Brevo). Set up SPF, DKIM and DMARC for the domain in its DNS, as the provider's
   setup page describes. Only the `EMAIL_*` lines change; for example, with Google Workspace the
   host and port stay the same, and the username, from address and app password become the
   Workspace account's.
2. **Give replies somewhere to go.** Set `EMAIL_REPLY_TO` (above) to a monitored address, and avoid
   "noreply" in the sending address if you can.
3. **Keep the sender name and the address matching.** "Custom Fundraising Solutions" from a
   `@gmail.com` address is a common phishing pattern; it reads better from the company's domain.
4. **Build up the account's reputation.** Mail from a new account is watched closely for its first
   few weeks. Ask the first customers to mark the receipt **Not spam** (or add the address to
   their contacts), and send a few test receipts to your own Gmail, Outlook and Yahoo addresses
   and mark them **Not spam** too.

Gmail shows why it filtered a message: open it in the spam folder and read the yellow banner. In
Gmail, **More** (⋮) → **Show original** shows whether SPF, DKIM and DMARC passed.

If a send fails, the app shows the mail server's reason. To see more:

```bash
cd /opt/cfs && docker compose logs --tail 50 app | grep -i email
```

---

## Before an event

- Power the Pi on and confirm `http://cfs.local:8080` loads from one of the tablets.
- Sign in as an admin and make sure the event is set up and **Active** under **Events**.
- Enter the stock counts under **Inventory** so Take With works.
- If the venue has no internet, that's fine - everything runs on the local network. Just don't
  expect the boot-time update to do anything.
- The Pi 3B's Wi-Fi is 2.4 GHz only and shares the bus with the network port. For a busy event,
  plug it into Ethernet if you can.

## Troubleshooting

**The page doesn't load at all.**

```bash
cd /opt/cfs && docker compose ps
```

If `cfs-app` is missing or restarting, read its log:

```bash
cd /opt/cfs && docker compose logs --tail 80 app
```

**"denied" or "unauthorized" when pulling.** The Pi can't read the package. Redo the
`docker login ghcr.io` step, or make the package public (Step 6).

**The app says the database isn't ready.** PostgreSQL is slow to start the first time on an SD
card. The app retries for a couple of minutes on its own. If it never settles:

```bash
cd /opt/cfs && docker compose logs --tail 40 db
```

**A password mismatch after changing `.env`.** PostgreSQL keeps the password from the first run.
Either restore the old password in `.env`, or wipe the database and start fresh - **this deletes
every order**:

```bash
cd /opt/cfs && docker compose down -v && docker compose up -d
```

**Out of space.** SD cards fill up with old images:

```bash
docker system df && docker image prune -af
```

**Which version is running?**

```bash
docker inspect --format '{{index .Config.Image}} {{.Created}}' cfs-app
```

---

## A note on security

This runs plain HTTP on your local network, which is fine for a cart on an event Wi-Fi. Don't
forward port 8080 through a router to the internet: there's no HTTPS and the sign-in is a short
PIN. If you ever need it reachable from outside the venue, put it behind a VPN or a reverse proxy
with a certificate.
