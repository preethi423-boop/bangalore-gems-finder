import type { PlaceLite } from "./places.functions";

const KEY = "namma-spot.favorites";

export type Favorite = Pick<PlaceLite, "id" | "name" | "address" | "lat" | "lng" | "rating">;

export function getFavorites(): Favorite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Favorite[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(list: Favorite[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked */
  }
}

export function isFavorite(id: string): boolean {
  return getFavorites().some((f) => f.id === id);
}

export function toggleFavorite(place: Favorite): Favorite[] {
  const list = getFavorites();
  const next = list.some((f) => f.id === place.id)
    ? list.filter((f) => f.id !== place.id)
    : [
        {
          id: place.id,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          rating: place.rating,
        },
        ...list,
      ];
  save(next);
  return next;
}

export function removeFavorite(id: string): Favorite[] {
  const next = getFavorites().filter((f) => f.id !== id);
  save(next);
  return next;
}
