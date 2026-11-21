<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Nearby AI uses an authenticated streaming server route and server-only AI SDK helpers so secrets never enter the browser.
- Place photos use Places photo resources with contributor attribution, lazy one-photo retrieval and access guards; never imply place photos belong to specific reviews because Places does not expose that association.
- Recommendations are ID-grounded to the selected location's attraction, food and shopping candidates, with distance filtering and output validation to prevent invented place links.
- Durable AI failure state is server-only; gateway credit/access blocks pause requests until a verified admin explicitly resumes after restoration.
- Place navigation stores map/search snapshots in browser history and ignores superseded requests so Back restores the previous view without stale place updates.
- Sponsored offers remain site-wide admin content and are periodically refreshed; never label them as location-targeted without location data.
- Subscription access is database-authoritative: admin-controlled settings, once-per-account explicit trials, and service-only paid entitlements; server Maps and AI calls verify access, while user-key Maps remain third-party browser calls behind the UI gate.
- Do not activate purchase controls or grant paid access until a real payment provider verifies purchases; Play Store and UPI setup is pending and displayed as unavailable.
- Admin draft previews share subscription plan rendering with the visitor page and never write settings until Save; preserve unsaved drafts during background refreshes.
- Prebundle lazy admin tabs alongside React to prevent mixed dependency generations during development.
- Trial duration uses the additive trial_duration_days column; the deprecated trial_days column is never read by new code.
- A shared access deadline guard blocks and aborts browser data calls at expiry; the access gate unmounts exploration while server calls independently check database access.
- UPI QR codes are generated locally for admin setup previews only until verified payment processing is connected; QR transfers never grant entitlements.
- When Google rejects a browser Maps key (gm_authFailure), the app marks it rejected for the session, auto-reloads once onto the built-in managed key, shows a banner, and routes search/details/nearby through the server path; saving a new key clears the rejection.
- EV routes use real car-charging candidates within the selected destination range, ranked by approximate detour and passed as a Routes waypoint; this includes road detours in driving time without claiming charging duration or connector compatibility.
- Google sign-in uses the Lovable broker on Lovable-hosted origins and direct backend OAuth (owner's own Google client) on self-hosted domains, because the broker's /~oauth paths only exist on Lovable hosting.
- Razorpay calls use one server-only connector gateway helper and hosted Checkout; provider credentials and card inputs must never enter app forms.
