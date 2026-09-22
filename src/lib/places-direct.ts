/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PlaceLite, PlaceDetails, NearbyGroup } from "./places.functions";

const PLACES = "https://places.googleapis.com/v1";
const ROUTES = "https://routes.googleapis.com/directions/v2:computeRoutes";

export const LITE_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryTypeDisplayName";

const BLR = { latitude: 12.9716, longitude: 77.5946 };

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

export const CATEGORIES = [
  { key: "parking", label: "Parking", query: "parking lot", radius: 5000 },
  { key: "streetfood", label: "Street food", query: "street food stall chaat darshini", radius: 1200 },
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

async function call(url: string, key: string, mask: string, body?: unknown) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": mask,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export async function searchPlacesWithKey(key: string, query: string): Promise<PlaceLite[]> {
  if (!query.trim()) return [];
  const json = await call(`${PLACES}/places:searchText`, key, LITE_MASK, {
    textQuery: query,
    maxResultCount: 8,
    regionCode: "IN",
    locationBias: { circle: { center: BLR, radius: 50000 } },
  });
  return (json.places ?? []).map(toLite);
}

export async function getPlaceDetailsWithKey(key: string, placeId: string): Promise<PlaceDetails> {
  const mask =
    "id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,primaryTypeDisplayName,editorialSummary,nationalPhoneNumber,websiteUri,googleMapsUri,reviews,accessibilityOptions,parkingOptions,regularOpeningHours";
  const p: any = await call(`${PLACES}/places/${encodeURIComponent(placeId)}`, key, mask);
  return {
    ...toLite(p),
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
}

export async function getNearbyWithKey(
  key: string,
  lat: number,
  lng: number,
  rangeKm = 5,
): Promise<NearbyGroup[]> {
  const center = { latitude: lat, longitude: lng };
  const scale = (rangeKm > 0 ? rangeKm : 5) / 5;
  return Promise.all(
    CATEGORIES.map(async (c) => {
      const radius = Math.min(50000, Math.round(c.radius * scale));
      try {
        const json = await call(`${PLACES}/places:searchText`, key, LITE_MASK, {
          textQuery: c.query,
          maxResultCount: 8,
          regionCode: "IN",
          locationBias: { circle: { center, radius } },
        });
        return { key: c.key, label: c.label, places: (json.places ?? []).map(toLite) };
      } catch {
        return { key: c.key, label: c.label, places: [] as PlaceLite[] };
      }
    }),
  );
}

export type RouteResult = {
  distanceText: string;
  durationText: string;
  fareEstimateText: string;
  polyline: string;
};

function estimateCabFare(distanceMeters: number) {
  const distanceKm = distanceMeters / 1000;
  const baseFare = 75;
  const includedKm = 2;
  const perKm = 18;
  const estimated = baseFare + Math.max(0, distanceKm - includedKm) * perKm;
  const low = Math.max(baseFare, Math.round((estimated * 0.9) / 10) * 10);
  const high = Math.max(low + 20, Math.round((estimated * 1.2) / 10) * 10);
  return `₹${low.toLocaleString("en-IN")}–₹${high.toLocaleString("en-IN")}`;
}

export async function computeRouteWithKey(
  key: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: "DRIVE" | "WALK" | "TWO_WHEELER" = "DRIVE",
): Promise<RouteResult> {
  const json: any = await call(
    ROUTES,
    key,
    "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      travelMode: mode,
      routingPreference: mode === "WALK" ? undefined : "TRAFFIC_AWARE",
      languageCode: "en-IN",
      units: "METRIC",
    },
  );
  const route = json.routes?.[0];
  if (!route) throw new Error("No route found.");
  const meters = route.distanceMeters ?? 0;
  const seconds = Number(String(route.duration ?? "0s").replace("s", ""));
  return {
    distanceText: meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`,
    durationText:
      seconds >= 3600
        ? `${Math.floor(seconds / 3600)} hr ${Math.round((seconds % 3600) / 60)} min`
        : `${Math.max(1, Math.round(seconds / 60))} min`,
    fareEstimateText: estimateCabFare(meters),
    polyline: route.polyline?.encodedPolyline ?? "",
  };
}