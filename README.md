# BuildStock Ethiopia

Bilingual (English / አማርኛ) inventory, sales and finance platform for multi-branch
construction-material businesses.

- **Backend** — Express + MongoDB (Mongoose), JWT auth, role-based access control, audit trail.
- **Frontend** — React 18 + Vite + Tailwind, react-router, recharts, full EN/አማርኛ i18n.

---

## Configuration

All runtime configuration lives in `server/.env`, which is **not** committed.
The template `server/.env.example` is committed and lists every variable.

```bash
cp server/.env.example server/.env
```

Then set at least:

| Variable | Notes |
| --- | --- |
| `MONGO_URI` | Your MongoDB connection string. Atlas SRV looks like `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/buildstock_ethiopia?authSource=admin&retryWrites=true&w=majority`. |
| `JWT_SECRET` | Random string, 32+ characters. The API refuses to start in production with a short one. |
| `CORS_ORIGINS` | Comma-separated list of allowed client origins. |
| `SEED_OWNER_PASSWORD` | Password for the owner account created by `npm run seed`. Change it before any shared deployment. |

`server/.env`, `server/uploads/`, `client/dist/` and `node_modules/` are all
excluded by `.gitignore` — never commit real credentials or user uploads.

---

## Quick start

Two terminals.

### 1. API (port 5000)

```bash
cd server
npm install
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm run dev:seeded        # seeds a demo dataset and starts the API
```

Other server scripts:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start with nodemon (no data) |
| `npm start` | Start the API |
| `npm run dev:seeded` | Seed demo data, then start the API |
| `npm run seed` | Seed only (add `-- --force` to wipe and reseed) |
| `npm run smoke` | Boot the API in-process and verify every endpoint the UI uses |

### 2. Client (port 5173)

```bash
cd client
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` and `/uploads`
to `http://localhost:5000`.

Production build: `npm run build` (output in `client/dist`).

Client checks:

| Script | Purpose |
| --- | --- |
| `npm run build` | Production build |
| `npm run smoke` | Run all client checks below |
| `npm run smoke:forms` | Verify the form-control `onChange` contract and scan for missing React hook imports |
| `npm run smoke:contrast` | Verify every colour pair meets its WCAG contrast target |
| `npm run smoke:render` | Server-render every page and fail on runtime errors |

---

## Database

`server/.env` points at `MONGO_URI=mongodb://127.0.0.1:27017/buildstock_ethiopia`.

If MongoDB is not reachable and `USE_MEMORY_DB_FALLBACK=true`, the API starts an
ephemeral in-memory MongoDB instead. **Data is not persisted in that mode** — install
MongoDB and set `MONGO_URI` for real use, or set `USE_MEMORY_DB_FALLBACK=false` so the
API fails loudly rather than silently losing data.

Before deploying, replace `JWT_SECRET` in `.env` with a random 32+ character string.

### CORS

`CORS_ORIGINS` lists the browser origins allowed to call the API. In development
`CORS_ALLOW_LOOPBACK=true` additionally accepts **any** `localhost` / `127.0.0.1`
port, so Vite keeps working when it falls back to another port (5174, 4173, ...).
A rejected origin now returns a clear `403 FORBIDDEN_ORIGIN` naming the allowed
origins instead of a generic server error.

Set `CORS_ALLOW_LOOPBACK=false` and list every real origin in `CORS_ORIGINS`
before deploying.

---

## Seeded accounts

All seeded users use the password `BuildStock@2024`.

| Role | Email | Can do |
| --- | --- | --- |
| Owner / Administrator | `owner@buildstock.et` | Everything, including settings, users, audit |
| Manager | `manager@buildstock.et` | Inventory and daily operations, approvals |
| Sales Clerk | `clerk@buildstock.et` | Sales invoices and receipts |
| Storekeeper | `storekeeper@buildstock.et` | Receiving and warehouse records |
| Accountant | `accountant@buildstock.et` | Expenses, receivables, payables, financial reports |

The sign-in screen offers a one-time owner setup when no account exists yet.

---

## Features

**Inventory** — products, categories, units of measure (with same-dimension
conversion), per-branch stock positions, full stock ledger, manual stock in/out,
branch-to-branch transfers, weighted-average costing.

**Sales** — invoices with per-line discounts and tax, credit-limit checks, cash and
credit sales, cancellations that return stock, sales returns, printable invoice view.

**Purchases** — purchase orders, goods receipt (stock only increases on receipt),
supplier payments, purchase returns, low-stock suggested order builder.

**Parties** — customers and suppliers with live balances, account statements and
receipt/payment recording.

**Finance** — expenses by category, customer receipts and supplier payments, 17
reports (sales, purchase, stock, inventory valuation, customer debt, supplier
payable, gross profit, net operating profit, expense, product movement, employee
transactions, branch comparison) with CSV export.

**Administration** — branches, users and roles, business settings (branding, tax,
numbering formats, defaults), audit trail of every sensitive action.

---

## Domain rules enforced by the API

