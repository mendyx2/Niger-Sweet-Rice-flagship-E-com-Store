# Distributor Network: Plan and progress

**Goal:** one Naija Sweet Rice website for the whole network. Each order goes to the distributor who covers the customer's area. That distributor delivers, sets the delivery fee, and is paid directly by the customer. The producer (HQ) sees every distributor's sales, supplies their stock, and tracks stock movement, mirrored to a Google Sheet.

Open points still to confirm are marked **[CONFIRM]** and listed in §11.

---

## 1. Decisions (13 Nov 2026)

| # | Topic | Decision | What it means for the build |
|---|---|---|---|
| 1 | Stock ownership | **Distributors buy stock from HQ.** Retail prices set by the distributor **within a range HQ sets** | Restock orders, HQ invoices and dispatches, distributor confirms receipt. HQ sets min/max retail price per bag size |
| 2 | Payments | **No Paystack. Customers pay the distributor directly** using the distributor's bank details shown on the platform. **HQ charges a fixed fee per bag**, which HQ can change at any time | Bank-transfer checkout. The distributor confirms payment in their portal. A per-bag fee is recorded on each order and totalled on a statement |
| 3 | Territories | **One distributor per area** | Each delivery area has exactly one owner |
| 4 | Out of stock | **Order goes to HQ** to fulfil; HQ restocks or reassigns | Automatic fallback to HQ + low-stock alert to HQ; HQ can reassign orders |
| 5 | Network costs | **HQ pays** for network-wide promotions, points coupons, free samples and replacement bags, and **builds the cost into the per-unit price** | HQ-funded discounts on a distributor's order are credited back to that distributor on the statement; replacement and sample bags are replaced in the next stock delivery |
| 6 | Stock records | **Google Sheet "stock depletion" log** of all stock movement | Every stock movement is also written to a Google Sheet automatically |
| 7 | First location | **Abuja** | Distributors cover Abuja districts; nearby towns can be assigned later |
| 8 | Walk-in sales | **Recorded on the platform** | Simple "record a shop sale" screen in the partner portal |
| 9 | Visibility | **Distributors see only their own numbers** | No rankings or network totals in the partner portal |

---

## 2. How it works

**Customer**
1. Picks their area once ("Delivering to: Gwarinpa"). The site remembers it.
2. Sees the bag sizes, prices, stock and delivery fee of **the distributor for that area**, with "Delivered by *Distributor*". If that distributor doesn't have the bags, **HQ** serves the order instead and the page says "Delivered by Naija Sweet Rice HQ".
3. Places the order and sees the **distributor's bank account details**, the **exact amount**, and the **order number to use as the transfer narration**. They get the same details by SMS.
4. Taps "I've paid". The distributor checks their bank alert and confirms. The order becomes Paid, and the customer gets an SMS and tracking as today.
5. Unpaid orders are cancelled automatically after the hold time (see §4) and the stock is released.

**Distributor** (partner portal, `/partner`)
- **Orders:** new-order SMS/WhatsApp alerts; **confirm payment received** (or mark not received); then prepare → out for delivery (rider details) → delivered.
- **Prices:** set retail prices per bag size, within HQ's range.
- **Delivery:** set their delivery fee and minimum order for their areas.
- **Stock:** see stock on hand; place **restock orders** with HQ; confirm stock received (and report shortages or damage); submit stock counts.
- **Shop sales:** record walk-in sales (bags, price, payment method) so stock stays accurate.
- **Statement:** see bags sold, HQ fees owed, credits from HQ (promo discounts, replacement and sample bags), and the net amount.
- **Their own numbers only**: sales, orders, delivery times, complaints.
- **Bank details:** maintained by HQ (see §5 on fraud prevention).
- **Staff:** add staff with phone login and limited permissions.

