import { expect, it } from "vitest";
import { mapTapLocation, uniqueMapPlaces } from "./map-selection";

it("keeps the tapped location rather than substituting the selected destination", () => {
  expect(mapTapLocation({ lat: 12.9716, lng: 77.5946 })).toEqual({ lat: 12.9716, lng: 77.5946 });
  expect(() => mapTapLocation({ lat: 91, lng: 77.5946 })).toThrow("Invalid map location.");
});

it("keeps distinct search-result and nearby markers without duplicate place IDs", () => {
  expect(uniqueMapPlaces([{ id: "park" }, { id: "food" }, { id: "park" }])).toEqual([{ id: "park" }, { id: "food" }]);
});