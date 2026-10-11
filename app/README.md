# CFS Sales - mobile app

The dashboard as a native app for iPhone, iPad and Android phones and tablets, built with Expo
(SDK 57), React Native and Expo Router, styled with NativeWind so it looks like the dashboard.
It talks to the same API: the server address is entered on the sign-in screen and remembered on
the device.

Every dashboard screen is here, on a native tab bar (Liquid Glass on iOS 26) - Sell, Checkout,
Orders, Dashboard, and More for Inventory, Catalog, Events, Crew and Settings. Sheets print and
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
├── Context/            AuthContext, SettingsContext
├── Hooks/              UseTheme, UseBreakpoint
├── Lib/                api.ts, Server.ts, Storage.ts, SheetPdf.ts, Files.ts, ...
├── Models/             Copied from the dashboard
├── Pages/              One per screen, as on the dashboard
├── Routes/             ProtectedRoute, HomeRedirect
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
