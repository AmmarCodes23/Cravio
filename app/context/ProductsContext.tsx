"use client"
import { createContext, useContext, useState,useEffect } from "react";
import { Product } from "../Data/database";

type ProductsValue = {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  loading: boolean;
  // legacy aliases
  ProductFetch?: Product[];
  setProductFetch?: React.Dispatch<React.SetStateAction<Product[]>>;
};

const ProductContext = createContext<ProductsValue | null>(null);

export function ProductsProvider({children}:{children:React.ReactNode}) {
    const [products,setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (!cancelled) setProducts(data);
      } catch (err) {
        console.error("Failed to fetch products", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ProductContext.Provider value={{products,setProducts, loading, ProductFetch: products, setProductFetch: setProducts}}>
        {children}
    </ProductContext.Provider>
  )
}

export const useProduct= ()=>{
  const ctx = useContext(ProductContext);
  if(!ctx) throw new Error("useProduct must be used inside ProductsProvider");
  return ctx;
}
