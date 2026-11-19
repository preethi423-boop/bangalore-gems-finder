import { createServerFn } from "@tanstack/react-start";
import { requireSubscriptionAccess } from "./subscription.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { photoResource, readPlacePhotos, type PlacePhoto } from "./place-photos";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

export type PlaceLite = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  ratingCount?: number;
  priceLevel?: string;
  primaryType?: string;
};

export type PlaceReview = {
  author: string;
  rating: number;
  text: string;
  relative: string;
};

export type PlaceDetails = PlaceLite & {
  photos?: PlacePhoto[];
  summary?: string;
  phone?: string;
  website?: string;
  mapsUri?: string;
  reviews: PlaceReview[];
  wheelchair?: boolean;
  parkingStatus: "available" | "not_available" | "unknown";
  parkingTypes: string[];
  hours: string[];
};

export type NearbyGroup = {
  key: string;
  label: string;
  places: PlaceLite[];
  error?: string;
};

async function ownKey() {
  const { readSharedMapsSettings } = await import("./maps-settings.server");
  const settings = await readSharedMapsSettings();
  return settings.serverKey || process.env.GOOGLE_API_KEY?.trim() || "";
}

async function placesUrl(path: string) {
  return await ownKey() ? `https://places.googleapis.com${path.replace(/^\/places\//, "/")}` : `${GATEWAY}${path}`;
}

async function buildHeaders(mask: string): Promise<Record<string, string>> {
  const own = await ownKey();
  if (own) return { "X-Goog-Api-Key": own, "Content-Type": "application/json", "X-Goog-FieldMask": mask };
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !connKey) throw new Error("Maps connection is not configured.");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
    "X-Goog-FieldMask": mask,
  };
}

async function gateway(path: string, mask: string, body: unknown) {
  await requireSubscriptionAccess();
  const res = await fetch(await placesUrl(path), {
    method: "POST",
    headers: await buildHeaders(mask),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Maps gateway ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Places request failed (${res.status}).`);
  }
  return res.json();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toLite(p: any): PlaceLite {
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unnamed place",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    rating: p.rating,
    ratingCount: p.userRatingCount,
    priceLevel: p.priceLevel,
    primaryType: p.primaryTypeDisplayName?.text,
  };
}

const PARKING_LABELS: Record<string, string> = {
  freeParkingLot: "Free parking lot",
  paidParkingLot: "Paid parking lot",
  freeStreetParking: "Free street parking",
  paidStreetParking: "Paid street parking",
  valetParking: "Valet parking",
  freeGarageParking: "Free parking garage",
  paidGarageParking: "Paid parking garage",
};

function getParkingDetails(parkingOptions: Record<string, boolean> | undefined) {
  if (!parkingOptions) {
    return { parkingStatus: "unknown" as const, parkingTypes: [] as string[] };
  }
  const parkingTypes = Object.entries(parkingOptions)
    .filter(([, available]) => available)
    .map(([key]) => PARKING_LABELS[key] ?? key);
  return {
    parkingStatus: parkingTypes.length ? ("available" as const) : ("not_available" as const),
    parkingTypes,
  };
}

const LITE_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryTypeDisplayName";

const BLR = { latitude: 12.9716, longitude: 77.5946 };

export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string }) => ({ query: String(data.query ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<PlaceLite[]> => {
    await requireSubscriptionAccess();
    if (!data.query.trim()) return [];
    const json = await gateway("/places/v1/places:searchText", LITE_MASK, {
      textQuery: data.query,
      maxResultCount: 8,
      regionCode: "IN",
      locationBias: { circle: { center: BLR, radius: 50000 } },
    });
    return (json.places ?? []).map(toLite);
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((data: { placeId: string }) => ({
    placeId: String(data.placeId ?? "").slice(0, 200),
  }))
  .handler(async ({ data }): Promise<PlaceDetails> => {
    await requireSubscriptionAccess();
    const mask =
      "id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,primaryTypeDisplayName,editorialSummary,nationalPhoneNumber,websiteUri,googleMapsUri,reviews,photos,accessibilityOptions,parkingOptions,regularOpeningHours";
    const res = await fetch(await placesUrl(`/places/v1/places/${encodeURIComponent(data.placeId)}`), {
      headers: await buildHeaders(mask),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Maps gateway details failed [${res.status}]: ${text}`);
      throw new Error(`Place details failed (${res.status}).`);
    }
    const p: any = await res.json();
    return {
      ...toLite(p),
      photos: readPlacePhotos(p.photos),
      summary: p.editorialSummary?.text,
      phone: p.nationalPhoneNumber,
      website: p.websiteUri,
      mapsUri: p.googleMapsUri,
      wheelchair: p.accessibilityOptions?.wheelchairAccessibleEntrance,
      ...getParkingDetails(p.parkingOptions),
      hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
      reviews: (p.reviews ?? []).slice(0, 6).map((r: any) => ({
        author: r.authorAttribution?.displayName ?? "Google user",
        rating: r.rating ?? 0,
        text: r.text?.text ?? r.originalText?.text ?? "",
        relative: r.relativePublishTimeDescription ?? "",
      })),
    };
  });

