import {
  companiesPresentInProducts,
  getCompanies,
  getCategories,
  getProducts,
} from "@/lib/catalog";
import CategoryProductsClient from "./CategoryProductsClient";

export const revalidate = 300;

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

  const [products, companies] = await Promise.all([getProducts(), getCompanies()]);

  const categoryProducts = products.filter(
    (product) =>
      product.category.toLowerCase() === decodedCategoryName.toLowerCase() &&
      !product.isHidden
  );

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
