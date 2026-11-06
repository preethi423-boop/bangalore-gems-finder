export type PlacePhoto = {
  name: string;
  authors: Array<{ name: string; uri?: string }>;
};

export function photoResource(name: string) {
  if (!/^places\/[^/?#]+\/photos\/[^/?#]+$/.test(name) || name.length > 2000) {
    throw new Error("Invalid place photo.");
  }
  return name.split("/").map(encodeURIComponent).join("/");
}

export function readPlacePhotos(photos: Array<{ name?: string; authorAttributions?: Array<{ displayName?: string; uri?: string }> }> = []): PlacePhoto[] {
  return photos.filter((photo) => typeof photo.name === "string").slice(0, 6).map((photo) => ({
    name: photo.name ?? "",
    authors: (photo.authorAttributions ?? []).map((author) => ({
      name: author.displayName ?? "Google contributor",
      uri: author.uri?.startsWith("https://") ? author.uri : undefined,
    })),
  }));
}