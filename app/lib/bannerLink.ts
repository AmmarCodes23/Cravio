import { companySlug } from "@/lib/company-slug";

/** Helpers for marketing banner click targets (homepage carousel). */

export type BannerLinkKind = "none" | "external" | "category" | "company";

export function companyPathSlug(name: string): string {
  return companySlug(name);
}

export function buildCategoryLink(categoryName: string): string {
  return `/category/${encodeURIComponent(categoryName.trim())}`;
}

export function buildCompanyLink(companyName: string): string {
  return `/companies/${companyPathSlug(companyName.trim())}`;
}

export function buildBannerLinkUrl(opts: {
  kind: BannerLinkKind;
  externalUrl?: string;
  categoryName?: string;
  companyName?: string;
}): string | null {
  switch (opts.kind) {
    case "category": {
      const name = opts.categoryName?.trim();
      return name ? buildCategoryLink(name) : null;
    }
    case "company": {
      const name = opts.companyName?.trim();
      return name ? buildCompanyLink(name) : null;
    }
    case "external": {
      const url = opts.externalUrl?.trim();
      return url || null;
    }
    default:
      return null;
  }
}

export function parseBannerLinkUrl(
  linkUrl: string | null | undefined,
  categoryNames: string[] = [],
  companyNames: string[] = []
): {
  kind: BannerLinkKind;
  externalUrl: string;
  categoryName: string;
  companyName: string;
} {
  const raw = linkUrl?.trim() || "";
  if (!raw) {
    return { kind: "none", externalUrl: "", categoryName: "", companyName: "" };
  }

  if (raw.startsWith("/category/")) {
    let name = decodeURIComponent(raw.slice("/category/".length));
    // Prefer exact catalog match (case-insensitive)
    const match = categoryNames.find((c) => c.toLowerCase() === name.toLowerCase());
    if (match) name = match;
    return { kind: "category", externalUrl: "", categoryName: name, companyName: "" };
  }

  if (raw.startsWith("/companies/")) {
    const slug = raw.slice("/companies/".length).split(/[?#]/)[0];
    const match = companyNames.find((c) => companyPathSlug(c) === slug);
    return {
      kind: "company",
      externalUrl: "",
      categoryName: "",
      companyName: match || slug.replace(/-/g, " "),
    };
  }

  return { kind: "external", externalUrl: raw, categoryName: "", companyName: "" };
}

export function describeBannerLink(linkUrl: string | null | undefined): string {
  if (!linkUrl?.trim()) return "No link";
  const parsed = parseBannerLinkUrl(linkUrl);
  if (parsed.kind === "category") return `Category: ${parsed.categoryName}`;
  if (parsed.kind === "company") return `Company: ${parsed.companyName}`;
  return parsed.externalUrl;
}
