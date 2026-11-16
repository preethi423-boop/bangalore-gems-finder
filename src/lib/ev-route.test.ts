import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { selectEVStation } from "./ev-route";
import { computeEVRouteWithKey } from "./places-direct";
import { updateExplorationAccess } from "./access-session";

const origin = { lat: 12.97, lng: 77.50 };
const destination = { id: "visit", name: "Visit", address: "Bengaluru", lat: 12.97, lng: 77.59 };
const station = { ...destination, id: "charger", name: "EV Station", lng: 77.58 };
beforeEach(() => updateExplorationAccess(true));
afterEach(() => { updateExplorationAccess(false); vi.unstubAllGlobals(); });

it("selects a real nearby charger with the smaller approximate detour", () => {
  const detour = { ...station, id: "detour", lat: 13.00 };
  expect(selectEVStation(origin, destination, [detour, station], 5)?.id).toBe("charger");
});

it("does not select the destination or a charger outside the selected range", () => {
  expect(selectEVStation(origin, destination, [destination, { ...station, lat: 13.2 }], 5)).toBeUndefined();
});

it("routes through the EV charger and reports the entire driving journey", async () => {
  const fetchRoute = vi.fn(async (_url: unknown, _options: RequestInit) => Response.json({ routes: [{ duration: "1800s", distanceMeters: 12000, polyline: { encodedPolyline: "route" } }] }));
  vi.stubGlobal("fetch", fetchRoute);
  const result = await computeEVRouteWithKey("test", origin, destination, [station], 5);
  const request = JSON.parse(fetchRoute.mock.calls[0]?.[1]?.body as string);
  expect(request.intermediates).toEqual([{ location: { latLng: { latitude: station.lat, longitude: station.lng } } }]);
  expect(request.destination.location.latLng).toEqual({ latitude: destination.lat, longitude: destination.lng });
  expect(result.durationText).toBe("30 min");
  expect(result.distanceText).toBe("12.0 km");
  expect(result.evStation?.id).toBe("charger");
});

it("does not silently build a normal route when no charger is available", async () => {
  const fetchRoute = vi.fn();
  vi.stubGlobal("fetch", fetchRoute);
  await expect(computeEVRouteWithKey("test", origin, destination, [], 5)).rejects.toThrow("no-ev-station");
  expect(fetchRoute).not.toHaveBeenCalled();
});

it("blocks EV routing after access expiry before calling Google", async () => {
  const fetchRoute = vi.fn();
  vi.stubGlobal("fetch", fetchRoute);
  updateExplorationAccess(true, Date.now() - 1);
  await expect(computeEVRouteWithKey("test", origin, destination, [station], 5)).rejects.toThrow("Your access has ended");
  expect(fetchRoute).not.toHaveBeenCalled();
});