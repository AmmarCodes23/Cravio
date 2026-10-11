import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CategoryFetch, Company, Product } from "@/app/Data/database";

export { companySlug, normalizeSlug } from "@/lib/company-slug";
import { companySlug, normalizeSlug } from "@/lib/company-slug";

// Data Cache tags. unstable_cache tags propagate to the ISR entry of every page
// that read them, so one shared tag would regenerate every category + company
// page on any product edit. Scope them instead:
//   PRODUCTS_TAG  full product list (home, /api/products)
//   LISTS_TAG     category + company lists (root layout seeds them on every page)
//   BANNERS_TAG   home banners
//   per-category / per-company product lists (their own pages)
export const PRODUCTS_TAG = "catalog-products";
export const LISTS_TAG = "catalog-lists";
export const BANNERS_TAG = "catalog-banners";
const categoryTag = (name: string) => `catalog-category-${normalizeSlug(name)}`;
const companyTag = (name: string) => `catalog-company-${companySlug(name)}`;
// Every catalog write path calls revalidateCatalog(), so the timed fallback only
// has to cover missed invalidations; 1h keeps background ISR regenerations rare.
export const CATALOG_REVALIDATE = 3600;
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
} as const;

export type RevalidateScope = {
  /** Category names whose /category/[name] page must be regenerated. */
  categories?: (string | null | undefined)[];
  /** Company names whose /companies/[slug] page must be regenerated. */
  companies?: (string | null | undefined)[];
  /** A category/company row itself changed (name, image, hidden): nav lists on every page. */
  lists?: boolean;
  banners?: boolean;
};

/**
 * Invalidate the Data Cache entries — and therefore only the ISR pages — a
 * change can affect. The home page always regenerates (hot deals / rows);
 * category and company pages only when named. Previously a single tag plus
 * `revalidatePath("/", "layout")` rewrote every page on every write.
 */
export function revalidateCatalog(scope: RevalidateScope = {}) {
  revalidateTag(PRODUCTS_TAG);
  if (scope.lists) revalidateTag(LISTS_TAG);
  if (scope.banners) revalidateTag(BANNERS_TAG);
  for (const name of new Set(scope.categories ?? [])) {
    if (name) revalidateTag(categoryTag(name));
  }
  for (const name of new Set(scope.companies ?? [])) {
    if (name) revalidateTag(companyTag(name));
  }
}

/**
 * revalidateCatalog() for a category/company row change (rename, image, hide,
 * seed): refreshes the nav lists and regenerates the category and company pages
 * that list the matching products.
 */
export async function revalidateCatalogForProducts(
  where: Prisma.ProductWhereInput,
  extra: RevalidateScope = {}
) {
  const rows = await prisma.product.findMany({
    where,
    select: { category: true, company: true },
    distinct: ["category", "company"],
  });
  revalidateCatalog({
    lists: true,
    categories: [...(extra.categories ?? []), ...rows.map((r) => r.category)],
    companies: [...(extra.companies ?? []), ...rows.map((r) => r.company)],
  });
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
      image: true,
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
  tags: [PRODUCTS_TAG],
  revalidate: CATALOG_REVALIDATE,
});

export const getCompanies = unstable_cache(queryCompanies, ["catalog-companies"], {
  tags: [LISTS_TAG],
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
    { tags: [companyTag(company.name)], revalidate: CATALOG_REVALIDATE }
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
  tags: [LISTS_TAG],
  revalidate: CATALOG_REVALIDATE,
});

async function queryProductsByCategory(category: {
  id: number;
  name: string;
}): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      ...visibleProductWhere,
      AND: [
        ...visibleProductWhere.AND,
        {
          OR: [
            { categoryId: category.id },
            { category: { equals: category.name, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: productSelect,
  });
  return rows as Product[];
}

/** Cached products for one category — avoids shipping the full catalog on category pages. */
export function getProductsByCategory(category: { id: number; name: string }) {
  return unstable_cache(
    () => queryProductsByCategory(category),
    [`catalog-products-category-${category.id}`],
    { tags: [categoryTag(category.name)], revalidate: CATALOG_REVALIDATE }
  )();
}

export async function getCategoryPageData(categoryName: string): Promise<{
  category: CategoryFetch | null;
  products: Product[];
}> {
  const wanted = categoryName.toLowerCase();
  const categories = await getCategories();
  const category =
    categories.find((c) => c.name.toLowerCase() === wanted) ?? null;

  if (category) {
    const products = await getProductsByCategory(category);
    return { category, products };
  }

  // Fallback for names that no longer match a category row
  const products = (await getProducts()).filter(
    (product) => product.category.toLowerCase() === wanted
  );
  return { category: null, products };
}

export const HOME_HOT_DEALS_LIMIT = 40;
export const HOME_CATEGORY_ROW_LIMIT = 12;

/**
 * The subset of the catalog the home page actually renders: the top discounted
 * products (Hot Deals row) plus the first N products of every category row.
 * Keeps the ISR output of "/" to a few hundred products instead of the whole catalog.
 * Order of the original list is preserved so the client slices match.
 */
export function selectHomeProducts(products: Product[]): Product[] {
  const withImage = products.filter((p) => p.image);
  const keep = new Set<number>();

  const hotDeals = withImage
    .map((p) => {
      const base = p.consumerPrice ?? p.price ?? 0;
      const original = p.originalPrice ?? p.retailPrice ?? base;
      const discount = original > base ? (original - base) / original : 0;
      return { product: p, discount };
    })
    .filter((p) => p.discount > 0)
    .sort((a, b) => b.discount - a.discount)
    .slice(0, HOME_HOT_DEALS_LIMIT);
  for (const { product } of hotDeals) keep.add(product.id);

  const perCategory = new Map<string, number>();
  for (const p of withImage) {
    const key = p.category || "Other";
    const count = perCategory.get(key) ?? 0;
    if (count >= HOME_CATEGORY_ROW_LIMIT) continue;
    perCategory.set(key, count + 1);
    keep.add(p.id);
  }

  return withImage.filter((p) => keep.has(p.id));
}

export const getBanners = unstable_cache(queryBanners, ["catalog-banners"], {
  tags: [BANNERS_TAG],
  revalidate: CATALOG_REVALIDATE,
});
