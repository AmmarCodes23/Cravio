import type { Dispatch, SetStateAction } from "react";
import type { Session } from "next-auth";

export type OrderStatus = "ACCEPTED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";

export type SortBy = "price" | "company" | "category" | "none";
export type SortOrder = "asc" | "desc";

export interface CategoryFetch {
  id: number;
  name: string;
  url: string;
  productCount: number;
  isHidden?: boolean;
}

export interface Company {
  id: number;
  name: string;
  image: string | null;
  productCount: number;
  category: string | null;
  categoryId?: number | null;
  categories?: (string | null)[];
  isHidden?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: number;
  name: string;
  company: string;
  companyId: number | null;
  category: string;
  categoryId: number | null;
  price: number;
  originalPrice: number | null;
  retailPrice: number;
  consumerPrice: number;
  bulkPrice: number;
  bulkLimit?: number | null;
  image: string;
  description: string | null;
  companyImage: string;
  isHidden?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealsCardProps {
  Name: string;
  range?: [number, number];
  index?: number;
  filterCategory?: string;
}

export interface CardProps {
  image: string;
  title?: string;
}

export interface SearchBarProps {
  onSearch?: (results: Product[]) => void;
  onSort?: (sortBy: SortBy, sortOrder: SortOrder) => void;
}

export interface CompanyProductsClientProps {
  companyName: string;
}

export interface CompanyPageProps {
  params: {
    companydata: string;
  };
}

export interface LocationSelectorProps {
  allowChange?: boolean;
}

export interface PlacesAutoCompleteProps {
  setAddress: Dispatch<SetStateAction<string | null>>;
  setSelected: Dispatch<SetStateAction<{ lat: number; lng: number } | null>>;
  setMapToOpen: Dispatch<SetStateAction<boolean>>;
}

export interface AddressDisplayProps {
  address: string | null;
}

export interface AccountInfoProps {
  session: Session | null;
  onSignOut: () => void;
}

export interface MobileCartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface AuthUserProfile {
  id: string;
  role: string;
}

export interface AuthSessionUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
}

export interface AdminOrderProduct {
  id: string;
  quantity: number;
  product: {
    name: string;
    price: number;
    retailPrice?: number | null;
    consumerPrice?: number | null;
    bulkPrice?: number | null;
  };
}

export interface AdminOrder {
  id: string;
  orderNumber: number;
  accountEmail: string;
  phoneNumber: string;
  orderInfo: string;
  address: string;
  orderPerson: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string | null;
    email: string;
  };
  orderProducts: AdminOrderProduct[];
}

export interface OrderProductItem {
  id: string;
  productId: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    price: number;
    image: string;
  };
}

export interface UserOrder {
  id: string;
  orderNumber: number;
  accountEmail: string;
  phoneNumber: string;
  orderInfo: string;
  address: string;
  orderPerson: string;
  status: OrderStatus;
  createdAt: string;
  orderProducts: OrderProductItem[];
}

export interface PendingOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
}

export interface EmployeeRecord {
  id: string;
  userId: string;
  employeeId: string;
  department: string | null;
  position: string | null;
  hireDate: string;
  salary: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string | null;
    email: string;
    role: string;
  };
}

export interface AdminRecord {
  id: string;
  userId: string;
  adminId: string;
  level: number;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string | null;
    email: string;
    role: string;
  };
}

// Admin analytics types
export type AnalyticsOrderProduct = {
  id: string;
  quantity: number;
  product: {
    name: string;
    company?: string | null;
    price: number;
    originalPrice?: number | null;
    retailPrice?: number | null;
    consumerPrice?: number | null;
    bulkPrice?: number | null;
    category?: string;
  };
};

export interface AnalyticsOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  createdAt: string;
  accountEmail: string;
  phoneNumber: string;
  address: string;
  orderPerson: string;
  orderProducts: AnalyticsOrderProduct[];
}

// Catalog admin types
export interface CatalogCategory {
  id: number;
  name: string;
  url: string;
  productCount: number;
  isHidden?: boolean;
}

export interface CatalogCompany {
  id: number;
  name: string;
  image: string | null;
  productCount: number;
  categories?: string[];
  isHidden?: boolean;
}

export interface CatalogProduct {
  id: number;
  name: string;
  companyId: number | null;
  company: string;
  categoryId: number | null;
  category: string;
  retailPrice: number;
  consumerPrice: number;
  bulkPrice: number;
  bulkLimit?: number | null;
  image: string;
  description: string | null;
  isHidden?: boolean;
}

export interface CategoryFormState {
  name: string;
  url: string;
  isHidden?: boolean;
  imageMode?: "url" | "upload";
  imageFile?: File | null;
}

export interface CompanyFormState {
  name: string;
  image: string;
  categoryIds: number[];
  productCount: string;
  isHidden?: boolean;
  imageMode: "url" | "upload";
  imageFile: File | null;
}

export interface ProductFormState {
  name: string;
  companyId: string;
  categoryId: string;
  retailPrice: string;
  consumerPrice: string;
  bulkPrice: string;
  bulkLimit: string;
  image: string;
  description: string;
  isHidden?: boolean;
  imageMode: "url" | "upload";
  imageFile: File | null;
}

// P2P admin types
export interface VendorOrderProduct {
  quantity: number;
  product: {
    consumerPrice?: number | null;
    price: number;
    retailPrice?: number | null;
    bulkPrice?: number | null;
  };
}

export interface VendorOrder {
  id: string;
  orderNumber: number;
  orderProducts: VendorOrderProduct[];
  user: { id: string; name: string | null; email: string | null; role: string };
}

export interface Vendor {
  id: number;
  name: string;
  address: string | null;
  phoneNumber: string;
  orders?: VendorOrder[];
}