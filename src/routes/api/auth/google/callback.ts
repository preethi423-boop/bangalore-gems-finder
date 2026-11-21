import { createFileRoute } from "@tanstack/react-router";
import {
  authenticateGoogleCode,
  readCookie,
  safeReturnTo,
  serializeCookie,
} from "@/server/google-auth";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const expectedState = readCookie(request, "google_oauth_state");
        const secure = url.protocol === "https:";
        const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

        if (!code || !state || !expectedState || state !== expectedState) {
          return new Response("Invalid OAuth state", { status: 400 });
        }

        try {
          const { sessionId } = await authenticateGoogleCode(code);
          const response = Response.redirect(new URL(returnTo, url.origin), 302);
          response.headers.append("Set-Cookie", serializeCookie("google_oauth_state", "", { maxAge: 0, path: "/api/auth/google/callback", secure }));
          response.headers.append("Set-Cookie", serializeCookie("session", sessionId, { maxAge: 60 * 60 * 24 * 30, secure }));
          return response;
        } catch (error) {
          console.error("Google OAuth callback failed", error);
          return new Response("Google sign-in failed", { status: 500 });
        }
      },
    },
  },
});
