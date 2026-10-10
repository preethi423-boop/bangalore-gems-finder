import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { validSubscriptionSettings } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SubscriptionAdmin({ userId }: { userId: string }) {
  const query = useSubscription(userId);
  const client = useQueryClient();
  const [paid, setPaid] = useState(false);
  const [days, setDays] = useState("2");
  const [monthly, setMonthly] = useState("");
  const [yearly, setYearly] = useState("");
  useEffect(() => {
    if (!query.data) return;
    const s = query.data.settings;
    setPaid(s?.paid_mode ?? false); setDays(String(s?.trial_days ?? 2));
    setMonthly(s?.monthly_price == null ? "" : String(s.monthly_price));
    setYearly(s?.yearly_price == null ? "" : String(s.yearly_price));
  }, [query.data?.settings]);
  const save = useMutation({ mutationFn: async () => {
    const m = monthly.trim() ? Number(monthly) : null;
    const y = yearly.trim() ? Number(yearly) : null;
    if (!validSubscriptionSettings(Number(days), m, y, paid)) throw new Error("Enter positive monthly and yearly prices before enabling subscriptions.");
    const { error } = await supabase.from("subscription_settings").upsert({ id: true, paid_mode: paid, trial_days: Number(days), monthly_price: m, yearly_price: y, currency: "INR", updated_at: new Date().toISOString() });
    if (error) throw error;
  }, onSuccess: () => client.invalidateQueries({ queryKey: ["subscription-access"] }) });
  return <section className="mt-6 border-t border-border pt-5">
    <h2 className="text-base font-semibold">Subscription access</h2>
    {query.isError ? <p className="mt-2 text-sm text-destructive">Could not load access settings.</p> : null}
    <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between gap-4"><Label htmlFor="paid-mode">Require subscription</Label><Switch id="paid-mode" checked={paid} onCheckedChange={setPaid} /></div>
      <p className="text-xs text-muted-foreground">{paid ? "A trial or active subscription is required. Admins retain access." : "Everyone can use Namma Spot for free. Trial time is not consumed."}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="monthly-price">Monthly price (₹)</Label><Input id="monthly-price" type="number" min="0.01" step="0.01" value={monthly} onChange={e => setMonthly(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="yearly-price">Yearly price (₹)</Label><Input id="yearly-price" type="number" min="0.01" step="0.01" value={yearly} onChange={e => setYearly(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="trial-days">Free trial</Label><Select value={days} onValueChange={setDays}><SelectTrigger id="trial-days"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 day</SelectItem><SelectItem value="2">2 days</SelectItem></SelectContent></Select></div>
      </div>
      <p className="text-xs text-muted-foreground">Play Store and UPI payments are not connected. Enabling subscriptions now limits users to their free trial.</p>
      <Button type="submit" disabled={query.isPending || query.isError || save.isPending}>Save access settings</Button>
      {save.isError ? <p role="alert" className="text-sm text-destructive">{save.error.message}</p> : save.isSuccess ? <p role="status" className="text-sm text-primary">Access settings saved.</p> : null}
    </form>
  </section>;
}