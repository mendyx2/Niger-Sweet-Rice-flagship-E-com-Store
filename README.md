# Naija Sweet Rice: Flagship E-commerce Store (Abuja)

Online store for the Naija Sweet Rice brand: 50kg, 25kg, 5kg and 1kg bags, delivery across Abuja and
nearby towns, purchase points → discount coupons, bag-replacement returns.

- **Plan & roadmap:** [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md)
- **Stack:** Next.js 16 (React 19, App Router, Cache Components) · TypeScript · Tailwind CSS 4 · PostgreSQL + Prisma · Vitest

## Run it locally

Requirements: Node 22+, PostgreSQL 16.

```bash
cp .env.example .env      # then fill in DATABASE_URL, OPS_PASSWORD, SESSION_SECRET
npm install
npm run db:migrate        # create tables
npm run db:seed           # bag sizes + delivery zones (prices start empty)
npm run dev               # http://localhost:3000
```

Without `PAYSTACK_SECRET_KEY` and `TERMII_API_KEY`, local development shows the SMS login code on screen and
uses a "simulate payment" page, so the whole buying flow can be tested. Production refuses both shortcuts.

Staff screens live at **/ops** (sign in with `OPS_PASSWORD`):

- **/ops/orders**: move paid orders to preparing → out for delivery (with rider) → delivered. Each change texts the customer.
- **/ops/returns**: review bag-replacement requests with photos; approving creates a free replacement order.
- **/ops/partners**: approve sellers (wholesale prices) and affiliates.
- **/ops/promotions**: publish promotions and coupon codes with start/end dates.
- **/ops/reports**: sales, orders, kg sold, sample conversion, by size/area/channel/affiliate.

Housekeeping runs from `/api/cron/release-reservations` (call every ~10 minutes with
`Authorization: Bearer $CRON_SECRET`): frees stock from unpaid orders, confirms points after the
return window, expires year-old points and sends sample follow-up coupons.
- **/ops/prices**: set retail, wholesale and "was" (promo) prices, plus stock, per bag size. Every change is logged.
- **/ops/zones**: delivery fees per area, and minimum orders (MOQ) for nearby towns.

Price edits show on the shop immediately: catalogue pages are cached and the cache is refreshed on save.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests (pricing, coupons, MOQ, points, return window, phone numbers, Paystack signatures) |
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
