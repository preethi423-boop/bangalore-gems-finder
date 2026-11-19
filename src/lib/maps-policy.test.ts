import { expect, it } from "vitest";
import { canManageMaps, mapPresentation } from "./maps-policy";

it("allows only signed-in admins to manage the shared Google keys", () => {
  expect(canManageMaps(true, true)).toBe(true);
  expect(canManageMaps(true, false)).toBe(false);
  expect(canManageMaps(false, true)).toBe(false);
  expect(canManageMaps(false, false)).toBe(false);
});

it("keeps a selected place in normal view until satellite is enabled", () => {
  expect(mapPresentation(true, false)).toEqual({ type: "roadmap", tilt: 0, heading: 0, zoom: 19 });
  expect(mapPresentation(true, true)).toEqual({ type: "hybrid", tilt: 45, heading: 45, zoom: 19 });
});