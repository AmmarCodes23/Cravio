import { NextResponse } from "next/server";
import { requireBrowserOrigin, rateLimit } from "@/lib/geo-guard";
import { nominatimSearch } from "@/lib/nominatim";

const cache = new Map<string, { suggestions: Awaited<ReturnType<typeof nominatimSearch>>; at: number }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const blocked = requireBrowserOrigin(request) || rateLimit(request, "geo-search", 15, 60_000);
  if (blocked) return blocked;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ suggestions: [] });
  if (q.length > 80) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ suggestions: hit.suggestions, cached: true });
  }

  try {
    const suggestions = await nominatimSearch(q);
    cache.set(key, { suggestions, at: Date.now() });
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Nominatim search failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
