import type { RouteResult } from "./places-direct";

function estimateFareRange(
  distanceMeters: number,
  baseFare: number,
  includedKm: number,
  perKm: number,
) {
  const distanceKm = distanceMeters / 1000;
  const estimated = baseFare + Math.max(0, distanceKm - includedKm) * perKm;
  const low = Math.max(baseFare, Math.round((estimated * 0.9) / 10) * 10);
  const high = Math.max(low + 20, Math.round((estimated * 1.2) / 10) * 10);
  return `₹${low.toLocaleString("en-IN")}–₹${high.toLocaleString("en-IN")}`;
}

function estimateCabFares(distanceMeters: number): RouteResult["fareEstimates"] {
  return [
    { type: "Auto", estimateText: estimateFareRange(distanceMeters, 35, 2, 15) },
    { type: "Mini", estimateText: estimateFareRange(distanceMeters, 75, 2, 18) },
    { type: "Sedan", estimateText: estimateFareRange(distanceMeters, 100, 2, 22) },
    { type: "SUV", estimateText: estimateFareRange(distanceMeters, 150, 2, 28) },
  ];
}

export function readRouteResult(json: any): RouteResult {
  const route = json.routes?.[0];
  if (!route) throw new Error("No route found.");
  const meters = route.distanceMeters ?? 0;
  const seconds = Number(String(route.duration ?? "").replace(/s$/, ""));
  if (!Number.isFinite(meters) || meters < 0 || !route.duration || !Number.isFinite(seconds) || seconds < 0 || !route.polyline?.encodedPolyline) throw new Error("Incomplete route data.");
  return {
    distanceText: meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`,
    durationText: seconds >= 3600 ? `${Math.floor(seconds / 3600)} hr ${Math.round((seconds % 3600) / 60)} min` : `${Math.max(1, Math.round(seconds / 60))} min`,
    fareEstimates: estimateCabFares(meters),
    polyline: route.polyline.encodedPolyline,
  };
}
