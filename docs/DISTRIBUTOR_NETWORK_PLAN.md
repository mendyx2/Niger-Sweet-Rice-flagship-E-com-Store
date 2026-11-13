# Distributor Network: Plan (not built yet)

**Goal:** turn the single Abuja store into a network. Customers anywhere order on one Naija Sweet Rice website. Each order goes to the distributor who covers the customer's area. That distributor delivers, sets and keeps the delivery fee, and receives the customer's payment. The producer sees every distributor's sales and manages their stock.

Items marked **[DECISION]** need your answer before building (collected in §10).

---

## 1. How it works for each person

**Customer**
1. Opens the site and picks their area once ("Delivering to: Gwarinpa, Abuja"). The site remembers it.
2. Sees the bag sizes, prices, delivery fee and stock **of the distributor who covers that area**, plus "Delivered by *Distributor name*".
3. Pays online. The money goes straight to that distributor's bank account (minus the producer's share, if any; see §4).
4. Gets SMS updates and tracks the order as today. Replacement claims go to the same distributor.

**Distributor**
- Has a login to a **Partner portal** (`/partner`) where they:
  - get new orders (SMS/WhatsApp alert) and move them through preparing → out for delivery → delivered;
  - set **their own delivery fees and minimum orders** for the areas they cover;
  - see their stock, confirm stock deliveries from the producer, record damaged or adjusted stock;
  - record walk-in shop sales so their stock stays accurate **[recommended]**;
  - see their sales, payouts (from Paystack) and customer reviews;
  - add their own staff (phone login, limited access).
- Gets a public page, `/distributors/<name>`, with their areas, address, hours and phone. It also has a shareable link and a QR code for their shop that sets the customer's area to theirs.

**Producer (you)**
- Adds distributors, assigns their areas, and connects their bank account for payouts.
- Sees a **network dashboard**: sales, orders, kg sold, stock on hand, days of stock left, delivery speed and complaint rate for each distributor and in total.
- Manages inventory: sends stock to distributors, sees sell-through, gets low-stock alerts and restock suggestions, and approves stock adjustments.
- Still controls the brand: products, photos, pricing rules, promotions, points and the replacement policy.
- The Abuja flagship becomes **"HQ", just another distributor** that you run, so everything built so far keeps working.

---

## 2. Order routing

| Situation | What happens |
|---|---|
| Area covered by one distributor | Order goes to that distributor |
| Area covered by more than one **[DECISION]** | Recommended: one distributor per area (exclusive territories). This is simplest and avoids disputes. If you allow overlap: send the order to the one with stock, then the one ranked first |
| Distributor out of stock for the cart **[DECISION]** | Option A: show "not available in your area right now" with WhatsApp contact. Option B: fall back to HQ (or a neighbour) if they deliver there |
| No distributor covers the area | "We don't deliver here yet". Capture the phone number to measure demand by area |
| Distributor doesn't accept an order within N hours | Reminder to the distributor, then an alert to the producer, who can reassign it |

One order always belongs to **one distributor**. The area decides who, so a cart never mixes distributors.

---

## 3. Payments (Paystack split payments; no wallet)

Paystack lets one payment be split automatically at checkout:

- Each distributor is created as a **Paystack subaccount** linked to their bank account. Their bank account is checked with Paystack's account-name lookup before saving.
- When a customer pays, the transaction is created **for that distributor's subaccount**. Paystack pays the distributor directly, usually the next business day. The producer's share (if any) goes to the producer's main account at the same moment.
- **The platform never holds anyone's money**, which keeps your earlier "no wallet" rule.
- Delivery fees go **100% to the distributor**.
- The producer's main Paystack account still receives every webhook, so order confirmation, tracking and reports work exactly as now.
- Who pays Paystack's processing fee can be set: the distributor, the producer, or shared **[DECISION]**.

> To confirm with Paystack before building: how refunds on split payments recover the subaccount's share, and the settlement schedule for new subaccounts. Exact API details will be checked against their current docs.

---

## 4. The business model behind the money **[DECISION: the most important one]**

| | **A. Distributor owns the stock** (recommended to start) | **B. Producer consigns stock** |
|---|---|---|
| How stock gets there | Distributor buys bags from you at wholesale price, outside the website or via a payment link | You place stock with the distributor; you own it until it sells |
| Customer payment | 100% to distributor (goods + delivery), optionally minus a small brand fee per bag | Split: producer gets the wholesale value of the bags sold, distributor gets the margin + delivery |
| Your risk | Low: paid upfront for stock | Higher: stock at their site is yours until sold |
| Stock tracking | For visibility and replenishment | Essential: it's your asset; regular stock counts |
| Accounting | Simple | More complex: reconciliation per distributor |

**Pricing [DECISION]:**
1. One national price set by you.
2. You set a price **range** (e.g. 50kg between ₦83,000 and ₦88,000) and each distributor picks within it. **Recommended:** it allows for transport costs in different cities while protecting the brand.
3. Distributors price freely.

---

## 5. Existing features in a network **[DECISIONS]**

| Feature | Recommended rule |
|---|---|
| **Promotions and coupons** | Producer-funded network-wide promotions come out of the producer's share (works in model B). In model A, discounts reduce the distributor's takings, so you either reimburse distributors monthly from a statement, or only distributors run their own promos. Distributors can also create **their own** promo codes for their area |
| **Purchase points** | Stay network-wide and producer-funded (the customer can use points anywhere). Same funding question as above |
| **Free 1kg samples** | Fulfilled by the local distributor; the customer pays that distributor's delivery fee. The bag comes from their stock: who bears the cost? Suggest the producer replaces it in the next stock delivery |
| **Bag replacement** | The distributor handles collection and the new bag. The producer approves claims (keeps policy consistent) and replaces the damaged bag in the distributor's next stock delivery |
| **Affiliates and referrals** | Stay producer-level; the order still goes to the local distributor |
| **Wholesale sellers** | Small resellers buy from their local distributor at the wholesale band |

