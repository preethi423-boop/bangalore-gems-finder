import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/explore")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleExploration } = await import("@/lib/exploration.server");
    return handleExploration(request);
  } } },
});