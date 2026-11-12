# Niger Sweet Rice: Flagship E-commerce Store (Abuja)

Online store for the Niger Sweet Rice brand: 50kg, 25kg, 5kg and 1kg bags, delivery across Abuja and
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

Staff screens live at **/ops** (sign in with `OPS_PASSWORD`):

- **/ops/prices**: set retail, wholesale and "was" (promo) prices, plus stock, per bag size. Every change is logged.
- **/ops/zones**: delivery fees per area, and minimum orders (MOQ) for nearby towns.

Price edits show on the shop immediately: catalogue pages are cached and the cache is refreshed on save.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests (pricing, coupons, MOQ, points, return window) |
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
src/lib/ops-auth.ts       Temporary staff sign-in for /ops
src/app/                  Pages (shop, product, delivery, returns, promotions, ops)
tests/                    Vitest unit tests
```
