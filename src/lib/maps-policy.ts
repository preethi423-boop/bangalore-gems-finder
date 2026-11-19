export function canManageMaps(signedIn: boolean, isAdmin: boolean) {
  return signedIn && isAdmin;
}

export function mapPresentation(selected: boolean, satellite: boolean) {
  return { type: satellite ? "hybrid" : "roadmap", tilt: selected && satellite ? 45 : 0, heading: selected && satellite ? 45 : 0, zoom: selected ? 19 : 14 };
}