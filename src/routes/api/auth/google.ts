import { createFileRoute } from "@tanstack/react-router";
import { createState, getGoogleAuthorizationUrl, serializeCookie } from "@/server/google-auth";

export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const state = createState();
        const secure = new URL(request.url).protocol === "https:";
        return new Response(null, {
          status: 302,
          headers: {
            Location: getGoogleAuthorizationUrl(state),
            "Set-Cookie": serializeCookie("google_oauth_state", state, {
              maxAge: 600,
              path: "/api/auth/google/callback",
              secure,
            }),
          },
        });
      },
    },
  },
});
