# CFS Mattress Fundraiser

Order-taking, checkout and reporting for CFS mattress fundraisers. An ASP.NET Core 10 Web API
backs a single React 19 + Vite + TypeScript SPA that runs on the cart's tablets.

The catalog and the printed receipt are both built from the supplied source documents: the
9/12/26 price cards and the Hampton 9/12 sales sheets.

---

## 1. What it does

**Sales floor** (`/sales`, Sales role)
- A rep holds as many drafts open at once as they have customers. Each one is a tab across the
  top; switching never loses anything because every change is saved server-side as it is made.
- Items are added from the catalog: pick a category, a product, a size/configuration, any
  selections the product has (such as a sheet set's Color), and a shipping method. Quantity, a
  discount (a percent, or a fixed dollar amount off each item) and a price override for "Inquire"
  sizes are all on the same screen. Every item gets a shipping row underneath it, including
  no-charge ones such as Drop Ship and Take With.
- **Size guide**: the ruler button in the menu bar (every role, every screen) and **Size guide**
  beside the sizes in Add item open the mattress size chart (`dashboard/public/mattress_sizes.png`,
  drawn to scale) with each size's width and length in inches.
- A product on sale shows a Sale badge and its sale prices. The sale comes off first and the
  rep's own discount comes off the sale price, with the working shown before the item is added.
  A shipping choice on sale shows its sale price too. A rep's discount on shipping is given
  afterwards, with **Edit** on the shipping row.
- A bundle - such as a mattress sold as a set with an adjustable base - gets each included item
  as its own no-charge "included" row, so the sheet shows exactly what is being delivered. The
  size chips show what each bundle includes.
- A second in-home service (White Glove *and* Haul Away, as on the paper sheets) is attached to a
  line with **Add service**.
- **Hand tablet to customer** opens a plain-language, oversized form for the customer to type
  their own address (with the same optional Unit #, Floor, Suite # and alternate phone as the sales
  sheet), a separate delivery address if the bed is going somewhere else, and the name of whoever
  referred them. No prices, no line items and no
  navigation are on screen while they have it.
- Pressing **Complete** hands the order to the checkout table.

**Checkout table** (`/checkout`, Checkout role)
- A queue of orders the floor has handed over, oldest first, with how long each customer has been
  waiting. It refreshes itself every 8 seconds.
- Items can still be added, edited and removed here, exactly as on the floor - a forgotten
  protector does not mean sending the customer back across the room.
- Comments can be read and added to here as well as on the floor.
- Takes payment split across cash, check, credit/debit card, financing and layaway, with cash
  selected by default. Choosing Credit/Debit Card puts the card processing fee on the total
  straight away; switching to another method takes it back off, so the figure quoted is the
  figure charged. **Financing** also takes the type of financing - picked from a dropdown of the
  catalog's financing options, or **Other** with the type typed in when Settings allows it - and
  the financing number; both are printed in the Comments box of the sales sheet, with the amount
  financed.
- **Hand to customer** walks the customer through the three acknowledgements one at a time in
  plain language, taking initials for each, then a finger-drawn signature. The signature is
  stored with the order and printed on the sales sheet.
- **Complete sale** closes the sale and opens the receipt, ready to print or email.

**Sales sheet** (`/receipt/:id`, all roles)
- A reproduction of the CFS sales sheet: masthead and order number, the Sale Date / Organization /
  Advertising Source / Referral Name / CFS Rep Name row, billing and delivery blocks, the product
  grid with blank rows, the comments and payment boxes, the three warranty/drop-ship/advisory
  paragraphs with initials, and the signature and received-by lines.
- The customer's initials and drawn signature are printed in place.
- A sheet for an order that is not completed is stamped NOT COMPLETED (or VOIDED) across the page
  with a banner explaining why, on screen and on paper, so it can never pass for a final sale.
- **Back** returns to wherever the sheet was opened from - the Orders list, the checkout table or
  the event export.
- **Print** makes the same picture-per-page PDF that email sends (below) and prints that, so the
  paper looks the same whichever device printed it. A desktop browser goes straight to its print
  dialog (the PDF is loaded into a hidden frame); a tablet or phone - and Safari, which prints an
  embedded PDF blank - opens the PDF in a new tab to print or share from there. Print-only CSS
  still hides the app chrome if someone prints the page itself with Ctrl+P.
- **Email** (completed sales only) sends the customer the sheet as a PDF attachment, with a
  friendly note: thanks, what happens next (take-home items, drop shipping to their address, how a
  boxed mattress expands, keeping a protector on for the warranty, any balance still owed) and the
  customer service number. The note's wording is set by an administrator under **Settings**. Goes
  to their billing email or any address typed in. Needs the Email settings below.
- The PDF is built in the browser from the sheet on screen (html2canvas-pro + jsPDF, loaded on
  demand), laid out at paper width whatever the device, one sheet per Letter page - the same PDF
  Print uses, so the emailed and printed copies match exactly. Sharpness follows the page count: a single receipt is captured at about
  300 dpi, an event's stack steps down (to about 145 dpi past 30 pages) so it still fits in an
  email, and a PDF that comes out too big is rebuilt a step smaller. The API checks it is a PDF
  under 18 MB, then attaches it.

**Orders** (`/orders`, all roles)
- Every order for the event being worked, filterable by status and searchable by customer, rep or
  order number, with the printable sales sheet one tap away.
- An administrator additionally gets an **All events** tab and a per-event picker, so a past
  fundraiser can be looked back over weeks later.
- An administrator can **Reopen** a completed (or at-checkout) order and send it to the checkout
  table - to fix a payment, initials or signature - or back to the sales floor to change what was
  sold. Payments already recorded stay on the order; a reopened sale leaves the event's totals and
  printed sheets until it is completed again.

**Event sales sheets** (`/events/:id/sheets`, Admin role)
- A filled-in Fundraiser Stat Sheet first, laid out like the paper School Stat Sheet: unit counts, each
  financing, check, layaway and cash sale itemised, and the summary box. As on the paper form,
  AVERAGE SALE is total sales divided by the number of mattresses and adjustable bases.
- Then every completed sales sheet for the event, one per printed page. **Print / Save PDF** builds
  the whole stack as one PDF (showing its progress page by page) and prints it - or, with Save as
  PDF as the printer, saves it. On a tablet the PDF opens in a new tab instead.
  **Download CSV** exports the same sales as a spreadsheet: one row per sale with customer,
  items, totals and each payment method.
- **Email report** sends the whole stack - stat sheet, every completed sales sheet and the
  accessory inventory sheet - as a single PDF to up to 10 addresses, with an optional note.
- Reached from **Sales sheets** on the Events page, or **Print all completed sheets** on Orders.

**Dashboard** (`/dashboard`, all roles)
- The stat sheet, computed live: total and net sales, units by category, mattresses plus
  adjustable bases, average sale, payment breakdown and best sellers. Items that come inside a
  bundle count in their own unit column but are not listed as best sellers - the bundle is.
- Scoped to one event or to a whole day across events. Only completed sales feed the money
  figures; drafts and voided orders are reported separately so nothing is counted twice.

**Admin** (Admin role)
- `/catalog` — products (sorted with the same **Sort** buttons as Add item: name, price or brand,
  categories kept together), their sizes and prices, what each size includes as a bundle, which
  delivery services each offers, sales, and selections:
  - **Sale on every size**: a percent or a fixed amount off each item, for the whole product.
    Each size can follow it, have no sale, or have its own percent or amount, which wins.
    A sale stays on until it is turned off.
  - **Delivery sales**: a delivery option (Catalog -> Delivery) can be on sale - a percent or an
    amount off - and each product can follow that, have none, or set its own for the option.
  - **Selections**: any number of extra picks besides the size (Color, Firmness, anything), each
    with its own list of choices. A choice can add to or take off the price. A selection can be
    optional, and on a tracked product it can **count stock for each choice**, so the Inventory
    screen keeps a count for every size and color combination.
  - **Count in inventory**: on a tracked product, each size can be left out of inventory (for
    example a size that isn't kept at the cart). It isn't counted, doesn't appear on the Inventory
    screen or the inventory sheet, and Take With isn't limited by stock for it.
  - **Financing Options** (a tab beside Delivery): the kinds of financing checkout can pick, in
    the order it lists them. An option can be switched off without deleting it. A financed
    payment stores the type as text, so renaming or deleting an option never changes a past sale.
    Not part of catalog files.
  - **Export catalog / Restore catalog** (system admins only): the whole catalog as a JSON file -
    every product (archived ones too) with sizes, prices, sales, selections, bundles, delivery
    choices, Track inventory and sizes left out of it, plus the delivery options list; no stock counts. Restoring either
    updates matching products and adds new ones, leaving the rest alone, or clears the catalog
    (a permanent delete, sold items included) and rebuilds it from the file. See *Catalog files*
    below.
- `/events` — sales tax rate, card processing fee, order number sequence, active event.
- `/crew` — accounts and roles.
- `/settings` — six cards, each saved on its own:
  - **Business details**: the company name and customer service number printed on every sales
    sheet and in emails, and the app name shown in the menu bar, sign-in screen, browser tab and as
    the email sender.
  - **Sales sheet terms**: the four statements a customer initials (details correct, warranty,
    drop ship, advisory) - a title for the customer's screen, a heading for the sheet and one
    paragraph used in both places, with `**bold**` and `__underline__`. A completed order keeps a
    copy of the wording it was signed with (`Orders.TermsJson`), so a reprint never shows terms the
    customer didn't see; reopening clears the copy. Longer wording scales the printed sheet down so
    it stays on one page.
  - **Receipt email**: the subject and wording, plain text with `{Placeholders}` (`{FirstName}`,
    `{OrderNumber}`, `{CompanyName}`, `{WhatHappensNext}` and so on), a blank line between
    paragraphs, `- ` for bullets, with a live preview for a sample order.
  - **Financing**: whether checkout's financing type dropdown ends with **Other**, for typing in
    a type that isn't a financing option (on by default). With it off, the API only accepts a
    financing option that is offered. A financed payment stores its type in
    `OrderPayments.FinanceType` and the financing number in `OrderPayments.Reference`.
  - **New events**: the sales tax and card processing fee a new event starts with (7% and 2%).
    The API uses them for an event created without rates.
  - **Dashboard**: the net sales for the first star and between stars, and the running-low level
    used by Stock to watch and the Inventory screen.

  Stored in the `AppSettings` table, one row per setting that differs from its default, so an
  untouched setting follows the built-in default. `GET /api/settings/general` is open (the
  sign-in screen needs the app name); everything else is admin-only.

---

## 2. Running it

### In Docker

The app runs as two containers - the app image (the API serving the dashboard, so one port and one
origin) and PostgreSQL - from one `docker-compose.yml`, the same on an x86 PC or server and on a
Raspberry Pi. Put the secrets in a `.env` file next to `docker-compose.yml` first:

```
POSTGRES_PASSWORD=a-long-random-password
JWT_KEY=a-long-random-string-of-at-least-32-characters
```

Then build the image here from source and start both:

```bash
docker compose up -d --build
```

or pull the published image instead (built for amd64 and arm64 by
`.github/workflows/app-image.yml`; set `CFS_IMAGE` in `.env` to use another one):

```bash
docker compose pull && docker compose up -d
```

Then open `http://localhost:8080` (or `http://<this machine's IP>:8080` from a tablet). The first
start takes a few seconds while PostgreSQL initialises; the app then creates its tables and loads
the catalog. The database lives in the `cfs-pgdata` volume and survives restarts, rebuilds and
updates. `docker-compose.pi.yml` simply includes `docker-compose.yml`, so a Pi set up with that file
name carries on unchanged; see [Documents/Raspberry Pi Setup.md](Documents/Raspberry%20Pi%20Setup.md).

To switch on emailed receipts and reports, add SMTP settings to the same `.env` (Gmail needs an
app password):

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURITY=StartTls
EMAIL_USERNAME=you@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=you@gmail.com
```

Emails come from the app name set under **Settings**; add `EMAIL_FROM_NAME=...` only to override
it. If the sending address isn't read (a "noreply" account), add `EMAIL_REPLY_TO=...` with an
address someone does read, so customers' replies reach a person.

If receipts land in customers' spam folders, the sender is usually the cause rather than the
message: a new free Gmail account, especially one called "noreply" and showing a company name,
sending PDFs to people who have never written to it, is what spam looks like. The lasting fix is to
send from the company's own domain (Google Workspace, or a sending service such as Postmark,
Amazon SES or SendGrid) with SPF, DKIM and DMARC set up for that domain; only the `EMAIL_*`
settings change. See [Documents/Raspberry Pi Setup.md](Documents/Raspberry%20Pi%20Setup.md) for the
details.

Locally, the same settings go in the `Email` section of `api/appsettings.local.json`. With no host
set, email stays off and the dashboard says so when the buttons are pressed.

To start without the sample catalog, delivery options and event, add `SKIP_SEED_DATA=true` to the
same `.env` (locally, `Seed:Skip` in `appsettings.local.json`). Without it, the seed refills
anything missing on every start, so sample items deleted on purpose come back. The first sign-in
account (`admin` / `1234`) is still created when the database has no accounts at all, so a new
database is never locked.

### Locally

Prerequisites: .NET 10 SDK, Node 20+, Docker (for PostgreSQL).

```bash
docker compose -f api/docker-compose.yml up -d
```

That starts PostgreSQL 16 on `localhost:5432` with the database, user and password that
`api/appsettings.json` expects (`CfsFundraiser` / `cfs` / `cfs-dev`), keeping its data in the
`cfs-dev-pgdata` volume. `docker compose -f api/docker-compose.yml down -v` starts over with an
empty database. Any other PostgreSQL works too: put its connection string in
`ConnectionStrings:DefaultConnection` in `api/appsettings.local.json`.

```bash
cd api && dotnet run --launch-profile http
```

The API listens on `http://localhost:5046`, applies migrations on startup, and seeds the catalog
from `api/Data/CatalogSeed.json` on first run (unless `Seed:Skip` is set - see above).

```bash
cd dashboard && npm install && npm run dev
```

The SPA listens on `http://localhost:3000` and reads the API URL from `dashboard/.env.local`.

New migrations: `cd api && dotnet ef migrations add Name`. The design-time context points at the
local container; set `CFS_POSTGRES_CONNECTION` to use another server.

### Seeded sign-ins

| Username | PIN | Role |
|---|---|---|
| `admin` | `1234` | Admin |
| `sales` | `1111` | Sales |
| `checkout` | `2222` | Checkout |

**Change these before the app goes anywhere near a real event** (`/crew`), and replace
`Jwt:Key` in `api/appsettings.json` with a long random secret — put it in
`api/appsettings.local.json`, which is gitignored, rather than committing it.

---

## 3. Repo layout

```
Dockerfile                  The app image: API + dashboard (amd64 and arm64)
docker-compose.yml          The app image plus a PostgreSQL container, on port 8080
docker-compose.pi.yml       Includes docker-compose.yml, for Pis set up with this name
docker/pi/                  Raspberry Pi boot, update, backup and reset scripts
.github/workflows/          app-image.yml publishes the image to ghcr.io

api/                        ASP.NET Core 10 Web API (net10.0)
├── Controllers/            One controller per resource, all inheriting BasicController
├── Dtos/                   Request/response shapes; EF models are never exposed directly
├── Models/                 EF entities
├── Data/                   ApplicationDbContext (PostgreSQL), SeedData, CatalogSeed.json
├── Services/               TokenService (JWT, refresh tokens, PIN hashing)
├── Utils/                  BasicController, TraceControl, OrderCalculator
├── Migrations/             PostgreSQL migrations
└── docker-compose.yml      PostgreSQL for local development

dashboard/                  Vite + React 19 + TS SPA
└── src/
    ├── Components/Elements/    Button, Icon, Modal, TextField, StatCard, ...
    ├── Components/Navbar/      Navbar, ThemeToggle, UserProfileDropdown
    ├── Components/{Sales,Checkout,Catalog}/  incl. the customer-facing sheets
    ├── Context/AuthContext.tsx
    ├── Hooks/                  UseTheme.ts, UseLockBodyScroll.ts
    ├── Lib/                    api.ts, ErrorHandler.ts, Toast.ts, ModelHelpers.ts
    ├── Models/                 One type per DTO
    ├── Pages/                  One per route
    ├── Routes/                 Routes.tsx, ProtectedRoute.tsx, HomeRedirect.tsx
    └── Services/               One file per backend controller
```

---

## 4. How the domain is modelled

**A product owns its prices.** `Product` (model name, brand, category) has many `ProductVariant`
rows, each a size plus an optional configuration — `Queen / Mattress Only`, `Queen / Hi-Rise`,
`Queen / IMC61 Adjustable`, `Queen / ES200 Flex Head`. That is exactly how the price cards are
laid out, and it means any product can be given any set of sizes without a schema change.

**A null price means "Inquire."** Where the price card reads Inquire, or where the supplied
documents simply do not give a price, the variant is stored with a null price. The floor shows it
as *Inquire* and makes the rep key a price in. Nothing is ever sold at an invented number.

**Delivery differs per product.** `DeliveryOption` is a shared catalog (Drop Ship, Take With,
White Glove $79, Haul Away $99, Local Delivery). `ProductDeliveryOption` joins a product to the
options it offers and can override the price for that product alone, so a Purple and a Langley can
carry different delivery choices at different prices.

**Shipping is always its own row.** Choosing a shipping method for an item adds a `Delivery`
line under it, whatever it costs, so the sheet always says how each item is leaving - Drop Ship
at $0.00 included. Take With also ticks the Take With box on the item, and removing the Take
With row clears it again. Each delivery option has a **Show on sales sheet** setting (Catalog ->
Delivery): when it is off the row stays on the order and on screen, marked "Not on sales sheet",
but is left off the printed sheet and the CSV. Take With is off by default, since the Take With
column on the item already says it. A row that carries a charge always prints, so the sheet's
subtotal adds up, and the setting is copied onto each row when it is added, so changing it later
never alters a sheet that has already been printed.

**Bundles are real catalog items.** Any size of any product can include one or more other
catalog items at no extra charge (`ProductVariantComponent`). The seeded mattress-and-base sets
are bundles: `Agility 3000 / Queen / IMC61 Adjustable` includes `IMC61 Adjustable Base / Queen`.
In the catalog editor, **Include item** picks the product and size, how many come with each
bundle, and optionally repeats it on every other size of the same configuration by matching
size. Selling a bundle adds an `Included` line per item under it, snapshotting the item's name,
brand, size and category; those lines scale with the bundle's quantity and cannot be edited or
removed on their own. Because the included item keeps its own category, a bundled base counts
as an adjustable base and a bundled pillow as a pillow on the stat sheet, so a set counts as one
mattress *and* one base. A product cannot include itself, and a bundle cannot include another
bundle. Anything sold on its own - including a standalone adjustable base - adds just its own
line.

**Catalog files.** `GET /api/catalog/export` and `POST /api/catalog/import` (system admins only) save
and restore the catalog as JSON (`"format": "cfs-catalog", "version": 1`). Nothing in the file is a
database id: products are matched by brand and name, sizes by size and configuration, and delivery
options, selections and choices by name, so a matched item keeps its id and with it its stock
counts and past sales. Two items with the same name are paired up in order. Bundles name what they
include the same way and are rebuilt after every product is in. `mode: "update"` brings matches in
line with the file and adds the rest; `mode: "replace"` runs `PermanentDelete.CatalogAsync` first.
The file is checked in full and the restore runs in one transaction, so a bad file changes
nothing; anything that can't be brought in (a delivery option or bundled item that doesn't exist)
is left out and listed in the result. `Utils/CatalogTransfer.cs` does the work.

**Lines are snapshots.** Brand, size, description, price and category are copied onto the order
line when it is added. Editing or retiring a catalog product never rewrites a printed receipt. A
product that has already been sold is archived rather than deleted.

**Sales and discounts.** A product can carry a sale (`SaleDiscountPercent` or
`SaleDiscountAmount`), and a size can override it (`HasOwnSale` plus its own pair, where an
override of nothing means that size is not on sale). The sale in force is copied onto the line
when it is added, so ending a sale never changes an order already written. It only applies to
sizes with a catalog price - a keyed-in Inquire price is taken as the price to charge. The rep's
own discount (`DiscountPercent` or `DiscountAmount`, never both) comes off the sale price. A
dollar amount is per item, and nothing ever goes below $0. `OrderCalculator.RecalculateLine`
does the arithmetic.

Shipping rows work the same way. A `DeliveryOption` can carry a sale, and a product's
`ProductDeliveryOption` can override it for that product (`HasOwnSale` plus its own pair).
`Choices.DeliverySaleFor` picks the one in force, and it is copied onto the shipping row when it is
added - with the product's own price for the option - whether the row comes with the item (Add
item) or on its own (Add service). A keyed-in shipping price takes no sale. A rep's discount on
shipping is set afterwards with Edit on the row, and stacks on the sale as an item's does.

