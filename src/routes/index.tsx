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
  Plus,
  X,
  ListOrdered,
  LocateFixed,
  Play,
} from "lucide-react";
import { MapView, type MapMarker } from "@/components/MapView";
import { SharePlaceCard } from "@/components/SharePlaceCard";
import { PlacePhotos } from "@/components/PlacePhotos";
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
  inferMarkerKind,
  searchPlacesWithLocation,
} from "@/lib/nearby-search";

import {
  searchPlacesWithKey,
  getPlaceDetailsWithKey,
  getNearbyWithKey,
  computeRouteWithKey,
  computeEVRouteWithKey,
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

const EXPLICIT_NEAR_ME_RE = /\b(near\s*me|nearby|around\s*me|close\s*to\s*me|nearest|closest)\b/i;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function filterNearbyByRange(
  groups: NearbyGroup[],
  origin: { lat: number; lng: number },
  maxKm: number,
): NearbyGroup[] {
  return groups.map((group) => ({
    ...group,
    places: group.places
      .map((p) => ({ p, d: distanceKm(origin, p) }))
      .filter(({ d }) => d <= maxKm)
      .sort((a, b) => a.d - b.d)
      .map(({ p }) => p),
  }));
}

async function searchPlacesPaginated({
  query,
  apiKey,
  origin,
  radiusKm,
  maxPages = 3,
}: {
  query: string;
  apiKey: string;
  origin?: { lat: number; lng: number } | null;
  radiusKm?: number;
  maxPages?: number;
}): Promise<PlaceLite[]> {
  const seen = new Set<string>();
  const collected: PlaceLite[] = [];
  let pageToken: string | undefined;

  const baseBody: Record<string, unknown> = {
    textQuery: query,
    pageSize: 20,
    languageCode: "en",
  };
  if (origin && radiusKm) {
    baseBody.locationBias = {
      circle: {
        center: { latitude: origin.lat, longitude: origin.lng },
        radius: Math.min(Math.max(radiusKm * 1000, 1000), 50000),
      },
    };
  }

  for (let page = 0; page < maxPages; page++) {
    const body = pageToken ? { ...baseBody, pageToken } : baseBody;
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.primaryTypeDisplayName,nextPageToken",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (page === 0) throw new Error(`places-search-${res.status}`);
      break;
    }
    const json = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        rating?: number;
        userRatingCount?: number;
        primaryTypeDisplayName?: { text?: string };
      }>;
      nextPageToken?: string;
    };

    for (const raw of json.places ?? []) {
      const id = raw.id;
      const lat = raw.location?.latitude;
      const lng = raw.location?.longitude;
      if (!id || lat == null || lng == null || seen.has(id)) continue;
      seen.add(id);
      collected.push({
        id,
        name: raw.displayName?.text ?? "Unnamed place",
        address: raw.formattedAddress ?? "",
        lat,
        lng,
        rating: raw.rating,
        ratingCount: raw.userRatingCount,
        primaryType: raw.primaryTypeDisplayName?.text,
      });
    }

    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }

  return collected;
}

