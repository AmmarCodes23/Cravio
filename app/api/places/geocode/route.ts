import { NextResponse } from "next/server";
import { googleMapsKey } from "@/lib/geo";
import {
  googlePlacesDisabledResponse,
  googlePlacesEnabled,
  rateLimit,
  requireBrowserOrigin,
} from "@/lib/geo-guard";

export async function GET(request: Request) {
  if (!googlePlacesEnabled()) return googlePlacesDisabledResponse();

  const blocked = requireBrowserOrigin(request) || rateLimit(request, "places-geocode", 15, 60_000);
  if (blocked) return blocked;

  const key = googleMapsKey();
  if (!key) {
    return NextResponse.json({ error: "Google Maps API key is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const placeId = (searchParams.get("placeId") ?? "").trim();
  const address = (searchParams.get("address") ?? "").trim();
  const sessionToken = (searchParams.get("sessionToken") ?? "").trim();

  if (!placeId && !address) {
    return NextResponse.json({ error: "placeId or address is required" }, { status: 400 });
  }

  if (placeId) {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,formattedAddress,location",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as {
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      };
      const lat = data.location?.latitude;
      const lng = data.location?.longitude;
      if (typeof lat === "number" && typeof lng === "number") {
        return NextResponse.json({
          lat,
          lng,
          address: data.formattedAddress || address || null,
        });
      }
    }

    const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detailsUrl.searchParams.set("place_id", placeId);
    detailsUrl.searchParams.set("fields", "geometry,formatted_address");
    detailsUrl.searchParams.set("key", key);
    if (sessionToken) detailsUrl.searchParams.set("sessiontoken", sessionToken);
    const details = await fetch(detailsUrl, { cache: "no-store" });
    const detailsBody = (await details.json()) as {
      status?: string;
      result?: {
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      };
    };
    const loc = detailsBody.result?.geometry?.location;
    if (detailsBody.status === "OK" && typeof loc?.lat === "number" && typeof loc?.lng === "number") {
      return NextResponse.json({
        lat: loc.lat,
        lng: loc.lng,
        address: detailsBody.result?.formatted_address || address || null,
      });
    }
  }

  const geoUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  if (placeId) geoUrl.searchParams.set("place_id", placeId);
  else geoUrl.searchParams.set("address", address);
  geoUrl.searchParams.set("key", key);
  const geo = await fetch(geoUrl, { cache: "no-store" });
  const body = (await geo.json()) as {
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  };
  const first = body.results?.[0];
  const lat = first?.geometry?.location?.lat;
  const lng = first?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Geocode failed" }, { status: 502 });
  }
  return NextResponse.json({
    lat,
    lng,
    address: first?.formatted_address || address || null,
  });
}
