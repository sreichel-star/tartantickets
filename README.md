# Tartan Tickets

Ticketing web app for student club events, live at https://tartan-tickets-sigma.vercel.app.

## What is built

- **Story 1: Browse events.** Upcoming events with date, location, price and seats left. Sold-out events show "Join waitlist".
- **Story 3: Buy tickets** (HW3). Click **Buy**, type your name, choose 1–4 tickets and click **Hold my seats**. The seats are held for 10 minutes. **Simulated payment** issues one QR-code ticket per seat and records a receipt email. **Simulate declined card** releases the seats. A student can hold or buy at most 4 tickets per event, and a sold-out event offers the waitlist.

"Join waitlist" still just says "Coming soon" (Story 4 is not built).

## Non-goals for now (HW3 scope)

- **No real payments.** "Simulated payment" and "Simulate declined card" buttons stand in for Stripe Checkout. No card is ever charged or entered.
- **No real authentication.** A name typed into a text box stands in for university sign-in (Story 2). Anyone can type any name.
- **No real email.** The receipt email is recorded in a server-side outbox instead of being sent; the receipt and QR codes are shown on screen.
- **No database.** Events, orders and tickets live in server memory. **All data resets on every deploy** (and whenever the server restarts), so sold seats return to the sample numbers.

## Run and test

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 48 tests: tests/story1-*.test.* and tests/story3-*.test.*
npm run build
```

## Security spec audit

Checked before Story 3 was built, against [docs/Starter Spec A - Tartan Tickets - SECURITY_SPEC.md](docs/Starter%20Spec%20A%20-%20Tartan%20Tickets%20-%20SECURITY_SPEC.md) on 2026-10-22, for the build at commit `422a633` (Story 1 only).

Status key: **Fully** = met today; **Partly** = some of it is met; **Not met** = not built yet. "Fully" can also mean met only because the feature it restricts doesn't exist yet; each such row says so and needs re-checking when that feature is built.

| Req | Status | Why |
|-----|--------|-----|
| SEC-1 | Not met | No sign-in exists yet; no passwords are stored, but nothing authenticates through CMU SSO. |
| SEC-2 | Not met | No sign-in sessions exist, so there is nothing to expire. |
| SEC-3 | Fully | Vercel redirects HTTP to HTTPS (308) and sends HSTS on the page and API (checked on the live site); this comes from the hosting, not app code. |
| SEC-4 | Not met | No roles or club memberships exist; the only endpoints (event page, `GET /api/events`) are public on purpose. |
| SEC-5 | Not met | No club-restricted resources, access-denied responses, or attempt logging exist. |
| SEC-6 | Not met | Tickets don't exist yet. |
| SEC-7 | Not met | No payments yet; no card data is handled at all, but Stripe Checkout isn't integrated. |
| SEC-8 | Not met | No checkout or charge calculation exists. |
| SEC-9 | Not met | No Stripe webhook endpoint exists. |
| SEC-10 | Not met | No webhook processing or duplicate-event protection exists. |
| SEC-11 | Partly | No Stripe keys exist anywhere and `.env` files are excluded from git, but no secrets manager or live/test key separation is set up. |
| SEC-12 | Not met | No connected Stripe accounts or approval process exist. |
| SEC-13 | Not met | QR codes and ticket tokens don't exist yet. |
| SEC-14 | Not met | Check-in scanning doesn't exist yet. |
| SEC-15 | Not met | No scanning and no rate limiting exist. |
| SEC-16 | Not met | No checkout and no rate limiting exist. |
| SEC-17 | Fully (for now) | No personal data is collected at all; must be re-checked once purchases store data. |
| SEC-18 | Not met | No attendee data exists and no automatic 90-day removal job is built. |
| SEC-19 | Not met | No attendee export feature exists. |
| SEC-20 | Fully | All event text is shown as plain text (no raw HTML anywhere in the code), and a test checks that a `<script>` tag displays as text. |
| SEC-21 | Not met | No audit log exists. |
| SEC-22 | Not met | No audit log exists. |

**Summary:** 3 fully met (one only because no personal data is collected yet), 1 partly, 18 not met. Most gaps belong to features later stories add: sign-in, payments, tickets, check-in and officer tools.
