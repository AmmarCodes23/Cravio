import { NextResponse } from "next/server";
import { requireBrowserOrigin, rateLimit } from "@/lib/geo-guard";
import { nominatimReverse } from "@/lib/nominatim";

const cache = new Map<string, { address: string; at: number }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export async function GET(request: Request) {
  const blocked = requireBrowserOrigin(request) || rateLimit(request, "geo-reverse", 20, 60_000);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ address: hit.address, cached: true });
  }

  try {
    const address = await nominatimReverse(lat, lng);
    cache.set(key, { address, at: Date.now() });
    return NextResponse.json({ address });
  } catch (err) {
    console.error("Nominatim reverse failed:", err);
    return NextResponse.json({ error: "Reverse geocode failed" }, { status: 502 });
  }
}
