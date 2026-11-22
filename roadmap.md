# Roadmap

## EV charging routes
- [x] Add an opt-in Find route with EV action, charging waypoint, total driving time and station marker; eleven tests passed and signed-in desktop/mobile flow checked with sample Google responses. Live Google map rendering remains unverified locally.

## Account creation fix (in progress)
- Signup currently blocked by two checks: weak/breached password rejection, and confirmation-email delivery failures ("could not be delivered recently") that stop accounts from being created.
- Pending user decision: activate accounts immediately without email confirmation, or keep confirmation and fix email delivery with a sender domain.
- Minor: show password requirements up front on the sign-up form.

- [x] Group account controls beside search, expand trials to 1–15 days, add admin UPI setup/QR previews, and enforce expiry immediately.
- [x] Expand admin dashboard with live visitor preview and admin-only navigation; verified using the admin session, signed-out view and seven passing rule tests.
- [x] Add INR monthly/yearly pricing controls, admin free mode, explicit 1–2 day trials, account page and server access checks; payment checkout remains unavailable.
- [x] Connect the live Razorpay account and add secure gateway and hosted payment-window helpers.
- [x] Implement prepaid monthly/yearly Razorpay checkout, verified confirmation and per-user expiry updates with no automatic renewal; preserve saved UPI details.
- [x] Verify live monthly/yearly payment windows, unpaid readback, mobile layout, calendar expiry, duplicate confirmation, account isolation and server access checks; 18 tests passed, temporary database tests rolled back.
- [ ] Verify an actual completed buyer payment and published webhook delivery; waiting for deployment, Razorpay webhook configuration and a real buyer payment. Setup is documented in RAZORPAY_SETUP.md.
- [ ] Connect Google Play purchases; waiting for required store configuration.
- [x] Fix sponsored-offer refresh, street-food failures and previous-search navigation; verified with sample service responses and six passing tests.
- [x] Add grounded recommendations and safe streaming AI access.
- [x] Add selected-place prompt, recommendation links, Stop and error states.
- [x] Verify grounding rules and live AI requests; verify panel with sample places because the existing Google Maps connection fails locally.
