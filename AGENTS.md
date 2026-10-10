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
- Recommendations are ID-grounded to the selected location's attraction, food and shopping candidates, with distance filtering and output validation to prevent invented place links.
- Durable AI failure state is server-only; gateway credit/access blocks pause requests until a verified admin explicitly resumes after restoration.
- Place navigation stores map/search snapshots in browser history and ignores superseded requests so Back restores the previous view without stale place updates.
- Sponsored offers remain site-wide admin content and are periodically refreshed; never label them as location-targeted without location data.
