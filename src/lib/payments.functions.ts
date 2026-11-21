import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tierSchema } from "./payment-rules";

export const startPayment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tier: tierSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { razorpayConfig } = await import("./razorpay.server");
    if (!razorpayConfig().live) throw new Error("Live payments are not available yet.");
    const { data: order, error } = await context.supabase.rpc("reserve_payment_order", { _tier: data.tier, _mode: "live" });
    if (error) throw error;
    if (!order || order.user_id !== context.userId) throw new Error("Could not prepare your payment.");
    const { preparePayment } = await import("./payments.server");
    return preparePayment(order);
  });

export const checkPayment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase.from("payment_orders").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Payment not found for your account.");
    const { confirmPayment, preparePayment } = await import("./payments.server");
    if (!order.razorpay_order_id) {
      await preparePayment(order);
      const { data: refreshed, error: refreshError } = await context.supabase.from("payment_orders").select("*").eq("id", data.id).single();
      if (refreshError) throw refreshError;
      return confirmPayment(refreshed);
    }
    return confirmPayment(order);
  });

export const paymentAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env['RAZORPAY_CONNECTION_KEY_ID'];
  return { live: Boolean(process.env['LOVABLE_API_KEY'] && process.env['RAZORPAY_CONNECTION_KEY'] && key?.startsWith("rzp_live_")) };
});