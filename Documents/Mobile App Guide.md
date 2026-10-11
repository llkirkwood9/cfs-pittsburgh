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
- **Checkout:** take a payment, hand the device to the customer for initials and a signature,
  and complete the order.
- **Sales sheet:** print it to an AirPrint or Android print-service printer, or save it as a
  PDF. **Share PDF** and **Email** should send the same sheet.
- **Orders**, **Dashboard** and **More** (Inventory, Catalog, Events, Crew, Settings), in light
  and dark mode, on a phone and on a tablet, in both orientations.
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
Store builds number themselves (`autoIncrement`). To change the version people see, edit
`version` in `app/app.json`.

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
| iOS bundle ID / Android package | `com.customfundraisingsolutions.cfssales` |
| Icon and splash | `app/assets/images/` |
