"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import Headband from "./Headband";
import Navbar from "./Navbar";
import Subnav from "./Subnav";
import Cart from "./Cart";
import MobileBottomNav from "./MobileBottomNav";
import PendingOrdersBanner from "./PendingOrdersBanner";
import BulkToast from "./BulkToast";
import { LoginModal } from "./LoginModal";
import ProductModal from "./ProductModal";
import { ProductModalProvider } from "../context/ProductModalContext";
import { LoginModalProvider } from "../context/LoginModalContext";
import { CartProvider, useCartContext } from "../context/CartContext";
import { LocationProvider } from "../context/LocationContext";
import { GoogleMapsProvider } from "../context/GoogleMapsProvider";
import { UserInfoProvider } from "../context/UserInfoContext";
import { ProductsProvider } from "../context/ProductsContext";
import { CategoryProvider } from "../context/categoriesContext";
import { CompaniesProvider } from "../context/fetchCompanies";
import { VendorProvider } from "../context/VendorContext";
import VendorModal from "./VendorModal";
import KeepAliveOutlet from "./KeepAliveOutlet";
import { useEffect } from "react";

type LayoutProps = {
  children: React.ReactNode;
};

const ADMIN_LINKS = [
  { href: "/admin/analytics", label: "Analytics", roles: ["ADMIN"] },
  { href: "/admin/catalog", label: "Catalog", roles: ["ADMIN"] },
  { href: "/admin/banners", label: "Banners", roles: ["ADMIN", "EMPLOYEE"] },
  { href: "/admin/orders", label: "Orders", roles: ["ADMIN", "EMPLOYEE"] },
  { href: "/admin/employees", label: "Employees", roles: ["ADMIN"] },
  { href: "/admin/p2p", label: "P2P", roles: ["ADMIN"] },
];

function ContentLayout({ children }: LayoutProps) {
  const { CartOpen, cartItems } = useCartContext();
  const isCartOpenOnDesktop = CartOpen && cartItems.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 bg-slate-50 border-b border-slate-200 shadow-sm">
        <Headband />
        <BulkToast />
        <Navbar />
        <Subnav />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`min-h-0 min-w-0 flex-1 pt-[56px] pb-[56px] md:pt-0 md:pb-0 ${
            isCartOpenOnDesktop ? "md:max-w-5xl" : ""
          }`}
        >
          {children}
        </div>
        <Cart />
      </div>
    </div>
  );
}

function SiteShell({ children }: LayoutProps) {
  return (
    <GoogleMapsProvider>
      <ProductsProvider>
        <CategoryProvider>
          <CompaniesProvider>
            <ProductModalProvider>
              <LoginModalProvider>
                <VendorProvider>
                  <CartProvider>
                    <LocationProvider>
                      <UserInfoProvider>
                        {/* Fixed viewport shell so keep-alive panes scroll internally */}
                        <div className="flex h-dvh flex-col overflow-hidden">
                          <div className="min-h-0 flex-1">
                            <ContentLayout>
                              <KeepAliveOutlet>{children}</KeepAliveOutlet>
                            </ContentLayout>
                          </div>
                          <MobileBottomNav />
                          <PendingOrdersBanner />
                          <LoginModal />
                          <VendorModal />
                          <ProductModal />
                        </div>
                      </UserInfoProvider>
                    </LocationProvider>
                  </CartProvider>
                </VendorProvider>
              </LoginModalProvider>
            </ProductModalProvider>
          </CompaniesProvider>
        </CategoryProvider>
      </ProductsProvider>
    </GoogleMapsProvider>
  );
}

function AdminShell({ children }: LayoutProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRole = session?.user?.role ?? "ADMIN";

  const visibleLinks = ADMIN_LINKS.filter((link) =>
    link.roles.includes(userRole)
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/admin/analytics" className="flex items-center gap-3">
              <img
                src="/images/Cravio_Logo.png"
                alt="Cravio"
                className="h-10 w-10 rounded-lg border border-gray-100 object-contain"
              />
              <div>
                <p className="font-semibold text-gray-900">Cravio Admin</p>
                <p className="text-xs text-gray-500">Operations Console</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">
                  {session.user.name || session.user.email}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {session.user.role.toLowerCase()}
                </p>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-gray-200 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px,1fr]">
          <nav className="hidden flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:flex">
            {visibleLinks.map((link) => {
              const isActive = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="lg:hidden mb-4 flex flex-wrap gap-2">
            {visibleLinks.map((link) => {
              const isActive = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-700 border border-gray-200"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <main className="min-h-[70vh] rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function LayoutSwitcher({ children }: LayoutProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const isAdminUser = session?.user?.role === "ADMIN";

  useEffect(() => {
    if (status !== "authenticated") return;
    if (isAdminUser && !isAdminRoute) {
      router.replace("/admin/analytics");
    }
  }, [isAdminUser, isAdminRoute, router, status]);

  if (isAdminRoute) {
    return <AdminShell>{children}</AdminShell>;
  }

  return <SiteShell>{children}</SiteShell>;
}

