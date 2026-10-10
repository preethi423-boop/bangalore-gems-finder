import { useQuery } from "@tanstack/react-query";
import { Megaphone, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type Promo = {
  id: string;
  title: string;
  offer: string;
  sponsor: string;
};

export function PromoStrip({ placeName }: { placeName?: string }) {
  const { data, isError, isPending } = useQuery({
    queryKey: ["promotions", "active", placeName],
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("id,title,offer,sponsor")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Promo[];
    },
  });

  if (isPending) return <p className="mt-5 text-xs text-muted-foreground">Loading sponsored offers…</p>;
  if (isError) return <p role="alert" className="mt-5 text-xs text-destructive">Sponsored offers could not be refreshed.</p>;
  if (!data?.length) return null;

  return (
    <section className="mt-5" aria-label="Sponsored offers nearby">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Megaphone className="size-4 text-primary" />
        Offers &amp; promotions
        <span className="text-xs font-normal text-muted-foreground">
          · sponsored
        </span>
      </h3>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {data.map((p) => (
          <article
            key={p.id}
            className="min-w-[220px] max-w-[220px] shrink-0 rounded-xl border border-dashed border-primary/40 bg-secondary/60 p-3 shadow-[var(--shadow-card)]"
          >
            <p className="text-sm font-semibold text-card-foreground">{p.title}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Tag className="size-3" /> {p.offer}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">{p.sponsor} · Ad</p>
          </article>
        ))}
      </div>
    </section>
  );
}
