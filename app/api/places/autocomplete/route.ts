import { NextResponse } from "next/server";
import { googleMapsKey, KARACHI_BOUNDS, KARACHI_CENTER } from "@/lib/geo";
import {
  googlePlacesDisabledResponse,
  googlePlacesEnabled,
  rateLimit,
  requireBrowserOrigin,
} from "@/lib/geo-guard";

type Suggestion = { placeId: string; description: string };

function parseNewSuggestions(data: {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { mainText?: { text?: string } };
    };
  }>;
}): Suggestion[] {
  return (data.suggestions ?? [])
    .map((s) => {
      const prediction = s.placePrediction;
      const placeId = prediction?.placeId;
      const description =
        prediction?.text?.text || prediction?.structuredFormat?.mainText?.text || "";
      if (!placeId || !description) return null;
      return { placeId, description };
    })
    .filter((s): s is Suggestion => Boolean(s));
}

async function autocompleteNew(
  key: string,
  q: string,
  sessionToken: string
): Promise<{ suggestions: Suggestion[] } | { error: string; status: number }> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify({
      input: q,
      includedRegionCodes: ["pk"],
      locationBias: {
        rectangle: {
          low: { latitude: KARACHI_BOUNDS.south, longitude: KARACHI_BOUNDS.west },
          high: { latitude: KARACHI_BOUNDS.north, longitude: KARACHI_BOUNDS.east },
        },
      },
      ...(sessionToken ? { sessionToken } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text();
    return { error: detail.slice(0, 400), status: res.status };
  }
  return { suggestions: parseNewSuggestions(await res.json()) };
}

async function autocompleteLegacy(
  key: string,
  q: string,
  sessionToken: string
): Promise<{ suggestions: Suggestion[] } | { error: string }> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("components", "country:pk");
  url.searchParams.set("location", `${KARACHI_CENTER.lat},${KARACHI_CENTER.lng}`);
  url.searchParams.set("radius", "30000");
  url.searchParams.set("key", key);
  if (sessionToken) url.searchParams.set("sessiontoken", sessionToken);

  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    predictions?: Array<{ place_id?: string; description?: string }>;
  };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return { error: data.error_message || data.status || "legacy autocomplete failed" };
  }
  const suggestions = (data.predictions ?? [])
    .map((p) =>
      p.place_id && p.description
        ? { placeId: p.place_id, description: p.description }
        : null
    )
    .filter((s): s is Suggestion => Boolean(s));
  return { suggestions };
}

export async function GET(request: Request) {
  if (!googlePlacesEnabled()) return googlePlacesDisabledResponse();

  const blocked = requireBrowserOrigin(request) || rateLimit(request, "places-autocomplete", 15, 60_000);
  if (blocked) return blocked;

  const key = googleMapsKey();
  if (!key) {
    return NextResponse.json({ error: "Google Maps API key is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const sessionToken = (searchParams.get("sessionToken") ?? "").trim();
  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const modern = await autocompleteNew(key, q, sessionToken);
  if ("suggestions" in modern) {
    return NextResponse.json({ suggestions: modern.suggestions });
  }

  const legacy = await autocompleteLegacy(key, q, sessionToken);
  if ("suggestions" in legacy) {
    return NextResponse.json({ suggestions: legacy.suggestions });
  }

  console.error("Places autocomplete failed:", modern.status, modern.error, legacy.error);
  return NextResponse.json(
    {
      error: "Autocomplete failed",
      hint: "Enable Places API (or Places API New) on the Google Cloud project and use GOOGLE_MAPS_API_KEY without HTTP-referrer restrictions (IP-restricted server key).",
    },
    { status: 502 }
  );
}
