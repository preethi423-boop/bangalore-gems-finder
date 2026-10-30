import { afterEach, expect, it, vi } from "vitest";
import {
  activeUserKey,
  clearMapsKeyRejected,
  effectiveMapsKey,
  isMapsKeyRejected,
  markMapsKeyRejected,
  setUserKey,
} from "./user-key";

afterEach(() => vi.unstubAllGlobals());

it("falls back to the built-in map key after Google rejects the user's key", () => {
  const store = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
  };
  vi.stubGlobal("window", { localStorage: store(), sessionStorage: store() });

  setUserKey("AIza-user-key");
  expect(activeUserKey()).toBe("AIza-user-key");
  expect(effectiveMapsKey()).toBe("AIza-user-key");

  markMapsKeyRejected();
  expect(isMapsKeyRejected()).toBe(true);
  expect(activeUserKey()).toBe("");
  expect(effectiveMapsKey()).toBe(import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ?? "");

  clearMapsKeyRejected();
  expect(isMapsKeyRejected()).toBe(false);
  expect(activeUserKey()).toBe("AIza-user-key");
});
