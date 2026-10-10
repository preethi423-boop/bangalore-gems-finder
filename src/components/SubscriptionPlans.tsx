import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubscriptionPlans({ monthly, yearly }: { monthly?: number | null; yearly?: number | null }) {
  const format = (value: number | null | undefined) => value == null || !Number.isFinite(value) || value <= 0 ? "Price not set" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
  return <div className="grid gap-4 sm:grid-cols-2">{[{ name: "Monthly", price: monthly, interval: "month" }, { name: "Yearly", price: yearly, interval: "year" }].map(plan => <article key={plan.name} className="min-w-0 rounded-lg border border-border bg-card p-5"><CalendarDays className="size-5 text-primary" /><h2 className="mt-4 font-semibold">{plan.name}</h2><p className="mt-2 break-words text-xl font-semibold">{format(plan.price)}</p><p className="mt-1 text-xs text-muted-foreground">{plan.price == null ? "Awaiting admin pricing" : `per ${plan.interval}`}</p><Button className="mt-5 w-full" disabled>Payments coming soon</Button></article>)}</div>;
}