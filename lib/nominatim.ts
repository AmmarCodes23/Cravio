import { KARACHI_BOUNDS } from "@/lib/geo";

export const NOMINATIM_USER_AGENT = "Cravio/1.0 (https://craviopk.com; delivery-address)";

type NominatimAddress = Record<string, string | undefined>;

export type NominatimSearchHit = {
  placeId: string;
  description: string;
  lat: number;
  lng: number;
};

let lastNominatimAt = 0;

export async function throttleNominatim() {
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
}

export function formatNominatimAddress(
  data: { display_name?: string; address?: NominatimAddress },
  fallback = "Address not found"
) {
  const a = data.address ?? {};
  const parts = [
    a.house_number,
    a.road || a.pedestrian || a.residential,
    a.neighbourhood || a.suburb || a.quarter,
    a.city_district || a.town || a.city || a.village,
  ].filter(Boolean);
  return parts.join(", ") || data.display_name || fallback;
}

export async function nominatimReverse(lat: number, lng: number) {
  await throttleNominatim();
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  const res = await fetch(url, {
    headers: {
      "User-Agent": NOMINATIM_USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "en",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Nominatim reverse ${res.status}`);
  const data = (await res.json()) as {
    display_name?: string;
    address?: NominatimAddress;
  };
  return formatNominatimAddress(data);
}

export async function nominatimSearch(q: string): Promise<NominatimSearchHit[]> {
  await throttleNominatim();
  const query = /karachi/i.test(q) ? q : `${q}, Karachi`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "pk");
  url.searchParams.set(
    "viewbox",
    `${KARACHI_BOUNDS.west},${KARACHI_BOUNDS.north},${KARACHI_BOUNDS.east},${KARACHI_BOUNDS.south}`
  );
  url.searchParams.set("bounded", "1");

  const res = await fetch(url, {
    headers: {
      "User-Agent": NOMINATIM_USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "en",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Nominatim search ${res.status}`);
  const rows = (await res.json()) as Array<{
    osm_type?: string;
    osm_id?: number;
    lat?: string;
    lon?: string;
    display_name?: string;
    address?: NominatimAddress;
  }>;

  return rows
    .map((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const shortName = (row.display_name || "")
        .split(",")
        .slice(0, 3)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ");
      return {
        placeId: `${row.osm_type || "osm"}:${row.osm_id ?? `${lat},${lng}`}`,
        description: shortName || formatNominatimAddress(row, query),
        lat,
        lng,
      };
    })
    .filter((row): row is NominatimSearchHit => Boolean(row));
}
