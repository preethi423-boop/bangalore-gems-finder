import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const query = useSubscription(auth.user?.id);
  if (auth.loading || query.isPending) return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 aria-label="Checking access" className="size-5 animate-spin text-primary" /></main>;
  if (!query.isError && query.data?.allowed) return children;
  return <main className="flex min-h-screen items-center justify-center bg-background px-6"><div className="w-full max-w-sm space-y-5">
    <h1 className="text-2xl font-semibold">Namma Spot</h1>
    <p className="text-muted-foreground">{query.isError ? "Could not check your access. Please try again." : "Explore Bengaluru with a monthly or yearly subscription."}</p>
    {query.isError ? <Button onClick={() => query.refetch()}>Try again</Button> : <Button asChild><Link to="/subscription">{auth.user ? "View access & plans" : "Start free trial"}</Link></Button>}
  </div></main>;
}