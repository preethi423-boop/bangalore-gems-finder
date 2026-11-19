export function mapTapLocation(input: { lat: number; lng: number }) {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng) || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) throw new Error("Invalid map location.");
  return { lat: input.lat, lng: input.lng };
}

export function uniqueMapPlaces<T extends { id: string }>(places: T[]): T[] {
  return Array.from(new Map(places.map(place => [place.id, place])).values());
}