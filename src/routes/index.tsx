import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  MapPin,
  Star,
  Car,
  UtensilsCrossed,
  ShoppingBag,
  Camera,
  Coffee,
  Phone,
  Globe,
  Accessibility,
  Loader2,
  AlertTriangle,
  Navigation,
  Maximize2,
  Minimize2,
  Zap,
  Bike,
} from "lucide-react";
import { MapView, type MapMarker } from "@/components/MapView";
import { SharePlaceCard } from "@/components/SharePlaceCard";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getUserKey } from "@/lib/user-key";
import {
  searchPlacesWithKey,
  getPlaceDetailsWithKey,
  getNearbyWithKey,
  computeRouteWithKey,
  type RouteResult,
} from "@/lib/places-direct";
import {
  searchPlaces,
  getPlaceDetails,
  getNearby,
  type PlaceLite,
  type PlaceDetails,
  type NearbyGroup,
} from "@/lib/places.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Namma Spot — Explore Bengaluru places, parking & street food" },
      {
        name: "description",
        content:
          "Search any place in and around Bengaluru to see ratings, reviews, nearby parking, street food stalls, shopping and must-see spots on one map.",
      },
      { property: "og:title", content: "Namma Spot — Explore Bengaluru places, parking & street food" },
      {
        property: "og:description",
        content:
          "Search any place in and around Bengaluru to see ratings, reviews, nearby parking, street food stalls, shopping and must-see spots on one map.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const BLR = { lat: 12.9716, lng: 77.5946 };

const GROUP_ICON: Record<string, typeof Car> = {
  parking: Car,
  streetfood: UtensilsCrossed,
  shopping: ShoppingBag,
  sights: Camera,
  cafes: Coffee,
  evcar: Zap,
  evbike: Bike,
};

const QUICK = ["Lalbagh", "MG Road", "Nandi Hills", "VV Puram Food Street", "Cubbon Park"];
const RANGES: number[] = [5, 10, 25];

function Stars({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-foreground">
      <Star className="size-3.5 fill-gold text-gold" />
      {rating.toFixed(1)}
    </span>
  );
}

function PlaceCard({ p, onClick }: { p: PlaceLite; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-w-[220px] max-w-[220px] shrink-0 rounded-xl border border-border bg-card p-3 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/40"
    >
      <p className="line-clamp-2 text-sm font-semibold text-card-foreground">{p.name}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.address}</p>
      <div className="mt-2 flex items-center gap-2">
        <Stars rating={p.rating} />
        {p.ratingCount ? (
          <span className="text-[11px] text-muted-foreground">
            {p.ratingCount.toLocaleString("en-IN")} reviews
          </span>
        ) : null}
      </div>
      {p.primaryType ? (
        <Badge variant="secondary" className="mt-2 text-[10px]">
          {p.primaryType}
        </Badge>
      ) : null}
    </button>
  );
}

