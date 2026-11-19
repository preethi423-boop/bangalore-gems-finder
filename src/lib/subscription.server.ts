import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

export async function requireSubscriptionAccess() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Access service is unavailable.");

  const authorization = getRequest().headers.get("authorization");
  const token = authorization?.replace(/^Bearer\\s+/i, "");

  // Supabase clients send the anonymous publishable token even when there is
  // no signed-in user. Public map requests must be allowed through so the
  // server-side Google Maps key can load place details for new visitors.
  let tokenRole: string | undefined;
  if (token) {
    try {
      const payload = token.split(".")[1];
      if (payload) {
        tokenRole = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role;
      }
    } catch {
      tokenRole = undefined;
    }
  }

  if (!authorization || tokenRole === "anon") return;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("Authorization");
        headers.set("Authorization", authorization);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data, error } = await client.rpc("can_use_subscription_app");
  if (error || data !== true) throw new Error("Start your free trial or subscribe to continue.");
}
