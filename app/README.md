# CFS Sales - mobile app

The dashboard as a native app for iPhone, iPad and Android phones and tablets, built with Expo
(SDK 57), React Native and Expo Router, styled with NativeWind so it looks like the dashboard.
It talks to the same API: the server address is entered on the sign-in screen and remembered on
the device. Sign-in is a username and password; the session's refresh token is kept in the iOS
Keychain / Android Keystore (`expo-secure-store`) and sent as an `X-Refresh-Token` header, since
the app has no browser cookies (see the README's *Security*).

Every dashboard screen is here, on a native tab bar (Liquid Glass on iOS 26) - Sell, Checkout,
Orders, Dashboard, and More for Inventory, Catalog, Events, Crew, Settings and Territories - with
the territory picker in the menu bar, as on the dashboard. Sheets print and
email as the same picture-per-page PDF the dashboard makes, printing through the system print
dialog.

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `w` for the browser test build. The full guide - running,
testing on devices, development builds and store builds - is
[`Documents/Mobile App Guide.md`](../Documents/Mobile%20App%20Guide.md).

## Layout

The code mirrors `dashboard/src`, so a change on one side is easy to find on the other.

```
src/
├── app/                Expo Router routes - thin files that wrap a Page in ProtectedRoute
│   ├── (tabs)/         The tab bar: sales, checkout, orders, dashboard, more/
│   ├── receipt/        A sales sheet
│   └── events/         An event's printable sheets
├── Components/         As on the dashboard (Elements, Sales, Checkout, Catalog, ...)
├── Context/            AuthContext, TerritoryContext, SettingsContext
├── Hooks/              UseTheme, UseBreakpoint
├── Lib/                api.ts, Server.ts, Storage.ts, SheetPdf.ts, Files.ts, ...
├── Models/             Copied from the dashboard
├── Pages/              One per screen, as on the dashboard
├── Routes/             ProtectedRoute, RequireTerritory, HomeRedirect
└── Services/           Copied from the dashboard
```

`Models`, `Services` and most of `Lib` are copies of the dashboard's files; keep them in step when
the API changes.

## Checks

```bash
npx tsc --noEmit
```

```bash
npx expo lint
```

```bash
npx expo-doctor
```

## Dependencies

Install packages with `npx expo install`, which picks the versions Expo SDK 57 and Expo Go
support; `npx expo install --check` lists any that are off. React Native and the native modules
stay on those versions until the app moves to a newer SDK.

`package.json` overrides three packages for security fixes:

- `uuid` 11.1.1+ for `xcode`, in Expo's build tooling.
- `postcss-selector-parser` 7.1.6+ for Tailwind CSS 3, which NativeWind 4 needs; Tailwind's
  output is unchanged.
- `decode-uri-component`, which Expo Router reaches through `query-string` 7, points at
  `vendor/decode-uri-component`: version 0.5.0, which fixes a denial of service, with only its
  export changed to CommonJS because `query-string` 7 loads it with `require()`. Delete the
  folder and the override once Expo Router no longer depends on `query-string` 7.

`npm audit` still reports two advisories that have no fixed version yet: `braces`, in Tailwind
CSS 3's file matching, and `node-forge`, in the Expo CLI's code signing. Both are build-time
tools, not part of the app. They go away when NativeWind supports Tailwind CSS 4 (NativeWind 5)
and when Expo updates its CLI.
