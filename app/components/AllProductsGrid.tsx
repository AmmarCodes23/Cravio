"use client"
import { useMemo } from 'react';
import Deals from './Deals';
import type { Product } from '../Data/database';
import Loading from './Loading';
import { useProduct } from '../context/ProductsContext';

export default function AllProductsGrid() {
  const { ProductFetch, loading } = useProduct();

  const grouped = useMemo(() => {
    if (!ProductFetch) return [];
    const withImage = ProductFetch.filter((p: Product) => p.image);
    const map = new Map<string, Product[]>();
    withImage.forEach((p) => {
      const key = p.category || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [ProductFetch]);

  if (loading && (!ProductFetch || ProductFetch.length === 0)) {
    return <Loading />;
  }

  if (!grouped.length) {
    return (
      <section className="py-4 px-0 sm:px-4 md:px-8">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="text-center py-8">
            <p className="text-slate-500">No products available</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-4 px-0 sm:px-4 md:px-8 pb-24">
      <div className="w-full max-w-screen-xl mx-auto space-y-8">
        {grouped.map(({ category }) => (
          <Deals key={category} Name={category} filterCategory={category} />
        ))}
      </div>
    </section>
  );
}

