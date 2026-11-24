import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeAuthReturn } from "@/lib/auth-return";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string; place?: string } => {
    const returnTo = safeAuthReturn(search['returnTo']);
    const place = typeof search['place'] === "string" ? search['place'].slice(0, 200) : undefined;
    return { ...(returnTo ? { returnTo } : {}), ...(place ? { place } : {}) };
  },
  head: () => ({
    meta: [
      { title: "Sign in — Namma Spot" },
      {
        name: "description",
        content:
          "Sign in to Namma Spot to manage sponsored offers and promotions shown alongside Bengaluru places.",
      },
      { property: "og:title", content: "Sign in — Namma Spot" },
      {
        property: "og:description",
        content: "Sign in to Namma Spot to manage sponsored offers and promotions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { returnTo, place } = Route.useSearch();
  const destination = returnTo === "/subscription" ? "/subscription" : returnTo === "/" ? `/${place ? `?place=${encodeURIComponent(place)}` : ""}` : "/";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign(destination);
    });
  }, [destination]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage(
            "Check your inbox for a confirmation email, then sign in. No email? Check spam, or sign up again with the same email to resend it."
          );
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      window.location.assign(destination);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setMessage(null);
    const host = window.location.hostname;
    const lovableHosted =
      host === "localhost" || host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
    if (!lovableHosted) {
      // Self-hosted domains use the project's own Google OAuth client directly.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${destination}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) setMessage("Google sign-in failed. Please try again.");
      return;
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${destination}`,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      setMessage("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    window.location.assign(destination);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 text-primary" /> Back to Namma Spot
        </Link>
        <h1 className="text-lg font-semibold">
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admins manage the sponsored offers shown in the app.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {mode === "signup" ? (
              <p className="text-xs text-muted-foreground">
                At least 6 characters. Avoid common or previously leaked passwords — they are rejected for your safety.
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <Button variant="outline" className="mt-3 w-full" onClick={google}>
          Continue with Google
        </Button>

        {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-xs text-muted-foreground underline underline-offset-4"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
