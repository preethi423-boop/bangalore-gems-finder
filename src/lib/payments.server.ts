import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { razorpay, razorpayConfig } from "./razorpay.server";
import { isVerifiedPayment, razorpayOrderSchema, razorpayPaymentSchema } from "./payment-rules";

type Purchase = Database['public']['Tables']['payment_orders']['Row'];

const razorpayPlanSchema = z.object({
  id: z.string(),
  period: z.string(),
  interval: z.number(),
  item: z.object({
    amount: z.number(),
    currency: z.string(),
  }),
});

const razorpaySubscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  plan_id: z.string(),
  current_end: z.number().nullable().optional(),
  ended_at: z.number().nullable().optional(),
  paid_count: z.number().optional(),
});

const razorpayInvoiceSchema = z.object({
  id: z.string(),
  status: z.string(),
  payment_id: z.string().nullable().optional(),
});

function formatSubscriptionStatus(sub: z.infer<typeof razorpaySubscriptionSchema>) {
  return {
    subscriptionId: sub.id,
    status: sub.status,
    currentEnd: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
    endedAt: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
  };
}

async function getOrCreatePlan(tier: "monthly" | "yearly", amountPaise: number) {
  const list = await razorpay("plans?count=100", z.object({ items: z.array(razorpayPlanSchema) }));
  const existing = list.items.find(
    (p) => p.period === tier && p.interval === 1 && p.item.amount === amountPaise && p.item.currency === "INR"
  );
  if (existing) return existing;
  return razorpay("plans", razorpayPlanSchema, {
    method: "POST",
    body: {
      period: tier,
      interval: 1,
      item: {
        name: tier === "monthly" ? "Namma Spot Monthly" : "Namma Spot Yearly",
        amount: amountPaise,
        currency: "INR",
        description: "Namma Spot auto-renewing subscription",
      },
    },
  });
}

export async function preparePayment(purchase: Purchase) {
  const config = razorpayConfig();
  if (!config.live || purchase.mode !== "live") throw new Error("Test payments cannot unlock live access.");
  if (!purchase.razorpay_order_id) {
    const { data: claim, error } = await supabaseAdmin.from("payment_orders")
      .update({ creation_attempt_at: new Date().toISOString() }).eq("id", purchase.id)
      .is("creation_attempt_at", null).is("razorpay_order_id", null).select("id").maybeSingle();
    if (error) throw error;
    if (!claim) {
      throw new Error("Your payment is still being prepared. Please check again shortly; do not pay outside Razorpay.");
    }
    const tier = purchase.tier === "yearly" ? "yearly" : "monthly";
    const plan = await getOrCreatePlan(tier, purchase.amount_paise);
    const subscription = await razorpay("subscriptions", razorpaySubscriptionSchema, {
      method: "POST",
      body: {
        plan_id: plan.id,
        total_count: purchase.tier === "monthly" ? 120 : 10,
        quantity: 1,
        customer_notify: 1,
        notes: { orderId: purchase.id, userId: purchase.user_id, tier: purchase.tier },
      },
    });
    const { error: saveError } = await supabaseAdmin.from("payment_orders").update({ razorpay_order_id: subscription.id })
      .eq("id", purchase.id).is("razorpay_order_id", null);
    if (saveError) throw saveError;
    purchase = { ...purchase, razorpay_order_id: subscription.id };
  }
  return {
    orderId: purchase.id,
    rzpOrderId: purchase.razorpay_order_id,
    rzpSubscriptionId: purchase.razorpay_order_id,
    amount: purchase.amount_paise,
    currency: purchase.currency,
    keyId: config.keyId,
    tier: purchase.tier,
  };
}

