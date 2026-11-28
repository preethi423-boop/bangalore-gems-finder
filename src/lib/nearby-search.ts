export type LatLng = { lat: number; lng: number };

export type NearbyPlaceResult = {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  rating?: number;
  userRatingCount?: number;
  category?: string;
  mapsUrl?: string;
};

const NEARBY_PATTERN = /\b(nearby|near me|around me|closest|nearest|near here)\b/i;

export function parseNearbyQuery(rawQuery: string): {
  isNearby: boolean;
  cleanedQuery: string;
} {
  const trimmed = rawQuery.trim();
  const isNearby = NEARBY_PATTERN.test(trimmed);
  const cleanedQuery =
    trimmed
      .replace(/\b(nearby|near me|around me|closest|nearest|near here)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || trimmed;

  return { isNearby, cleanedQuery };
}

export function getUserLocation(timeoutMs = 8000): Promise<LatLng | null> {
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
      }
    );
  });
}

export async function searchPlacesWithLocation(params: {
  query: string;
  apiKey: string;
  fallbackCenter: LatLng;
  radiusKm?: number;
}): Promise<{ origin: LatLng; usedCurrentLocation: boolean; places: NearbyPlaceResult[] }> {
  const { isNearby, cleanedQuery } = parseNearbyQuery(params.query);
  const userLoc = isNearby ? await getUserLocation() : null;
  const origin = userLoc ?? params.fallbackCenter;
  const radiusMeters = Math.min(Math.max((params.radiusKm ?? 5) * 1000, 500), 50_000);

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
      maxResultCount: 15,
      rankPreference: isNearby ? "DISTANCE" : "RELEVANCE",
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

  const places: NearbyPlaceResult[] = (data.places ?? [])
    .filter((p) => p.location?.latitude != null && p.location?.longitude != null)
    .map((p) => ({
      id: p.id ?? crypto.randomUUID(),
      name: p.displayName?.text ?? "Unnamed place",
      address: p.formattedAddress ?? "",
      location: {
        lat: p.location!.latitude!,
        lng: p.location!.longitude!,
      },
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      category: p.primaryTypeDisplayName?.text,
      mapsUrl: p.googleMapsUri,
    }));

  return { origin, usedCurrentLocation: Boolean(userLoc), places };
}
