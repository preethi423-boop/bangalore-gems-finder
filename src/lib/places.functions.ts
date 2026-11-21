import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getSessionUser, readCookie } from "@/server/google-auth";
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

export type PlaceReview = { author: string; rating: number; text: string; relative: string };

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

export type NearbyGroup = { key: string; label: string; places: PlaceLite[]; error?: string };

function ownKey() {
  return process.env.GOOGLE_API_KEY?.trim() || "";
}

async function requireGoogleSession() {
  const user = await getSessionUser(readCookie(getRequest(), "session"));
  if (!user) throw new Error("Unauthorized: Google session required.");
  return user;
}

function apiUrl(path: string) {
  return ownKey()
    ? `https://places.googleapis.com${path.replace(/^\/places/, "")}`
    : `${GATEWAY}${path}`;
}

function buildHeaders(mask: string): Record<string, string> {
  const own = ownKey();
  if (own) {
    return { "X-Goog-Api-Key": own, "Content-Type": "application/json", "X-Goog-FieldMask": mask };
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !connectionKey) throw new Error("Maps connection is not configured.");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
    "X-Goog-FieldMask": mask,
  };
}

async function searchGoogle(path: string, mask: string, body: unknown) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: buildHeaders(mask),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error(`Maps request failed [${response.status}]: ${await response.text()}`);
    throw new Error(`Places request failed (${response.status}).`);
  }
  return response.json();
}

function toLite(place: any): PlaceLite {
  return {
    id: place.id,
    name: place.displayName?.text ?? "Unnamed place",
    address: place.formattedAddress ?? "",
    lat: place.location?.latitude ?? 0,
    lng: place.location?.longitude ?? 0,
    rating: place.rating,
    ratingCount: place.userRatingCount,
    priceLevel: place.priceLevel,
    primaryType: place.primaryTypeDisplayName?.text,
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

function parkingDetails(options: Record<string, boolean> | undefined) {
  if (!options) return { parkingStatus: "unknown" as const, parkingTypes: [] as string[] };
  const parkingTypes = Object.entries(options)
    .filter(([, available]) => available)
    .map(([key]) => PARKING_LABELS[key] ?? key);
  return {
    parkingStatus: parkingTypes.length ? ("available" as const) : ("not_available" as const),
    parkingTypes,
  };
}

const LITE_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryTypeDisplayName";
const BLR = { latitude: 12.9716, longitude: 77.5946 };

export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string }) => ({ query: String(data.query ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<PlaceLite[]> => {
    await requireGoogleSession();
    if (!data.query.trim()) return [];
    const json = await searchGoogle("/places/v1/places:searchText", LITE_MASK, {
      textQuery: data.query,
      maxResultCount: 8,
      regionCode: "IN",
      locationBias: { circle: { center: BLR, radius: 50000 } },
    });
    return (json.places ?? []).map(toLite);
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((data: { placeId: string }) => ({ placeId: String(data.placeId ?? "").slice(0, 200) }))
  .handler(async ({ data }): Promise<PlaceDetails> => {
    await requireGoogleSession();
    const mask = "id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,primaryTypeDisplayName,editorialSummary,nationalPhoneNumber,websiteUri,googleMapsUri,reviews,photos,accessibilityOptions,parkingOptions,regularOpeningHours";
    const response = await fetch(apiUrl(`/places/v1/places/${encodeURIComponent(data.placeId)}`), { headers: buildHeaders(mask) });
    if (!response.ok) throw new Error(`Place details failed (${response.status}).`);
    const place: any = await response.json();
    return {
      ...toLite(place),
      photos: readPlacePhotos(place.photos),
      summary: place.editorialSummary?.text,
      phone: place.nationalPhoneNumber,
      website: place.websiteUri,
      mapsUri: place.googleMapsUri,
      wheelchair: place.accessibilityOptions?.wheelchairAccessibleEntrance,
      ...parkingDetails(place.parkingOptions),
      hours: place.regularOpeningHours?.weekdayDescriptions ?? [],
      reviews: (place.reviews ?? []).slice(0, 6).map((review: any) => ({
        author: review.authorAttribution?.displayName ?? "Google user",
        rating: review.rating ?? 0,
        text: review.text?.text ?? review.originalText?.text ?? "",
        relative: review.relativePublishTimeDescription ?? "",
      })),
    };
  });

export const getPlacePhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string }) => ({ resource: photoResource(String(data.name ?? "")) }))
  .handler(async ({ data }): Promise<string> => {
    await requireGoogleSession();
    const headers = buildHeaders("");
    const response = await fetch(apiUrl(`/places/v1/${data.resource}/media?maxWidthPx=1200&skipHttpRedirect=true`), {
      headers: Object.fromEntries(Object.entries(headers).filter(([key]) => key !== "X-Goog-FieldMask" && key !== "Content-Type")),
    });
    if (!response.ok) throw new Error(`Photo unavailable (${response.status}).`);
    const photo = await response.json() as { photoUri?: string };
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
  { key: "evbike", label: "Bike charging", query: "electric two wheeler scooter bike charging station", radius: 5000 },
];

export const getNearby = createServerFn({ method: "POST" })
  .inputValidator((data: { lat: number; lng: number; rangeKm?: number }) => ({
    lat: Number(data.lat),
    lng: Number(data.lng),
    rangeKm: Number(data.rangeKm) > 0 ? Number(data.rangeKm) : 5,
  }))
  .handler(async ({ data }): Promise<NearbyGroup[]> => {
    await requireGoogleSession();
    const center = { latitude: data.lat, longitude: data.lng };
    const scale = data.rangeKm / 5;
    return Promise.all(CATEGORIES.map(async (category) => {
      const radius = Math.min(50000, Math.round(category.radius * scale));
      try {
        const json = await searchGoogle("/places/v1/places:searchText", LITE_MASK, {
          textQuery: category.query,
          maxResultCount: 8,
          regionCode: "IN",
          locationBias: { circle: { center, radius } },
        });
        return { key: category.key, label: category.label, places: (json.places ?? []).map(toLite) };
      } catch (error) {
        console.error(`nearby ${category.key} failed`, error);
        return { key: category.key, label: category.label, places: [], error: "Could not refresh these places. Please try again." };
      }
    }));
  });

export const getDefaultMapsKey = createServerFn({ method: "GET" }).handler(async () => ownKey());
