# CFS Sales Mobile App: Running, Testing and Building

The mobile app lives in `app/`. It is the dashboard as a native app for iPhone, iPad and Android
phones and tablets, built with Expo (SDK 57), React Native and NativeWind. It uses the same API as
the dashboard, so a server has to be running for it to sign in. That can be the API on your PC,
or the cart's Pi or venue server.

---

## 1. What you need

- **Node 20 or newer** and **npm**.
- **A phone or tablet with Expo Go** from the App Store or Google Play. It must be the Expo Go
  release for SDK 57, which the store version is while SDK 57 is current.
- **The same Wi-Fi** for the phone and the computer running the server.
- For builds you can install: a free **Expo account** (`npx eas-cli login`). A local iOS build
  also needs a **Mac with Xcode**. On Windows, iOS builds go through EAS in the cloud.

Install the app's packages once:

```bash
cd app
```

```bash
npm install
```

---

## 2. Running it

### Start a server the phone can reach

The app signs in to whatever server address you type on its sign-in screen. Use one of these:

- **The cart's Pi or a venue server:** `http://<its IP>:8080`. No changes are needed on the server.
- **The API on your PC:** a phone can't reach `localhost`, so the API has to listen on the
  network. Start it with:

  ```bash
  cd api && dotnet run --launch-profile http --urls http://0.0.0.0:5046
  ```

  Then use `http://<your PC's IP>:5046` as the server address. Find the IP with `ipconfig`
  (Windows) or `ipconfig getifaddr en0` (Mac). Allow the Windows firewall prompt for private
  networks.

Plain `http://` is allowed, because the cart's server is on the local network without a
certificate. iOS allows it through the App Transport Security settings in `app.json`, and Android
through `usesCleartextTraffic`.

### Start the app

```bash
cd app
```

```bash
npx expo start
```

Scan the QR code with the camera (iOS) or with Expo Go (Android). The app opens on the sign-in
screen:

1. Type the server address, e.g. `192.168.1.20:5046` (`http://` is added for you), and tap
   **Connect**. The app checks the server's `/health` and remembers the address on the device.
2. Sign in with a username and PIN as usual. The seeded accounts are listed in the README.

To use a different server later, sign out and tap **Change** beside the server address.

Edits to the code reload on the phone as you save. Shake the device, or press `m` in the
terminal, for the developer menu.

### In a browser

Press `w` in the terminal, or run `npm run web -- --port 8082`. This is a quick way to click
through screens, but it is not how the app ships. A browser needs the API to allow the page's
origin, so start the API with:

```bash
cd api && Cors__AllowedOrigins__0=http://localhost:3000 Cors__AllowedOrigins__1=http://localhost:8082 dotnet run --launch-profile http
```

In PowerShell, set `$env:Cors__AllowedOrigins__0` and `$env:Cors__AllowedOrigins__1` first.
Then sign in with `localhost:5046` as the server address.

---

## 3. Testing

### Checks

Run these from `app/` before committing:

```bash
npx tsc --noEmit
```

```bash
npx expo lint
```

```bash
npx expo-doctor
```

To confirm the app still bundles for each platform without a device:

```bash
npx expo export --platform ios
```

```bash
npx expo export --platform android
```

### Expo Go or a development build

**Expo Go** runs everything the app uses, so it is the quickest way to test on a real device. A
**development build** is the app installed under its own name and icon, with the same developer
menu and live reloading. Use one to test what Expo Go can't show:

- the real app icon, splash screen and name;
- the local network permission prompt on iOS;
- `app.json` changes, such as permissions or the cleartext setting;
- Liquid Glass on the tab bar and floating panels. This needs iOS 26, and Expo Go shows it only
  when its own build supports it.

Build one in the cloud and install it from the link EAS gives you:

```bash
npx eas-cli build --profile development --platform android
```

```bash
npx eas-cli build --profile development --platform ios
```

An iOS development build installs only on devices registered to the Apple developer account.
`npx eas-cli device:create` registers one. For the iOS Simulator on a Mac, use the
`development-simulator` profile.

With a Mac or Android Studio you can build and install locally instead:

```bash
npx expo run:android
```

```bash
npx expo run:ios --device
```

Once a development build is installed, `npx expo start` serves it in place of Expo Go.

### What to try on a device

- Sign in against the server, then sign out and back in. The server address should be
  remembered.
