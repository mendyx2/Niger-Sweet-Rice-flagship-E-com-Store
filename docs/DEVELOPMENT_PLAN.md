# Niger Sweet Rice: Flagship Store, Abuja. Development Plan

This plan turns the rough brief into a buildable spec: scope, architecture, data model, pages, APIs, and a phased delivery schedule. Anything marked **[ASSUMPTION]** is a reasonable default. Confirm or change it before the phase that depends on it. Open questions are collected in §12.

---

## 0. Decisions confirmed (12 Nov 2026)

| # | Question | Decision | Effect on the build |
|---|---|---|---|
| 1 | Bag sizes | **50kg, 25kg, 5kg, 1kg.** Prices to be set later | Prices start empty ("Price coming soon"). Staff set them in **/ops/prices** with no code change, and every change is logged |
| 2 | Back office | **A small `/ops` staff screen is OK** | `/ops` holds prices & stock and delivery zones now; orders, approvals and returns come in later phases |
| 3 | Affiliate rewards | **Coupons only: purchase points and discount offers.** No cash commission | Everyone (buyers, referrers, affiliates) earns points that convert into coupons. No payouts, no wallet |
| 4 | Pay on delivery | **No, not for now** | Paystack prepaid only |
| 5 | Nearby towns | **Yes, subject to terms such as a minimum order (MOQ)** | Zones for Suleja, Madalla, Zuba, Mararaba, Nyanya, Karu, Masaka, Kuje, Bwari, with a minimum order (default 50kg, editable per town) checked at checkout |
| 6 | Returns | **48 hours from delivery; the brand pays for retrieval** | Replacement claims close 48h after delivery. Collection and redelivery are free to the customer |

Where the sections below still say "[DECISION NEEDED]" or "[ASSUMPTION]" for these items, this table overrides them.

---

## 1. The brief, interpreted

| Rough note | What we will build |
|---|---|
| E-commerce store, flagship in Abuja | A public storefront for the brand, with Abuja as the primary delivery zone and the physical flagship as a pickup point |
| Login for buyers | Accounts using phone number + OTP (main method) or email + password. Guest checkout is also allowed so we don't lose sales |
| No back office or wallet | **No custom-built admin system** and **no stored-money wallet**. Staff manage products and content in a hosted CMS, payments and refunds in the Paystack dashboard, and orders in a small internal screen with limited roles (see §4.3) **[ASSUMPTION]** |
| Purchase of rice | Catalogue → cart → checkout → card / bank transfer / USSD payment through Paystack (Flutterwave as a fallback) |
| Affiliates for products | Approved affiliates get a unique link and code for each product. Sales through those links earn them points or commission |
| Referral points → coupons | Every user has a referral code. Qualifying referred purchases earn points, and points convert to coupons at set thresholds |
| Register to sell, buy | Two kinds of registration: **Buyer** (instant) and **Seller/Reseller** (application → approval, wholesale pricing, bulk ordering) |
| Local SEO Abuja | Server-rendered pages, LocalBusiness schema, Google Business Profile, area landing pages (Wuse, Garki, Maitama, Gwarinpa, Kubwa, Lugbe…) |
| All available kgs | Each product has size variants (e.g. 5kg, 10kg, 25kg, 50kg **[ASSUMPTION, to confirm]**), each with its own price, stock and SKU |
| Return policy: bag replacement | Claims are for **replacement only, not refunds**: damaged, torn or wrong bag, reported with photos within N days of delivery |
| Tracking of delivery | Order status timeline plus a public tracking page (order no. + phone), with SMS and WhatsApp updates at each stage |
| Promotionals page | `/promotions`: active offers, bundles, seasonal campaigns and coupon codes, all managed in the CMS |
| Free samples incur delivery cost | Samples cost ₦0, but the customer pays delivery at checkout. Limited to one per customer / phone / address |
| Caching | CDN + static generation for catalogue pages, Redis for sessions, carts and rate limits, plus HTTP caching headers |
| User tracking | GA4 + Meta Pixel + server-side conversion events, behind a cookie consent that complies with the NDPA 2023 |
| Security | OWASP Top 10 hardening, verified payment webhooks, rate limiting, secrets management, data protection compliance |

