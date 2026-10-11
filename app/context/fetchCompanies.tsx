"use client"
import { createContext, useContext, useState,useEffect } from "react";
import { Company } from "../Data/database";

type CompanyValue = {
  companies: Company[];
  setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
  loading: boolean;
  // legacy aliases
  CompaniesFetch?: Company[];
  setCompaniesFetch?: React.Dispatch<React.SetStateAction<Company[]>>;
};

const CompanyContext = createContext<CompanyValue | null>(null);

export function CompaniesProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  /** Complete list from the server render; when present the mount-time /api/company fetch is skipped. */
  initialData?: Company[] | null;
}) {
    const hasInitial = Boolean(initialData && initialData.length > 0);
    const [companies,setCompanies] = useState<Company[]>(initialData ?? []);
    const [loading, setLoading] = useState(!hasInitial);

  useEffect(() => {
    if (hasInitial) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/company");
        const data = await res.json();
        if (!cancelled) setCompanies(data);
      } catch (err) {
        console.error("Failed to fetch companies", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasInitial]);

  return (
    <CompanyContext.Provider value={{companies,setCompanies, loading, CompaniesFetch: companies, setCompaniesFetch: setCompanies}}>
        {children}
    </CompanyContext.Provider>
  )
}

export const useCompanies= ()=>{
  const ctx = useContext(CompanyContext);
  if(!ctx) throw new Error("useCompanies must be used inside CompaniesProvider");
  return ctx;
}
