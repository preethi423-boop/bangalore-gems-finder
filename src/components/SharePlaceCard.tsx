import { useState } from "react";
import { Check, Copy, Share2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NearbyGroup, PlaceDetails } from "@/lib/places.functions";

function buildSummary(details: PlaceDetails, nearby: NearbyGroup[], url: string) {
  const lines = [
    `${details.name}`,
    details.address,
    details.rating
      ? `Rated ${details.rating.toFixed(1)}★${details.ratingCount ? ` (${details.ratingCount.toLocaleString("en-IN")} reviews)` : ""}`
      : "",
    details.summary ?? "",
    ...nearby
      .filter((g) => g.places.length)
      .map((g) => `${g.label}: ${g.places.slice(0, 3).map((p) => p.name).join(", ")}`),
    "",
    url,
  ];
  return lines.filter(Boolean).join("\n");
}

export function SharePlaceCard({
  details,
  nearby,
}: {
  details: PlaceDetails;
  nearby: NearbyGroup[];
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/?place=${encodeURIComponent(details.id)}`
      : "";
  const summary = buildSummary(details, nearby, url);

  const copy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: details.name, text: summary, url });
        return;
      } catch {
        /* user dismissed */
      }
    }
    void copy();
  };

  const highlights = nearby.filter((g) => g.places.length).slice(0, 4);

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Shareable summary
          </p>
          <h3 className="truncate text-base font-semibold">{details.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{details.address}</p>
        </div>
        {details.rating ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-semibold">
            <Star className="size-3 fill-gold text-gold" />
            {details.rating.toFixed(1)}
          </span>
        ) : null}
      </div>

      {highlights.length ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {highlights.map((g) => (
            <li key={g.key} className="truncate">
              <span className="font-medium text-foreground">{g.label}:</span>{" "}
              {g.places.slice(0, 3).map((p) => p.name).join(", ")}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 truncate rounded-md bg-secondary px-2 py-1.5 text-[11px] text-muted-foreground">
        {url}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5" onClick={share}>
          <Share2 className="size-4" /> Share
        </Button>
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy summary"}
        </Button>
      </div>
    </div>
  );
}
