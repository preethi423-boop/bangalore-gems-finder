export async function readSharedMapsSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("google_maps_settings").select("browser_key,server_key").eq("id", true).maybeSingle();
  if (error) throw new Error("Shared map settings could not be loaded.");
  return { browserKey: data?.browser_key ?? "", serverKey: data?.server_key ?? "" };
}