export async function confirmPayment(purchase: Purchase) {
  if (purchase.status === "paid") return { paid: true, expiresAt: purchase.access_until };
  if (!razorpayConfig().live || purchase.mode !== "live") throw new Error("Test payments cannot unlock live access.");
  if (!purchase.razorpay_order_id) return { paid: false, expiresAt: null };

  if (purchase.razorpay_order_id.startsWith("sub_")) {
    const sub = await razorpay(`subscriptions/${purchase.razorpay_order_id}`, razorpaySubscriptionSchema);
    if (sub.status === "active" || sub.status === "authenticated" || (sub.paid_count ?? 0) >= 1) {
      const invoices = await razorpay(
        `invoices?subscription_id=${sub.id}`,
        z.object({ items: z.array(razorpayInvoiceSchema) })
      );
      const invoice = invoices.items.find((inv) => inv.payment_id && /^pay_[A-Za-z0-9]+$/.test(inv.payment_id));
      const paymentId = invoice?.payment_id;
      if (paymentId) {
        const { data, error } = await supabaseAdmin.rpc("complete_payment_order", {
          _order_id: purchase.id,
          _payment_id: paymentId,
        });
        if (error) throw error;
        return { paid: data.status === "paid", expiresAt: data.access_until };
      }
    }
    return { paid: false, expiresAt: null };
  }

  let order = await razorpay(`orders/${purchase.razorpay_order_id}`, razorpayOrderSchema);
  let payments = await razorpay(`orders/${order.id}/payments`, z.object({ items: z.array(razorpayPaymentSchema) }));
  let payment = payments.items.find((p) => isVerifiedPayment(p, order, purchase));
  if (!payment && order.status === "paid") {
    order = await razorpay(`orders/${purchase.razorpay_order_id}`, razorpayOrderSchema);
    payments = await razorpay(`orders/${order.id}/payments`, z.object({ items: z.array(razorpayPaymentSchema) }));
    payment = payments.items.find((p) => isVerifiedPayment(p, order, purchase));
  }
  if (!payment) return { paid: false, expiresAt: null };
  const { data, error } = await supabaseAdmin.rpc("complete_payment_order", {
    _order_id: purchase.id,
    _payment_id: payment.id,
  });
  if (error) throw error;
  return { paid: data.status === "paid", expiresAt: data.access_until };
}
export async function getSubscriptionStatus(subscriptionId: string) {
  const sub = await razorpay(`subscriptions/${subscriptionId}`, razorpaySubscriptionSchema);
  return formatSubscriptionStatus(sub);
}

export async function cancelRazorpaySubscription(subscriptionId: string) {
  let sub: z.infer<typeof razorpaySubscriptionSchema>;
  try {
    sub = await razorpay(`subscriptions/${subscriptionId}/cancel`, razorpaySubscriptionSchema, {
      method: "POST",
      body: { cancel_at_cycle_end: true },
    });
  } catch {
    sub = await razorpay(`subscriptions/${subscriptionId}/cancel`, razorpaySubscriptionSchema, {
      method: "POST",
      body: { cancel_at_cycle_end: false },
    });
  }
  return formatSubscriptionStatus(sub);
}

export async function handleRazorpayWebhook(payload: unknown) {
  const parsed = z.object({
    payload: z.object({
      payment: z.object({ entity: z.object({ order_id: z.string().optional() }) }).optional(),
      order: z.object({ entity: z.object({ id: z.string().optional() }) }).optional(),
      subscription: z.object({ entity: z.object({ id: z.string().optional() }) }).optional(),
    }).optional(),
  }).safeParse(payload);
  if (!parsed.success) return;

  const subId = parsed.data.payload?.subscription?.entity?.id;
  if (subId && /^sub_[A-Za-z0-9]+$/.test(subId)) {
    const { data, error } = await supabaseAdmin.from("payment_orders").select("*").eq("razorpay_order_id", subId).maybeSingle();
    if (error) throw error;
    if (!data) return;
    if (data.status !== "paid") {
      await confirmPayment(data);
    } else {
      const sub = await razorpay(`subscriptions/${subId}`, razorpaySubscriptionSchema);
      if (sub.status === "active" && sub.current_end) {
        const nextEnd = new Date(sub.current_end * 1000).toISOString();
        const { data: access, error: accessError } = await supabaseAdmin
          .from("subscription_access")
          .select("subscription_ends_at")
          .eq("user_id", data.user_id)
          .maybeSingle();
        if (accessError) throw accessError;
        if (!access?.subscription_ends_at || nextEnd > access.subscription_ends_at) {
          const { error: updateError } = await supabaseAdmin
            .from("subscription_access")
            .update({ subscription_ends_at: nextEnd })
            .eq("user_id", data.user_id);
          if (updateError) throw updateError;
        }
      }
    }
    return;
  }

  const id = parsed.data.payload?.payment?.entity?.order_id ?? parsed.data.payload?.order?.entity?.id;
  if (!id || !/^order_[A-Za-z0-9]+$/.test(id)) return;
  const { data, error } = await supabaseAdmin.from("payment_orders").select("*").eq("razorpay_order_id", id).maybeSingle();
  if (error) throw error;
  // The event body is only a lookup hint, never proof. The authenticated
  // provider read inside confirmPayment is required before any write.
  if (data) await confirmPayment(data);
}
