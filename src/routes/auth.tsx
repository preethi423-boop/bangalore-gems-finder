import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const signInWithGoogle = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const query = new URLSearchParams({ returnTo });
    window.location.assign(`/api/auth/google?${query.toString()}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <Link to="/" className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <MapPin className="size-4" /> Back to Bangalore Gems Finder
        </Link>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use your Google account to continue.</p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium transition hover:bg-muted"
        >
          <span className="text-lg font-bold">G</span>
          Continue with Google
        </button>
      </div>
    </main>
  );
}
