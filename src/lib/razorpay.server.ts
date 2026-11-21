import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/razorpay";

export function razorpayConfig() {
  const lovableKey = process.env['LOVABLE_API_KEY'];
  const connectionKey = process.env['RAZORPAY_CONNECTION_KEY'];
  const keyId = process.env['RAZORPAY_CONNECTION_KEY_ID'];
  if (!lovableKey || !connectionKey || !keyId) throw new Error("Payments are not set up yet.");
  return { lovableKey, connectionKey, keyId, live: keyId.startsWith("rzp_live_") };
}

export async function razorpay<T extends z.ZodTypeAny>(path: string, schema: T, init: { method?: string; body?: unknown } = {}): Promise<z.infer<T>> {
  const { lovableKey, connectionKey } = razorpayConfig();
  const response = await fetch(`${GATEWAY_URL}/${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connectionKey, "Content-Type": "application/json" },
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