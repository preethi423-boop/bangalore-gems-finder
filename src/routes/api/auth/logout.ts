import { createFileRoute } from "@tanstack/react-router";
import { deleteSession, readCookie, serializeCookie } from "@/server/google-auth";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await deleteSession(readCookie(request, "session"));
        const secure = new URL(request.url).protocol === "https:";
        return new Response(null, {
          status: 204,
          headers: {
            "Set-Cookie": serializeCookie("session", "", { maxAge: 0, secure }),
          },
        });
      },
    },
  },
});
