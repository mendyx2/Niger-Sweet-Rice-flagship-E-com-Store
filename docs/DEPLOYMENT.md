# Going live: step-by-step

This guide takes the store from this code to a live website, then through the first setup in `/ops`. Allow about half a day. Where a step needs a developer, it says so.

---

## 1. Accounts you need

| What | Used for | Cost |
|---|---|---|
| **GitHub** (you have this) | Holds the code | Free |
| **Vercel** | Runs the website | Pro plan recommended (needed for the 10-minute housekeeping job; see §6) |
| **Neon** (or any PostgreSQL host) | The database | Free tier to start |
| **Domain name** (e.g. `naijasweetrice.ng`) | The web address | Yearly fee from a registrar |
| **Termii** | SMS: login codes and customer messages | Pay per SMS |
| **Telegram** + a bot from @BotFather | Free staff alerts | Free |
| **Resend** (optional) | Free staff alert emails | Free tier |
| **Google Cloud** (optional) | The stock depletion sheet | Free |

---

## 2. Database (Neon)

1. Create a Neon project in a region close to Nigeria (e.g. Europe).
2. Copy the connection string it shows for **Prisma**. It starts with `postgresql://`.
3. Keep it for the `DATABASE_URL` setting below.

Neon may offer both a "pooled" and a "direct" connection string. The direct one is simplest at launch volumes. If you want the pooled one, ask a developer to follow Neon's Prisma guide.

---

## 3. Website (Vercel)

1. In Vercel: **Add New → Project → import** the GitHub repository.
2. Before the first deploy, open **Settings → Environment Variables** and add the settings in §4.
3. Deploy. Every deploy automatically:
   - updates the database structure;
   - adds anything missing to the starting data (bag sizes, delivery areas, HQ, Gova Max Ltd); it never overwrites prices, stock or anything staff entered;
   - builds the site.
4. **Domains:** add your domain and follow Vercel's DNS instructions. Then set `NEXT_PUBLIC_SITE_URL` to `https://yourdomain` and redeploy.

If a required setting is missing, the site refuses to start and the Vercel log lists exactly which one.

---

## 4. Settings (environment variables)

Never put these in chat, email or the code. Enter them only in Vercel's settings.

**Required**

| Setting | What to put |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain` (no trailing slash) |
| `SESSION_SECRET` | 48+ random characters (a developer can run `openssl rand -base64 48`) |
| `HQ_OWNER_PHONES` | Your phone number(s), comma-separated, e.g. `08031234567`. These always have full HQ access |
| `CRON_SECRET` | Another random string; protects the housekeeping job |
| `TERMII_API_KEY` | From your Termii dashboard |
| `TERMII_SENDER_ID` | Your approved sender ID (Termii must approve it first) |

**Store details** (shown in the footer and to Google; use exactly what's on your Google Business Profile)

`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_STORE_PHONE`, `NEXT_PUBLIC_STORE_WHATSAPP` (digits only, e.g. `2348031234567`), `NEXT_PUBLIC_STORE_STREET`, `NEXT_PUBLIC_STORE_AREA`, `NEXT_PUBLIC_STORE_LAT`, `NEXT_PUBLIC_STORE_LNG`

**Optional features**

| Feature | Settings |
|---|---|
| Telegram staff alerts | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (random string) |
| Email staff alerts | `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Naija Sweet Rice <alerts@yourdomain>`), `OPS_ALERT_EMAIL` |
| Google stock sheet | `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY` |
| Analytics (after cookie consent) | `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID` |
| Rate limits shared across servers | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

---

## 5. First sign-in and setup in `/ops`

Go to `https://yourdomain/ops` and sign in with a phone number from `HQ_OWNER_PHONES`. Then:

1. **HQ team:** add the other HQ staff by phone (owner or staff).
2. **Distributors → Naija Sweet Rice HQ:** enter HQ's bank account (customers of HQ pay into it, and distributors pay restock invoices into it).
3. **Prices & stock**, per bag size:
   - HQ retail price and HQ stock;
   - **distributor price** (what distributors pay HQ);
   - **distributor range** (lowest–highest retail price distributors may set);
   - **HQ fee per bag** (charged on distributor online sales).
4. **HQ delivery fees:** confirm the fee per area (the starting values are placeholders).
5. **Distributors → Gova Max Ltd** (and any others):
   - bank account;
   - areas;
   - owner's phone number (they get an SMS invitation);
   - alert email;
   - send opening stock.