**Selections.** `ProductOption` (e.g. Color) has `ProductOptionChoice` rows (Gray, White), each
with an optional price change. The choices picked are stored on the line as JSON (`ChoicesJson`)
and printed after the description, e.g. "Hotel Sheets - Color: Gray". A choice removed from the
catalog is archived, so old lines still read correctly. When a selection **counts stock**, each
size keeps a count per combination of counted choices in `ChoiceStocks`, keyed by a `StockKey`
such as `3:12|4:20` (option id : choice id, ordered by option). The line, the adjustment history
and the inventory count all carry the same key, and the empty key means the size's own
`QuantityOnHand`, as before. `Utils/Choices.cs` resolves picks, builds keys and labels, and
reads and changes counts. Bundled items can have their own selections, which the rep picks when
adding the bundle.

**An event is named by its organization.** A fundraiser is not always at a school, so an event
has one name - the organization running it, e.g. "Hampton Band" - which heads the stat sheet and
is copied onto each order. Only one event is active at a time, and new orders can only be taken
while one is: with no active event the Sell and Checkout screens say so and the API refuses new
orders. Existing orders can still be looked up, and an admin still sees every event's history.

**Rates are snapshots too.** Each order stores the tax rate and card fee rate it was written
under, so changing the rate on an event only affects orders taken from that point on.

