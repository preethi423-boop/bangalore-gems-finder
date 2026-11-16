import type { PlaceLite } from "./places.functions";

type Coordinates = { lat: number; lng: number };

function distance(a: Coordinates, b: Coordinates) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

// Routes calculates actual driving time; this ranks candidates by approximate detour.
export function selectEVStation(origin: Coordinates, destination: PlaceLite, stations: PlaceLite[], rangeKm: number) {
  return stations
    .filter((p) => p.id !== destination.id && Number.isFinite(p.lat) && Number.isFinite(p.lng) && distance(p, destination) <= rangeKm * 1000)
    .sort((a, b) => (distance(origin, a) + distance(a, destination)) - (distance(origin, b) + distance(b, destination)))[0];
}