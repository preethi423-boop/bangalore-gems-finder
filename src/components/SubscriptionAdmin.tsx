import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Save, RotateCcw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { UpiPreview } from "@/components/UpiPreview";
import { validUpi } from "@/lib/upi";
import { validSubscriptionSettings } from "@/lib/subscription";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SubscriptionAdmin({ userId }: { userId: string }) {
  const query = useSubscription(userId);
  const client = useQueryClient();
  const [paid, setPaid] = useState(false);
  const [days, setDays] = useState("2");
  const [monthly, setMonthly] = useState("");
  const [yearly, setYearly] = useState("");
  const [upi, setUpi] = useState("");
  const [payee, setPayee] = useState("");
  const dirty = useRef(false);
  const [edited, setEdited] = useState(false);
  const restore = () => {
    const s = query.data?.settings;
    setPaid(s?.paid_mode ?? false); setDays(String(s?.trial_duration_days ?? 2));
    setMonthly(s?.monthly_price == null ? "" : String(s.monthly_price));
    setYearly(s?.yearly_price == null ? "" : String(s.yearly_price));
    setUpi(s?.upi_id ?? ""); setPayee(s?.upi_payee_name ?? "");
    dirty.current = false; setEdited(false);
  };
  useEffect(() => {
    if (!query.data || dirty.current) return;
    restore();
  }, [query.data?.settings]);
  const edit = () => { dirty.current = true; setEdited(true); save.reset(); };
  const m = monthly.trim() ? Number(monthly) : null;
  const y = yearly.trim() ? Number(yearly) : null;
  const save = useMutation({ mutationFn: async () => {
    if (!validSubscriptionSettings(Number(days), m, y, paid)) throw new Error("Enter positive monthly and yearly prices before enabling subscriptions.");
    if ((upi.trim() || payee.trim()) && !validUpi(upi.trim(), payee.trim())) throw new Error("Enter a valid UPI ID and account holder name, or clear both.");
    const { error } = await supabase.from("subscription_settings").upsert({ id: true, paid_mode: paid, trial_duration_days: Number(days), upi_id: upi.trim() || null, upi_payee_name: payee.trim() || null, monthly_price: m, yearly_price: y, currency: "INR", updated_at: new Date().toISOString() });
    if (error) throw error;
  }, onSuccess: async () => {
    dirty.current = false; setEdited(false);
    await client.invalidateQueries({ queryKey: ["subscription-access"] });
  } });
  return <section className="mt-6 border-t border-border pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Subscription access</h2><Badge variant="secondary">Live: {query.data?.settings?.paid_mode ? "Subscription required" : "Free access"}</Badge></div>
    {query.isError ? <p role="alert" className="mt-2 text-sm text-destructive">Could not load access settings.</p> : null}
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <form className="min-w-0 space-y-5" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <fieldset className="space-y-5" disabled={query.isPending || query.isError || save.isPending}>
          <div className="flex items-center justify-between gap-4"><div><Label htmlFor="free-access">Free access for everyone</Label><p className="mt-1 text-xs text-muted-foreground">{paid ? "Trial or subscription required" : "No subscription required"}</p></div><Switch id="free-access" checked={!paid} onCheckedChange={free => { edit(); setPaid(!free); }} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="monthly-price">Monthly price (₹)</Label><Input id="monthly-price" type="number" min="0.01" max="99999999.99" step="0.01" value={monthly} onChange={e => { edit(); setMonthly(e.target.value); }} /></div>
            <div className="space-y-2"><Label htmlFor="yearly-price">Yearly price (₹)</Label><Input id="yearly-price" type="number" min="0.01" max="99999999.99" step="0.01" value={yearly} onChange={e => { edit(); setYearly(e.target.value); }} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="trial-days">Free trial duration</Label><Select value={days} onValueChange={value => { edit(); setDays(value); }}><SelectTrigger id="trial-days"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 15 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1} {i === 0 ? "day" : "days"}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Applies to new trials. Existing trial end dates stay unchanged.</p></div>
          <div className="border-l-2 border-primary pl-3 text-sm"><ShieldCheck className="mb-2 size-4 text-primary" /><p>Admins always retain access. Free mode does not start new trials.</p></div>
          <div className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">UPI receiving account</h3><div className="space-y-2"><Label htmlFor="upi-id">UPI ID</Label><Input id="upi-id" placeholder="name@bank" maxLength={100} value={upi} onChange={e => { edit(); setUpi(e.target.value); }} /></div><div className="space-y-2"><Label htmlFor="upi-name">Account holder name</Label><Input id="upi-name" maxLength={100} value={payee} onChange={e => { edit(); setPayee(e.target.value); }} /></div><p className="text-xs text-muted-foreground">Account setup and QR previews only. Visitor payments remain unavailable until verified payment processing is connected. Play Store setup is also pending.</p></div>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!edited}><Save className="size-4" />{save.isPending ? "Saving…" : "Save access settings"}</Button><Button type="button" variant="outline" disabled={!edited} onClick={() => { restore(); save.reset(); }}><RotateCcw className="size-4" /> Discard</Button></div>
        </fieldset>
        {save.isError ? <p role="alert" className="text-sm text-destructive">{save.error.message}</p> : save.isSuccess ? <p role="status" className="text-sm text-primary">Access settings saved.</p> : edited ? <p role="status" className="text-xs text-muted-foreground">Unsaved changes</p> : null}
      </form>
      <aside className="min-w-0 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0" aria-label="Live visitor preview">
        <div className="flex items-center justify-between gap-3"><h3 className="inline-flex items-center gap-2 text-sm font-semibold"><Eye className="size-4" /> Visitor preview</h3><Badge variant="outline">{edited ? "Draft" : "Saved"}</Badge></div>
        <h4 className="mt-6 text-xl font-semibold">Namma Spot access</h4>
        <p className="mb-5 mt-2 text-sm text-muted-foreground">{paid ? "Choose monthly or yearly access to explore Bengaluru." : "Namma Spot is currently free for everyone."}</p>
        <SubscriptionPlans monthly={m} yearly={y} />
        {validUpi(upi.trim(), payee.trim()) ? <div className="mt-6 space-y-5"><h3 className="text-sm font-semibold">UPI QR previews · admin only</h3>{m && m > 0 ? <UpiPreview id={upi.trim()} name={payee.trim()} amount={m} plan="Monthly" /> : null}{y && y > 0 ? <UpiPreview id={upi.trim()} name={payee.trim()} amount={y} plan="Yearly" /> : null}</div> : null}
        <Button className="mt-6" disabled>{paid ? `Sign in to start ${days}-day trial` : "Explore for free"}</Button>
        <p className="mt-3 text-xs text-muted-foreground">No payment is taken for the trial. Play Store and UPI payments are not available yet.</p>
      </aside>
    </div>
  </section>;
}
