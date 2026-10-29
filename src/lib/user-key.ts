const STORAGE_KEY = "namma-spot.google-api-key";
const REJECTED_FLAG = "namma-spot.google-key-rejected";
const RETRY_FLAG = "namma-spot.google-key-retry";

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

/** Google rejected the key that was in use (bad billing or restrictions). */
export function markMapsKeyRejected() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(REJECTED_FLAG, "1");
  } catch {
    /* ignore */
  }
}

export function isMapsKeyRejected(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(REJECTED_FLAG) === "1";
  } catch {
    return false;
  }
}

/** Clear the rejection so a newly saved key gets another chance. */
export function clearMapsKeyRejected() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(REJECTED_FLAG);
    window.sessionStorage.removeItem(RETRY_FLAG);
  } catch {
    /* ignore */
  }
}

/** Allows exactly one page reload to retry with the fallback key. */
export function shouldRetryAfterKeyFailure(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(RETRY_FLAG)) return false;
    window.sessionStorage.setItem(RETRY_FLAG, "1");
    return true;
  } catch {
    return false;
  }
}

/** The user's key, or "" when Google has rejected it and we fell back. */
export function activeUserKey(): string {
  return isMapsKeyRejected() ? "" : getUserKey();
}

/** Falls back to the built-in managed key when the user has not supplied one. */
export function effectiveMapsKey(): string {
  return activeUserKey() || (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ?? "");
}