function buildGoogleMapsDirectionsUrl(
  destination: { lat: number; lng: number },
  waypoints: Array<{ lat: number; lng: number }> = [],
) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
    dir_action: "navigate",
  });
  if (waypoints.length > 0) {
    params.set(
      "waypoints",
      waypoints.map((w) => `${w.lat},${w.lng}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

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
  const [showResults, setShowResults] = useState(false);
  const [resultDistances, setResultDistances] = useState<Record<string, number>>({});
  const [nearMeMode, setNearMeMode] = useState(false);
  const [lastNearbyQuery, setLastNearbyQuery] = useState<string | null>(null);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [nearby, setNearby] = useState<NearbyGroup[]>([]);
  const [center, setCenter] = useState(BLR);
  const [error, setError] = useState<string | null>(null);
  const [userKey, setUserKeyState] = useState("");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeStops, setRouteStops] = useState<string[] | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [planRouteOn, setPlanRouteOn] = useState(false);
  const [routePlaces, setRoutePlaces] = useState<PlaceLite[]>([]);
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
    mutationFn: async ({
      q,
      version,
      range,
      forceNearMe,
    }: {
      q: string;
      version: number;
      range: number;
      forceNearMe: boolean;
    }) => {
      const explicitNearMe = EXPLICIT_NEAR_ME_RE.test(q);
      const useNearby = forceNearMe || explicitNearMe;
      const browserKey =
        userKey ||
        ((import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ??
          "");

      if (useNearby && browserKey) {
        let origin = center;
        let usedCurrentLocation = false;
        try {
          origin = await getMyLocation();
          usedCurrentLocation = true;
        } catch {
          origin = center;
        }

        try {
          const allPlaces = await searchPlacesPaginated({
            query: q,
            apiKey: browserKey,
            origin,
            radiusKm: range,
            maxPages: 3,
          });
          const withDist = allPlaces
            .map((p) => ({ p, d: distanceKm(origin, p) }))
            .filter(({ d }) => d <= range)
            .sort((a, b) => a.d - b.d);
          return {
            data: withDist.map(({ p }) => p),
            distances: Object.fromEntries(
              withDist.map(({ p, d }) => [p.id, Math.round(d * 10) / 10]),
            ),
            origin,
            usedCurrentLocation,
            wasNearby: true,
            radiusKm: range,
            queryText: q,
            version,
          };
        } catch {
          const res = await searchPlacesWithLocation({
            query: q,
            apiKey: browserKey,
            fallbackCenter: center,
            radiusKm: range,
            strictRadius: true,
          });
          return {
            data: res.places as PlaceLite[],
            distances: Object.fromEntries(res.places.map((p) => [p.id, p.distanceKm])),
            origin: res.origin,
            usedCurrentLocation: res.usedCurrentLocation,
            wasNearby: true,
            radiusKm: res.radiusKm,
            queryText: q,
            version,
          };
        }
      }

      let data: PlaceLite[];
      if (browserKey) {
        try {
          data = await searchPlacesPaginated({
            query: q,
            apiKey: browserKey,
            origin: BLR,
            radiusKm: 50,
            maxPages: 3,
          });
        } catch {
          data = await (userKey ? searchPlacesWithKey(userKey, q) : doSearch({ data: { query: q } }));
        }
      } else {
        data = await doSearch({ data: { query: q } });
      }
      return {
        data,
        distances: {} as Record<string, number>,
        origin: null as { lat: number; lng: number } | null,
        usedCurrentLocation: false,
        wasNearby: false,
        radiusKm: range,
        queryText: q,
        version,
      };
    },
    onSuccess: ({ data, distances, origin, usedCurrentLocation, wasNearby, radiusKm, queryText, version }) => {
      if (version !== searchVersion.current) return;
      setResults(data);
      setShowResults(data.length > 0);
      setResultDistances(distances);
      if (wasNearby) {
        setLastNearbyQuery(queryText);
        setDetails(null);
        setNearby([]);
        setLastPlace(null);
        setRoute(null);
        setRouteStops(null);
        setRouteWaypoints([]);
        if (origin) setCenter(origin);
        setSheet("peek");
      } else {
        setLastNearbyQuery(null);
      }

      if (!data.length) {
        setError(
          wasNearby
            ? `No matching places found within ${radiusKm} km${usedCurrentLocation ? " of your location" : ""}. Try 10 km or 25 km.`
            : "No places found. Try another name.",
        );
      } else if (wasNearby && !usedCurrentLocation) {
        setError("Location permission was unavailable—showing results near the current map area.");
      } else {
        setError(null);
      }
    },
    onError: (_, { version }) => {
      if (version === searchVersion.current) {
        setError("Could not search right now. Please try again.");
      }
    },
  });

  const selectMutation = useMutation({
    mutationFn: async ({ place, range, version }: { place: PlaceLite; range: number; version: number }) => {
      explorationSignal();
      const [d, rawNearby] = await Promise.all([
        userKey
          ? getPlaceDetailsWithKey(userKey, place.id)
          : doDetails({ data: { placeId: place.id } }),
        userKey
          ? getNearbyWithKey(userKey, place.lat, place.lng, range)
          : doNearby({ data: { lat: place.lat, lng: place.lng, rangeKm: range } }),
      ]);
      const n = filterNearbyByRange(rawNearby, { lat: d.lat, lng: d.lng }, range);
      return { d, n, version };
    },
    onSuccess: ({ d, n, version }) => {
      if (version !== requestVersion.current) return;
      setDetails(d);
      setNearby(n);
      setCenter({ lat: d.lat, lng: d.lng });
      setError(null);
    },
    onError: (_, { version }) => {
      if (version === requestVersion.current) setError("Could not load this place's details.");
    },
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
          : "Routing is unavailable right now."
        : e.message === "no-geo"
          ? "Location permission is needed to build a route."
          : e.message === "no-ev-station"
            ? "No car charging station found within the selected range. Refresh nearby places or choose a larger range."
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
      setRouteWaypoints([]);
      setPlanRouteOn(false);
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
      return { r, labels, stops };
    },
    onSuccess: ({ r, labels, stops }) => {
      setRoute(r);
      setRouteStops(labels);
      setRouteWaypoints(stops);
      setPlanRouteOn(true);
      setError(null);
    },
    onError: routeError,
  });

  const evRouteMutation = useMutation({
    mutationFn: async (dest: PlaceDetails) => {
      explorationSignal();
      if (!userKey) throw new Error("no-key");
      const version = requestVersion.current;
      const stations = nearby.find((g) => g.key === "evcar")?.places ?? [];
      const origin = await getMyLocation();
      const r = await computeEVRouteWithKey(userKey, origin, dest, stations, rangeKm);
      explorationSignal();
      return { r, version, destinationName: dest.name };
    },
    onSuccess: ({ r, version, destinationName }) => {
      if (version !== requestVersion.current) return;
      setRoute(r);
      setRouteStops([`EV charging: ${r.evStation?.name}`, `Visit: ${destinationName}`]);
      setRouteWaypoints(r.evStation ? [{ lat: r.evStation.lat, lng: r.evStation.lng }] : []);
      setPlanRouteOn(false);
      setError(null);
      setSheet("half");
    },
    onError: routeError,
  });

  const closeSearchResults = useCallback(() => {
    ++searchVersion.current;
    searchMutation.reset();
    setShowResults(false);
    setResults([]);
    setResultDistances({});
    setLastNearbyQuery(null);
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [searchMutation.reset]);

  const addToRoute = (p: PlaceLite) => {
    setRoutePlaces((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
    closeSearchResults();
  };

  const removeFromRoute = (id: string) => {
    setRoutePlaces((list) => list.filter((x) => x.id !== id));
  };

  const fullRouteMutation = useMutation({
    mutationFn: async (places: PlaceLite[]) => {
      explorationSignal();
      const key = userKey;
      if (!key) throw new Error("no-key");
      if (!places.length) throw new Error("no-stops");
      const origin = await getMyLocation();
      const destination = places[places.length - 1];
      const intermediates = places.slice(0, -1).map((p) => ({ lat: p.lat, lng: p.lng }));
      const r = await computeRouteWithKey(
        key,
        origin,
        { lat: destination.lat, lng: destination.lng },
        "DRIVE",
        intermediates,
      );
      return { r, labels: places.map((p, i) => `Stop ${i + 1}: ${p.name}`), intermediates };
    },
    onSuccess: ({ r, labels, intermediates }) => {
      setRoute(r);
      setRouteStops(labels);
      setRouteWaypoints(intermediates);
      setPlanRouteOn(false);
      setError(null);
      setSheet("half");
    },
    onError: routeError,
  });

  const openGoogleMapsDirections = useCallback(
    (destination: { lat: number; lng: number }, waypoints: Array<{ lat: number; lng: number }> = []) => {
      closeSearchResults();
      const url = buildGoogleMapsDirectionsUrl(destination, waypoints);
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [closeSearchResults],
  );

  const runSearch = (q: string, overrideRange?: number, overrideNearMe?: boolean) => {
    const value = q.trim();
    if (!value) return;
    setQuery(value);
    setShowResults(false);
    setResults([]);
    setResultDistances({});
    searchMutation.mutate({
      q: value,
      version: ++searchVersion.current,
      range: overrideRange ?? rangeKm,
      forceNearMe: overrideNearMe ?? nearMeMode,
    });
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
      setNearMeMode(false);
      closeSearchResults();
      setDetails(null);
      setNearby([]);
      setRoute(null);
      setRouteStops(null);
      setRouteWaypoints([]);
      setPlanRouteOn(false);
      setLastPlace(p);
      setCenter({ lat: p.lat, lng: p.lng });
      setSheet("half");
      setFullMap(false);
      selectMutation.mutate({ place: p, range: rangeKm, version: ++requestVersion.current });
    },
    [selectMutation, rangeKm, closeSearchResults],
  );

  const selectByIdMutation = useMutation({
    mutationFn: async ({ placeId, range, version }: { placeId: string; range: number; version: number }) => {
      explorationSignal();
      const d = userKey
        ? await getPlaceDetailsWithKey(userKey, placeId)
        : await doDetails({ data: { placeId } });
      explorationSignal();
      const rawNearby = userKey
        ? await getNearbyWithKey(userKey, d.lat, d.lng, range)
        : await doNearby({ data: { lat: d.lat, lng: d.lng, rangeKm: range } });
      const n = filterNearbyByRange(rawNearby, { lat: d.lat, lng: d.lng }, range);
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
    onError: (_, { version }) => {
      if (version === requestVersion.current) setError("Could not load details for that spot.");
    },
  });

  const selectById = useCallback(
    (placeId: string) => {
      pushPlace(placeId);
      setNearMeMode(false);
      closeSearchResults();
      setDetails(null);
      setNearby([]);
      setRoute(null);
      setRouteStops(null);
      setRouteWaypoints([]);
      setPlanRouteOn(false);
      setSheet("half");
      setFullMap(false);
      selectByIdMutation.mutate({ placeId, range: rangeKm, version: ++requestVersion.current });
    },
    [selectByIdMutation, rangeKm, closeSearchResults],
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
    const activePlace = details ?? lastPlace;
    if (activePlace) {
      setNearby([]);
      selectMutation.mutate({ place: activePlace, range: km, version: ++requestVersion.current });
    } else if (lastNearbyQuery) {
      runSearch(lastNearbyQuery, km, true);
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
      setQuery(previous.query); setResults(previous.results); setShowResults(previous.results.length > 0); setDetails(previous.details); setNearby(previous.nearby);
      setCenter(previous.center); setRoute(previous.route); setRouteStops(null); setRouteWaypoints([]); setPlanRouteOn(false); setRangeKm(previous.rangeKm); setLastPlace(previous.lastPlace);
      setSheet(previous.sheet); setFullMap(previous.fullMap); setDepth(previous.depth); setError(null);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [selectMutation.reset, selectByIdMutation.reset, searchMutation.reset, routeMutation.reset]);

  const searchMarkers: MapMarker[] =
    !details && results.length > 0
      ? results.map((p) => ({ ...p, kind: inferMarkerKind(query) }))
      : [];
  const nearbyMarkers: MapMarker[] = nearby
    .flatMap((g) => g.places.map((p) => ({ ...p, kind: g.key })))
    .slice(0, 40);
  const baseMarkers = nearbyMarkers.length > 0 ? nearbyMarkers : searchMarkers;
  const markers: MapMarker[] = route?.evStation
    ? [{ ...route.evStation, kind: "evcar" }, ...baseMarkers.filter((p) => p.id !== route.evStation?.id)]
    : baseMarkers;

  const routePanel = route ? (
    <div className="mt-3 rounded-lg border border-border bg-secondary/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{route.evStation ? "Route with EV charging" : "Travel options"}</p>
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
      {route.evStation ? <p className="mt-2 text-xs text-muted-foreground">Total driving time includes the charging detour, not charging or waiting time. Confirm connector compatibility and station availability before travelling.</p> : null}
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
  ) : null;

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
              placeholder="Search a place or nearby charging station…"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              aria-label="Search a place"
            />
            <Button type="submit" size="sm" className="rounded-full px-4">
              {searchMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Go"}
            </Button>
          </form><AccountMenu signedIn={Boolean(session)} isAdmin={isAdmin} hasKey={Boolean(userKey)} /></div>

          {routePlaces.length > 0 ? (
            <div className="mt-2 rounded-2xl border border-border bg-card/95 p-2.5 shadow-[var(--shadow-card)] backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ListOrdered className="size-3.5 text-primary" /> Full route · {routePlaces.length}{" "}
                  {routePlaces.length === 1 ? "place" : "places"}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRoutePlaces([])}
                    className="rounded-full px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                  >
                    Clear
                  </button>
                  <Button
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => {
                      closeSearchResults();
                      fullRouteMutation.mutate(routePlaces);
                    }}
                    disabled={fullRouteMutation.isPending}
                  >
                    {fullRouteMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RouteIcon className="size-3.5" />
                    )}
                    Plan route
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => {
                      const destination = routePlaces[routePlaces.length - 1];
                      const waypoints = routePlaces.slice(0, -1);
                      openGoogleMapsDirections(destination, waypoints);
                    }}
                  >
                    <Play className="size-3.5" />
                    Start
                  </Button>
                </div>
              </div>
              <ol className="mt-2 flex flex-wrap gap-1.5">
                {routePlaces.map((p, i) => (
                  <li
                    key={p.id}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-[11px] text-secondary-foreground"
                  >
                    <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="max-w-36 truncate">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFromRoute(p.id)}
                      aria-label={`Remove ${p.name} from route`}
                      className="shrink-0 rounded-full p-0.5 text-muted-foreground transition hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1.5">
            <FavoritesSheet onOpenPlace={selectById} version={favVersion} />
            <button
              type="button"
              onClick={() => {
                const next = !nearMeMode;
                setNearMeMode(next);
                if (next && query.trim()) {
                  runSearch(query, rangeKm, true);
                }
              }}
              aria-pressed={nearMeMode}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs backdrop-blur transition ${
                nearMeMode
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/90 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              <LocateFixed className="size-3.5" /> Near me
            </button>
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
                onClick={() => {
                  setNearMeMode(false);
                  runSearch(q, rangeKm, false);
                }}
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

          {showResults && results.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
                <span>
                  {results.length} {results.length === 1 ? "result" : "results"}
                </span>
                <button
                  type="button"
                  onClick={closeSearchResults}
                  aria-label="Close search results"
                  className="rounded-full p-1 transition hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {results.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 border-b border-border/60 px-4 py-3 last:border-0 hover:bg-secondary"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        closeSearchResults();
                        select(r);
                      }}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.address}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      {resultDistances[r.id] != null ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {resultDistances[r.id]} km
                        </Badge>
                      ) : null}
                      <Stars rating={r.rating} />
                      <button
                        type="button"
                        aria-label={`Add ${r.name} to full route`}
                        title="Add to full route"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          addToRoute(r);
                        }}
                        className={`rounded-full border p-1.5 transition ${
                          routePlaces.some((x) => x.id === r.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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
              {routePanel}
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

              <PlacePhotos key={details.id} details={details} />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => { setNearby([]); selectMutation.mutate({ place: details, range: rangeKm, version: ++requestVersion.current }); }} disabled={selectMutation.isPending}><RefreshCw className="size-4" />Refresh details</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => {
                    closeSearchResults();
                    routeMutation.mutate({ lat: details.lat, lng: details.lng });
                  }}
                  disabled={routeMutation.isPending || evRouteMutation.isPending || planRouteMutation.isPending}
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
                  onClick={() =>
                    openGoogleMapsDirections(
                      { lat: details.lat, lng: details.lng },
                      routeWaypoints,
                    )
                  }
                >
                  <Play className="size-4" />
                  Start
                </Button>
                <Button
                  size="sm"
                  variant={route?.evStation ? "default" : "outline"}
                  className="gap-1.5"
                  aria-pressed={Boolean(route?.evStation)}
                  onClick={() => {
                    closeSearchResults();
                    evRouteMutation.mutate(details);
                  }}
                  disabled={evRouteMutation.isPending || routeMutation.isPending || planRouteMutation.isPending || selectMutation.isPending}
                >
                  {evRouteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                  Find route with EV
                </Button>
                <Button
                  size="sm"
                  variant={planRouteOn ? "default" : "outline"}
                  className="gap-1.5"
                  aria-pressed={planRouteOn}
                  onClick={() => {
                    closeSearchResults();
                    planRouteMutation.mutate(details);
                  }}
                  disabled={planRouteMutation.isPending || evRouteMutation.isPending || routeMutation.isPending}
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
                  variant={routePlaces.some((x) => x.id === details.id) ? "default" : "outline"}
                  className="gap-1.5"
                  aria-pressed={routePlaces.some((x) => x.id === details.id)}
                  onClick={() =>
                    routePlaces.some((x) => x.id === details.id)
                      ? removeFromRoute(details.id)
                      : addToRoute(details)
                  }
                >
                  {routePlaces.some((x) => x.id === details.id) ? (
                    <X className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {routePlaces.some((x) => x.id === details.id) ? "In route" : "Add to route"}
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

              {routePanel}

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
                        · {group.places.length} within {rangeKm} km
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
