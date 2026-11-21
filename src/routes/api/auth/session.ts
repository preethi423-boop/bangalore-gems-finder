import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser, readCookie } from "@/server/google-auth";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(readCookie(request, "session"));
        if (!user) return Response.json({ user: null }, { status: 401 });
        return Response.json({ user });
      },
    },
  },
});
