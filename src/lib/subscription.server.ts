import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

export async function requireSubscriptionAccess() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Access service is unavailable.");
  const authorization = getRequest().headers.get("authorization");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.delete("Authorization");
      if (authorization) headers.set("Authorization", authorization);
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await client.rpc("can_use_subscription_app");
  if (error || data !== true) throw new Error("Start your free trial or subscribe to continue.");
}