- **Sell:** start an order, add items, and send it to checkout.
- **Lists:** tapping a row opens it (an order item's editor, a product, an event, a crew
  member, an order's sales sheet, a size's count). Swiping a row to the left uncovers its other
  actions - Add service, Add upcharge, Remove, Delete, Reopen, History - and tapping an open row
  closes it. Holding an order item, delivery option or financing option for a moment, then
  dragging it, puts it in a new place.
- **Checkout:** take a payment, hand the device to the customer for initials and a signature,
  and complete the order.
- **Sales sheet:** print it to an AirPrint or Android print-service printer, and **Email** a
  completed one. The emailed PDF should match the printed sheet. **Email report** on an event's
  sheets should do the same for the whole stack.
- **Orders**, **Dashboard** and **More** (Inventory, Catalog, Events, Crew, Settings), in light
  and dark mode, on a phone and on a tablet, in both orientations.
- **Refresh on return:** change something on another device (send an order to checkout, add a
  product), then switch back to the tab. It should show the change without pulling down.
- **Close out** an event: swiping an open order uncovers Discard (or Void), and Clear all / Void
  all clear a whole step.
- Turn Wi-Fi off for a moment. The "can't reach the server" banner should show, then clear when
  Wi-Fi is back.

---

## 4. Building for release

Builds run on EAS. Profiles are in `app/eas.json`:

| Profile | What it makes |
| --- | --- |
| `development` | A development build, installed from a link (see above) |
| `development-simulator` | The same, for the iOS Simulator |
| `preview` | The release app for testers: an Android `.apk`, or an iOS ad hoc build |
| `production` | The store build: an Android `.aab` and an iOS App Store build |

```bash
npx eas-cli build --profile preview --platform all
```

```bash
npx eas-cli build --profile production --platform all
```

The first build asks to create the EAS project and the signing credentials. Let EAS manage them.

The version people see is **YYYY.MM.<build>**: the year and month it was built, then which release
of that month it is, counting from 1 - the first release in October 2026 is `2026.10.1`. Releases
from the workflow in section 6 are numbered that way automatically; a build run by hand, and the
app in Expo Go, show this month's build 0 (e.g. `2026.10.0`). `app/app.config.js` sets it, and
nothing needs editing by hand. The stores' own internal build numbers count up on their own too
(`autoIncrement`).

To send a production build to the stores:

```bash
npx eas-cli submit --platform ios
```

```bash
npx eas-cli submit --platform android
```

iOS needs an Apple Developer Program membership. Android needs a Google Play developer account,
and the very first Android upload has to be done by hand in the Play Console.

The app's identity is set in `app/app.json`:

| Setting | Value |
| --- | --- |
| Name | CFS Sales |
| iOS bundle ID / Android package | `com.cfsbeds.cfssales` |
| Icon and splash | `app/assets/images/` |

---

## 5. Setting up TestFlight

TestFlight is Apple's way to hand out an app before, or instead of, the App Store. It needs an
**Apple Developer Program** membership ($99 a year). This is done once.

1. **Join the Apple Developer Program** at <https://developer.apple.com/programs/> with the Apple
   Account that will own the app. Enrolling as an organization needs a D-U-N-S number and takes a
   few days; as an individual it is usually same-day.
