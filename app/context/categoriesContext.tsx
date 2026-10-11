"use client"
import { createContext, useContext, useState,useEffect } from "react";
import { CategoryFetch } from "../Data/database";
type CategoryValue = {
  categories: CategoryFetch[] | null;
  setCategories: React.Dispatch<React.SetStateAction<CategoryFetch[] | null>>;
  // legacy alias
  CategoryFetched?: CategoryFetch[] | null;
  setCategoryFetched?: React.Dispatch<React.SetStateAction<CategoryFetch[] | null>>;
};

const CategoryContext = createContext<CategoryValue | null>(null);

export function CategoryProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  /** Complete list from the server render; when present the mount-time /api/category fetch is skipped. */
  initialData?: CategoryFetch[] | null;
}) {
    const [categories,setCategories] = useState<CategoryFetch[] | null>(initialData ?? null);

  useEffect(() => {
    if (initialData && initialData.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/category");
        const data = await res.json();
        if (!cancelled) setCategories(data);
      } catch (err) {
        console.error("Failed to fetch categories", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  return (
    <CategoryContext.Provider value={{categories,setCategories, CategoryFetched: categories, setCategoryFetched: setCategories}}>
    {children}
    </CategoryContext.Provider>
  )
}

export const useCategory= ()=>{
  const ctx = useContext(CategoryContext);
  if(!ctx) throw new Error("useCategory must be used inside CategoryProvider");
  return ctx;
}
