/** Client-safe company URL slugs. Do not import Prisma or next/cache here. */

export function normalizeSlug(slug: string) {
  let decoded = slug.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // already decoded or malformed (% is literal)
  }
  return decoded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function companySlug(name: string) {
  return normalizeSlug(name);
}

export function categorySlug(name: string) {
  return normalizeSlug(name);
}

export function looksLikeRemoteUrl(value?: string | null) {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

/** Slug for Category.url. Ignore leftover image URLs in the url field. */
export function resolveCategorySlug(name: string, url?: string | null) {
  if (url && !looksLikeRemoteUrl(url)) {
    const fromUrl = normalizeSlug(url);
    if (fromUrl) return fromUrl;
  }
  return normalizeSlug(name);
}
