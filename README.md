# Naija Sweet Rice: Flagship E-commerce Store (Abuja)

Online store for the Naija Sweet Rice brand: 50kg, 25kg, 5kg and 1kg bags, delivery across Abuja and
nearby towns, purchase points → discount coupons, bag-replacement returns.

- **Plan & roadmap:** [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md)
- **Distributor network:** [docs/DISTRIBUTOR_NETWORK_PLAN.md](docs/DISTRIBUTOR_NETWORK_PLAN.md)
- **Going live (step by step):** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Stack:** Next.js 16 (React 19, App Router, Cache Components) · TypeScript · Tailwind CSS 4 · PostgreSQL + Prisma · Vitest

## Run it locally

Requirements: Node 22+, PostgreSQL 16.

```bash
cp .env.example .env      # then fill in DATABASE_URL, SESSION_SECRET, HQ_OWNER_PHONES
npm install
npm run db:migrate        # create tables
npm run db:seed           # bag sizes + delivery zones (prices start empty)
npm run dev               # http://localhost:3000
```

Customers pay by **bank transfer** to the seller for their area (a distributor, or HQ). SMS (Termii) is used for login
codes, customer messages and the bank-change security alert; staff alerts go to Telegram and/or email (free). Without
the provider keys, local development shows the login code on screen and prints messages to the server log.

Staff screens live at **/ops**: HQ staff sign in with their own phone number (owners come from `HQ_OWNER_PHONES`; owners add the rest under **HQ team**). Distributors use **/partner** (phone sign-in; HQ adds their number in `/ops/distributors`).

- **/ops/distributors**: add distributors, set their bank account (HQ only), areas, logins, send stock, approve stock adjustments, see their month.
- **/ops/restocks**: distributor stock requests: invoice, confirm payment, dispatch.
- **/ops/statements**: close a month per distributor and mark statements settled.

- **/ops/orders**: move paid orders to preparing → out for delivery (with rider) → delivered. Each change texts the customer.
- **/ops/returns**: review bag-replacement requests with photos; approving creates a free replacement order.
- **/ops/partners**: approve sellers (wholesale prices) and affiliates.
- **/ops/promotions**: publish promotions and coupon codes with start/end dates.
- **/ops/reports**: sales, orders, kg sold, sample conversion, by size/area/channel/affiliate.

Housekeeping runs from `/api/cron/release-reservations` (call every ~10 minutes with
`Authorization: Bearer $CRON_SECRET`): frees stock from unpaid orders, confirms points after the
return window, expires year-old points, sends sample follow-up coupons and payment reminders, and syncs the
Google stock depletion sheet (when configured).
- **/ops/prices**: set retail, wholesale and "was" (promo) prices, plus stock, per bag size. Every change is logged.
- **/ops/zones**: delivery fees per area, and minimum orders (MOQ) for nearby towns.

Price edits show on the shop immediately: catalogue pages are cached and the cache is refreshed on save.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests (pricing, coupons, MOQ, points, return window, phone numbers, network routing, statements) |
| `npm run e2e` | Browser tests on a phone-sized screen: shopping, distributor orders and restocks, HQ team, alerts, replacements. Uses a separate `nsr_e2e` database (create it once: `createdb -U nsr nsr_e2e`), or set `E2E_DATABASE_URL` |
| `npm run typecheck` | Generate route types and run the TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` | Production build (needs a reachable database: pages are prerendered from it) |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrations (dev / production) and seed |

## Project layout

```
prisma/schema.prisma      Database schema (money stored as integer kobo)
prisma/seed.ts            Bag sizes, flagship pickup, Abuja districts, nearby towns
src/lib/pricing.ts        Server-side order quote: prices, delivery fee, MOQ, coupons
src/lib/rewards.ts        Purchase / referral / affiliate points → coupon tiers
src/lib/catalogue.ts      Cached catalogue reads ("use cache" + tags)
src/lib/orders.ts         Order creation, stock holds, payment confirmation (idempotent)
src/lib/paystack.ts       Paystack API; webhook at src/app/api/webhooks/paystack
src/lib/auth.ts, otp.ts   Phone + SMS-code sign-in, sessions
src/lib/ops-auth.ts       Temporary staff sign-in for /ops
src/app/                  Pages (shop, product, delivery, returns, promotions, ops)
tests/                    Vitest unit tests
```