---

## 2. Recommended tech stack

You asked for a React app. I recommend **Next.js (a React framework)** over a plain React single-page app, mainly because of **local SEO**. A plain React SPA sends Google an empty page that only fills in with JavaScript. Next.js renders real HTML on the server, so product and area pages index properly and load fast on mobile data. It is still React all the way through.

| Layer | Choice | Why |
|---|---|---|
| Frontend + web server | **Next.js 15 (App Router) + TypeScript** | Server rendering for SEO, React components, built-in image optimisation |
| Styling | Tailwind CSS + shadcn/ui | Fast to build, consistent, accessible components |
| Client data | TanStack Query + Zustand (cart) | Caching on the client, optimistic cart updates |
| Forms / validation | React Hook Form + Zod (Zod reused on the server) | One schema validates on both client and server |
| API | Next.js Route Handlers / Server Actions (moves to a separate NestJS service later only if needed) | One codebase and one deploy at launch |
| Database | **PostgreSQL** (Neon / Supabase / RDS) | Relational data: orders, points ledger, inventory |
| ORM | Prisma | Type-safe queries, migrations |
| Cache / queues | **Redis** (Upstash) + BullMQ | Sessions, carts, rate limits, background jobs (SMS, emails, point awards) |
| Content (CMS) | **Sanity** or Strapi | Products, promotions, banners, blog and area pages, edited by staff without code |
| Payments | **Paystack** (primary), Flutterwave (fallback) | Nigerian cards, bank transfer, USSD; strong dashboard for refunds |
| SMS / OTP | Termii (or Africa's Talking) | Nigerian SMS delivery, DND-safe OTP route |
| WhatsApp updates | WhatsApp Business Cloud API | Order and delivery notifications people actually read |
| Email | Resend / Postmark | Receipts, account emails |
| Delivery | In-house riders in Abuja + integration with **Kwik / GIG Logistics** for overflow and outside Abuja | Tracking IDs feed the order timeline |
| Media | Cloudinary or Next/Image + S3 | Product photos, return-claim photo uploads |
| Hosting | **Vercel** (app) + Neon (DB) + Upstash (Redis) | Managed, autoscaling, global CDN. A VPS/Docker option is in §10 |
| Monitoring | Sentry + Vercel Analytics + uptime checks | Errors, performance, alerts |
| Analytics | GA4, Meta Pixel, Meta Conversions API, Microsoft Clarity (heatmaps) | Marketing attribution and behaviour insight |

---

## 3. User roles

| Role | How they get it | What they can do |
|---|---|---|
| **Guest** | none | Browse, add to cart, check out as a guest, track an order, request a sample |
| **Buyer** | Sign up with phone OTP or email | All of the above + order history, saved addresses, referral code, points, coupons, return claims |
| **Seller / Reseller** | Apply (business name, CAC no. optional, address, expected monthly volume) → staff approve | Wholesale price list, minimum order quantities, bulk/repeat orders, invoices |
| **Affiliate** | Apply → staff approve (any buyer can apply) | Affiliate links and codes per product, click and conversion stats, earnings |
| **Staff: Fulfilment** | Created by owner | Update order and delivery status, assign riders, process return claims |
| **Staff: Owner** | Seeded | Approve sellers and affiliates, set point rules, view reports. Products and promos are edited in the CMS |

---

## 4. Feature specification

### 4.1 Catalogue and product variants
- Product = rice line (e.g. *Niger Sweet Rice Premium Parboiled*). Variant = bag size.
- Each variant has: `sizeKg`, `sku`, `retailPrice`, `wholesalePrice`, `compareAtPrice` (for promos), `stockQty`, `weightForDelivery`.
- The product page shows a size selector with a per-kg price ("₦X/kg") so buyers can compare sizes. It shows "Low stock" below a threshold and "Notify me" when out of stock.
- Structured data: `Product`, `Offer`, `AggregateRating` JSON-LD on every product page.

### 4.2 Accounts and registration
- **Phone + OTP is the main login.** It suits Nigerian shoppers better than passwords. Email + password is optional.
- Sessions: httpOnly, Secure, SameSite=Lax cookies, with sessions stored in Redis. No tokens in localStorage.
- Registration flow: "I want to **Buy**" (instant) or "I want to **Sell/Resell**" (form → pending → approved by email/SMS).
- Account pages: profile, addresses (Abuja area dropdown + landmark field, since street addresses are often vague), orders, points & coupons, referrals, returns.

### 4.3 "No back office": how operations still work
To keep to "no back office", we **don't build a full admin system**. Instead:
- **Products, prices, promotions, banners, area pages** → the hosted CMS (Sanity Studio). Staff log in there.
- **Payments, refunds, settlements** → the Paystack dashboard.
- **Orders and deliveries** → one small protected `/ops` screen (order list, change status, assign rider, approve sellers/affiliates, review return claims). Without it, someone has to update delivery tracking by hand in the database, and that won't work day to day.
- **No wallet:** we never hold customer money as a balance. Rewards are **coupons only** (see 4.5). Affiliate cash payouts, if wanted, are paid out monthly by bank transfer from Paystack and are not shown as a spendable balance. **[ASSUMPTION]**

If "no back office" means no `/ops` screen at all, the fallback is to update order status through the CMS or a shared Google Sheet synced by a scheduled job. It is workable, but more error-prone.

### 4.4 Cart, checkout and payment
1. Cart (saved in Redis for logged-in users, localStorage for guests, merged at login).
2. Delivery details → **delivery zone** (Abuja areas priced by zone, with flagship store pickup = ₦0).
3. Delivery fee is calculated on the server from zone + total weight.
4. Apply a coupon (referral, promo or affiliate code). Validated on the server.
5. Pay with Paystack inline (card / transfer / USSD). The order is created as `PENDING_PAYMENT`.
6. **Payment is confirmed only by the Paystack webhook** (signature verified) **plus a server-side verify call.** The browser redirect alone never marks an order as paid.
7. Confirmation page + SMS/WhatsApp + email receipt.
8. Stock is reserved when payment starts and released after 30 minutes if unpaid (BullMQ job).

Pay-on-delivery: **[DECISION NEEDED]**. Common in Nigeria, but it carries fraud and logistics risk. If you want it, I suggest it only for verified repeat buyers inside Abuja.

### 4.5 Referral points → coupons
- Every buyer gets a referral code/link: `nigersweetrice.ng/r/AMINA25`.
- The referred friend gets a first-order discount (e.g. 5% off, capped).
- The referrer earns **points** when the referred order is **delivered and the return window has closed** (this stops self-referral abuse and returns gaming).
- Example rules (editable by the owner, stored in the DB):
  - 1 point per ₦100 of referred order value, and 50 bonus points for a referred friend's first order.
  - **500 pts → ₦2,000 coupon**, **1,000 pts → ₦5,000 coupon**, **2,500 pts → free 10kg bag coupon**.
- Points are recorded in an **append-only ledger** (`PointsTransaction`). The balance is always the sum of the ledger, never a field someone can edit. Points expire after 12 months.
- Abuse controls: no self-referral (same phone, device fingerprint, address or payment card), daily earning cap, manual review above a threshold.
- Coupons are single-use, tied to the user, with an expiry date and a minimum order value.

### 4.6 Affiliates
- Affiliate application → approval.
- Per-product links: `/p/premium-parboiled?aff=ABC123`. The attribution cookie lasts 30 days, with last-click attribution.
- Affiliate dashboard: clicks, orders, conversion rate, earned points/commission, pending vs confirmed.
- Earnings are confirmed only after delivery + return window (same rule as referrals).
- Reward is either **points → coupons** (no cash, no wallet) or **% commission paid monthly by transfer**. **[DECISION NEEDED]**
- Marketing kit: product images, captions and WhatsApp share buttons with the link pre-filled.

### 4.7 Free samples
- `/samples`: request a small sample pack (e.g. 1kg / 500g **[ASSUMPTION]**).
- Price ₦0, **delivery fee charged through Paystack** (or ₦0 if collected from the flagship store).
- Limit one per phone number + address + device. Requires a phone OTP login.
- Flow: the sample request becomes a normal order with `type = SAMPLE`, so it uses the same tracking and analytics. A follow-up coupon is sent 3 days after delivery to turn samplers into buyers.

### 4.8 Delivery tracking
- Order statuses: `PENDING_PAYMENT → PAID → PROCESSING → READY_FOR_PICKUP | OUT_FOR_DELIVERY → DELIVERED`, plus `CANCELLED`, `FAILED_DELIVERY`.
- Each change is recorded in `OrderStatusEvent` (timestamp, who, note), which drives the timeline UI.
- Public page `/track`: order number + phone → timeline, rider name and phone when out for delivery, expected time window.
- Third-party couriers (Kwik/GIG): we store their tracking ID and pull status by webhook or polling.
- Notifications at each step: SMS + WhatsApp + email.

### 4.8b Return policy: bag replacement
- Policy page `/returns-policy`: replacement only, for bags that arrive **torn, tampered with, water-damaged, underweight, or the wrong size**, reported within **48 hours of delivery** with photos **[ASSUMPTION: confirm window]**.
- `/account/returns/new`: choose order and bag, reason, upload photos (max 5, scanned for type and size), description.
- Statuses: `SUBMITTED → UNDER_REVIEW → APPROVED → REPLACEMENT_SCHEDULED → COMPLETED` or `REJECTED` (with reason).
- An approved claim creates a ₦0 replacement order linked to the original, delivered free, and tracked the same way.
- An open claim on an order puts its referral/affiliate points on hold.

### 4.9 Promotions page
- `/promotions`: hero banners, time-limited deals with countdowns, bundles (e.g. "2 × 25kg"), seasonal campaigns (Ramadan, Christmas, Sallah), and public coupon codes.
- Entirely CMS-driven, with start/end dates, so staff can schedule campaigns ahead of time.
- Each promotion has its own SEO-friendly URL so it can be shared on WhatsApp and Instagram.

---

## 5. Local SEO: Abuja

**Technical**
- Server-rendered/static pages, a clean URL structure, `sitemap.xml`, `robots.txt`, canonical tags, Open Graph tags for WhatsApp previews.
- Core Web Vitals target: LCP < 2.5s on a mid-range Android over 4G. Images served as AVIF/WebP at responsive sizes.
- JSON-LD: `Organization`, `LocalBusiness`/`GroceryStore` (flagship address, geo coordinates, opening hours, phone), `Product`, `BreadcrumbList`, `FAQPage`.

**Local**
- Claim and fill out a **Google Business Profile** for the flagship: photos, hours, products, and a link to the site. Ask customers for reviews after delivery (link in the delivery SMS).
- Area landing pages: `/delivery/abuja/wuse`, `/garki`, `/maitama`, `/asokoro`, `/gwarinpa`, `/kubwa`, `/lugbe`, `/jabi`, `/life-camp`, `/apo`, `/lokogoma` and so on. Each has real content: delivery fee, typical delivery time, nearby landmarks. No duplicate filler text.
- Use the same Name, Address and Phone everywhere (site footer, Google profile, Facebook, Instagram, Nigerian directories such as VConnect and BusinessList.ng).
- Content: a "Where to buy rice in Abuja" page, recipe blog (jollof, fried rice, tuwo shinkafa), and a bag-size buying guide ("How long does a 50kg bag last a family of 6?").
- Target keywords: "buy rice in Abuja", "50kg bag of rice price Abuja", "rice delivery Abuja", "Niger sweet rice", "parboiled rice Abuja".

---

## 6. Caching strategy

| What | Where | TTL / invalidation |
|---|---|---|
| Static assets (JS, CSS, fonts, images) | CDN | 1 year, immutable (hashed filenames) |
| Home, product, category, area, promo pages | Next.js static generation + **on-demand revalidation** | Rebuilt the moment the CMS publishes (webhook → `revalidateTag`) |
| Prices and stock on product pages | Short revalidation (60s) + fetched live on the client at add-to-cart and checkout | Checkout always re-checks price and stock on the server |
| Sessions, carts, OTP codes, rate-limit counters | Redis | Session 30 days rolling, OTP 5 minutes, cart 30 days |
| Delivery zone fees, points rules | Redis cache in front of Postgres | Cleared on change |
| Personalised pages (account, cart, checkout) | **Never cached** (`Cache-Control: private, no-store`) | none |
| API reads on the client | TanStack Query | 30–60s stale time |
| Offline / poor network | Service worker (PWA) caches the app shell + recently viewed products | Version bumped on deploy |

---

## 7. User tracking and analytics

- **Cookie consent banner** (NDPA 2023 / GAID 2025): analytics and marketing cookies load only after the user opts in. Essential cookies (session, cart) are always on.
- **GA4** e-commerce events: `view_item`, `add_to_cart`, `begin_checkout`, `add_shipping_info`, `purchase`, `sign_up`, `generate_lead` (sample request).
- **Meta Pixel + Conversions API** (server-side, deduplicated by event ID), so Facebook/Instagram ads attribute purchases even when ad blockers are on.
- **UTM + referral/affiliate attribution** stored on the order, so reports can show which channel, affiliate or referrer drove each sale.
- **Microsoft Clarity** for heatmaps and session replays (with input masking on forms).
- First-party event table (`AnalyticsEvent`) for key funnel events, so the business owns its own data.
- Owner dashboard (in `/ops` or Looker Studio on GA4): revenue by size, by area, by channel; top affiliates; sample → purchase conversion.

---

## 8. Security

**Application**
- All input validated with Zod on the server. Prisma uses parameterised queries, which prevents SQL injection.
- **Prices, discounts, delivery fees and points are always calculated on the server**, and the client is never trusted for amounts.
- Payment: Paystack webhook HMAC-SHA512 signature verification, idempotent webhook handling (the same event can't be processed twice), and an amount match check against the order.
- Auth: OTP rate limiting (3 per phone per 15 minutes, by IP too), OTP codes stored hashed, lockout after repeated failures. Passwords use Argon2id.
- Session cookies: httpOnly, Secure, SameSite. CSRF protection on state-changing requests.
- Role-based access control on every `/ops` and API route, checked on the server.
- Rate limiting (Redis) on login, OTP, coupon validation, checkout, sample requests and track lookups.
- Security headers: strict CSP, HSTS, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy.
- File uploads (return photos): type/size checks, re-encoded, stored outside the web root on S3/Cloudinary, served through signed URLs.
- Bot protection on signup, sample and checkout forms: Cloudflare Turnstile.
- Fraud signals: device fingerprint + phone + address checks for referral and sample abuse.

**Infrastructure and data**
- Secrets in the host's environment store, never in git. Separate staging and production keys.
- Database: TLS connections, least-privilege DB user, automated daily backups, point-in-time recovery.
- Personal data: collect only what's needed. Privacy policy, data export and account deletion on request (NDPA). Logs mask phone numbers and emails.
- Dependencies: Dependabot/Renovate, `npm audit` in CI, CodeQL scanning.
- Admin/ops accounts: 2FA required.
- Audit log for staff actions (status changes, approvals, coupon grants).

---

## 9. Data model (core tables)

```
User            id, phone (unique), email?, name, passwordHash?, role[BUYER|SELLER|AFFILIATE|STAFF|OWNER],
                referralCode (unique), referredById?, createdAt
SellerProfile   userId, businessName, cacNumber?, address, status[PENDING|APPROVED|REJECTED]
AffiliateProfile userId, code (unique), status, payoutMethod?, bankDetails? (encrypted)
Address         id, userId, area, street, landmark, phone, isDefault
DeliveryZone    id, name (e.g. "Wuse"), baseFee, perKgFee, etaHours, active

Product         id, slug, name, description, cmsId
Variant         id, productId, sizeKg, sku, retailPrice, wholesalePrice, compareAtPrice?, stockQty, reservedQty

Order           id, number, userId?, guestPhone?, type[STANDARD|SAMPLE|REPLACEMENT], status,
                subtotal, discount, deliveryFee, total, zoneId, addressSnapshot (json),
                couponId?, referrerId?, affiliateId?, utm (json), paymentRef, paidAt?, parentOrderId?
OrderItem       id, orderId, variantId, qty, unitPrice (snapshot)
OrderStatusEvent id, orderId, status, note, actorId?, createdAt
Shipment        id, orderId, carrier[IN_HOUSE|KWIK|GIG], trackingId?, riderName?, riderPhone?, eta?

Coupon          id, code (unique), type[PERCENT|FIXED|FREE_ITEM], value, minOrder, maxUses, usedCount,
                userId? (if personal), source[PROMO|REFERRAL_REWARD|AFFILIATE|WINBACK], startsAt, expiresAt
PointsTransaction id, userId, delta (+/-), reason[REFERRAL|AFFILIATE|REDEMPTION|EXPIRY|ADJUSTMENT],
                orderId?, status[PENDING|CONFIRMED|REVERSED], createdAt        ← append-only ledger
PointsRule      id, key, value (json)                                          ← editable thresholds
AffiliateClick  id, affiliateId, productId?, ip hash, userAgent, landingUrl, createdAt

ReturnClaim     id, orderId, orderItemId, reason, description, photos[], status, resolutionNote,
                replacementOrderId?, createdAt
SampleRequest   → modelled as Order(type=SAMPLE) + unique constraint on (phone, normalised address)

WebhookEvent    id, provider, eventId (unique), payload, processedAt          ← idempotency
AuditLog        id, actorId, action, entity, entityId, before, after, createdAt
```

---

## 10. Site map and key routes

**Public**
`/` · `/shop` · `/p/[slug]` · `/promotions` · `/promotions/[slug]` · `/samples` · `/track` · `/delivery/abuja/[area]` · `/about` · `/flagship-store` (map, hours) · `/returns-policy` · `/faq` · `/blog` · `/blog/[slug]` · `/privacy` · `/terms`

**Auth**
`/login` · `/register` (buy / sell choice) · `/register/seller` · `/affiliates/apply`

**Account**
`/account` · `/account/orders` · `/account/orders/[id]` · `/account/addresses` · `/account/rewards` (points, coupons, redeem) · `/account/referrals` · `/account/returns` · `/account/affiliate` (dashboard)

**Checkout**
`/cart` · `/checkout` · `/checkout/success`

**Ops (staff only)**
`/ops/orders` · `/ops/orders/[id]` · `/ops/returns` · `/ops/approvals` · `/ops/rules`

**Key API endpoints**
```
POST /api/auth/otp/request        POST /api/auth/otp/verify       POST /api/auth/logout
GET  /api/cart                    POST /api/cart/items            PATCH/DELETE /api/cart/items/:id
POST /api/checkout/quote          (server-calculated totals, delivery fee, coupon)
POST /api/checkout/init           (reserve stock, create order, init Paystack)
POST /api/webhooks/paystack       POST /api/webhooks/courier
GET  /api/orders/:id              GET  /api/track?number=&phone=
POST /api/coupons/validate        POST /api/rewards/redeem
GET  /api/referrals/me            GET  /api/affiliate/stats       GET /r/:code  GET /a/:code
POST /api/samples                 POST /api/returns               POST /api/uploads/sign
POST /api/revalidate              (CMS webhook)
```

---

## 11. Delivery phases

Estimates assume 1 full-stack developer plus part-time design input. Each phase ends with a deployable staging build.

| Phase | Weeks | Deliverables |
|---|---|---|
| **0. Discovery and setup** | 1 | Confirm open questions, brand assets, product sizes and prices, delivery zones. Repo, CI, staging and prod environments, Sanity, Paystack test keys, design system |
| **1. Storefront MVP** | 2–3 | Home, shop, product pages with size variants, cart, SEO foundations (SSR, schema, sitemap), flagship page, CMS integration, caching layer |
| **2. Accounts and checkout** | 2 | Phone OTP login, buyer/seller registration, addresses, delivery zones and fees, Paystack checkout + webhooks, stock reservation, order confirmation notifications |
| **3. Fulfilment and tracking** | 1.5 | `/ops` order screen, status timeline, public `/track`, SMS/WhatsApp updates, courier integration |
| **→ Soft launch (Abuja)** | | Real orders with friends, family and staff. Fix issues |
| **4. Growth features** | 2–3 | Referral codes + points ledger + coupon redemption, affiliate program + dashboard, promotions page, free-sample flow |
| **5. Returns, analytics, hardening** | 1.5 | Bag replacement claims, GA4/Meta/Clarity with consent, owner reports, security review, load test, backups verified |
| **6. Local SEO and launch** | 1 + ongoing | Area landing pages, Google Business Profile, directory listings, first blog posts, public launch |

**Total: about 11–13 weeks to full launch, with a soft launch around week 6–7.**

**Testing throughout:** Vitest unit tests (pricing, coupons, points rules: the money logic gets the most coverage), Playwright end-to-end tests for checkout, sample and return flows, Lighthouse CI budgets, Paystack test-mode runs before every release.

**Hosting alternative:** if you prefer one monthly bill or a Nigerian/African region, everything can run as Docker containers (Next.js + Postgres + Redis) on a VPS (DigitalOcean, Hetzner, or AWS af-south-1 Cape Town) behind Cloudflare. It costs less, but you take on more maintenance.

**Rough running costs at launch (monthly):** Vercel Pro ~$20, Neon/Upstash free → ~$20–40, Sanity free tier, Sentry free tier, plus SMS/WhatsApp per-message costs and Paystack fees (1.5% + ₦100, capped at ₦2,000).

---

## 12. Open questions (please confirm)

1. **Bag sizes and prices**: which sizes exist (e.g. 1kg sample, 5kg, 10kg, 25kg, 50kg)? Are there several rice varieties or just one?
2. **"No back office"**: is a minimal `/ops` order screen acceptable (recommended), or must everything be done through the CMS and payment dashboards?
3. **Affiliate rewards**: points → coupons only (no cash), or a cash commission paid monthly?
4. **Pay on delivery**: allowed? For whom?
5. **Delivery coverage**: Abuja only at launch, or also satellite towns (Suleja, Mararaba, Nyanya, Madalla) and other states?
6. **Return window**: 48 hours after delivery OK? Who pays the courier for collecting the damaged bag? (Plan assumes the brand does.)
7. **Seller/reseller terms**: minimum order quantity and wholesale discount level? Is CAC registration required?
8. **Sample size** and monthly sample budget/limit?
9. **Domain name** and brand guidelines (logo, colours, fonts, photography)?
10. **Existing accounts**: Paystack business account, Google Business Profile, WhatsApp Business number, social pages?

---

## 13. Immediate next steps

1. Answer the open questions in §12 (even rough answers unblock Phase 0).
2. I scaffold the Next.js + TypeScript + Tailwind + Prisma project in this repo with CI, linting, environment templates and the base layout.
3. Set up Sanity, Paystack test mode and Neon/Upstash staging, then start Phase 1.

---

## 14. Progress

**Done (Phase 0 + start of Phase 1)**
- Next.js 16 + TypeScript + Tailwind + Prisma/PostgreSQL project, CI (lint, typecheck, tests, build)
- Full database schema (§9), seed data for the 4 bag sizes and 34 delivery zones
- Pricing engine: delivery fee by zone and weight, nearby-town MOQ, coupons, wholesale pricing, stock checks (unit tested)
- Points engine: purchase/referral/affiliate points, coupon tiers, self-referral block, 48h confirmation (unit tested)
- Storefront: home, shop, product page with size picker and price per kg, delivery areas, returns policy, promotions
- Local SEO basics: server-rendered pages, LocalBusiness + Product structured data, sitemap, robots
- Caching: catalogue pages prerendered and refreshed the moment staff save a price
- Security: CSP/HSTS and other headers, signed httpOnly staff session, login rate limit, audit log
- Staff screens: `/ops/prices` (prices, wholesale, promo "was" price, stock) and `/ops/zones` (fees, MOQ, terms)

**Done (Phase 2 + parts of Phase 3), 12 Nov 2026**
- Brand look taken from the bag: green (main), yellow (buy buttons, like the handle), red (promo labels only); product photo on every page
- Cart that works without an account, live prices and delivery fee from the server, nearby-town minimum order checked before checkout
- Phone sign-in with SMS code (also creates the account), account page with points, referral link, orders, profile
- Seller/reseller application with staff approval; approved sellers see wholesale prices
- Checkout: delivery details, stock held for 30 minutes, Paystack payment (verified server-side + signed webhook), test payment page in local development
- Order confirmation page, SMS updates, public tracking page (order number + phone)
- Staff `/ops/orders` (move orders through delivery, rider details, cancel) and `/ops/sellers`
- Purchase/referral points recorded as pending on payment, confirmed 48h after delivery

**Needed from the business to go live:** Paystack account (secret key + webhook), Termii account (SMS), domain, real store address/phone, photos of each bag size, confirmed delivery fees

**Done (Phase 4), 12 Nov 2026**
- Each bag size shows its own photo (5kg and 1kg supplied; 50kg and 25kg fall back to the 5kg photo)
- Points → coupons: buyers swap confirmed points for single-use personal coupons (₦2,000 / ₦5,000 / ₦15,000); saved coupons appear as one-tap buttons in the cart
- Free 1kg sample: rice ₦0, customer pays delivery (pickup free), one per account and per address, Abuja and pickup only
- Bag replacement claims: within 48h of delivery, 1–5 photos (shrunk on the phone, re-encoded on the server, location data removed, visible only to the customer and staff); staff approval creates a free replacement order with a "collect damaged bag" note; points stay on hold while a claim is open
- Affiliates: apply from My account, staff approve, per-size share links, 30-day attribution, dashboard (clicks, orders, sales, points); 2 points per ₦100, coupons only
- Promotions: staff publish promotions with start/end dates and optional coupon codes (% or ₦ off, minimum spend, cap, usage limit); pausing a promotion also stops its code
- Cart shows discounts before a delivery area is chosen

**Next: Phase 5 (analytics, hardening) and Phase 6 (local SEO launch)**
- GA4 / Meta Pixel with cookie consent, owner reports
- Area landing pages for local SEO, Google Business Profile
- Move rate limits to Redis before running more than one server; points expiry after 12 months; follow-up coupon after a sample is delivered