export const getPlacePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string }) => ({ resource: photoResource(String(data.name ?? "")) }))
  .handler(async ({ data }): Promise<string> => {
    await requireSubscriptionAccess();
    const headers = await buildHeaders("");
    const res = await fetch(await placesUrl(`/places/v1/${data.resource}/media?maxWidthPx=1200&skipHttpRedirect=true`), {
      headers: Object.fromEntries(Object.entries(headers).filter(([k]) => k !== "X-Goog-FieldMask" && k !== "Content-Type")),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Place photo failed [${res.status}]: ${body}`);
      if (res.status === 403) throw new Error("Google denied photo access. Check that the server key allows Places API and has server-compatible restrictions.");
      throw new Error(`Photo unavailable (${res.status}).`);
    }
    const photo = await res.json() as { photoUri?: string };
    if (!photo.photoUri?.startsWith("https://")) throw new Error("Photo unavailable.");
    return photo.photoUri;
  });

const CATEGORIES = [
  { key: "parking", label: "Parking", query: "parking lot", radius: 5000 },
  { key: "streetfood", label: "Street food", query: "street food", radius: 1200 },
  { key: "shopping", label: "Shopping", query: "shopping market mall", radius: 2000 },
  { key: "sights", label: "Must see", query: "tourist attraction landmark viewpoint", radius: 5000 },
  { key: "cafes", label: "Cafes & eats", query: "cafe restaurant", radius: 1200 },
  { key: "evcar", label: "Car charging", query: "electric car charging station", radius: 5000 },
  {
    key: "evbike",
    label: "Bike charging",
    query: "electric two wheeler scooter bike charging station",
    radius: 5000,
  },
];

export const getNearby = createServerFn({ method: "POST" })
  .inputValidator((data: { lat: number; lng: number; rangeKm?: number }) => ({
    lat: Number(data.lat),
    lng: Number(data.lng),
    rangeKm: Number(data.rangeKm) > 0 ? Number(data.rangeKm) : 5,
  }))
  .handler(async ({ data }): Promise<NearbyGroup[]> => {
    await requireSubscriptionAccess();
    const center = { latitude: data.lat, longitude: data.lng };
    const scale = data.rangeKm / 5;
    return Promise.all(
      CATEGORIES.map(async (c) => {
        const radius = Math.min(50000, Math.round(c.radius * scale));
        try {
          const json = await gateway("/places/v1/places:searchText", LITE_MASK, {
            textQuery: c.query,
            maxResultCount: 8,
            regionCode: "IN",
            locationBias: { circle: { center, radius } },
          });
          return { key: c.key, label: c.label, places: (json.places ?? []).map(toLite) };
        } catch (e) {
          console.error(`nearby ${c.key} failed`, e);
          return { key: c.key, label: c.label, places: [] as PlaceLite[], error: "Could not refresh these places. Please try again." };
        }
      }),
    );
  });

/** Browser Maps key for drawing the map: the admin-configured key, or "" to use the built-in one. */
export const getDefaultMapsKey = createServerFn({ method: "POST" }).handler(async () => {
  await requireSubscriptionAccess();
  const { readSharedMapsSettings } = await import("./maps-settings.server");
  return (await readSharedMapsSettings()).browserKey || process.env.GOOGLE_API_KEY?.trim() || "";
});

export const computeSharedRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number }; intermediates?: Array<{ lat: number; lng: number }> }) => {
    const valid = (p: { lat: number; lng: number }) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
    const intermediates = data.intermediates ?? [];
    if (!valid(data.origin) || !valid(data.destination) || intermediates.length > 25 || !intermediates.every(valid)) throw new Error("Invalid route stops (maximum 25 intermediate stops).");
    return { origin: data.origin, destination: data.destination, intermediates };
  }).handler(async ({ data }) => {
    await requireSubscriptionAccess();
    const own = await ownKey();
    const waypoint = (p: { lat: number; lng: number }) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
    const response = await fetch(own ? "https://routes.googleapis.com/directions/v2:computeRoutes" : `${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST", headers: await buildHeaders("routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"),
      body: JSON.stringify({ origin: waypoint(data.origin), destination: waypoint(data.destination), intermediates: data.intermediates.map(waypoint), travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", languageCode: "en-IN", units: "METRIC" }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Google Routes failed [${response.status}]: ${body}`);
      if (response.status === 403) throw new Error("Google denied routing. Ask the administrator to enable Routes API and use a server key without website restrictions.");
      throw new Error(`Routing unavailable (${response.status}).`);
    }
    const { readRouteResult } = await import("./route-result");
    return readRouteResult(await response.json());
  });
