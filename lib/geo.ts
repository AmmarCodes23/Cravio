export const KARACHI_CENTER = { lat: 24.8607, lng: 67.0011 };

export const KARACHI_BOUNDS = {
  north: 25.15,
  south: 24.7,
  east: 67.25,
  west: 66.85,
};

export function googleMapsKey() {
  const raw =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  return raw.trim().replace(/^['"]|['"]$/g, "");
}

export function newPlacesSessionToken() {
  return crypto.randomUUID();
}
