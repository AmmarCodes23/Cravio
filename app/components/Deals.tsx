"use client"
import { ArrowRight, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import ProductCard from './ProductCard';
import type { DealsCardProps, Product } from '../Data/database';
import Loading from './Loading';
import { useProduct } from '../context/ProductsContext';
import { useCartContext } from '../context/CartContext';

export default function Deals({Name, range, index, filterCategory}:DealsCardProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const {ProductFetch, loading} = useProduct();
  const { cartItems, CartOpen } = useCartContext();
  const isCartOpen = cartItems.length > 0 && CartOpen;
  
  const rangedProducts = useMemo(() => {
    if (!ProductFetch) return [];
    let source = ProductFetch.filter((p: Product) => p.image);
    if (filterCategory) {
      source = source.filter((p) => p.category === filterCategory);
    }
    if (Name === "Hot Deals - On the Clock") {
      const sorted = source
        .map((p) => {
          const base = p.consumerPrice ?? p.price ?? 0;
          const original = p.originalPrice ?? p.retailPrice ?? base;
          const discount = original > base ? (original - base) / original : 0;
          return { product: p, discount };
        })
        .filter((p) => p.discount > 0)
        .sort((a, b) => b.discount - a.discount)
        .map((p) => p.product);
      return sorted.slice(0, 40);
    }
    if (range && range.length === 2) {
      const [start, end] = range;
      return source.slice(start, end);
    }
    if (typeof index === "number") {
      return source.slice(index, index + 1);
    }
    return source;
  }, [ProductFetch, range, index, Name]);

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById(`deals-container${Name}`);
    if (container) {
      const scrollAmount = 300;
      const newPosition = direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : Math.min(container.scrollWidth - container.clientWidth, scrollPosition + scrollAmount);

      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  if (loading && (!ProductFetch || ProductFetch.length === 0)) {
    return (
      <section className="py-4 px-5">
        <div className="max-w-md lg:max-w-4xl md:max-w-2xl mx-auto">
          <h2 className="font-sifonn text-xl md:text-3xl font-semibold text-slate-800 mb-6">
            {Name}
          </h2>
          <Loading />
        </div>
      </section>
    );
  }

  if(!rangedProducts || rangedProducts.length === 0){
    return (
      <section className="py-4 px-5">
        <div className="max-w-md lg:max-w-4xl md:max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-sifonn text-xl md:text-3xl font-semibold text-slate-800">
                {Name}
              </h2>
            </div>
          </div>
          <div className="text-center py-8">
            <p className="text-slate-500">No products available</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-0 px-1 sm:px-6 md:px-8 overflow-hidden" id={Name === "Hot Deals - On the Clock" ? "deals-section" : undefined}>
      <div className={`w-full max-w-screen-xl mx-auto transition-all duration-300 ${isCartOpen ? "md:max-w-[calc(100vw-460px)] md:mx-0" : ""}`}>
        <div className="flex items-center justify-between gap-3 mb-5 md:mb-6">
          <h2 className="font-sifonn text-2xl md:text-3xl font-semibold text-slate-900">
            {Name}
          </h2>
        </div>

        <div className="relative group/carousel overflow-hidden max-w-screen w-full px-1 py-5 sm:px-6 md:px-8">
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 items-center justify-center bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 opacity-0 group-hover/carousel:opacity-100 hover:scale-110"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6 text-slate-700" />
          </button>

          <div
            id={"deals-container"+Name}
            className="flex overflow-x-auto gap-3 sm:gap-4 pr-2 scrollbar-hide w-full max-w-full min-w-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {rangedProducts.map((deal: Product, index:number) => (
              <ProductCard product={deal} key={index} dest="deal"/>
            ))}
          </div>

          <button
            onClick={() => scroll('right')}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 items-center justify-center bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 opacity-0 group-hover/carousel:opacity-100 hover:scale-110"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6 text-slate-700" />
          </button>
        </div>
      </div>
    </section>
  );
}
