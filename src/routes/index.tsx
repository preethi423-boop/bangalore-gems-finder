import { createFileRoute, Link } from "@tanstack/react-router";
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
  Heart,
  LogIn,
  ShieldCheck,
  CircleParking,
  CircleCheck,
  CircleHelp,
  CircleX,
  IndianRupee,
  Clock3,
  Route as RouteIcon,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { MapView, type MapMarker } from "@/components/MapView";
import { SharePlaceCard } from "@/components/SharePlaceCard";
import { AccountMenu } from "@/components/AccountMenu";
import { FavoritesSheet } from "@/components/FavoritesSheet";
import { PromoStrip } from "@/components/PromoStrip";
import { ExploreNearby } from "@/components/ExploreNearby";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { activeUserKey, getUserKey, isMapsKeyRejected } from "@/lib/user-key";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { useAuth } from "@/hooks/useAuth";
import { explorationSignal } from "@/lib/access-session";


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
  component: () => <SubscriptionGate><Index /></SubscriptionGate>,
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

type MapSnapshot = {
  query: string; results: PlaceLite[]; details: PlaceDetails | null; nearby: NearbyGroup[];
  center: typeof BLR; route: RouteResult | null; rangeKm: number; lastPlace: PlaceLite | null;
  sheet: "peek" | "half" | "full"; fullMap: boolean; depth: number;
};

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
  const { session, isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceLite[]>([]);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [nearby, setNearby] = useState<NearbyGroup[]>([]);
  const [center, setCenter] = useState(BLR);
  const [error, setError] = useState<string | null>(null);
  const [userKey, setUserKeyState] = useState("");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeStops, setRouteStops] = useState<string[] | null>(null);
  const [rangeKm, setRangeKm] = useState(5);
  const [lastPlace, setLastPlace] = useState<PlaceLite | null>(null);
  const [sheet, setSheet] = useState<"peek" | "half" | "full">("half");
  const [fullMap, setFullMap] = useState(false);
  const [favVersion, setFavVersion] = useState(0);
  const [saved, setSaved] = useState(false);
  const [depth, setDepth] = useState(0);
  const requestVersion = useRef(0);
  const searchVersion = useRef(0);
  const snapshot = useRef<MapSnapshot | null>(null);
  const dragStart = useRef<{ y: number; snap: typeof sheet } | null>(null);

  useEffect(() => {
    setSaved(details ? isFavorite(details.id) : false);
  }, [details, favVersion]);


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

  useEffect(() => setUserKeyState(activeUserKey()), []);

  const doSearch = useServerFn(searchPlaces);
  const doDetails = useServerFn(getPlaceDetails);
  const doNearby = useServerFn(getNearby);

  const searchMutation = useMutation({
    mutationFn: async ({ q, version }: { q: string; version: number }) => ({
      data: await (userKey ? searchPlacesWithKey(userKey, q) : doSearch({ data: { query: q } })), version,
    }),
    onSuccess: ({ data, version }) => {
      if (version !== searchVersion.current) return;
      setResults(data);
      setError(data.length ? null : "No places found. Try another name.");
    },
    onError: (_, { version }) => { if (version === searchVersion.current) setError("Could not search right now. Please try again."); },
  });

  const selectMutation = useMutation({
    mutationFn: async ({ place, range, version }: { place: PlaceLite; range: number; version: number }) => {
      explorationSignal();
      const [d, n] = await Promise.all([
        userKey
          ? getPlaceDetailsWithKey(userKey, place.id)
          : doDetails({ data: { placeId: place.id } }),
        userKey
          ? getNearbyWithKey(userKey, place.lat, place.lng, range)
          : doNearby({ data: { lat: place.lat, lng: place.lng, rangeKm: range } }),
      ]);
      return { d, n, version };
    },
    onSuccess: ({ d, n, version }) => {
      if (version !== requestVersion.current) return;
      setDetails(d);
      setNearby(n);
      setCenter({ lat: d.lat, lng: d.lng });
      setError(null);
    },
    onError: (_, { version }) => { if (version === requestVersion.current) setError("Could not load this place's details."); },
  });

  const getMyLocation = () =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("no-geo"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error("no-geo")),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });

  const routeError = (e: Error) =>
    setError(
      e.message === "no-key"
        ? getUserKey() && isMapsKeyRejected()
          ? "Your saved Google API key isn't working (check its billing in Google Cloud), so routing is unavailable."
          : "Add your Google API key to get routing."
        : e.message === "no-geo"
          ? "Location permission is needed to build a route."
          : "Could not build a route right now.",
    );

  const routeMutation = useMutation({
    mutationFn: async (dest: { lat: number; lng: number }) => {
      explorationSignal();
      const key = userKey;
      if (!key) throw new Error("no-key");
      const origin = await getMyLocation();
      return computeRouteWithKey(key, origin, dest, "DRIVE");
    },
    onSuccess: (r) => {
      setRoute(r);
      setRouteStops(null);
      setError(null);
    },
    onError: routeError,
  });

  const planRouteMutation = useMutation({
    mutationFn: async (dest: PlaceDetails) => {
      explorationSignal();
      const key = userKey;
      if (!key) throw new Error("no-key");
      const origin = await getMyLocation();
      const stops: Array<{ lat: number; lng: number }> = [];
      const labels: string[] = [];
      if (dest.parkingStatus !== "available") {
        const parking = nearby.find((g) => g.key === "parking")?.places ?? [];
        if (parking.length) {
          const nearest = parking.reduce((best, p) =>
            Math.hypot(p.lat - dest.lat, p.lng - dest.lng) <
            Math.hypot(best.lat - dest.lat, best.lng - dest.lng)
              ? p
              : best,
          );
          stops.push({ lat: nearest.lat, lng: nearest.lng });
          labels.push(`Parking: ${nearest.name}`);
        }
      }
      labels.push(`Visit: ${dest.name}`);
      const r = await computeRouteWithKey(key, origin, { lat: dest.lat, lng: dest.lng }, "DRIVE", stops);
      return { r, labels };
    },
    onSuccess: ({ r, labels }) => {
      setRoute(r);
      setRouteStops(labels);
      setError(null);
    },
    onError: routeError,
  });

  const runSearch = (q: string) => {
    const value = q.trim();
    if (!value) return;
    setQuery(value);
    setResults([]);
    searchMutation.mutate({ q: value, version: ++searchVersion.current });
  };

  const pushPlace = (id: string) => {
    if (snapshot.current) window.history.replaceState({ ...window.history.state, nammaSpot: snapshot.current }, "");
    const url = new URL(window.location.href);
    url.searchParams.set("place", id);
    window.history.pushState({ ...window.history.state, nammaSpot: null }, "", url);
    setDepth(d => d + 1);
    ++searchVersion.current;
    searchMutation.reset();
  };

  const select = useCallback(
    (p: PlaceLite) => {
      pushPlace(p.id);
      setResults([]);
      setDetails(null);
      setNearby([]);
      setRoute(null);
      setRouteStops(null);
      setLastPlace(p);
      setCenter({ lat: p.lat, lng: p.lng });
      setSheet("peek");
      setFullMap(false);
      selectMutation.mutate({ place: p, range: rangeKm, version: ++requestVersion.current });
    },
    [selectMutation, rangeKm],
  );

  const selectByIdMutation = useMutation({
    mutationFn: async ({ placeId, range, version }: { placeId: string; range: number; version: number }) => {
      explorationSignal();
      const d = userKey
        ? await getPlaceDetailsWithKey(userKey, placeId)
        : await doDetails({ data: { placeId } });
      explorationSignal();
      const n = userKey
        ? await getNearbyWithKey(userKey, d.lat, d.lng, range)
        : await doNearby({ data: { lat: d.lat, lng: d.lng, rangeKm: range } });
      return { d, n, version };
    },
    onSuccess: ({ d, n, version }) => {
      if (version !== requestVersion.current) return;
      setDetails(d);
      setNearby(n);
      setLastPlace(d);
      setCenter({ lat: d.lat, lng: d.lng });
      setError(null);
    },
    onError: (_, { version }) => { if (version === requestVersion.current) setError("Could not load details for that spot."); },
  });

  const selectById = useCallback(
    (placeId: string) => {
      pushPlace(placeId);
      setResults([]);
      setDetails(null);
      setNearby([]);
      setRoute(null);
      setRouteStops(null);
      setSheet("half");
      setFullMap(false);
      selectByIdMutation.mutate({ placeId, range: rangeKm, version: ++requestVersion.current });
    },
    [selectByIdMutation, rangeKm],
  );

  // Open a shared link like /?place=<id> straight into that place's details.
  const openedShared = useRef(false);
  useEffect(() => {
    if (openedShared.current) return;
    openedShared.current = true;
    const id = new URLSearchParams(window.location.search).get("place");
    if (!id) return;
    selectById(id);
  }, [selectById]);

  const changeRange = (km: number) => {
    setRangeKm(km);
    if (lastPlace) {
      setNearby([]);
      selectMutation.mutate({ place: lastPlace, range: km, version: ++requestVersion.current });
    }
  };

  useEffect(() => {
    snapshot.current = { query, results, details, nearby, center, route, rangeKm, lastPlace, sheet, fullMap, depth };
    window.history.replaceState({ ...window.history.state, nammaSpot: snapshot.current }, "");
  }, [query, results, details, nearby, center, route, rangeKm, lastPlace, sheet, fullMap, depth]);

  useEffect(() => {
    const restore = (event: PopStateEvent) => {
      const previous = event.state?.nammaSpot as MapSnapshot | undefined;
      if (!previous) return;
      ++requestVersion.current; ++searchVersion.current;
      selectMutation.reset(); selectByIdMutation.reset(); searchMutation.reset(); routeMutation.reset();
      setQuery(previous.query); setResults(previous.results); setDetails(previous.details); setNearby(previous.nearby);
      setCenter(previous.center); setRoute(previous.route); setRouteStops(null); setRangeKm(previous.rangeKm); setLastPlace(previous.lastPlace);
      setSheet(previous.sheet); setFullMap(previous.fullMap); setDepth(previous.depth); setError(null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [selectMutation.reset, selectByIdMutation.reset, searchMutation.reset, routeMutation.reset]);

  const markers: MapMarker[] = nearby
    .flatMap((g) => g.places.map((p) => ({ ...p, kind: g.key })))
    .slice(0, 40);

  return (
    <main className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      <div className="absolute inset-0">
        <MapView
          center={center}
          main={details}
          markers={markers}
          onMarkerClick={(p) => select(p)}
          onPoiSelect={selectById}
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
          <div className="flex items-center gap-2"><form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4 shadow-[var(--shadow-card)]"
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
          </form><AccountMenu signedIn={Boolean(session)} isAdmin={isAdmin} hasKey={Boolean(userKey)} /></div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <FavoritesSheet onOpenPlace={selectById} version={favVersion} />
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

          {depth > 0 ? <Button size="sm" variant="ghost" className="mb-2" onClick={() => window.history.back()}><ArrowLeft className="size-4" />Back</Button> : null}

          {selectMutation.isPending || selectByIdMutation.isPending ? (
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

              <div className="mt-3 rounded-lg border border-border bg-background p-3">
                <div className="flex items-start gap-2.5">
                  <CircleParking className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {details.parkingStatus === "available" ? (
                        <CircleCheck className="size-4 text-primary" />
                      ) : details.parkingStatus === "not_available" ? (
                        <CircleX className="size-4 text-destructive" />
                      ) : (
                        <CircleHelp className="size-4 text-muted-foreground" />
                      )}
                      {details.parkingStatus === "available"
                        ? "Parking available at this place"
                        : details.parkingStatus === "not_available"
                          ? "No on-site parking listed"
                          : "On-site parking information unavailable"}
                    </p>
                    {details.parkingTypes.length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {details.parkingTypes.join(" · ")}
                      </p>
                    ) : details.parkingStatus === "unknown" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Check the nearby Parking section below for other options.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

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
                <Button size="sm" variant="outline" onClick={() => { setNearby([]); selectMutation.mutate({ place: details, range: rangeKm, version: ++requestVersion.current }); }} disabled={selectMutation.isPending}><RefreshCw className="size-4" />Refresh details</Button>
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
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5"
                  onClick={() => planRouteMutation.mutate(details)}
                  disabled={planRouteMutation.isPending}
                >
                  {planRouteMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RouteIcon className="size-4" />
                  )}
                  Plan full route
                </Button>
                <Button
                  size="sm"
                  variant={saved ? "default" : "outline"}
                  className="gap-1.5"
                  aria-pressed={saved}
                  onClick={() => {
                    toggleFavorite(details);
                    setFavVersion((v) => v + 1);
                  }}
                >
                  <Heart className={`size-4 ${saved ? "fill-current" : ""}`} />
                  {saved ? "Saved" : "Save"}
                </Button>
              </div>

              {route ? (
                <div className="mt-3 rounded-lg border border-border bg-secondary/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Travel options</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">From your current location</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-foreground">
                      <span className="inline-flex items-center gap-1">
                        <RouteIcon className="size-3.5 text-primary" /> {route.distanceText}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5 text-primary" /> {route.durationText}
                      </span>
                    </div>
                  </div>
                  {routeStops?.length ? (
                    <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5">
                        <span className="inline-block size-1.5 rounded-full bg-primary" /> Start: your location
                      </li>
                      {routeStops.map((stop, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="inline-block size-1.5 rounded-full bg-primary" /> {stop}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {route.fareEstimates.map((fare) => (
                      <div key={fare.type} className="rounded-md border border-border bg-card px-3 py-2">
                        <p className="text-xs text-muted-foreground">{fare.type}</p>
                        <p className="mt-1 flex items-center gap-0.5 text-sm font-semibold">
                          <IndianRupee className="size-3.5 text-primary" aria-hidden="true" />
                          <span className="sr-only">Estimated fare:</span>
                          {fare.estimateText.replace("₹", "").replace("–₹", "–")}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Estimated fares only. Actual prices may vary with demand, waiting, tolls, and provider pricing.
                  </p>
                </div>
              ) : null}

              <ExploreNearby key={`${details.id}-${rangeKm}`} details={details} nearby={nearby} rangeKm={rangeKm} session={session} isAdmin={isAdmin} onSelect={selectById} />

              <SharePlaceCard details={details} nearby={nearby} />

              <PromoStrip placeName={details.name} />




              {nearby.map((group) => {
                const Icon = GROUP_ICON[group.key] ?? MapPin;
                if (!group.places.length && !group.error && group.key !== "streetfood") return null;
                return (
                  <div key={group.key} className="mt-5">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Icon className="size-4 text-primary" />
                      {group.label}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {group.places.length} nearby
                      </span>
                    </h3>
                    {group.error ? <p role="alert" className="text-xs text-destructive">{group.error}</p> : !group.places.length ? <p className="text-xs text-muted-foreground">No street food results found near this place.</p> : null}
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
