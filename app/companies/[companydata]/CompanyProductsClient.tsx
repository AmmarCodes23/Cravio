"use client";

import { useMemo, useState } from "react";
import type { CompanyProductsClientProps, Product } from "@/app/Data/database";
import ProductCard from "@/app/components/ProductCard";
import Loading from "@/app/components/Loading";
import { useProduct } from "@/app/context/ProductsContext";
import { useCompanies } from "@/app/context/fetchCompanies";

const normalizeSlug = (slug: string) => slug.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function CompanyProductsClient({ companyName }: CompanyProductsClientProps) {
  const { products, loading: productsLoading } = useProduct();
  const { companies, loading: companiesLoading } = useCompanies();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const normalizedSlug = normalizeSlug(companyName);
  const hasCachedProducts = Array.isArray(products) && products.length > 0;
  const hasCachedCompanies = Array.isArray(companies) && companies.length > 0;
  const showDataLoader =
    (productsLoading && !hasCachedProducts) || (companiesLoading && !hasCachedCompanies);

  const companyProducts = hasCachedProducts
    ? products.filter(
        (product: Product) => normalizeSlug(product.company) === normalizedSlug
      )
    : [];

  const company = hasCachedCompanies
    ? companies.find((c) => normalizeSlug(c.name) === normalizedSlug)
    : null;

  const displayName = company?.name || companyName.replace(/-/g, " ");

  const categoriesForCompany = useMemo(() => {
    const cats = Array.from(
      new Set(companyProducts.map((p: Product) => p.category))
    ).filter(Boolean);
    return cats.sort((a, b) => a.localeCompare(b));
  }, [companyProducts]);

  const visibleProducts =
    selectedCategory === "All"
      ? companyProducts
      : companyProducts.filter((p: Product) => p.category === selectedCategory);

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        {company?.image && (
          <div className="w-14 h-14 border rounded-full p-2 flex items-center justify-center bg-white">
            <img
              src={company.image}
              alt={`${company.name} Logo`}
              className="object-contain w-full h-full"
            />
          </div>
        )}
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 font-sifonn">
            {displayName} Products
          </h1>
          <p className="text-sm text-gray-500 font-sifonn">
            Explore the range of snacks from {displayName}.
          </p>
        </div>
      </div>

      {showDataLoader ? (
        <Loading />
      ) : companyProducts.length === 0 ? (
        <div className="container mx-auto p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600">Company Not Found</h2>
          <p className="mt-4 text-gray-600">
            No products found for &quot;{companyName.replace(/-/g, " ")}&quot;.
          </p>
        </div>
      ) : (
        <>
          {categoriesForCompany.length > 1 && (
            <div className="sticky top-16 z-10 -mx-4 px-4 py-3 pb-4 pt-4 bg-white/80 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory("All")}
                  className={`flex-shrink-0 px-4 py-2 rounded-full border text-sm font-semibold transition ${
                    selectedCategory === "All"
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-slate-700 border-slate-200 hover:border-primary"
                  }`}
                >
                  All
                </button>
                {categoriesForCompany.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full border text-sm font-semibold transition ${
                      selectedCategory === cat
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-700 border-slate-200 hover:border-primary"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 mt-2 pb-24">
            {visibleProducts.map((product: Product) => (
              <ProductCard key={product.id} product={product} dest="company" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
