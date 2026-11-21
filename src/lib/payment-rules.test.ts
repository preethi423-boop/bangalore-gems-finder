import { describe, expect, it } from "vitest";
import { isVerifiedPayment } from "./payment-rules";

describe("verified prepaid access", () => {
  const stored = { id: "purchase-id", razorpay_order_id: "order_123", amount_paise: 2000, mode: "live" };
  const order = { id: "order_123", receipt: "purchase-id", amount: 2000, amount_paid: 2000, currency: "INR", status: "paid" };
  const payment = { id: "pay_123", order_id: "order_123", amount: 2000, currency: "INR", status: "captured", amount_refunded: 0 };
  it("accepts only the verified full live payment for the stored purchase", () => {
    expect(isVerifiedPayment(order, payment, stored)).toBe(true);
    expect(isVerifiedPayment({ ...order, receipt: "another-user-purchase" }, payment, stored)).toBe(false);
    expect(isVerifiedPayment(order, { ...payment, order_id: "order_other" }, stored)).toBe(false);
  });
  it("never grants access for test payments", () => {
    expect(isVerifiedPayment(order, payment, { ...stored, mode: "test" })).toBe(false);
  });
  it("does not grant access from a click, failed or merely authorized payment", () => {
    for (const status of ["created", "attempted", "failed"]) expect(isVerifiedPayment({ ...order, status }, payment, stored)).toBe(false);
    for (const status of ["authorized", "failed", "refunded"]) expect(isVerifiedPayment(order, { ...payment, status }, stored)).toBe(false);
  });
  it("rejects short, foreign-currency and refunded payments", () => {
    expect(isVerifiedPayment({ ...order, amount_paid: 1900 }, payment, stored)).toBe(false);
    expect(isVerifiedPayment(order, { ...payment, amount: 1900 }, stored)).toBe(false);
    expect(isVerifiedPayment(order, { ...payment, currency: "USD" }, stored)).toBe(false);
    expect(isVerifiedPayment(order, { ...payment, amount_refunded: 1 }, stored)).toBe(false);
  });
});