function Index() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceLite[]>([]);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [nearby, setNearby] = useState<NearbyGroup[]>([]);
  const [center, setCenter] = useState(BLR);
  const [error, setError] = useState<string | null>(null);
  const [userKey, setUserKeyState] = useState("");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [rangeKm, setRangeKm] = useState(5);
  const [lastPlace, setLastPlace] = useState<PlaceLite | null>(null);
  const [sheet, setSheet] = useState<"peek" | "half" | "full">("half");
  const [fullMap, setFullMap] = useState(false);
  const dragStart = useRef<{ y: number; snap: typeof sheet } | null>(null);

  const SHEET_H: Record<"peek" | "half" | "full", string> = {
    peek: "16vh",
    half: "46vh",
    full: "85vh",
  };

  const endDrag = (endY: number) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const dy = endY - start.y;
    const order: Array<"peek" | "half" | "full"> = ["peek", "half", "full"];
    let i = order.indexOf(start.snap);
    if (dy < -40) i = Math.min(i + 1, 2);
    else if (dy > 40) i = Math.max(i - 1, 0);
    setSheet(order[i]);
  };

  useEffect(() => setUserKeyState(getUserKey()), []);

  const doSearch = useServerFn(searchPlaces);
  const doDetails = useServerFn(getPlaceDetails);
  const doNearby = useServerFn(getNearby);

  const searchMutation = useMutation({
    mutationFn: (q: string) =>
      userKey ? searchPlacesWithKey(userKey, q) : doSearch({ data: { query: q } }),
    onSuccess: (data) => {
      setResults(data);
      setError(data.length ? null : "No places found. Try another name.");
    },
    onError: () => setError("Could not search right now. Please try again."),
  });

  const selectMutation = useMutation({
    mutationFn: async ({ place, range }: { place: PlaceLite; range: number }) => {
      const [d, n] = await Promise.all([
        userKey
          ? getPlaceDetailsWithKey(userKey, place.id)
          : doDetails({ data: { placeId: place.id } }),
        userKey
          ? getNearbyWithKey(userKey, place.lat, place.lng, range)
          : doNearby({ data: { lat: place.lat, lng: place.lng, rangeKm: range } }),
      ]);
      return { d, n };
    },
    onSuccess: ({ d, n }) => {
      setDetails(d);
      setNearby(n);
      setCenter({ lat: d.lat, lng: d.lng });
      setError(null);
    },
    onError: () => setError("Could not load this place's details."),
  });

  const routeMutation = useMutation({
    mutationFn: async (dest: { lat: number; lng: number }) => {
      const key = userKey;
      if (!key) throw new Error("no-key");
      const origin = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("no-geo"));
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => reject(new Error("no-geo")),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      });
      return computeRouteWithKey(key, origin, dest, "DRIVE");
    },
    onSuccess: (r) => {
      setRoute(r);
      setError(null);
    },
    onError: (e: Error) =>
      setError(
        e.message === "no-key"
          ? "Add your Google API key to get routing."
          : e.message === "no-geo"
            ? "Location permission is needed to build a route."
            : "Could not build a route right now.",
      ),
  });

  const runSearch = (q: string) => {
    const value = q.trim();
    if (!value) return;
    setQuery(value);
    setResults([]);
    searchMutation.mutate(value);
  };

  const select = useCallback(
    (p: PlaceLite) => {
      setResults([]);
      setDetails(null);
      setNearby([]);
      setRoute(null);
      setLastPlace(p);
      setCenter({ lat: p.lat, lng: p.lng });
      setSheet("peek");
      setFullMap(false);
      selectMutation.mutate({ place: p, range: rangeKm });
    },
    [selectMutation, rangeKm],
  );

  const changeRange = (km: number) => {
    setRangeKm(km);
    if (lastPlace) {
      setNearby([]);
      selectMutation.mutate({ place: lastPlace, range: km });
    }
  };

  const markers = nearby.flatMap((g) => g.places).slice(0, 30);

  return (
    <main className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      <div className="absolute inset-0">
        <MapView
          center={center}
          main={details}
          markers={markers}
          onMarkerClick={(p) => select(p)}
          routePolyline={route?.polyline ?? null}
          threeD={Boolean(details)}
        />
      </div>

      <button
        type="button"
        onClick={() => setFullMap((v) => !v)}
        aria-label={fullMap ? "Exit full-screen map" : "Full-screen map"}
        className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-medium shadow-[var(--shadow-card)] backdrop-blur transition hover:border-primary/50"
      >
        {fullMap ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        {fullMap ? "Show details" : "Full map"}
      </button>

      <header className={`relative z-10 px-4 pt-4 ${fullMap ? "hidden" : ""}`}>
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="mb-2 px-1 text-sm font-semibold tracking-wide text-foreground drop-shadow">
            Namma Spot · Bengaluru & around
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
            className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4 shadow-[var(--shadow-card)]"
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a place in Bengaluru…"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              aria-label="Search a place"
            />
            <Button type="submit" size="sm" className="rounded-full px-4">
              {searchMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Go"}
            </Button>
          </form>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <ApiKeyDialog hasKey={Boolean(userKey)} />
            <div
              role="group"
              aria-label="Search range"
              className="flex items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1 backdrop-blur"
            >
              <span className="pl-1 pr-0.5 text-[11px] text-muted-foreground">Range</span>
              {RANGES.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => changeRange(km)}
                  aria-pressed={rangeKm === km}
                  className={`rounded-full px-2.5 py-0.5 text-xs transition ${
                    rangeKm === km
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => runSearch(q)}
                className="rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition hover:border-primary/50 hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>

          {error ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-card/95 px-3 py-1.5 text-xs text-destructive">
              <AlertTriangle className="size-3.5" /> {error}
            </p>
          ) : null}

          {results.length > 0 ? (
            <ul className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => select(r)}
                    className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-secondary"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.address}
                      </span>
                    </span>
                    <span className="ml-auto shrink-0">
                      <Stars rating={r.rating} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <section
        style={{ height: fullMap ? "0vh" : SHEET_H[sheet] }}
        className={`relative z-10 mt-auto flex flex-col overflow-hidden rounded-t-3xl border-t border-border bg-card/95 shadow-[var(--shadow-sheet)] backdrop-blur transition-[height] duration-300 ease-out ${
          fullMap ? "pointer-events-none border-0 opacity-0" : ""
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag to resize the details panel"
          onPointerDown={(e) => {
            dragStart.current = { y: e.clientY, snap: sheet };
          }}
          onPointerUp={(e) => endDrag(e.clientY)}
          onClick={() => setSheet(sheet === "full" ? "peek" : sheet === "half" ? "full" : "half")}
          className="shrink-0 cursor-grab touch-none py-3 active:cursor-grabbing"
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-border" />
        </div>
        <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-8">

          {selectMutation.isPending ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Gathering parking, street food and sights…
            </p>
          ) : !details ? (
            <div className="py-4">
              <h2 className="text-base font-semibold">Pick a spot to see the full picture</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search any place across Bengaluru — you'll get its rating and real reviews, plus
                parking nearby, street food stalls, shopping, and the things worth seeing there.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-tight">{details.name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{details.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Stars rating={details.rating} />
                  {details.ratingCount ? (
                    <span className="text-xs text-muted-foreground">
                      {details.ratingCount.toLocaleString("en-IN")} ratings
                    </span>
                  ) : null}
                </div>
              </div>

              {details.summary ? (
                <p className="mt-2 text-sm text-foreground/90">{details.summary}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {details.primaryType ? <Badge variant="secondary">{details.primaryType}</Badge> : null}
                {details.wheelchair ? (
                  <Badge variant="secondary" className="gap-1">
                    <Accessibility className="size-3" /> Step-free entry
                  </Badge>
                ) : null}
                {details.hours[0] ? <Badge variant="outline">{details.hours[0]}</Badge> : null}
                {details.phone ? (
                  <a
                    href={`tel:${details.phone}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="size-3" /> {details.phone}
                  </a>
                ) : null}
                {details.website ? (
                  <a
                    href={details.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
                  >
                    <Globe className="size-3" /> Website
                  </a>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => routeMutation.mutate({ lat: details.lat, lng: details.lng })}
                  disabled={routeMutation.isPending}
                >
                  {routeMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Navigation className="size-4" />
                  )}
                  Route from my location
                </Button>
                {route ? (
                  <span className="text-xs text-muted-foreground">
                    {route.distanceText} · about {route.durationText} by car
                  </span>
                ) : null}
              </div>

              <SharePlaceCard details={details} nearby={nearby} />


              {nearby.map((group) => {
                const Icon = GROUP_ICON[group.key] ?? MapPin;
                if (!group.places.length) return null;
                return (
                  <div key={group.key} className="mt-5">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Icon className="size-4 text-primary" />
                      {group.label}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {group.places.length} nearby
                      </span>
                    </h3>
                    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                      {group.places.map((p) => (
                        <PlaceCard key={p.id} p={p} onClick={() => select(p)} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {details.reviews.length ? (
                <div className="mt-5">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Star className="size-4 text-primary" /> What visitors say
                  </h3>
                  <ul className="space-y-2">
                    {details.reviews.map((r, i) => (
                      <li key={i} className="rounded-xl border border-border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{r.author}</span>
                          <span className="flex items-center gap-2">
                            <Stars rating={r.rating} />
                            <span className="text-[11px] text-muted-foreground">{r.relative}</span>
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">{r.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {details.mapsUri ? (
                <a
                  href={details.mapsUri}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex text-xs text-muted-foreground underline underline-offset-4"
                >
                  Open in Google Maps
                </a>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
