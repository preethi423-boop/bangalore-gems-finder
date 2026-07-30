const STORAGE_KEY = "namma-spot.google-api-key";

export function getUserKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setUserKey(key: string) {
  if (typeof window === "undefined") return;
  const value = key.trim();
  if (value) window.localStorage.setItem(STORAGE_KEY, value);
  else window.localStorage.removeItem(STORAGE_KEY);
}

/** Falls back to the built-in managed key when the user has not supplied one. */
export function effectiveMapsKey(): string {
  return getUserKey() || (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ?? "");
}