import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { razorpay, razorpayConfig } from "./razorpay.server";
import { isVerifiedPayment, razorpayOrderSchema, razorpayPaymentSchema } from "./payment-rules";

type Purchase = Database['public']['Tables']['payment_orders']['Row'];

export async function preparePayment(purchase: Purchase) {
  const config = razorpayConfig();
  if (!config.live || purchase.mode !== "live") throw new Error("Test payments cannot unlock live access.");
  if (!purchase.razorpay_order_id) {
    // A creation attempt is claimed once, even after a timeout. Recover by our
    // unique receipt instead of issuing another potentially chargeable order.
    const { data: claim, error } = await supabaseAdmin.from("payment_orders")
      .update({ creation_attempt_at: new Date().toISOString() }).eq("id", purchase.id)
      .is("creation_attempt_at", null).is("razorpay_order_id", null).select("id").maybeSingle();
    if (error) throw error;
    let order;
    if (claim) {
      order = await razorpay("orders", razorpayOrderSchema, { method: "POST", body: {
        amount: purchase.amount_paise, currency: "INR", receipt: purchase.id, notes: { orderId: purchase.id },
      } });
    } else {
      const result = await razorpay(`orders?receipt=${encodeURIComponent(purchase.id)}&count=100`, z.object({ items: z.array(razorpayOrderSchema) }));
      order = result.items.find(item => item.receipt === purchase.id && item.amount === purchase.amount_paise && item.currency === "INR");
      if (!order) throw new Error("Your payment is still being prepared. Please check again shortly; do not pay outside Razorpay.");
    }
    if (order.receipt !== purchase.id || order.amount !== purchase.amount_paise || order.currency !== "INR") throw new Error("Payment order did not match your plan.");
    const { error: saveError } = await supabaseAdmin.from("payment_orders").update({ razorpay_order_id: order.id }).eq("id", purchase.id).is("razorpay_order_id", null);
    if (saveError) throw saveError;
    purchase = { ...purchase, razorpay_order_id: order.id };
  }
  return { orderId: purchase.id, rzpOrderId: purchase.razorpay_order_id, amount: purchase.amount_paise, currency: purchase.currency, keyId: config.keyId, tier: purchase.tier };
}

export async function confirmPayment(purchase: Purchase) {
  if (purchase.status === "paid") return { paid: true, expiresAt: purchase.access_until };
  if (!razorpayConfig().live || purchase.mode !== "live") throw new Error("Test payments cannot unlock live access.");
  if (!purchase.razorpay_order_id) return { paid: false, expiresAt: null };
  let order = await razorpay(`orders/${purchase.razorpay_order_id}`, razorpayOrderSchema);
  if (order.id !== purchase.razorpay_order_id || order.receipt !== purchase.id || order.amount !== purchase.amount_paise || order.currency !== "INR") throw new Error("Payment verification did not match your purchase.");
  const list = await razorpay(`orders/${order.id}/payments`, z.object({ items: z.array(razorpayPaymentSchema) }));
  let payment = list.items.find(item => item.status === "captured" && item.amount === purchase.amount_paise && item.order_id === order.id && item.currency === "INR" && item.amount_refunded === 0);
  if (!payment && order.status === "attempted") {
    const authorized = list.items.find(item => item.status === "authorized" && item.amount === purchase.amount_paise && item.order_id === order.id && item.currency === "INR");
    if (authorized) {
      payment = await razorpay(`payments/${authorized.id}/capture`, razorpayPaymentSchema, { method: "POST", body: { amount: purchase.amount_paise, currency: "INR" } });
      order = await razorpay(`orders/${order.id}`, razorpayOrderSchema);
    }
  }
  if (!payment || !isVerifiedPayment(order, payment, purchase)) return { paid: false, expiresAt: null };
  const { data, error } = await supabaseAdmin.rpc("complete_payment_order", { _order_id: purchase.id, _payment_id: payment.id });
  if (error) throw error;
  return { paid: data.status === "paid", expiresAt: data.access_until };
}

export async function handleRazorpayWebhook(payload: unknown) {
  const parsed = z.object({ payload: z.object({
    payment: z.object({ entity: z.object({ order_id: z.string().optional() }) }).optional(),
    order: z.object({ entity: z.object({ id: z.string().optional() }) }).optional(),
  }).optional() }).safeParse(payload);
  if (!parsed.success) return;
  const id = parsed.data.payload?.payment?.entity.order_id ?? parsed.data.payload?.order?.entity.id;
  if (!id || !/^order_[A-Za-z0-9]+$/.test(id)) return;
  const { data, error } = await supabaseAdmin.from("payment_orders").select("*").eq("razorpay_order_id", id).maybeSingle();
  if (error) throw error;
  // The event body is only a lookup hint, never proof. The authenticated
  // provider read inside confirmPayment is required before any write.
  if (data) await confirmPayment(data);
}