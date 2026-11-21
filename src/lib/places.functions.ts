import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getSessionUser, readCookie } from "@/server/google-auth";
import { photoResource, readPlacePhotos, type PlacePhoto } from "./place-photos";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const BLR = { latitude: 12.9716, longitude: 77.5946 };

export type PlaceLite = { id: string; name: string; address: string; lat: number; lng: number; rating?: number; ratingCount?: number; priceLevel?: string; primaryType?: string };
export type PlaceReview = { author: string; rating: number; text: string; relative: string };
export type PlaceDetails = PlaceLite & { photos?: PlacePhoto[]; summary?: string; phone?: string; website?: string; mapsUri?: string; reviews: PlaceReview[]; wheelchair?: boolean; parkingStatus: "available" | "not_available" | "unknown"; parkingTypes: string[]; hours: string[] };
export type NearbyGroup = { key: string; label: string; places: PlaceLite[]; error?: string };

function ownKey() { return process.env.GOOGLE_API_KEY?.trim() || ""; }
function gatewayReady() { return Boolean(process.env.LOVABLE_API_KEY && process.env.GOOGLE_MAPS_API_KEY); }

async function requireGoogleSession() {
  const user = await getSessionUser(readCookie(getRequest(), "session"));
  if (!user) throw new Error("Unauthorized: Google session required.");
  return user;
}

function googleUrl(path: string) { return `https://places.googleapis.com${path.replace(/^\/places/, "")}`; }
function gatewayUrl(path: string) { return `${GATEWAY}${path}`; }
function googleHeaders(mask: string) { return { "X-Goog-Api-Key": ownKey(), "Content-Type": "application/json", "X-Goog-FieldMask": mask }; }
function gatewayHeaders(mask: string) { return { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "X-Connection-Api-Key": process.env.GOOGLE_MAPS_API_KEY!, "Content-Type": "application/json", "X-Goog-FieldMask": mask }; }

async function placesRequest(path: string, mask: string, init: RequestInit) {
  const primary = await fetch(googleUrl(path), { ...init, headers: { ...googleHeaders(mask), ...(init.headers || {}) } });
  if (primary.ok || !gatewayReady()) return primary;
  const status = primary.status;
  if (![400, 401, 403, 429].includes(status) && status < 500) return primary;
  console.warn(`Google Places key returned ${status}; retrying through the configured gateway.`);
  return fetch(gatewayUrl(path), { ...init, headers: { ...gatewayHeaders(mask), ...(init.headers || {}) } });
}

async function searchGoogle(path: string, mask: string, body: unknown) {
  const response = ownKey()
    ? await placesRequest(path, mask, { method: "POST", body: JSON.stringify(body) })
    : await fetch(gatewayUrl(path), { method: "POST", headers: gatewayHeaders(mask), body: JSON.stringify(body) });
  if (!response.ok) { console.error(`Places request failed [${response.status}]: ${await response.text()}`); throw new Error(`Places request failed (${response.status}).`); }
  return response.json();
}

function toLite(place: any): PlaceLite { return { id: place.id, name: place.displayName?.text ?? "Unnamed place", address: place.formattedAddress ?? "", lat: place.location?.latitude ?? 0, lng: place.location?.longitude ?? 0, rating: place.rating, ratingCount: place.userRatingCount, priceLevel: place.priceLevel, primaryType: place.primaryTypeDisplayName?.text }; }
const LITE_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryTypeDisplayName";
const PARKING_LABELS: Record<string, string> = { freeParkingLot: "Free parking lot", paidParkingLot: "Paid parking lot", freeStreetParking: "Free street parking", paidStreetParking: "Paid street parking", valetParking: "Valet parking", freeGarageParking: "Free parking garage", paidGarageParking: "Paid parking garage" };
function parkingDetails(options: Record<string, boolean> | undefined) { if (!options) return { parkingStatus: "unknown" as const, parkingTypes: [] as string[] }; const parkingTypes = Object.entries(options).filter(([, value]) => value).map(([key]) => PARKING_LABELS[key] ?? key); return { parkingStatus: parkingTypes.length ? "available" as const : "not_available" as const, parkingTypes }; }

export const searchPlaces = createServerFn({ method: "POST" }).inputValidator((data: { query: string }) => ({ query: String(data.query ?? "").slice(0, 120) })).handler(async ({ data }): Promise<PlaceLite[]> => {
  await requireGoogleSession();
  if (!data.query.trim()) return [];
  const json = await searchGoogle("/places/v1/places:searchText", LITE_MASK, { textQuery: data.query, maxResultCount: 8, regionCode: "IN", locationBias: { circle: { center: BLR, radius: 50000 } } });
  return (json.places ?? []).map(toLite);
});

