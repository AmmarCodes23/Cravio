"use client";
import { useCartContext } from "@/app/context/CartContext";
import { useProductModal } from "@/app/context/ProductModalContext";
import { Plus } from "lucide-react";
import { Product } from "@/app/Data/database";
import { useSession } from "next-auth/react";
import CatalogImage from "./CatalogImage";

const ProductCard = ({
  product,
  dest,
  priority = false,
}: {
  product: Product;
  dest: string;
  priority?: boolean;
}) => {
  // Client-side hooks live here
  const { setProduct, setIsOpen } = useProductModal();
  const { addItem } = useCartContext();
  const { data: session } = useSession();
  const isEmployee = session?.user?.role === "EMPLOYEE";

  const consumer = product.consumerPrice ?? product.price;
  const retail = product.originalPrice ?? product.retailPrice ?? consumer;

  const displayPrice = isEmployee
    ? product.bulkPrice ?? retail ?? consumer
    : consumer;

  const isSlider = dest === "deal";

  return (
    <div
      className={`group h-full ${isSlider ? "flex-shrink-0 snap-start w-[140px] sm:w-[168px]" : "w-full"}`}
    >
      <div className={`bg-white rounded-lg ${isSlider ? 'p-1.5' : 'p-1.5 sm:p-2'} h-full shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 flex flex-col`}>
        <div className={`relative ${isSlider ? 'mb-2' : 'mb-1.5 sm:mb-2'}`}>
          <div
            className="relative overflow-hidden rounded-md bg-slate-100 aspect-square w-full cursor-pointer"
            onClick={() => {
              setProduct(product);
              setIsOpen(true);
            }}
          >
            <CatalogImage
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              priority={priority}
            />
          </div>
          <button
            className={`absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 ${isSlider ? 'w-8 h-8' : 'w-8 h-8 sm:w-9 sm:h-9'} bg-white rounded-full shadow-md flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all duration-300 transform hover:scale-110`}
            onClick={() => addItem(product, 1)}
            aria-label="Add to cart"
          >
            <Plus className={`${isSlider ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'}`} />
          </button>
        </div>

        <div className={`flex flex-1 flex-col space-y-0.5 sm:space-y-1 ${isSlider ? 'border-t border-slate-100 pt-1.5' : 'border-t border-slate-100 pt-1 sm:pt-1.5 sm:border-t-0'}`}>
          <div className="flex items-baseline gap-0.5 sm:gap-1">
            <span className={`font-sifonn ${isSlider ? 'text-xs' : 'text-sm'} font-bold text-red-600`}>
              Rs {displayPrice}
            </span>
            {!isEmployee && retail > consumer ? (
              <span className={`font-sifonn ${isSlider ? 'text-[10px]' : 'text-[10px] sm:text-[11px]'} text-slate-400 line-through`}>
                Rs {retail}
              </span>
            ) : null}
          </div>

          <h3 className={`font-sifonn ${isSlider ? 'text-[11px] leading-4 h-8' : 'text-sm sm:text-[15px] leading-5 h-10'} font-semibold text-slate-800 line-clamp-2`}>
            {product.name}
          </h3>
          <p className={`font-sifonn ${isSlider ? 'text-sm' : 'text-base sm:text-lg'} font-bold text-green-700 ${product.bulkPrice ? "" : "invisible"}`}>
            Bulk: Rs {product.bulkPrice ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;