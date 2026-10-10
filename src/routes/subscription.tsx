import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";

export const Route = createFileRoute("/subscription")({
  head: () => ({ meta: [
    { title: "Plans & access — Namma Spot" },
    { name: "description", content: "Monthly and yearly Namma Spot access, free trials and your subscription status." },
    { property: "og:title", content: "Plans & access — Namma Spot" },
    { property: "og:description", content: "Manage your Namma Spot trial and subscription access for exploring Bengaluru." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: SubscriptionPage,
});

function SubscriptionPage() {
  const { user, isAdmin, loading } = useAuth();
  const query = useSubscription(user?.id);
  const client = useQueryClient();
  const navigate = useNavigate();
  const start = useMutation({ mutationFn: async () => {
    const { error } = await supabase.rpc("start_subscription_trial");
    if (error) throw error;
  }, onSuccess: () => client.invalidateQueries({ queryKey: ["subscription-access"] }) });
  const signOut = async () => { await client.cancelQueries(); client.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); };
  const settings = query.data?.settings;
  const access = query.data?.access;
  const free = !settings?.paid_mode;
  return <main className="min-h-screen bg-background px-5 py-8"><div className="mx-auto max-w-xl">
    <nav className="flex flex-wrap items-center justify-between gap-3"><Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="size-4" /> Map</Link></Button>{user ? <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4" /> Sign out</Button> : null}</nav>
    <h1 className="mt-8 text-2xl font-semibold">Namma Spot access</h1>
    {loading || query.isPending ? <p className="mt-5 text-muted-foreground">Checking access…</p> : query.isError ? <div className="mt-5 space-y-3"><p className="text-destructive">Could not load your access.</p><Button onClick={() => query.refetch()}>Try again</Button></div> : <>
      <p className="mt-3 text-muted-foreground">{free ? "Namma Spot is currently free for everyone." : isAdmin ? "Your admin account has full access." : query.data?.allowed ? "Your access is active." : "Choose monthly or yearly access to explore Bengaluru."}</p>
      {access ? <div className="mt-5 border-l-2 border-primary pl-4 text-sm"><p>Trial ends: {new Date(access.trial_ends_at).toLocaleString("en-IN")}</p>{access.subscription_ends_at ? <p>Subscription ends: {new Date(access.subscription_ends_at).toLocaleString("en-IN")}</p> : null}</div> : null}
      <div className="mt-8"><SubscriptionPlans monthly={settings?.monthly_price} yearly={settings?.yearly_price} /></div>
      <div className="mt-8 space-y-3">
        {free ? <Button asChild><Link to="/">Explore for free</Link></Button> : !user ? <Button asChild><Link to="/auth" search={{ returnTo: "/" }}>Sign in to start {settings?.trial_days ?? 2}-day trial</Link></Button> : !access && !isAdmin ? <Button disabled={start.isPending} onClick={() => start.mutate()}>Start {settings?.trial_days ?? 2}-day free trial</Button> : query.data?.allowed ? <Button asChild><Link to="/">Continue exploring</Link></Button> : <p className="text-sm text-muted-foreground">Your trial has ended. Paid access will be available once payments are connected.</p>}
        <p className="text-xs text-muted-foreground">No payment is taken for the trial. Play Store and UPI payments are not available yet.</p>
        {start.isError ? <p role="alert" className="text-sm text-destructive">{start.error.message}</p> : null}
        {isAdmin ? <Button asChild variant="outline"><Link to="/admin">Manage access settings</Link></Button> : null}
      </div>
    </>}
  </div></main>;
}