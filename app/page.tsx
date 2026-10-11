import HomeClient from "./HomeClient";
import {
  getBanners,
  getCategories,
  getCompanies,
  getProducts,
  selectHomeProducts,
} from "@/lib/catalog";

export const revalidate = 3600;

export default async function Page() {
  const [banners, categories, companies, products] = await Promise.all([
    getBanners(),
    getCategories(),
    getCompanies(),
    getProducts(),
  ]);

  return (
    <HomeClient
      banners={banners}
      categories={categories}
      companies={companies}
      // Only what Deals/AllProductsGrid render; search/modal use ProductsContext.
      products={selectHomeProducts(products)}
    />
  );
}
