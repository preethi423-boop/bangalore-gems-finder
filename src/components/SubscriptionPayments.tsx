import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startPayment, checkPayment, paymentAvailability } from "@/lib/payments.functions";
import { openRazorpay } from "@/lib/razorpay-checkout";
import type { PaymentTier } from "@/lib/payment-rules";
import { SubscriptionPlans } from "./SubscriptionPlans";
import { Button } from "./ui/button";

export function SubscriptionPayments({ userId, monthly, yearly }: { userId?: string; monthly?: number | null; yearly?: number | null }) {
  const create = useServerFn(startPayment);
  const verify = useServerFn(checkPayment);
  const availability = useServerFn(paymentAvailability);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const live = useQuery({ queryKey: ["payment-availability"], queryFn: () => availability() });
  const history = useQuery({
    queryKey: ["payment-orders", userId], enabled: Boolean(userId), refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("payment_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      // Reconcile pending purchases when a buyer returns from a UPI app or
      // reloads. Never infer success from Checkout's browser callback.
      for (const order of data.filter(item => item.status === "pending" && item.razorpay_order_id)) {
        try {
          const result = await verify({ data: { id: order.id } });
          if (result.paid) await client.invalidateQueries({ queryKey: ["subscription-access"] });
        } catch { /* The pending row and Check payment action remain visible. */ }
      }
      const refreshed = await supabase.from("payment_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
      if (refreshed.error) throw refreshed.error;
      return refreshed.data;
    },
  });
  const confirm = useMutation({
    mutationFn: (id: string) => verify({ data: { id } }),
    onSuccess: async result => {
      await client.invalidateQueries({ queryKey: ["payment-orders"] });
      await client.invalidateQueries({ queryKey: ["subscription-access"] });
      if (result.paid) {
        setMessage(`Payment verified. Access expires ${result.expiresAt ? new Date(result.expiresAt).toLocaleString("en-IN") : "on your account's updated expiry date"}.`);
        await navigate({ to: "/" });
      } else setMessage("Payment has not been confirmed yet. Your access has not changed; check again after paying in Razorpay.");
    },
    onError: error => setFailure(error.message),
  });
  const purchase = useMutation({
    mutationFn: async (tier: PaymentTier) => {
      setFailure(""); setMessage("");
      const order = await create({ data: { tier } });
      if (!order.rzpOrderId) throw new Error("Could not prepare your payment.");
      await client.invalidateQueries({ queryKey: ["payment-orders"] });
      setCheckoutOpen(true);
      const finish = () => { setCheckoutOpen(false); confirm.mutate(order.orderId); };
      try {
        await openRazorpay({ key: order.keyId, order_id: order.rzpOrderId, amount: order.amount, currency: order.currency, name: "Namma Spot", description: `${tier === "monthly" ? "One month" : "One year"} of access · no auto-renewal`, handler: finish, modal: { ondismiss: finish } }, setFailure);
      } catch (error) { setCheckoutOpen(false); throw error; }
    },
    onError: error => { setFailure(error.message); void client.invalidateQueries({ queryKey: ["payment-orders"] }); },
  });
  return <section aria-label="Subscription payments" className="space-y-4">
    <SubscriptionPlans monthly={monthly} yearly={yearly} busy={purchase.isPending || checkoutOpen || confirm.isPending || live.isPending} unavailable={live.isError || live.data?.live === false} onPurchase={tier => userId ? purchase.mutate(tier) : void navigate({ to: "/auth", search: { returnTo: "/subscription" } })} />
    {!userId ? <Button asChild variant="outline"><Link to="/auth" search={{ returnTo: "/subscription" }}>Sign in to pay</Link></Button> : null}
    <p className="text-xs text-muted-foreground">One payment buys one calendar month or year. No automatic renewal. Any remaining paid time is kept when you pay again.</p>
    {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    {history.isError ? <p role="alert" className="text-sm text-destructive">Could not load your payments. <Button variant="link" onClick={() => history.refetch()}>Retry</Button></p> : null}
    {history.data?.length ? <div className="border-t border-border pt-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="size-4" /> Your payments</h2><ul className="mt-3 divide-y divide-border">{history.data.map(order => <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{order.tier === "monthly" ? "Monthly" : "Yearly"} · ₹{(order.amount_paise / 100).toFixed(2)}</p><p className="mt-1 text-xs text-muted-foreground">{order.status === "paid" ? `Verified · expires ${order.access_until ? new Date(order.access_until).toLocaleString("en-IN") : "—"}` : "Awaiting payment confirmation"}</p></div>{order.status === "pending" ? <Button variant="outline" size="sm" disabled={confirm.isPending || checkoutOpen} onClick={() => { setFailure(""); confirm.mutate(order.id); }}><RefreshCw className="size-4" /> Check payment</Button> : null}</li>)}</ul></div> : null}
  </section>;
}