**HQ / producer** (existing `/ops`, extended)
- **Distributors:** add a distributor, assign areas, record and verify bank details, suspend.
- **Rules:** set the **price range** and the **per-bag fee** per bag size, both with effective dates and a change history.
- **Restocking:** handle restock orders → invoice → mark paid → dispatch → distributor confirms receipt.
- **Network dashboard:** sales, bags, stock on hand, days of stock left, unconfirmed payments, delivery speed and complaints per distributor and in total.
- **Alerts:** low stock (with suggested restock quantity), orders falling back to HQ, payments not confirmed in time, stock differences on delivery.
- **Statements:** a monthly statement per distributor; mark as settled.
- **HQ as a distributor:** HQ is also a distributor (the Abuja flagship), and is the fallback for every area.

---

## 3. Order routing

| Situation | What happens |
|---|---|
| Area has a distributor with enough stock for the whole cart | Order goes to that distributor |
| Area's distributor is short on any bag in the cart | Order goes to **HQ** (HQ's prices and delivery fee shown before ordering). HQ gets a "restock *Distributor*" alert |
| Area has no distributor yet | HQ serves it if HQ delivers there; otherwise "not available here yet", and the customer's area and phone are captured as demand |
| Distributor doesn't confirm payment or act within the time limit | Reminder to the distributor, then an alert to HQ. HQ can **reassign** the order to itself |
| Distributor is suspended | Their areas fall back to HQ automatically |

One order = one distributor. The cart is priced by whoever will fulfil it, so the customer always sees the real price and delivery fee before paying.

---

## 4. Payment by bank transfer (no Paystack)

- **Checkout:** the order is created as *Awaiting payment*, with stock held. The screen and SMS show:
  - the distributor's bank name, account number and account name;
  - the exact amount;
  - the order number to use as narration.
- **Confirmation:** the customer taps "I've paid" (optional: attach the receipt screenshot). The distributor confirms after seeing the money in their bank. **Only the distributor's confirmation marks an order paid**, never the customer's screenshot.
- **Hold time [CONFIRM]:** recommended **3 hours** to pay. After that the order is cancelled and stock released, with a reminder SMS at 2 hours.
- **Disputes:** "Customer says they paid, distributor says not received" goes to HQ with the receipt for review.
- **Optional later:** automatic confirmation using a bank-transfer provider that gives each distributor a dedicated virtual account (confirmation by webhook, no manual step). This is not Paystack-dependent, and the design keeps the door open.
- **[CONFIRM] HQ's own orders:** does HQ (the flagship) also take bank transfers instead of Paystack? Recommended: yes, the same flow for everyone. The existing Paystack code stays switched off rather than deleted.

---

## 5. Money between HQ and distributors

| Item | How it's handled |
|---|---|
| **Stock purchases** | Distributor places a restock order. HQ invoices at the wholesale price (on the platform) and the distributor pays HQ by transfer. HQ marks it paid and dispatches. **Stock is added when the distributor confirms receipt** |
| **HQ per-bag fee** | Recorded on each online order at the rate in force that day, e.g. `₦X × bags`. Changes apply to new orders only |
| **HQ-funded discounts** (network promotions, points coupons) | The customer paid the distributor less, so the discount is **credited to the distributor** on the statement |
| **Replacement bags & free samples** | Given from the distributor's stock. HQ **replaces the bag in the next stock delivery** (no cash), shown on the statement |
| **Statement (monthly [CONFIRM])** | Per distributor: fees owed − HQ-funded discount credits = **net owed to HQ** (or to the distributor). Settled by bank transfer outside the platform; HQ marks it settled |

HQ never holds customer money, so there's still no wallet. Statements are reports, not balances customers can spend.

**Fraud protection for bank details:** distributors can't change their own bank details. HQ updates them after verification, every change is logged, and the distributor gets an SMS alert. This stops someone who takes over a distributor login from redirecting customer payments.

---

## 6. Inventory and the Google stock depletion sheet