6. **Alerts:** on the Distributors page, connect HQ's Telegram (§7). Ask each distributor to connect theirs under **Alerts** in the partner portal.
7. **Promotions**, if you want one at launch.

---

## 6. Housekeeping job (every 10 minutes)

The job at `/api/cron/release-reservations` does several things:
- cancels transfers not paid within 3 hours and sends 2-hour reminders;
- alerts HQ about payments not confirmed in time;
- confirms points after the return window and expires old points;
- sends sample follow-up coupons;
- fills the Google sheet.

- **Vercel Pro:** `vercel.json` already schedules it every 10 minutes, and Vercel sends `CRON_SECRET` automatically.
- **Vercel Hobby (free):** Hobby only allows infrequent cron jobs, and the deploy may refuse the 10-minute schedule. Check Vercel's current cron limits. If so, delete `vercel.json` and use a free external scheduler such as cron-job.org:
  - URL: `https://yourdomain/api/cron/release-reservations`
  - every 10 minutes
  - add the header `Authorization: Bearer <your CRON_SECRET>`

---

## 7. Telegram, email and Google sheet

**Telegram**
1. In Telegram, message **@BotFather** → `/newbot` and choose a name (e.g. "Naija Sweet Rice Alerts").
2. Copy the token into `TELEGRAM_BOT_TOKEN`, set a random `TELEGRAM_WEBHOOK_SECRET`, and redeploy.
3. In `/ops/distributors`, press **Connect bot to site** (once), then **Connect my Telegram** or **Add to a staff group**.
4. Press **Send test alert**.

**Email (Resend)**
1. Create an account and verify your domain (add the DNS records it shows).
2. Set `RESEND_API_KEY`, `EMAIL_FROM` and `OPS_ALERT_EMAIL`.

**Google stock sheet** (a developer can do this in 10 minutes)
1. In Google Cloud, create a project, enable the **Google Sheets API**, and create a **service account** with a JSON key.
2. Create a Google Sheet and **share** it with the service account's email as **Editor**.
3. Set `GOOGLE_SHEETS_ID` (from the sheet's address), `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_SERVICE_ACCOUNT_KEY` (the key's `private_key` value).
4. Within 10 minutes the sheet gets two tabs, **Stock movements** and **Current stock**.

---

## 8. Keeping it healthy

- **Uptime:** add `https://yourdomain/api/health` to a free monitor such as UptimeRobot. It answers "ok" only when the site and database are working.
- **Backups:** turn on Neon's point-in-time restore (how far back depends on your Neon plan).
- **Updates:** changes pushed to the main branch on GitHub deploy automatically.

---

## 9. Final test before announcing

Do one real order end to end, with a 1kg bag or a small order:

1. On your phone, choose an area served by a distributor, order, and check the **SMS** with the bank details.
2. Transfer the money and tap **I've made the transfer**. The distributor's **Telegram** should get the alert.
3. The distributor taps **Payment received**, then marks it out for delivery and delivered. Check the customer gets the SMS updates.
4. Check `/ops/reports`, the distributor's **My numbers**, and (if set up) the Google sheet.
5. Try a replacement request on that order and approve it.

## Security review before launch (13 Nov 2026)

Checked: every server action and API route checks who is signed in; distributors can only touch their own orders, stock, restocks, codes and staff; bank details and the HQ team are owner-only; claim photos are visible only to the customer and HQ; Telegram webhook and housekeeping secrets are compared in constant time; uploads are re-encoded with size and pixel limits; sign-in codes appear on screen only in development without an SMS key; the test-only rate-limit bypass is off in production.

Fixed in this review:
- Rate limits used the visitor-supplied first `X-Forwarded-For` entry, so they could be dodged. Now they use the IP set by the host.
- The "go back to where you were" link after sign-in could be tricked into leaving the site (`/\t/evil.com`). It now only allows same-site paths. Unit tests cover this.
- Distributor, account, order and checkout pages are now sent with `Cache-Control: private, no-store`, like /ops already was.

Known and accepted: `npm audit` reports a denial-of-service issue in `deepmerge-ts`, used only by the Prisma command-line tool to read its own config. Visitors can't reach it. The fix needs a major Prisma upgrade (6 → 7), which should be planned separately.
