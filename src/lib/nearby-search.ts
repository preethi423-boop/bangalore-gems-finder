import type { PlaceLite } from "@/lib/places.functions";

export type LatLng = { lat: number; lng: number };

export type NearbyPlaceResult = PlaceLite & {
  distanceKm: number;
  mapsUri?: string;
};

const NEARBY_WORD_PATTERN =
  /\b(nearby|near me|around me|closest|nearest|near here|close by)\b/i;

const GENERIC_CATEGORY_PATTERN =
  /\b(charging station|ev charging|ev charger|charger|parking|petrol|fuel|gas station|hospital|clinic|pharmacy|medical|atm|bank|shopping mall|mall|supermarket|grocery|restaurant|cafe|coffee|street food|hotel|police|metro|bus stop|gym|park|temple|salon)\b/i;

export function parseNearbyQuery(rawQuery: string): {
  isNearby: boolean;
  cleanedQuery: string;
} {
  const trimmed = rawQuery.trim();
  const hasNearbyWord = NEARBY_WORD_PATTERN.test(trimmed);
  const isGenericCategory = GENERIC_CATEGORY_PATTERN.test(trimmed);
  const cleanedQuery =
    trimmed
      .replace(
        /\b(nearby|near me|around me|closest|nearest|near here|close by)\b/gi,
        "",
      )
      .replace(/\s{2,}/g, " ")
      .trim() || trimmed;

  return {
    isNearby: hasNearbyWord || isGenericCategory,
    cleanedQuery,
  };
}

export function inferMarkerKind(query: string): string {
  const q = query.toLowerCase();
  if (/\b(ev|charging|charger)\b/.test(q)) return "evcar";
  if (/\b(parking|park my)\b/.test(q)) return "parking";
  if (/\b(mall|shop|shopping|store|market|supermarket)\b/.test(q)) return "shopping";
  if (/\b(food|restaurant|hotel|eatery|biryani|dosa|chaat)\b/.test(q)) return "streetfood";
  if (/\b(cafe|coffee|tea|bakery)\b/.test(q)) return "cafes";
  return "sights";
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function getUserLocation(timeoutMs = 10000): Promise<LatLng | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 60_000,
      },
    );
  });
}

export async function searchPlacesWithLocation(params: {
  query: string;
  apiKey: string;
  fallbackCenter: LatLng;
  radiusKm?: number;
  strictRadius?: boolean;
}): Promise<{
  origin: LatLng;
  usedCurrentLocation: boolean;
  radiusKm: number;
  places: NearbyPlaceResult[];
}> {
  const { cleanedQuery } = parseNearbyQuery(params.query);
  const userLoc = await getUserLocation();
  const origin = userLoc ?? params.fallbackCenter;
  const radiusKm = params.radiusKm && params.radiusKm > 0 ? params.radiusKm : 5;
  const radiusMeters = Math.min(Math.max(radiusKm * 1000, 500), 50_000);

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": params.apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.googleMapsUri",
    },
    body: JSON.stringify({
      textQuery: cleanedQuery,
      regionCode: "IN",
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      locationBias: {
        circle: {
          center: { latitude: origin.lat, longitude: origin.lng },
          radius: radiusMeters,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Place search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      rating?: number;
      userRatingCount?: number;
      primaryTypeDisplayName?: { text?: string };
      googleMapsUri?: string;
    }>;
  };

  const mapped: NearbyPlaceResult[] = (data.places ?? [])
    .filter((p) => p.location?.latitude != null && p.location?.longitude != null)
    .map((p) => {
      const lat = p.location!.latitude!;
      const lng = p.location!.longitude!;
      return {
        id: p.id ?? crypto.randomUUID(),
        name: p.displayName?.text ?? "Unnamed place",
        address: p.formattedAddress ?? "",
        lat,
        lng,
        rating: p.rating,
        ratingCount: p.userRatingCount,
        primaryType: p.primaryTypeDisplayName?.text,
        mapsUri: p.googleMapsUri,
        distanceKm: Number(haversineKm(origin, { lat, lng }).toFixed(2)),
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const strict = params.strictRadius ?? true;
  const places = strict ? mapped.filter((p) => p.distanceKm <= radiusKm) : mapped;

  return {
    origin,
    usedCurrentLocation: Boolean(userLoc),
    radiusKm,
    places,
  };
}