---

## 6. Inventory management

- **Stock per distributor per bag size.**
- Every change is a **stock movement**, an append-only history like the points ledger. Types: stock sent by producer → received by distributor, online sale, walk-in sale, replacement, damaged/write-off, count adjustment, transfer between distributors.
- **In transit:** stock you dispatch shows as "in transit" until the distributor confirms receipt. Any difference is flagged.
- **Days of cover** = stock ÷ average daily sales (last 14 days). Below a threshold (e.g. 7 days), the producer gets an alert and a suggested restock quantity.
- **Stock counts:** distributors submit periodic counts. Differences become adjustments the producer approves.
- Online orders hold the distributor's stock for 30 minutes during payment (as today), so two customers can't buy the last bag twice.

---

## 7. Storefronts

**Recommended: one brand website, location-aware**, rather than a separate website per distributor:
- Customers always see the same trusted brand, and Google ranks one strong site instead of many weak ones.
- Each distributor still gets their **own page** (`/distributors/ibrahim-foods-kano`), their own **share link and QR code**, and "Delivered by …" on every product and order. Local SEO pages extend to each city and area they cover (e.g. "Rice delivery in Nassarawa, Kano").
- Possible later: subdomains (`kano.naijasweetrice.ng`) if a distributor needs a separate address for marketing.

---

## 8. What changes in the system

**New data**

```
Distributor        id, name, slug, status, phone, address, city, state, geo, hours,
                   paystackSubaccountCode, bank (masked), producerShareRule, slaHours
DistributorMember  distributorId, userId, role (OWNER | STAFF)
Territory          distributorId, zoneId, priority          ← who covers which delivery area
DistributorZoneFee distributorId, zoneId, baseFee, perKgFee, minOrderKg/Kobo, etaHours, terms
DistributorPrice   distributorId, variantId, retailPrice, wholesalePrice   (within producer band)
PriceBand          variantId, minRetail, maxRetail          (if pricing option 2)
DistributorStock   distributorId, variantId, onHand, reserved, inTransit, reorderPoint
StockMovement      id, distributorId, variantId, delta, type, orderId?, shipmentId?, actor, note, createdAt
StockShipment      id, distributorId, lines, status (DISPATCHED | RECEIVED | DISPUTED), dispatchedAt, receivedAt
WalkInSale         id, distributorId, lines, totalKobo, createdBy, createdAt
Order              + distributorId, + distributorShareKobo, + producerShareKobo
DemandSignal       phone?, zone/area text, createdAt        ← "we don't deliver here yet"
```

Delivery zones grow beyond Abuja: **state → city → area**. They become shared reference data, and each distributor sets their own fee per area.

**New screens**
- Customer: area picker in the header; "Delivered by …"; distributor pages; "not available here yet".
- `/partner`: orders, delivery fees, stock (receive, count, adjust), walk-in sales, sales and payouts, staff.
- `/ops`: distributors (onboard, bank details, territories, status), stock shipments, network dashboard, approvals (stock adjustments, price changes), reassign orders.

**Changes to what exists**
- Checkout: price, fee and stock come from the area's distributor. The Paystack transaction is created with that distributor's subaccount and the producer's share.
- `/ops/orders` gets a distributor filter. Distributors only ever see their own orders and customers.
- Reports gain a "by distributor" view and a network map.
- Privacy policy: customers' name, phone and address are shared with the distributor who delivers. Distributors sign a data-processing clause (NDPA 2023).

---

## 9. Delivery phases (estimates for one developer)

| Phase | Weeks | Scope |
|---|---|---|
| **D1. Foundations** | 1.5 | Distributor, members, territories, per-distributor fees/prices/stock, stock movement ledger; current store migrated as "HQ" with no visible change |
| **D2. Routing and split payments** | 1.5 | Area picker, routing rules, "Delivered by", Paystack subaccounts (onboarding + bank check), split checkout, unavailable-area capture |
| **D3. Partner portal** | 1.5 | Orders and fulfilment, new-order alerts, delivery fees, stock receive/count/adjust, walk-in sales, staff |
| **D4. Producer network console** | 1.5 | Onboarding, stock shipments, network dashboard, low-stock alerts and restock suggestions, SLA alerts and order reassignment |
| **D5. Storefronts and SEO** | 1 | Distributor pages, share links/QR, city and area pages beyond Abuja |
| **D6. Network rules** | 1 | Promotions/points funding, samples and replacements across distributors, distributor promo codes, refunds on split payments |

**About 8 weeks.** D1 + D2 + D3 is the smallest useful version (~4.5 weeks): distributors can receive and fulfil paid orders, and you can see their sales. Testing throughout as before, including split-payment tests in Paystack test mode with test subaccounts.

---

## 10. Decisions needed

1. **Model:** do distributors buy stock from you (A), or do you place stock with them on consignment (B)?
2. **Your share per online sale:** none, a fixed amount per bag/kg, or a percentage? And who pays Paystack's fee?
3. **Pricing:** one national price, a price range distributors choose within, or free pricing?
4. **Territories:** one distributor per area (exclusive), or overlapping?
5. **Out of stock:** show unavailable, or fall back to HQ/another distributor?
6. **Funding:** who pays for network-wide promotions, points coupons, free samples and replacement bags?
7. **First locations:** which cities/states and roughly how many distributors at launch?
8. **Walk-in sales:** should distributors record their in-shop sales on the platform? (Needed for accurate stock.)
9. **Visibility:** should distributors see network-wide numbers (e.g. rankings), or only their own?
