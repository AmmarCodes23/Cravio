import {
  companiesPresentInProducts,
  getCompanies,
  getCategories,
  getCategoryPageData,
} from "@/lib/catalog";
import CategoryProductsClient from "./CategoryProductsClient";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const categories = await getCategories();
    return categories.map((category) => ({ categoryName: category.name }));
  } catch {
    return [];
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categoryName: string }>;
}) {
  const { categoryName } = await params;
  const decodedCategoryName = decodeURIComponent(categoryName);

  const [{ products: categoryProducts }, companies] = await Promise.all([
    getCategoryPageData(decodedCategoryName),
    getCompanies(),
  ]);

  // Chips = companies that actually have products in this category (not M2M alone).
  const companiesForCategory = companiesPresentInProducts(
    companies,
    categoryProducts
  );

  return (
    <CategoryProductsClient
      categoryName={decodedCategoryName}
      products={categoryProducts}
      companies={companiesForCategory}
    />
  );
}
