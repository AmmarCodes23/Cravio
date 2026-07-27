"use client"
import Link from "next/link";
import { useCompanies } from "../context/fetchCompanies";
import Loading from "../components/Loading";

export default function CompaniesPage() {
  const { CompaniesFetch, loading } = useCompanies();
  const hasCached = Array.isArray(CompaniesFetch) && CompaniesFetch.length > 0;
  const showDataLoader = loading && !hasCached;

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-4xl font-brasika mb-6 text-center text-gray-800">
        Our Snack Manufacturers
      </h1>

      {showDataLoader ? (
        <Loading />
      ) : !hasCached ? (
        <div className="text-center py-8">
          <p>No companies available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-6 sm:gap-8 md:gap-10">
          {CompaniesFetch.map(company => (
            <Link 
              key={company.name}
              href={`/companies/${company.name.toLowerCase().replace(/\s+/g, '-')}`}
              scroll={false}
              className="group flex flex-col items-center"
            >
              <div className="w-full aspect-square mb-2 flex items-center justify-center shadow-sm">
                {company.image ? (
                  <img
                    src={company.image}
                    alt={`${company.name} Logo`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500 text-xs">No Image</span>
                  </div>
                )}
              </div>
              <h2 className="font-sifonn text-sm font-semibold text-slate-700 text-center">
                {company.name}
              </h2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
