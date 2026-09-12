import { CompanyProductsClient } from "./CompanyProductsClient";
import { companySlug, getCompanies, getCompanyPageData } from "@/lib/catalog";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const companies = await getCompanies();
    return companies.map((company) => ({
      companydata: companySlug(company.name),
    }));
  } catch {
    return [];
  }
}

export default async function CompanyProductsPage({
  params,
}: {
  params: Promise<{ companydata: string }>;
}) {
  const { companydata } = await params;
  const { company, products } = await getCompanyPageData(companydata);

  return (
    <CompanyProductsClient
      companyName={companydata}
      company={company}
      products={products}
    />
  );
}
