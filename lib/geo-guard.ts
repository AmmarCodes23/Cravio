import { NextResponse } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

function hostnameFromUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Same-origin only. Curl/bots with no Origin, and other sites, get 403. */
export function requireBrowserOrigin(request: Request): NextResponse | null {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = (forwarded || request.headers.get("host") || hostnameFromUrl(request.url) || "")
    .split(":")[0]
    .toLowerCase();
  const originHost = hostnameFromUrl(request.headers.get("origin"));
  const refererHost = hostnameFromUrl(request.headers.get("referer"));
  const browserHost = originHost || refererHost;
  if (!requestHost || !browserHost || browserHost !== requestHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function rateLimit(
  request: Request,
  bucket: string,
  max: number,
  windowMs: number
): NextResponse | null {
  const ip = clientIp(request);
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count > max) {
    const retry = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }
  return null;
}

export function googlePlacesEnabled() {
  const raw = (process.env.USE_GOOGLE_PLACES ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function googlePlacesDisabledResponse() {
  return NextResponse.json(
    { error: "Google Places is disabled", disabled: true },
    { status: 404 }
  );
}
