import { z } from "zod";

export const tierSchema = z.enum(["monthly", "yearly"]);
export type PaymentTier = z.infer<typeof tierSchema>;
export const razorpayOrderSchema = z.object({
  id: z.string().regex(/^order_[A-Za-z0-9]+$/), amount: z.number().int(), amount_paid: z.number().int(),
  currency: z.string(), status: z.string(), receipt: z.string().nullable(),
});
export const razorpayPaymentSchema = z.object({
  id: z.string().regex(/^pay_[A-Za-z0-9]+$/), order_id: z.string(), amount: z.number().int(),
  currency: z.string(), status: z.string(), amount_refunded: z.number().default(0),
});
export function isVerifiedPayment(order: z.infer<typeof razorpayOrderSchema>, payment: z.infer<typeof razorpayPaymentSchema>, stored: { id: string; razorpay_order_id: string | null; amount_paise: number; mode: string }) {
  return stored.mode === "live" && order.id === stored.razorpay_order_id && order.receipt === stored.id
    && order.status === "paid" && order.currency === "INR" && order.amount === stored.amount_paise && order.amount_paid === stored.amount_paise
    && payment.order_id === order.id && payment.status === "captured" && payment.currency === "INR"
    && payment.amount === stored.amount_paise && payment.amount_refunded === 0;
}