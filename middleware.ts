import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CRAVIO_POS_ORIGINS = [
  "null", // Desktop apps (e.g. CravioPos) often send Origin: null
  "http://localhost",
  "http://127.0.0.1",
  "file://",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  const lower = origin.toLowerCase();
  return CRAVIO_POS_ORIGINS.some(
    (allowed) => lower === allowed || lower.startsWith(allowed + ":")
  );
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  const response = NextResponse.next();

  // Geo/Places are browser-only on craviopk.com — never open them to every origin.
  const isGeoPath =
    pathname.startsWith("/api/geo/") || pathname.startsWith("/api/places/");
  if (isGeoPath) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.next();
  }

  // Allow CravioPos (desktop) and common dev origins; also allow no origin (desktop HttpClient)
  if (isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
  } else {
    response.headers.set("Access-Control-Allow-Origin", "*");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-POS-API-Key");
  response.headers.set("Access-Control-Max-Age", "86400");

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