2. **Create the app in App Store Connect** (<https://appstoreconnect.apple.com>): **Apps → + → New
   App**. Choose iOS, name it **CFS Sales**, and pick the bundle ID
   `com.cfsbeds.cfssales`. If that bundle ID isn't in the list, register it
   first under **Certificates, Identifiers & Profiles → Identifiers** on developer.apple.com, or
   run the first build in step 5, which registers it for you. The SKU can be anything, e.g.
   `cfs-sales`. Open the new app's **App Information** page and note its **Apple ID**, a number
   such as `6740000000`.
3. **Make an App Store Connect API key**, so builds can be uploaded without your password and
   two-factor codes: **Users and Access → Integrations → App Store Connect API → Team Keys → +**,
   with the **App Manager** role. Download the `.p8` file - Apple only lets you download it once -
   and note the **Key ID** and the **Issuer ID** shown above the list.
4. **Link the app to EAS**, from `app/`:

   ```bash
   npx eas-cli login
   ```

   ```bash
   npx eas-cli init
   ```

   `init` adds the EAS project's ID to `app/app.json`; commit that change. Then add the app's
   Apple ID from step 2 to the `production` submit profile in `app/eas.json` - not `app.json`,
   which has no submit settings:

   ```json
   "submit": {
     "production": {
       "ios": { "ascAppId": "6740000000" }
     }
   }
   ```

   Then give EAS the API key: run `npx eas-cli credentials --platform ios`, choose the
   `production` profile, then **App Store Connect: Manage your API Key**, and set up a new key
   with the `.p8` file, Key ID and Issuer ID from step 3. Let EAS use it for submissions.
5. **Run the first build by hand**, so EAS can create the signing certificate and provisioning
   profile (sign in with the Apple Account when asked):

   ```bash
   npx eas-cli build --platform ios --profile production --auto-submit
   ```

   When it finishes, EAS uploads it to App Store Connect. Apple takes 10-30 minutes to process a
   build before it appears under **TestFlight**.
6. **Add testers** in App Store Connect under **TestFlight**:
   - **Internal testing:** up to 100 people who are users on your App Store Connect team. Add
     them under **Users and Access** first (the **Developer** or **Marketing** role is enough),
     then add them to an internal group. Builds reach them right away, with no review.
   - **External testing:** up to 10,000 people, by email or a public link. The first build in a
     group needs a short Beta App Review from Apple, usually within a day.

   Testers install the **TestFlight** app from the App Store and accept the invitation; TestFlight
   then installs CFS Sales and updates it when new builds arrive.

Each TestFlight build works for 90 days, so put out a new one at least that often (section 6
does it on every push). The app doesn't use any encryption beyond HTTPS, so `app/app.json`
declares that, and App Store Connect won't ask about export compliance on every build.

---

## 6. Automatic releases with GitHub Actions

`.github/workflows/app-release.yml` releases the app whenever the **`app-release`** branch is
pushed. Both builds run on EAS's servers, so no Mac is needed:

- **Android:** an APK is built and attached to a new **GitHub release**, named after the version
  (e.g. `app-v2026.10.1`).
- **iOS:** a build is made and sent to **TestFlight**. EAS only fills in TestFlight's "What to
  Test" note on its Enterprise plan, so add one in App Store Connect if testers need it.

It can also be started by hand: **Actions → App release → Run workflow**.

### One-time setup

1. Do steps 1-5 of section 5, and commit the `app/app.json` and `app/eas.json` changes. The
   workflow can't answer questions, so the signing credentials and the API key must already be
   stored on EAS. If the Apple Developer account changes, also change `EXPO_APPLE_TEAM_ID` in
   `.github/workflows/app-release.yml` to its Team ID (shown under **Membership details** on
   developer.apple.com); EAS needs it to use the API key without asking.
2. Run one Android build by hand too, so EAS creates the Android signing key:

   ```bash
   npx eas-cli build --platform android --profile preview
   ```

   Every later APK is signed with the same key, which is what lets a new version install over the
   old one. EAS keeps the key; **Credentials** on expo.dev can download a backup.
3. Make an Expo access token: on <https://expo.dev>, **Account settings → Access tokens → Create
   token**.
4. Add it to the GitHub repository as a secret: **Settings → Secrets and variables → Actions → New
   repository secret**, named `EXPO_TOKEN`.
5. Create the branch and push it:

   ```bash
   git push origin main:app-release
   ```

### Releasing

Merge or push whatever should ship to `app-release`, e.g. straight from `main`:

```bash
git push origin main:app-release
```

Then watch it under **Actions**. A release takes about 15-30 minutes; builds can wait longer in
EAS's queue on the free plan, which also caps the number of builds a month (see
<https://expo.dev/pricing>).

Each release gets the next version for the month, YYYY.MM.<build>, so October's releases are
`2026.10.1`, `2026.10.2` and so on, and November starts again at `2026.11.1`. The workflow finds
the next number from the month's `app-v` tags and tags the release before building, so iOS and
Android always share a version. A release that fails still uses up its number; the next one takes
the number after it.

### Installing the Android release

On each Android phone or tablet, open the repository's **Releases** page, download the newest
`.apk` and open it. The first time, Android asks to allow installs from the browser or Files app.
A new release installs over the old one and keeps the saved server address. If the repository is
private, people need access to it on GitHub to download from Releases; otherwise share the APK
another way, such as the link on the build's page on expo.dev.
