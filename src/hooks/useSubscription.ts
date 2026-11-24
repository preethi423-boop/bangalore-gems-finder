import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { hasSubscriptionAccess } from "@/lib/subscription";

export function useSubscription(userId?: string) {
  const [now, setNow] = useState(0);
  const query = useQuery({
    queryKey: ["subscription-access", userId ?? "public"],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: settings, error } = await supabase.rpc("get_subscription_settings").maybeSingle();
      if (error) throw error;
      const { data: access, error: accessError } = userId
        ? await supabase.from("subscription_access").select("*").eq("user_id", userId).maybeSingle()
        : { data: null, error: null };
      if (accessError) throw accessError;
      const { data: allowed, error: allowedError } = await supabase.rpc("can_use_subscription_app");
      if (allowedError) throw allowedError;
      const { data: admin, error: roleError } = userId ? await supabase.rpc("has_role", { _user_id: userId, _role: "admin" }) : { data: false, error: null };
      if (roleError) throw roleError;
      return { settings, access, admin: admin === true, allowed: allowed === true };
    },
  });
  const deadline = query.data?.settings?.paid_mode && !query.data.admin
    ? Math.max(0, ...[query.data.access?.trial_ends_at, query.data.access?.subscription_ends_at].map(value => value ? Date.parse(value) || 0 : 0))
    : Infinity;
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const delay = Math.max(0, deadline - Date.now());
    const timer = Number.isFinite(delay) ? window.setTimeout(tick, Math.min(delay, 2147483647)) : undefined;
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { clearTimeout(timer); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [deadline]);
  const paidMode = query.data?.settings?.paid_mode === true;
  const hasAccess = hasSubscriptionAccess(
    {
       paidMode,
       admin: query.data?.admin ?? false,
       trialEndsAt: query.data?.access?.trial_ends_at,
       subscriptionEndsAt: query.data?.access?.subscription_ends_at,
     },
     now || Date.now(),
    );
   const allowed = !paidMode || (query.data?.allowed === true && hasAccess);
  return { ...query, data: query.data ? { ...query.data, allowed, deadline } : undefined };
} 

