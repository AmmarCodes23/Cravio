"use client";
import { useLoginModal } from "@/app/context/LoginModalContext";
import Image from "next/image";
import {signOut, useSession } from "next-auth/react"
import AccountInfo from "./AccountInfo";
import LocationSelector from "./LocationSelector";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, ChevronDown, Search, MapPin } from "lucide-react";
import { useLocation } from "../context/LocationContext";
import { useCartContext } from "../context/CartContext";
import MobileLocationDrawer from "./MobileLocationDrawer";

const Navbar: React.FC = () => {
    const { setIsOpen, setIsEmployee } = useLoginModal();
    const { data: session } = useSession();
    const [isSeeding, setIsSeeding] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [locOpen, setLocOpen] = useState(false);
    const [mobileSearchActive, setMobileSearchActive] = useState(false);
    const { selectedAddress } = useLocation();
    const { cartItems, CartOpen, setCartOpen } = useCartContext();

    useEffect(() => {
      const handleOpen = () => setMobileSearchActive(true);
      const handleClose = () => setMobileSearchActive(false);

      window.addEventListener("mobile-search-open", handleOpen as EventListener);
      window.addEventListener("mobile-search-close", handleClose as EventListener);

      return () => {
        window.removeEventListener("mobile-search-open", handleOpen as EventListener);
        window.removeEventListener("mobile-search-close", handleClose as EventListener);
      };
    }, []);

  const shortAddress = selectedAddress
    ? selectedAddress.length > 35
      ? `${selectedAddress.slice(0, 35)}...`
      : selectedAddress
    : "Set location";

    // const seedDatabase = async () => {
    //     setIsSeeding(true);
    //     try {
    //         // Only seed companies (companydata.json already includes category + counts)
    //         const companyResponse = await fetch('/api/company?seed=true', {
    //             method: 'POST',
    //         });

    //         if (!companyResponse.ok) {
    //             throw new Error('Failed to seed companies');
    //         }

    //         const companyResult = await companyResponse.json();
    //         console.log('Companies seeded:', companyResult);

    //         alert(`Companies seeded successfully! Count: ${companyResult.count}`);

    //     } catch (error) {
    //         console.error('Seeding failed:', error);
    //         alert('Failed to seed companies. Check console for details.');
    //     } finally {
    //         setIsSeeding(false);
    //     }
    // };

    // const seedDatabase = async () => {
    //     setIsSeeding(true);
    //     try {
    //         // Seed categories first
    //         const categoryResponse = await fetch('/api/category?seed=true', {
    //             method: 'POST',
    //         });

    //         if (!categoryResponse.ok) {
    //             throw new Error('Failed to seed categories');
    //         }

    //         const categoryResult = await categoryResponse.json();
    //         console.log('Categories seeded:', categoryResult);

    //         // Then seed companies
    //         const companyResponse = await fetch('/api/company?seed=true', {
    //             method: 'POST',
    //         });

    //         if (!companyResponse.ok) {
    //             throw new Error('Failed to seed companies');
    //         }

    //         const companyResult = await companyResponse.json();
    //         console.log('Companies seeded:', companyResult);

    //         // Finally seed products
    //         const productResponse = await fetch('/api/products?seed=true', {
    //             method: 'POST',
    //         });

    //         if (!productResponse.ok) {
    //             throw new Error('Failed to seed products');
    //         }

    //         const productResult = await productResponse.json();
    //         console.log('Products seeded:', productResult);

    //         alert(`Database seeded successfully!\nCategories: ${categoryResult.count}\nCompanies: ${companyResult.count}\nProducts: ${productResult.count}`);

    //     } catch (error) {
    //         console.error('Seeding failed:', error);
    //         alert('Failed to seed database. Check console for details.');
    //     } finally {
    //         setIsSeeding(false);
    //     }
    // };
  return (
    <>
      {/* Main Navbar */}
      <div className="md:static fixed top-0 left-0 right-0 z-[10000] bg-white border-b border-slate-200 md:border-none md:relative">

        {/* ===== MOBILE NAVBAR (< md) ===== */}
        <div className="flex md:hidden flex-row items-center py-3 px-2 gap-0 w-full">
          {/* Burger */}
          <button
            className="shrink-0 p-1 rounded-full hover:bg-slate-100 relative"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            <Menu 
              className={`w-6 h-6 text-slate-800 transition-all duration-300 ${
                menuOpen ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
              }`}
            />
            <X 
              className={`w-6 h-6 text-slate-800 absolute top-2 left-2 transition-all duration-300 ${
                menuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
              }`}
            />
          </button>

          {/* Mobile deliver to — fills entire middle */}
          <button
            onClick={() => setLocOpen(true)}
            className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-2"
          >
            <div className="flex flex-col items-center leading-tight min-w-0">
              <span className="text-[11px] text-slate-500">Deliver to</span>
              <span className="text-[0.8rem] font-semibold text-slate-800 truncate max-w-full block">{selectedAddress || "Set location"}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-700 shrink-0" />
          </button>

          {/* Search */}
          <button
            className="shrink-0 p-1 rounded-full hover:bg-slate-100 relative"
            aria-label="Search"
            onClick={() => {
              const next = !mobileSearchActive;
              setMobileSearchActive(next);
              const event = new CustomEvent(next ? "mobile-search-open" : "mobile-search-close");
              window.dispatchEvent(event);
            }}
          >
            <span className="relative w-6 h-6 inline-flex items-center justify-center">
              <Search
                className={`absolute w-6 h-6 text-slate-800 transition-all duration-300 ${
                  mobileSearchActive ? "opacity-0 -rotate-45 scale-75" : "opacity-100 rotate-0 scale-100"
                }`}
              />
              <X
                className={`absolute w-6 h-6 text-slate-800 transition-all duration-300 ${
                  mobileSearchActive ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-45 scale-75"
                }`}
              />
            </span>
          </button>
        </div>

        {/* ===== DESKTOP NAVBAR (md+) ===== */}
        <div className="hidden md:flex flex-row justify-between py-3 px-5 items-center gap-5 w-full">
          <Link href={"/"} scroll={false}>
            <div className="flex flex-row md:gap-5 gap-2 w-fit flex-none">
              <img src="/images/Cravio_Logo.png" className="w-15 sm:w-20 h-auto rounded-sm md:rounded-lg lg:rounded-xl"/>
              <p className="self-center font-brasika text-primary hidden sm:text-sm md:block md:text-lg lg:text-2xl">Cravio</p>
            </div>
          </Link>

          {/* Desktop Location Selector trigger */}
          <button
            onClick={() => setLocOpen(true)}
            className="flex items-center gap-4 border border-slate-200 bg-white py-2 px-3 rounded-lg hover:border-primary/60 hover:bg-accents/60 transition"
          >
            <MapPin className="text-primary"/>
            <div className="flex flex-col items-start leading-tight w-[240px]">
              <span className="text-[11px] text-slate-500">Deliver to</span>
              <span className="text-sm font-semibold text-slate-800 line-clamp-1 max-w-full">{shortAddress}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-700" />
          </button>

          {session?<AccountInfo session={session} onSignOut={signOut}/>:
          <div className="flex flex-row gap-2 justify-end w-fit">
            <button className="px-10 cursor-pointer md:px-30 py-2 hover:bg-secondary hover:text-accents w-full font-sifonn rounded-md bg-primary text-accents text-xs md:text-lg"
            onClick={()=>{setIsOpen(true);setIsEmployee(false)}}
            >Login/Sign Up</button>
          </div>}

          {cartItems.length > 0 && (
            <button
              onClick={() => setCartOpen(!CartOpen)}
              className="relative p-2 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Toggle cart"
            >
              <div className="relative w-12 h-12">
                <Image
                    src="/images/plastic-bag.png"
                    alt="cart"
                    fill
                />
              </div>
              <div className="rounded-full w-5 h-5 bg-primary absolute -top-1 -right-1 text-accents text-xs flex items-center justify-center font-bold">
                {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
              </div>
            </button>
          )}

          {/* Employee Links */}
          {session && session.user.role === 'EMPLOYEE' && (
            <div className="flex flex-row gap-4 ml-4">
              <Link href="/admin/orders" className="text-accents bg-primary p-4 hover:text-amber-300 font-sifonn text-sm">
                Manage Orders
              </Link>
            </div>
          )}
        </div>

      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-[9998] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-5/6 max-w-sm bg-white shadow-2xl rounded-r-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xl font-bold text-slate-900">Menu</p>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-slate-700" />
              </button>
            </div>
            <div className="space-y-3">
              {session && (
                <>
                  <Link href="/account" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-slate-800 font-medium">
                <span>My Account</span>
              </Link>
                  <Link href="/user-info" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-slate-800 font-medium">
                <span>Addresses</span>
              </Link>
                  <Link href="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-slate-800 font-medium">
                <span>Orders</span>
              </Link>
                </>
              )}
              <Link href="/help" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-slate-800 font-medium">
                <span>Help Center</span>
              </Link>
            </div>
            <div className="mt-auto">
              {session ? (
                <button
                  className="w-full bg-primary text-white rounded-lg py-3 font-semibold"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Sign out
                </button>
              ) : (
                <button
                  className="w-full bg-primary text-white rounded-lg py-3 font-semibold"
                  onClick={() => {
                    setIsOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  Login / Sign Up
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <MobileLocationDrawer isOpen={locOpen} onClose={() => setLocOpen(false)} />
    </>
  )
}

export default Navbar