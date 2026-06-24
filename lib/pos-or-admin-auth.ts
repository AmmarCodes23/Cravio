import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import type { Session } from "next-auth";

type SessionWithRole = Session & { user: { id?: string; role?: string } };

/** True when X-POS-API-Key matches POS_API_KEY (same as /api/pos/sync). */
export function isValidPosApiKey(request: Request): boolean {
  const rawKey =
    request.headers.get("x-pos-api-key") ?? request.headers.get("X-POS-API-Key") ?? "";
  const apiKey = rawKey.trim();
  const expectedKey = (process.env.POS_API_KEY ?? "").trim();
  return expectedKey.length > 0 && apiKey === expectedKey;
}

/**
 * Allow catalog/upload mutations from either an ADMIN session (web admin) or a valid POS API key.
 */
export async function ensureAdminOrPosApiKey(request: Request) {
  if (isValidPosApiKey(request)) {
    return null;
  }

  const session = (await getServerSession(authOptions)) as SessionWithRole | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return null;
}
