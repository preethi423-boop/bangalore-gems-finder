import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      if (Number(request.headers.get("content-length") ?? 0) > 65536) return new Response("Payload too large", { status: 413 });
      const text = await request.text();
      if (text.length > 65536) return new Response("Payload too large", { status: 413 });
      const { handleRazorpayWebhook } = await import("@/lib/payments.server");
      await handleRazorpayWebhook(JSON.parse(text));
      return new Response("ok");
    } catch (error) {
      console.error("Razorpay verification failed", error);
      return new Response("Verification unavailable; retry delivery", { status: 503 });
    }
  } } },
});