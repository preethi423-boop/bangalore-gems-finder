import { expect, it } from "vitest";
import { photoResource, readPlacePhotos } from "./place-photos";

it("keeps place photo contributor attribution without assigning photos to reviews", () => {
  expect(readPlacePhotos([{ name: "places/lalbagh/photos/photo1", authorAttributions: [{ displayName: "Visitor", uri: "https://maps.google.com/contributor/1" }] }])).toEqual([
    { name: "places/lalbagh/photos/photo1", authors: [{ name: "Visitor", uri: "https://maps.google.com/contributor/1" }] },
  ]);
});

it("rejects external URLs and traversal as photo resources", () => {
  expect(photoResource("places/lalbagh/photos/photo1")).toBe("places/lalbagh/photos/photo1");
  expect(() => photoResource("https://example.org/photo")).toThrow();
  expect(() => photoResource("places/abc/photos/photo?key=x")).toThrow();
});