import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getNearbyWithKey } from "./places-direct";
import { updateExplorationAccess } from "./access-session";

beforeEach(() => updateExplorationAccess(true));
afterEach(() => { updateExplorationAccess(false); vi.unstubAllGlobals(); });

it("uses a focused street-food query at the selected location", async () => {
  const requests: Record<string, any>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ places: [] });
  }));
  await getNearbyWithKey("test", 12.97, 77.59, 5);
  const food = requests.find(r => r.textQuery === "street food");
  expect(food?.locationBias.circle).toEqual({ center: { latitude: 12.97, longitude: 77.59 }, radius: 1200 });
});

it("distinguishes failed street-food refresh from no results", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable", { status: 503 })));
  const groups = await getNearbyWithKey("test", 12.97, 77.59);
  expect(groups.find(g => g.key === "streetfood")?.error).toBe("Could not refresh these places. Please try again.");
});