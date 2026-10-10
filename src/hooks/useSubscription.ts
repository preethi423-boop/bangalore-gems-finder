import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSubscription(userId?: string) {
  return useQuery({
    queryKey: ["subscription-access", userId ?? "public"],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: settings, error } = await supabase.from("subscription_settings").select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      const { data: access, error: accessError } = userId
        ? await supabase.from("subscription_access").select("*").eq("user_id", userId).maybeSingle()
        : { data: null, error: null };
      if (accessError) throw accessError;
      const { data: allowed, error: allowedError } = await supabase.rpc("can_use_subscription_app");
      if (allowedError) throw allowedError;
      return { settings, access, allowed: allowed === true };
    },
  });
}