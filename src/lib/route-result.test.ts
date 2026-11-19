import { expect, it } from "vitest";
import { readRouteResult } from "./route-result";

it("preserves total route distance, driving time and four fare options on shared routes", () => {
  const result = readRouteResult({ routes: [{ distanceMeters: 12000, duration: "1800s", polyline: { encodedPolyline: "encoded-route" } }] });
  expect(result.distanceText).toBe("12.0 km");
  expect(result.durationText).toBe("30 min");
  expect(result.fareEstimates.map(f => f.type)).toEqual(["Auto", "Mini", "Sedan", "SUV"]);
  expect(result.polyline).toBe("encoded-route");
});

it("rejects missing duration or geometry instead of inventing a route", () => {
  expect(() => readRouteResult({ routes: [{ distanceMeters: 12000 }] })).toThrow("Incomplete route data.");
});