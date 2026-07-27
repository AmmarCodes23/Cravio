"use client";
import React, { use, useMemo, useState } from "react";
import { Company, Product } from "@/app/Data/database";
import { useProductModal } from "@/app/context/ProductModalContext";
import { useCartContext } from "@/app/context/CartContext";
import { useProduct } from "@/app/context/ProductsContext";
import { useCompanies } from "@/app/context/fetchCompanies";
import { useSession } from "next-auth/react";
import ProductCard from "../../components/ProductCard";
import Loading from "../../components/Loading";

export default function CategoryPage({ params }: { params: Promise<{ categoryName: string }> }) {
  const { categoryName } = use(params);
  const { setProduct } = useProductModal();
  const { addItem } = useCartContext();
  const { ProductFetch, loading } = useProduct();
  const { CompaniesFetch } = useCompanies();
  const { data: session } = useSession();
  const isEmployee = session?.user?.role === "EMPLOYEE";
  const [selectedCompany, setSelectedCompany] = useState<string>("All");

  const decodedCategoryName = decodeURIComponent(categoryName);

  const hasCachedProducts = Array.isArray(ProductFetch) && ProductFetch.length > 0;
  const showDataLoader = loading && !hasCachedProducts;

  const products: Product[] = hasCachedProducts
    ? ProductFetch.filter(
        (product: Product) => product.category === decodedCategoryName && !product.isHidden
      )
    : [];

  const companiesForCategory = useMemo(() => {
    if (!CompaniesFetch) return [];
    const categorySlug = decodedCategoryName.toLowerCase();
    const list = CompaniesFetch.filter((c: Company) => {
      if (c.isHidden) return false;
      if (Array.isArray(c.categories) && c.categories.length > 0) {
        return c.categories.some(
          (cat: string | null | undefined) => cat?.toLowerCase() === categorySlug
        );
      }
      return c.category?.toLowerCase() === categorySlug;
    });
    return list.sort((a: Company, b: Company) => a.name.localeCompare(b.name));
  }, [CompaniesFetch, decodedCategoryName]);

  const visibleProducts =
    selectedCompany === "All"
      ? products
      : products.filter((p: Product) => p.company === selectedCompany);

  return (
    <section className="py-8 pb-24 px-4 sm:px-6">
      <div className="w-full max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold font-sifonn mb-4">
          Category: {decodedCategoryName}
        </h1>

        {showDataLoader ? (
          <Loading />
        ) : !hasCachedProducts ? (
          <div className="text-center py-8">
            <p>No products available.</p>
          </div>
        ) : (
          <>
            {companiesForCategory.length > 0 && (
              <div className="sticky top-16 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 pb-4 pt-4 bg-white/80 backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto scrollbar-hide">
                  <button
                    onClick={() => setSelectedCompany("All")}
                    className={`flex-shrink-0 px-4 py-2 rounded-full border text-sm font-semibold transition ${
                      selectedCompany === "All"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-700 border-slate-200 hover:border-primary"
                    }`}
                  >
                    All
                  </button>
                  {companiesForCategory.map((company: Company) => (
                    <button
                      key={company.name}
                      onClick={() => setSelectedCompany(company.name)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full border text-sm font-semibold transition ${
                        selectedCompany === company.name
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-slate-700 border-slate-200 hover:border-primary"
                      }`}
                    >
                      {company.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                {visibleProducts.map((deal: Product) => (
                  <ProductCard key={deal.id} product={deal} dest="category" />
                ))}
              </div>
            ) : (
              <p>No products found in this category.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
