import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminMapsSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !allowed) throw new Error("Only administrators can manage Google Maps settings.");
  const { data, error: settingsError } = await context.supabase.from("google_maps_settings").select("browser_key,server_key").eq("id", true).maybeSingle();
  if (settingsError) throw new Error("Map settings could not be loaded.");
  return { browserConfigured: Boolean(data?.browser_key || process.env.GOOGLE_API_KEY), serverConfigured: Boolean(data?.server_key || process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY) };
});

export const saveAdminMapsSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { browserKey: string; serverKey: string; reset?: boolean }) => {
    const browserKey = String(data.browserKey ?? "").trim();
    const serverKey = String(data.serverKey ?? "").trim();
    if ([browserKey, serverKey].some(k => k && !/^AIza[\w-]{20,100}$/.test(k))) throw new Error("Enter a valid Google API key.");
    return { browserKey, serverKey, reset: data.reset === true };
  }).handler(async ({ context, data }) => {
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !allowed) throw new Error("Only administrators can manage Google Maps settings.");
    const { data: current, error: readError } = await context.supabase.from("google_maps_settings").select("browser_key,server_key").eq("id", true).maybeSingle();
    if (readError) throw new Error("Map settings could not be loaded.");
    const { error: saveError } = await context.supabase.from("google_maps_settings").upsert({ id: true, browser_key: data.reset ? "" : data.browserKey || current?.browser_key || "", server_key: data.reset ? "" : data.serverKey || current?.server_key || "" });
    if (saveError) throw new Error("Map settings could not be saved.");
    return { saved: true };
  });
