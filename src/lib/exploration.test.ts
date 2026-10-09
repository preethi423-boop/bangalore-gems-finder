import { describe, it, expect } from "vitest";
import { explorationCandidates, explorationInputSchema, groundRecommendations } from "./exploration";

const spot = { id: "selected", name: "Bengaluru", address: "Bengaluru", lat: 12.9716, lng: 77.5946 };
const food = { ...spot, id: "food", name: "Food stall", lat: 12.972 };
describe("nearby exploration grounding", () => {
  it("uses only attraction, food and shopping app candidates", () => {
    const groups = ["sights", "streetfood", "shopping", "parking", "evcar"].map(key => ({ key, label: key, places: [{ ...food, id: key }] }));
    expect(explorationCandidates(groups, spot, 5).map(p => p.id)).toEqual(["sights", "streetfood", "shopping"]);
  });
  it("excludes results beyond the chosen 5 km range", () => {
    expect(explorationCandidates([{ key: "sights", label: "Sights", places: [{ ...food, lat: 13.1 }] }], spot, 5)).toEqual([]);
  });
  it("never returns an invented place or duplicated recommendation", () => {
    const result = groundRecommendations({ summary: "Matches", recommendations: [{ placeId: "invented", reason: "Made up" }, { placeId: "food", reason: "Match" }, { placeId: "food", reason: "Duplicate" }] }, [{ ...food, category: "streetfood" }]);
    expect(result.recommendations).toEqual([{ placeId: "food", reason: "Match" }]);
  });
  it("requires candidate place data before a model call", () => {
    expect(explorationInputSchema.safeParse({ prompt: "Food", location: spot, rangeKm: 5, places: [] }).success).toBe(false);
  });
});