import { z } from "zod";
import type { NearbyGroup, PlaceLite } from "./places.functions";

const categorySchema = z.enum(["sights", "streetfood", "shopping", "cafes"]);
export const explorationInputSchema = z.object({
  prompt: z.string().trim().min(3).max(800),
  location: z.object({ name: z.string().min(1).max(300), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  rangeKm: z.union([z.literal(5), z.literal(10), z.literal(25)]),
  places: z.array(z.object({
    id: z.string().min(1).max(200), name: z.string().min(1).max(300),
    address: z.string().max(1000), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
    rating: z.number().min(0).max(5).optional(), ratingCount: z.number().nonnegative().optional(),
    primaryType: z.string().max(200).optional(), category: categorySchema,
  })).min(1).max(32),
  resume: z.boolean().optional(),
});
export type ExplorationInput = z.infer<typeof explorationInputSchema>;
export const recommendationSchema = z.object({
  summary: z.string(),
  recommendations: z.array(z.object({ placeId: z.string(), reason: z.string() })),
}).strict();
export type RecommendationResult = z.infer<typeof recommendationSchema>;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function explorationCandidates(groups: NearbyGroup[], location: PlaceLite, rangeKm: number) {
  const seen = new Set<string>();
  return groups.flatMap(group => {
    const parsed = categorySchema.safeParse(group.key);
    if (!parsed.success) return [];
    return group.places.filter(p => {
      if (seen.has(p.id) || p.id === location.id || distanceKm(location, p) > rangeKm) return false;
      seen.add(p.id);
      return true;
    }).map(p => ({ ...p, category: parsed.data }));
  }).slice(0, 32);
}
export function groundRecommendations(result: RecommendationResult, candidates: ExplorationInput["places"]): RecommendationResult {
  const ids = new Set(candidates.map(p => p.id));
  const seen = new Set<string>();
  return {
    summary: result.summary.slice(0, 600),
    recommendations: result.recommendations.filter(r => {
      if (!ids.has(r.placeId) || seen.has(r.placeId)) return false;
      seen.add(r.placeId);
      return true;
    }).slice(0, 6).map(r => ({ placeId: r.placeId, reason: r.reason.slice(0, 500) })),
  };
}