"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Grid3x3, Package, ShoppingBag } from "lucide-react";

const Subnav: React.FC = () => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  const scrollToCategories = () => {
    const categoriesSection = document.getElementById("categories");
    if (categoriesSection) {
      categoriesSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="subnav w-full h-auto py-3 px-3 hidden md:flex flex-row bg-secondary gap-3">
        {isHomePage && (
          <button
            onClick={scrollToCategories}
            className="flex flex-row gap-2 px-2 py-2 items-center hover:opacity-80 transition-opacity"
          >
              <Grid3x3 className="w-10 h-10 text-accents"/>
              <p className="font-sifonn text-accents">Categories</p>
          </button>
        )}
        <Link href="/companies" scroll={false}>
          <div className="flex flex-row gap-2 px-2 py-2 items-center">
              <img src="/images/brand.png" className="w-10 h-10"/>
              <p className="font-sifonn text-accents">Companies</p>
          </div>
        </Link>
        {session && (
          <Link href="/orders">
            <div className="flex flex-row gap-2 px-2 py-2 items-center">
                <Package className="w-10 h-10 text-accents"/>
                <p className="font-sifonn text-accents">Your Orders</p>
            </div>
          </Link>
        )}
    </div>
  )
}

export default Subnav;