- **Stock per distributor per bag size**: on hand, held for unpaid orders, in transit.
- **Every change is a stock movement** (append-only history):

  | Movement | Effect |
  |---|---|
  | Restock received | + bags (in transit → on hand) |
  | Online sale | − bags when the distributor confirms payment |
  | Shop (walk-in) sale | − bags |
  | Replacement / free sample given | − bags (HQ replaces later) |
  | Damaged / write-off | − bags (HQ approves) |
  | Count adjustment | ± bags (HQ approves) |
  | Reassigned to HQ | none at the distributor; HQ's stock moves instead |

- **Google Sheet (stock depletion log):**
  - Every stock movement is appended as a row within a minute. Columns: date/time, distributor, bag size, movement type, quantity, stock after, order/restock reference, recorded by.
  - A second tab shows **current stock per distributor and size** and **days of stock left**, refreshed each time.
  - The sheet is a **live copy for the team to view, filter and chart. The platform is the source of truth.** Edits typed into the sheet don't change stock. Stock corrections go through the portal so they're checked and logged.
  - Needs: a Google account owned by the business, the sheet shared with a service account the platform uses. If Google is briefly unreachable, rows are queued and sent later, never lost.
- **Days of stock left** = stock ÷ average daily sales over the last 14 days. Below 7 days: alert HQ with a suggested restock quantity.

---

## 7. Storefront

- **One brand website**, location-aware (as recommended earlier). Each distributor also gets:
  - their own page `/distributors/<name>` (areas, address, hours, phone);
  - a share link and QR code that sets the customer's area to theirs.
- Prices on product pages come from the area's distributor. With no area chosen, the page shows "from ₦X" (the lowest price in the range) and asks for the area.
- The existing Abuja area pages show the local distributor's delivered prices.

---

## 8. Existing features in the network

