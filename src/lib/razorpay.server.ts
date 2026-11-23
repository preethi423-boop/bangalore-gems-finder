import { z } from "zod";

const RAZORPAY_API_URL = "https://api.razorpay.com/v1";

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Payments are not set up yet.");
  return { keyId, keySecret, live: keyId.startsWith("rzp_live_") };
}

export async function razorpay<T extends z.ZodTypeAny>(path: string, schema: T, init: { method?: string; body?: unknown } = {}): Promise<z.infer<T>> {
  const { keyId, keySecret } = razorpayConfig();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`${RAZORPAY_API_URL}/${path.replace(/^\/+/, "")}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Razorpay request failed [${response.status}]: ${body}`);
    throw new Error(`Razorpay request failed [${response.status}]: ${body}`);
  }
  return schema.parse(await response.json());
}
