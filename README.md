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
- Items are added from the catalog: pick a category, a product, a size/configuration, and a
  delivery method. Quantity, percentage discount and a price override for "Inquire" sizes are all
  on the same screen.
- A second in-home service (White Glove *and* Haul Away, as on the paper sheets) is attached to a
  line with **Add service**.
- **Hand tablet to customer** opens a plain-language, oversized form for the customer to type
  their own address and the name of whoever referred them. No prices, no line items and no
  navigation are on screen while they have it.
- Pressing **Complete** hands the order to the checkout table.

**Checkout table** (`/checkout`, Checkout role)
- A queue of orders the floor has handed over, oldest first, with how long each customer has been
  waiting. It refreshes itself every 8 seconds.
- Items can still be added, edited and removed here, exactly as on the floor - a forgotten
  protector does not mean sending the customer back across the room.
- Takes payment split across Visa/MC, cash, check, financing and layaway. Choosing Visa/MC puts
  the card processing fee on the total straight away; switching to another method takes it back
  off, so the figure quoted is the figure charged.
- **Hand to customer** walks the customer through the three acknowledgements one at a time in
  plain language, taking initials for each, then a finger-drawn signature. The signature is
  stored with the order and printed on the sales sheet.
- **Complete & print** closes the sale and opens the receipt.

**Sales sheet** (`/receipt/:id`, all roles)
- A reproduction of the CFS sales sheet: masthead and order number, the Sale Date / Organization /
  Advertising Source / Referral Name / CFS Rep Name row, billing and delivery blocks, the product
  grid with blank rows, the comments and payment boxes, the three warranty/drop-ship/advisory
  paragraphs with initials, and the signature and received-by lines.
- The customer's initials and drawn signature are printed in place.
- Print-only CSS hides the app chrome, so the paper copy is just the sheet.

**Orders** (`/orders`, all roles)
- Every order for the event being worked, filterable by status and searchable by customer, rep or
  order number, with the printable sales sheet one tap away.
- An administrator additionally gets an **All events** tab and a per-event picker, so a past
  fundraiser can be looked back over weeks later.

**Dashboard** (`/dashboard`, all roles)
- The School Stat Sheet, computed live: total and net sales, units by category, mattresses plus
  adjustable bases, average sale, payment breakdown, best sellers and per-rep totals.
- Scoped to one event or to a whole day across events. Only completed sales feed the money
  figures; drafts and voided orders are reported separately so nothing is counted twice.

**Admin** (Admin role)
- `/catalog` — products, their sizes and prices, and which delivery services each offers.
- `/events` — sales tax rate, card processing fee, order number sequence, active event.
- `/crew` — accounts and roles.

---

## 2. Running it

Prerequisites: .NET 10 SDK, Node 20+, SQL Server (LocalDB is fine).

```bash
cd api && dotnet run --launch-profile http
```

The API listens on `http://localhost:5046`, applies migrations on startup, and seeds the catalog
from `api/Data/CatalogSeed.json` on first run.

```bash
cd dashboard && npm install && npm run dev
```

The SPA listens on `http://localhost:3000` and reads the API URL from `dashboard/.env.local`.

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
api/                        ASP.NET Core 10 Web API (net10.0)
├── Controllers/            One controller per resource, all inheriting BasicController
├── Dtos/                   Request/response shapes; EF models are never exposed directly
├── Models/                 EF entities
├── Data/                   ApplicationDbContext, SeedData, CatalogSeed.json
├── Services/               TokenService (JWT, refresh tokens, PIN hashing)
├── Utils/                  BasicController, TraceControl, OrderCalculator
└── Migrations/

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

**Adjustable bases are counted twice, on purpose.** The stat sheet tallies mattresses and
adjustable bases in separate columns, but the price cards sell them as a set on one line. A
variant carries `IncludesAdjustableBase`, so a `Queen / IMC61 Adjustable` line counts as one
mattress *and* one base — the way the crew tallies it on paper.

**Lines are snapshots.** Brand, size, description, price and category are copied onto the order
line when it is added. Editing or retiring a catalog product never rewrites a printed receipt. A
product that has already been sold is archived rather than deleted.

**Rates are snapshots too.** Each order stores the tax rate and card fee rate it was written
under, so changing the rate on an event only affects orders taken from that point on.

**The card fee follows the chosen method, not the recorded payment.** An order carries an
`ApplyCcProcessingFee` flag that the checkout screen sets when Visa/MC is picked and clears when
anything else is. Once a card payment is actually keyed in, that amount takes over and caps the
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