**The card fee follows the chosen method, not the recorded payment.** An order carries an
`ApplyCcProcessingFee` flag that the checkout screen sets when Credit/Debit Card is picked and
clears when anything else is. (The stored method is still `VisaMc`, so older orders read
correctly; only the label changed.) Once a card payment is actually keyed in, that amount takes over and caps the
fee at the pre-fee total, so a payment that already includes the fee never compounds it.

**Money is computed in one place.** `Utils/OrderCalculator.cs` recalculates lines and totals on
every mutation, and the API returns the recalculated order. The screen and the receipt read the
same numbers because neither of them does arithmetic.

### Order lifecycle

```
Draft ──Complete──> AwaitingCheckout ──Complete & print──> Completed
  ^                        │
  └────── Send back ───────┘                Void ──> Voided (kept, excluded from totals)
```

Completing with a balance outstanding is allowed — that is how layaway and financing sales are
recorded — and the checkout screen warns when one will remain.

---

## 5. Verification

The pricing was checked against a real sheet. Hampton order **No. 1614** (Therapedic King Agility
3000 at 10% off, White Glove, Haul Away, a King mattress protector taken with) reproduces through
the API to the cent:

| | Paper sheet | App |
|---|---|---|
| Subtotal | $2,526.10 | $2,526.10 |
| Sales tax | $176.83 | $176.83 |
| Total | $2,702.93 | $2,702.93 |
| Balance due | $0.00 | $0.00 |