export const getPlaceDetails = createServerFn({ method: "POST" }).inputValidator((data: { placeId: string }) => ({ placeId: String(data.placeId ?? "").slice(0, 200) })).handler(async ({ data }): Promise<PlaceDetails> => {
  await requireGoogleSession();
  const mask = "id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,primaryTypeDisplayName,editorialSummary,nationalPhoneNumber,websiteUri,googleMapsUri,reviews,photos,accessibilityOptions,parkingOptions,regularOpeningHours";
  const response = ownKey() ? await placesRequest(`/places/v1/places/${encodeURIComponent(data.placeId)}`, mask, {}) : await fetch(gatewayUrl(`/places/v1/places/${encodeURIComponent(data.placeId)}`), { headers: gatewayHeaders(mask) });
  if (!response.ok) throw new Error(`Place details failed (${response.status}).`);
  const place: any = await response.json();
  return { ...toLite(place), photos: readPlacePhotos(place.photos), summary: place.editorialSummary?.text, phone: place.nationalPhoneNumber, website: place.websiteUri, mapsUri: place.googleMapsUri, wheelchair: place.accessibilityOptions?.wheelchairAccessibleEntrance, ...parkingDetails(place.parkingOptions), hours: place.regularOpeningHours?.weekdayDescriptions ?? [], reviews: (place.reviews ?? []).slice(0, 6).map((review: any) => ({ author: review.authorAttribution?.displayName ?? "Google user", rating: review.rating ?? 0, text: review.text?.text ?? review.originalText?.text ?? "", relative: review.relativePublishTimeDescription ?? "" })) };
});

export const getPlacePhoto = createServerFn({ method: "POST" }).inputValidator((data: { name: string }) => ({ resource: photoResource(String(data.name ?? "")) })).handler(async ({ data }): Promise<string> => {
  await requireGoogleSession();
  const path = `/places/v1/${data.resource}/media?maxWidthPx=1200&skipHttpRedirect=true`;
  const response = ownKey() ? await placesRequest(path, "", {}) : await fetch(gatewayUrl(path), { headers: gatewayHeaders("") });
  if (!response.ok) throw new Error(`Photo unavailable (${response.status}).`);
  const photo = await response.json() as { photoUri?: string };
  if (!photo.photoUri?.startsWith("https://")) throw new Error("Photo unavailable.");
  return photo.photoUri;
});

const CATEGORIES = [{ key: "parking", label: "Parking", query: "parking lot", radius: 5000 }, { key: "streetfood", label: "Street food", query: "street food", radius: 1200 }, { key: "shopping", label: "Shopping", query: "shopping market mall", radius: 2000 }, { key: "sights", label: "Must see", query: "tourist attraction landmark viewpoint", radius: 5000 }, { key: "cafes", label: "Cafes & eats", query: "cafe restaurant", radius: 1200 }, { key: "evcar", label: "Car charging", query: "electric car charging station", radius: 5000 }, { key: "evbike", label: "Bike charging", query: "electric two wheeler scooter bike charging station", radius: 5000 }];
export const getNearby = createServerFn({ method: "POST" }).inputValidator((data: { lat: number; lng: number; rangeKm?: number }) => ({ lat: Number(data.lat), lng: Number(data.lng), rangeKm: Number(data.rangeKm) > 0 ? Number(data.rangeKm) : 5 })).handler(async ({ data }): Promise<NearbyGroup[]> => {
  await requireGoogleSession();
  const center = { latitude: data.lat, longitude: data.lng }; const scale = data.rangeKm / 5;
  return Promise.all(CATEGORIES.map(async (category) => { try { const json = await searchGoogle("/places/v1/places:searchText", LITE_MASK, { textQuery: category.query, maxResultCount: 8, regionCode: "IN", locationBias: { circle: { center, radius: Math.min(50000, Math.round(category.radius * scale)) } } }); return { key: category.key, label: category.label, places: (json.places ?? []).map(toLite) }; } catch (error) { console.error(`nearby ${category.key} failed`, error); return { key: category.key, label: category.label, places: [], error: "Could not refresh these places. Please try again." }; } }));
});

export const getDefaultMapsKey = createServerFn({ method: "GET" }).handler(async () => ownKey());
