import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CategoryFetch, Company, Product } from "@/app/Data/database";

export const CATALOG_TAG = "catalog";
export const CATALOG_REVALIDATE = 300;
export const CATALOG_CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=300";

export type CatalogBanner = {
  image: string;
  title: string;
  linkUrl: string | null;
};

const visibleProductWhere = {
  isHidden: false,
  OR: [{ companyId: null }, { companyRel: { isHidden: false } }],
  AND: [
    {
      OR: [{ categoryId: null }, { categoryRel: { isHidden: false } }],
    },
  ],
};

const productSelect = {
  id: true,
  name: true,
  company: true,
  companyId: true,
  category: true,
  categoryId: true,
  price: true,
  originalPrice: true,
  retailPrice: true,
  consumerPrice: true,
  bulkPrice: true,
  bulkLimit: true,
  image: true,
  description: true,
  companyImage: true,
  isHidden: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function companySlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function normalizeSlug(slug: string) {
  return slug.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function revalidateCatalog() {
  revalidateTag(CATALOG_TAG);
}

/**
 * Keep Company↔Category M2M in sync when a product asserts both FKs.
 * Product rows are the catalog source of truth; this join is secondary metadata.
 */
export async function ensureCompanyCategoryLink(
  companyId: number | null | undefined,
  categoryId: number | null | undefined
) {
  if (!companyId || !categoryId) return;
  await prisma.company.update({
    where: { id: companyId },
    data: {
      categories: {
        connect: { id: categoryId },
      },
    },
  });
}

/**
 * Category filter chips must come from products in that category — not the
 * optional Company↔Category M2M (which is easy to leave stale when adding products).
 */
export function companiesPresentInProducts(
  companies: Company[],
  products: Product[]
): Company[] {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const byName = new Map(companies.map((c) => [c.name.toLowerCase(), c]));
  const seen = new Set<number>();
  const result: Company[] = [];

  for (const product of products) {
    const match =
      (product.companyId != null ? byId.get(product.companyId) : undefined) ??
      byName.get(product.company.toLowerCase());
    if (!match || match.isHidden || seen.has(match.id)) continue;
    seen.add(match.id);
    result.push(match);
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

async function queryProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: visibleProductWhere,
    select: productSelect,
  });
  return rows as Product[];
}

async function queryCompanies(): Promise<Company[]> {
  const companies = await prisma.company.findMany({
    where: { isHidden: false },
    orderBy: { name: "asc" },
    include: {
      categories: { where: { isHidden: false } },
    },
  });
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    image: c.image,
    productCount: c.productCount,
    category: c.categories[0]?.name ?? null,
    categories: c.categories.map((cat) => cat.name),
    isHidden: c.isHidden,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

async function queryCategories(): Promise<CategoryFetch[]> {
  const categories = await prisma.category.findMany({
    where: { isHidden: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      url: true,
      productCount: true,
      isHidden: true,
    },
  });
  return categories;
}

async function queryBanners(): Promise<CatalogBanner[]> {
  const banners = await prisma.marketingBanner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      imageUrl: true,
      title: true,
      linkUrl: true,
    },
  });
  return banners
    .filter((b) => typeof b.imageUrl === "string" && b.imageUrl.trim())
    .map((b, i) => ({
      image: b.imageUrl.trim(),
      title: (b.title && b.title.trim()) || `Banner ${i + 1}`,
      linkUrl: b.linkUrl?.trim() || null,
    }));
}

export const getProducts = unstable_cache(queryProducts, ["catalog-products"], {
  tags: [CATALOG_TAG],
  revalidate: CATALOG_REVALIDATE,
});

export const getCompanies = unstable_cache(queryCompanies, ["catalog-companies"], {
  tags: [CATALOG_TAG],
  revalidate: CATALOG_REVALIDATE,
});

async function queryProductsByCompany(company: {
  id: number;
  name: string;
}): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      ...visibleProductWhere,
      OR: [
        { companyId: company.id },
        { company: { equals: company.name, mode: "insensitive" } },
      ],
    },
    select: productSelect,
  });
  return rows as Product[];
}

/** Cached products for one company — avoids shipping the full catalog on company pages. */
export function getProductsByCompany(company: { id: number; name: string }) {
  return unstable_cache(
    () => queryProductsByCompany(company),
    [`catalog-products-company-${company.id}`],
    { tags: [CATALOG_TAG], revalidate: CATALOG_REVALIDATE }
  )();
}

export async function getCompanyPageData(slug: string): Promise<{
  company: Company | null;
  products: Product[];
}> {
  const normalizedSlug = normalizeSlug(slug);
  const companies = await getCompanies();
  const company =
    companies.find((c) => normalizeSlug(c.name) === normalizedSlug) ?? null;

  if (company) {
    const products = await getProductsByCompany(company);
    return { company, products };
  }

  // Fallback for slug mismatches / missing company rows
  const products = (await getProducts()).filter(
    (product) => normalizeSlug(product.company) === normalizedSlug
  );
  return { company: null, products };
}

export const getCategories = unstable_cache(queryCategories, ["catalog-categories"], {
  tags: [CATALOG_TAG],
  revalidate: CATALOG_REVALIDATE,
});

export const getBanners = unstable_cache(queryBanners, ["catalog-banners"], {
  tags: [CATALOG_TAG],
  revalidate: CATALOG_REVALIDATE,
});
