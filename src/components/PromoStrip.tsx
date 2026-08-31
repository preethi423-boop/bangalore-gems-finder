import { Megaphone, Tag } from "lucide-react";

export type Promo = {
  id: string;
  title: string;
  offer: string;
  sponsor: string;
};

/** Sponsored slots — swap these for a live ads feed later. */
const PROMOS: Promo[] = [
  { id: "p1", title: "Filter coffee & masala dosa", offer: "20% off before 11 AM", sponsor: "Namma Tiffin Rooms" },
  { id: "p2", title: "Covered 2-wheeler parking", offer: "₹20 for 3 hours", sponsor: "ParkEasy Bengaluru" },
  { id: "p3", title: "EV fast charge", offer: "Free 15 min top-up", sponsor: "VoltGo Chargers" },
  { id: "p4", title: "Silk & handloom sale", offer: "Flat ₹500 off above ₹2,999", sponsor: "Chikpet Weaves" },
];

export function PromoStrip({ placeName }: { placeName?: string }) {
  return (
    <section className="mt-5" aria-label="Sponsored offers nearby">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Megaphone className="size-4 text-primary" />
        Offers &amp; promotions
        <span className="text-xs font-normal text-muted-foreground">
          · sponsored{placeName ? ` near ${placeName}` : ""}
        </span>
      </h3>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {PROMOS.map((p) => (
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