- Stock is only changed through atomic aggregation-pipeline updates; each branch's
  `ProductStock` row is the source of truth, product totals are recalculated from it.
- Purchases do not affect stock until goods are received.
- Failed stock transfers and later sale-line failures trigger compensating reversals.
- `clientKey` on sales and purchases makes a resubmitted invoice idempotent.
- Discounts above `DISCOUNT_APPROVAL_THRESHOLD_PERCENT` (default 15) need owner/manager.
- Financial reports and money screens are limited to owner, manager and accountant.
- Currency is ETB, business timezone is `Africa/Addis_Ababa`, and dates can be shown
  in the Ethiopian calendar.

---

## Colour system

Every colour lives in `client/src/lib/palette.js`, which is the single source of
truth: `tailwind.config.js` feeds it into Tailwind, and `client/src/lib/colors.js`
derives the chart and swatch colours from it.

| Family | Purpose |
| --- | --- |
| `navy` 50–950 | Sidebar, headers and dark chrome |
| `brand` 50–900 | Primary actions, links, active nav |
| `cyan` 50–900 | Secondary accent |
| `success` / `warning` / `danger` 50–900 | State colours |
| `ink` DEFAULT, 50–900, `muted`, `faint` | Text, borders, subtle surfaces |
| `line`, `canvas` | Hairline borders, page background |

Rules the palette follows:

- No raw Tailwind colours (`red-50`, `emerald-600`, `slate-100`, …) are used in
  the app — everything resolves to a token above.
- Text passes WCAG AA (4.5:1). The lightest step of each state family that
  stays AA as small text is `700`; `500`/`600` are for fills and icons.
- `success`, `warning` and `danger` are used as `bg-<family>-50` with
  `text-<family>-700` for badges and alerts, and `bg-<family>-600/700` with
  white text for solid buttons.
- `ink-muted` is secondary text, `ink-faint` is the lightest step that still
  passes AA (5.4:1) — use it for placeholders, hints and metadata.
- `npm run smoke:contrast` fails the build if any of these pairs regress.
- Changing `src/lib/palette.js` changes the Tailwind config, so **restart the
  client dev server** (`npm run dev`) for the new tokens to take effect.

## Layout

```
server/
  src/
    config/      env, db connection, permissions
    models/      Mongoose models
    services/    inventory, sales, purchases, parties, reports, dashboard, settings, audit
    routes/      REST endpoints
    middleware/  auth, RBAC, validation, uploads, errors
    utils/       seed, CSV, date helpers
  scripts/smoke.js
client/
  src/
    components/  ui primitives, forms, tables, overlays, layout, pickers
    context/     auth + app state
    i18n/        en.js, am.js
    lib/         api client, formatting, form helpers
    pages/       one file per screen
  scripts/       form + render smoke tests
```

## Form controls

`Input`, `Select` and `Textarea` call `onChange` with the DOM event;
`Checkbox`, `Toggle` and `SearchInput` call it with the plain value. Use
`fieldValue` from `client/src/lib/form.js` inside a shared `update(key)`
handler so the same handler works with any control:

```js
const update = (key) => (input) => {
  setForm((prev) => ({ ...prev, [key]: fieldValue(input) }));
};
```

## API overview

All routes are under `/api` and require `Authorization: Bearer <token>` except
`/api/health`, `/api/auth/setup-status`, `/api/auth/setup`, `/api/auth/login` and
`/api/settings/branding`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/setup`, `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password` |
| Products | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, `/products/categories`, `/products/units`, `/products/units/convert`, `/products/alerts/low-stock` |
| Branches | `GET/POST /branches`, `PATCH/DELETE /branches/:id` |
| Customers | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id`, `GET /customers/:id/statement` |
| Suppliers | `GET/POST /suppliers`, `GET/PATCH/DELETE /suppliers/:id`, `GET /suppliers/:id/statement` |
| Sales | `GET/POST /sales`, `POST /sales/quote`, `GET /sales/:id`, `GET /sales/:id/print`, `POST /sales/:id/cancel`, `POST /sales/:id/return` |
| Purchases | `GET/POST /purchases`, `GET /purchases/low-stock-order`, `POST /purchases/:id/receive`, `/payment`, `/cancel`, `/return` |
| Stock | `GET /stock/positions`, `GET /stock/ledger`, `GET /stock/transfers`, `POST /stock/in`, `/stock/out`, `/stock/transfer` |
| Money | `GET/POST /payments`, `DELETE /payments/:id`, `GET/POST /expenses`, `PATCH/DELETE /expenses/:id` |
| Dashboard | `GET /dashboard`, `GET /dashboard/branches` |
| Reports | `GET /reports`, `GET /reports/:type`, `GET /reports/:type/export` |
| Settings | `GET /settings`, `PUT /settings`, `POST /settings/logo`, `GET /settings/branding` |
| Users | `GET/POST /users`, `PATCH/DELETE /users/:id`, `GET /users/roles` |
| Audit | `GET /audit` |
#   I n v e n t o r y M a n a g e m e n t  
 