Run the checks with:

```bash
cd api && dotnet build
```

```bash
cd dashboard && npm run lint && npm run build
```

---

## 6. Seeded catalog, and what still needs prices

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

**Still needs prices before an event** — these are seeded as *Inquire* rather than guessed, so
they are safe to leave but will slow a rep down:

- Mattress protectors in Twin XL and Full.
- Shoulder Carbon Cool, Sub 0 Down Complete, Shattered Ice and Snowflake pillows; King in every
  pillow.
- Sheet sets, bed frames and bean bag chairs (no prices appear in the supplied documents).
- Standalone adjustable bases (the cards only quote them bundled with a mattress).
- Monarch Euro Top, King, ES200 Flex Head — the price is not legible on the supplied card.

Fill them in at `/catalog`.

Two other notes on the source data: the Agility 3000, Agility 5000 and Monarch Euro Top share
identical Hi-Rise prices in the price guide, and the Callista Extra Firm and Callista X Firm rows
are identical throughout. Both are transcribed as printed rather than corrected.

---

## 7. Conventions

Backend: every controller inherits `BasicController` with primary-constructor DI; every action is
wrapped in its own try/catch that traces and returns `{ error, exception }`; actions are grouped
in `#region POST/GET/PATCH/DELETE Methods`; validation is done by hand at the top of each mutating
action; DTO properties are all nullable and EF models are never returned.