| Feature | Network rule |
|---|---|
| Promotions & coupon codes | HQ promotions apply network-wide; HQ funds the discount (credited to the distributor). Distributor-only promo codes are a possible later addition |
| Purchase points & coupons | Network-wide, HQ-funded (credited to the distributor when redeemed on their order) |
| Free 1kg samples | Fulfilled by the area's distributor from their stock; customer pays the distributor's delivery fee by transfer (or pickup free); HQ replaces the bag |
| Bag replacement claims | Customer submits as today; **HQ approves**; the distributor collects the damaged bag and delivers the new one from their stock; HQ replaces it in the next delivery |
| Affiliates & referrals | Stay at HQ level; the order still goes to the area's distributor |
| Wholesale sellers | Buy from their area's distributor at that distributor's wholesale price (within HQ's range) |
| Reports | HQ sees everything; distributors see only their own |

---

## 9. What changes in the system

**New data**

```
Distributor        id, name, slug, status, isHq, phone, address, hours, slaHours,
                   bankName, accountNumber, accountName, bankVerifiedAt
DistributorMember  distributorId, userId, role (OWNER | STAFF)
Territory          zoneId (unique) → distributorId          ← one distributor per area
DistributorZoneFee distributorId, zoneId, baseFee, perKgFee, minOrderKg/Kobo, etaHours, terms
PriceBand          variantId, minRetail, maxRetail, minWholesale, maxWholesale, effectiveFrom
HqFeeRate          variantId, feeKobo, effectiveFrom, setBy            ← fixed per-bag fee, history kept
DistributorPrice   distributorId, variantId, retailPrice, wholesalePrice (validated against band)
DistributorStock   distributorId, variantId, onHand, held, inTransit, reorderPoint
StockMovement      id, distributorId, variantId, delta, type, orderId?, restockId?, saleId?, actor,
                   note, createdAt, sheetSyncedAt                      ← append-only; mirrored to Google Sheets
RestockOrder       id, distributorId, lines, wholesaleTotal, status (REQUESTED → INVOICED → PAID →
                   DISPATCHED → RECEIVED | DISPUTED), timestamps
WalkInSale         id, distributorId, lines, totalKobo, paymentMethod, createdBy, createdAt
Statement          id, distributorId, period, feesKobo, creditsKobo, netKobo, status (OPEN | SETTLED)
Order              + distributorId, + routedToHq (bool), + hqFeeKobo, + hqFundedDiscountKobo,
                   + paymentMethod (BANK_TRANSFER), + customerMarkedPaidAt, + paymentConfirmedBy/At,
                   + receiptPhoto?
DemandSignal       zone/area, phone?, createdAt
```

**Changes to what exists**
- **Checkout:** route the order (§3), then price, fee and stock from that distributor; bank-transfer payment page instead of Paystack; hold time and auto-cancel.
- **Cron:** cancel unpaid transfers after the hold time; send payment reminders; escalate unconfirmed payments; push queued rows to the Google Sheet; build monthly statements.
- **Ops:** distributor management, price range and fee settings, restock orders, network dashboard, statements, disputes, reassignment.
- **Privacy policy:** customers' details are shared with the distributor who delivers. Each distributor signs a data-processing agreement (NDPA 2023).

---

## 10. Delivery phases (estimates for one developer)

| Phase | Weeks | Scope |
|---|---|---|
| **D1. Foundations** | 1.5 | Distributors (HQ = first distributor, current store migrated with no visible change), members and roles, territories, price ranges, per-bag fee with history, per-distributor prices/fees/stock, stock movement ledger |
| **D2. Routing & bank-transfer checkout** | 1.5 | Area picker, routing + HQ fallback, "Delivered by", bank-transfer payment page and SMS, "I've paid", distributor confirmation, hold time, auto-cancel, reminders, disputes |
| **D3. Partner portal** | 1.5 | Orders & fulfilment, new-order alerts, price setting within range, delivery fees, stock view/counts, walk-in sales, staff, own reports |
| **D4. HQ network console & restocking** | 1.5 | Onboarding & bank verification, restock orders (invoice → paid → dispatch → receive), network dashboard, low-stock and SLA alerts, reassignment |
| **D5. Google Sheet & statements** | 1 | Stock depletion sheet sync (log + current stock tab, retry queue), monthly statements with fees and HQ credits |
| **D6. Network rules & storefront** | 1 | HQ-funded promos/points credits, samples & replacements via distributors, distributor pages + share links/QR, updated area pages and privacy policy |

**About 8 weeks.** D1 + D2 + D3 (~4.5 weeks) is the first usable version: Abuja distributors receive orders, get paid by transfer, fulfil them, and HQ sees their sales.

---

## 11. Progress (13 Nov 2026)

Confirmed: HQ also uses bank transfer, the per-bag fee is set per bag size, 3-hour payment hold, monthly statements, first distributor **Gova Max Ltd** (Laura Internal Market, Abuja). Google account for the sheet: to be added later.

**Built and tested end to end**
- **D1:** distributors (HQ is one), logins with owner/staff roles, one distributor per area, price range and per-bag HQ fee per size (with history), per-distributor prices, delivery fees and stock, and a stock movement history. Existing stock and orders moved to HQ.
- **D2:** area picker in the header. Product pages, cart and checkout use the area's distributor, falling back to HQ when it is short. Bank-transfer checkout: seller's bank details, exact amount, order number as narration, "I've made the transfer", 3-hour hold with a reminder at 2 hours, auto-cancel, and an HQ alert if a seller doesn't confirm in time. Paystack removed.
- **D3 partner portal (`/partner`):**
  - orders: confirm payment received / not received, then fulfil;
  - stock: confirm deliveries (shortfalls reported to HQ), report damage or count differences (applied after HQ approval);
  - shop sales, prices within range and delivery fees (owners only);
  - "My numbers": monthly sales and the statement with HQ;
  - staff, with distributors seeing only their own numbers.
- **D4 (most):** `/ops/distributors`:
  - add distributors and edit their details;
  - bank details, which only HQ can change (logged, distributor alerted by SMS);
  - areas, logins, dispatching stock from HQ, approving stock adjustments, stock history, and the current month's statement.

  The HQ orders screen gained a seller filter and transfer confirmation, and reports gained "By seller".
- **D5 (part):** the monthly statement per distributor: HQ fee on bags sold online − HQ-funded discounts = net owed, plus bags HQ must replace (samples and replacements given from the distributor's stock).

**Added on 13 Nov 2026 (second round)**
- **Restocks (`/ops/restocks`, partner Stock page):**
  1. The distributor requests bags.
  2. HQ confirms quantities, adds free bags to replace samples and replacements the distributor gave (pre-filled), and invoices at the **distributor price** (set per size on the Prices page).
  3. The distributor pays HQ by transfer using the RS number and taps "I've paid HQ".
  4. HQ confirms and dispatches; the bags show "in transit".
  5. The distributor confirms receipt.
- **Statements (`/ops/statements`):** live figures during the month. HQ closes a finished month, which freezes the figures and texts each distributor, then marks each statement settled with a transfer reference. Distributors see the frozen statement and its status in "My numbers".
- **Google stock depletion sheet:** every finished stock movement is appended to a "Stock movements" tab, and a "Current stock" tab shows on hand, held, in transit, usage over the last 14 days and days of stock left per distributor. It runs with the housekeeping job, retries anything not yet sent, and stays switched off until `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_KEY` are set. Tested against a simulated Google API; needs one real run once the account exists.
- **Public distributor pages** (`/distributors/<name>`): areas, address, hours and phone, plus "Shop in <area>" buttons that set the customer's area. Each distributor gets a share link and a printable QR code (partner Prices & delivery page and HQ's distributor page). Area pages name the local distributor, and the sitemap includes distributor pages.

**Staff alerts moved off SMS (13 Nov 2026)**
- **Distributor alerts** (new order, "customer says they've paid", restock invoice and dispatch, stock sent by HQ, monthly statement) go to each team member's Telegram (connected under **Alerts** in the partner portal) and/or the distributor's alert email.
- **HQ alerts** (payments not confirmed in time, stock requests and payments, shortfalls, damage reports) go to HQ's Telegram chat or group (connected on `/ops/distributors`) and/or `OPS_ALERT_EMAIL`.
- **Still SMS:** login codes, the bank-account-change alert, the one-time "you've been added" sign-in invitation to new team members, and every customer message.
- **Setup:**
  1. Create a bot with @BotFather and set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`.
  2. Once the site is live, press "Connect bot to site".
  3. For email, set `RESEND_API_KEY`, `EMAIL_FROM` and `OPS_ALERT_EMAIL`.

**Added later on 13 Nov 2026**
- **Distributors' own promo codes:** created by distributor owners under Prices & delivery. They're funded by the distributor, only work on that distributor's orders, and aren't credited on statements. HQ can see them on the Promotions page.
- **Individual HQ logins:** the shared `/ops` password is gone. HQ staff sign in with their own phone, as owner or staff; owners come from `HQ_OWNER_PHONES` and add others under **HQ team**. Only owners can change bank details or the team. The team page shows recent activity by person.

- **Network map (/ops/network):** a drawn map of Abuja and nearby towns. Each area is coloured by the distributor that covers it (grey outline = HQ), and the dot grows with paid orders in the last 30 days. Tables underneath show the same facts plus each seller's sales and stock. It needs no outside map service. A new area appears in the table and goes on the map once its position is added in `src/lib/network-map.ts`.

## 12. Still to confirm

1. The Google account that will own the stock depletion sheet: create a service account, share the sheet with it, and set the three `GOOGLE_*` settings.
2. Gova Max Ltd's areas, bank account and owner phone number (HQ can enter them in `/ops/distributors`).
