import { SignJWT, jwtVerify } from "jose";

export type MobileTokenPayload = {
  id: string;
  email: string;
  role: string;
  name?: string | null;
};

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signMobileToken(payload: MobileTokenPayload): Promise<string> {
  return new SignJWT({
    id: payload.id,
    email: payload.email,
    role: payload.role,
    name: payload.name ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyMobileToken(
  token: string
): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = payload.id;
    const email = payload.email;
    if (typeof id !== "string" || typeof email !== "string") {
      return null;
    }
    return {
      id,
      email,
      role: typeof payload.role === "string" ? payload.role : "USER",
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    return null;
  }
}

export type GoogleIdTokenProfile = {
  email: string;
  name?: string;
  picture?: string;
  sub: string;
};

export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleIdTokenProfile | null> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    aud?: string;
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
  };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || data.aud !== clientId || !data.email || !data.sub) {
    return null;
  }

  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
    sub: data.sub,
  };
}