Frontend: PascalCase folders and filenames; one service file per controller with
POST/GET/PATCH/DELETE banner comments; services never throw, they call `HandleAxiosError` and
return a safe default; all HTTP goes through `Lib/api.ts` (bearer token + queued refresh
interceptor); Tailwind utilities only with an explicit `dark:` variant on every colour; no
component library; icons only through the local `Icon` wrapper; feedback only through `Toast`.

Tablet-first specifics: controls are at least 48px tall, inputs are 16px so iPad Safari does not
zoom on focus, modals are full-width sheets on a phone and centred cards on a tablet, and the
navbar is a top bar on a tablet and a bottom tab bar on a phone.

---

## 8. Deviations from the blueprint

Three, each deliberate:

1. **One SPA, not two.** The blueprint's `frontend/` is a public guest site; every user here is
   crew, so there is only `dashboard/`.
2. **PIN sign-in instead of Google OAuth.** The blueprint authenticates through Google. Floor
   reps share a tablet at a school gym and often have no Google account on it, so sign-in is a
   username and a numeric keypad. The rest is unchanged: JWT bearer access tokens, opaque
   refresh tokens on the user row, the same `TokenService` shape, and no self-service signup.
3. **Only the FontAwesome solid set is registered.** `library.add(fas, far, fab)` roughly doubles
   the bundle and nothing here uses a regular or brand icon; on venue wifi that is worth the
   deviation.

One lint rule is also turned off beyond the blueprint's two: `react-hooks/set-state-in-effect`,
which rejects fetch-on-mount into `useState` wholesale — the pattern this codebase uses
throughout, having no query library.
