# Prepaid Namma Spot payments

Monthly and yearly buttons open the connected live Razorpay checkout. One verified payment adds one calendar month or year to that buyer's paid access. Existing paid time is preserved. There is no automatic renewal.

## Enable payment notifications

Publish the latest app, or redeploy the updated source on your own server-capable host with the linked server secrets available. Keep all secret values server-only.

In Razorpay, open **Accounts & Settings → Webhooks → Add New Webhook**:

- URL on the published app: `https://bangalore-gems-finder.lovable.app/api/public/razorpay-webhook`
- On your own hosting, use `https://godinexus.com/api/public/razorpay-webhook` only after deploying this handler there.
- Events: `payment.captured`, `payment.authorized`, `order.paid`.
- Leave the **Secret** field empty: this handler independently reads the stored order and payment from Razorpay to verify payment; it never trusts webhook status or amounts.
- Test and live modes each require their own webhook. Test payments never grant live paid access.

Payment cancellation and failures leave access unchanged. Returning from UPI or reopening the plans page checks pending payments; **Check payment** retries verification. Verified purchases appear under **Your payments**, with their expiry, and checkout confirmation returns the buyer to the map.

The saved admin UPI ID remains unchanged and is used only for setup previews. Razorpay payments settle to the bank account configured in Razorpay, not automatically to that saved UPI ID. Google Play payments are not implemented.

Free mode remains enabled unless the administrator changes it. Expiry blocks Maps and AI usage in paid mode; free mode and admin access remain exceptions.

## Checks performed

- Signed-in live monthly ₹20 and yearly ₹200 checkout windows opened, without completing a payment.
- Pending payments were visible after reload and repeated checkout reused the existing unpaid orders.
- Unpaid verification left access unchanged; signed-out payment actions opened sign-in and hid payment history.
- Desktop and mobile layouts checked; mobile page had no horizontal overflow.
- Temporary database tests verified calendar-month/year expiry, preserved paid time, duplicate confirmation protection, isolation from another user's expiry, and restricted write permissions; all temporary rows rolled back.
- 18 automated tests passed for payment proof, sign-in return paths, access rules and expiry guards.

A real completed payment and the published webhook delivery have not been exercised. Verify those after deploying and configuring the webhook, using a genuine buyer payment. Do not manually mark a purchase paid to simulate this check.