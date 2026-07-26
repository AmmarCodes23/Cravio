import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { verifyMobileToken } from "@/lib/mobile-auth";
import type { Session } from "next-auth";

export type RequestSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  image?: string | null;
};

export type RequestSession = Session & { user: RequestSessionUser };

export async function getRequestSession(
  request?: Request
): Promise<RequestSession | null> {
  const cookieSession = (await getServerSession(authOptions)) as RequestSession | null;
  if (cookieSession?.user?.id) {
    return cookieSession;
  }

  if (!request) return null;

  const header =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  const payload = await verifyMobileToken(token);
  if (!payload) return null;

  return {
    user: {
      id: payload.id,
      email: payload.email,
      name: payload.name ?? null,
      role: payload.role,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  } as RequestSession;
}
