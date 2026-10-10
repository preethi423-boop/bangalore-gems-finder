import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { updateExplorationAccess } from "@/lib/access-session";

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const query = useSubscription(auth.user?.id);
  const allowed = !auth.loading && !query.isError && query.data?.allowed === true;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    updateExplorationAccess(allowed, query.data?.deadline);
    setReady(allowed);
    return () => updateExplorationAccess(false);
  }, [allowed, query.data?.deadline]);
  if (auth.loading || query.isPending) return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 aria-label="Checking access" className="size-5 animate-spin text-primary" /></main>;
  if (allowed && ready) return children;
  if (allowed) return null;
  return <main className="flex min-h-screen items-center justify-center bg-background px-6"><div className="w-full max-w-sm space-y-5">
    <h1 className="text-2xl font-semibold">Namma Spot</h1>
    <p role="alert" className="text-muted-foreground">{query.isError ? "Could not check your access. Please try again." : query.data?.access ? "Your trial or subscription has ended. Subscribe to continue. Map requests and exploration are blocked." : "Start a free trial or subscribe to explore Bengaluru."}</p>
    {query.isError ? <Button onClick={() => query.refetch()}>Try again</Button> : <Button asChild><Link to="/subscription">{auth.user ? "View access & plans" : "Start free trial"}</Link></Button>}
  </div></main>;
}