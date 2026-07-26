"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Filter, MoreVertical, Plus } from "lucide-react";
import CatalogEditModal from "@/app/components/CatalogEditModal";
import type {
  CatalogCategory as Category,
  CatalogCompany as Company,
  CatalogProduct as Product,
  CategoryFormState,
  CompanyFormState,
  ProductFormState,
} from "@/app/Data/database";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "An unexpected error occurred";

export interface ProductFilters {
  companyNames: string[];
  categoryNames: string[];
  retailMin: number | "";
  retailMax: number | "";
  bulkMin: number | "";
  bulkMax: number | "";
  consumerMin: number | "";
  consumerMax: number | "";
  quantityMin: number | "";
  quantityMax: number | "";
}

const emptyProductFilters = (): ProductFilters => ({
  companyNames: [],
  categoryNames: [],
  retailMin: "",
  retailMax: "",
  bulkMin: "",
  bulkMax: "",
  consumerMin: "",
  consumerMax: "",
  quantityMin: "",
  quantityMax: "",
});

const emptyCategory: CategoryFormState = { name: "", url: "", isHidden: false, imageMode: "url", imageFile: null };
const emptyCompany: CompanyFormState = {
  name: "",
  image: "",
  categoryIds: [],
  productCount: "",
  isHidden: false,
  imageMode: "url",
  imageFile: null,
};
const emptyProduct: ProductFormState = {
  name: "",
  companyId: "",
  categoryId: "",
  retailPrice: "",
  consumerPrice: "",
  bulkPrice: "",
  bulkLimit: "",
  image: "",
  description: "",
  isHidden: false,
  imageMode: "url",
  imageFile: null,
};

function filterBySearch<T>(items: T[], search: string, getText: (item: T) => string): T[] {
  const term = search.trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => getText(item).toLowerCase().includes(term));
}

export default function CatalogAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [displayedCount, setDisplayedCount] = useState(50);
  const observerTarget = useRef<HTMLDivElement>(null);

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedProductFilters, setAppliedProductFilters] = useState<ProductFilters | null>(null);
  const [draftProductFilters, setDraftProductFilters] = useState<ProductFilters>(emptyProductFilters());

  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategory);
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(emptyCompany);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProduct);

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"category" | "company" | "product" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";
  useEffect(() => {
    if (status === "loading") return;
    if (!session || !isAdmin) {
      router.push("/");
      return;
    }
    void loadData();
  }, [status, isAdmin, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [catRes, compRes, prodRes] = await Promise.all([
        fetch("/api/category?includeHidden=true"),
        fetch("/api/company?includeHidden=true"),
        fetch("/api/products?includeHidden=true"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (compRes.ok) setCompanies(await compRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch (err) {
      console.error("Failed to load catalog data", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = useMemo(
    () => filterBySearch(categories, categorySearch, (c) => c.name),
    [categories, categorySearch]
  );

  const filteredCompanies = useMemo(
    () => filterBySearch(companies, companySearch, (c) => c.name + " " + (c.categories ?? []).join(" ")),
    [companies, companySearch]
  );

  const filteredProducts = useMemo(() => {
    let list = products;
    const term = productSearch.trim().toLowerCase();
    if (term) {
      list = list.filter((p) => (p.name ?? "").toLowerCase().includes(term));
    }
    const f = appliedProductFilters;
    if (f) {
      if (f.companyNames.length > 0) {
        const set = new Set(f.companyNames.map((n) => n.toLowerCase()));
        list = list.filter((p) => set.has((p.company ?? "").toLowerCase()));
      }
      if (f.categoryNames.length > 0) {
        const set = new Set(f.categoryNames.map((n) => n.toLowerCase()));
        list = list.filter((p) => set.has((p.category ?? "").toLowerCase()));
      }
      if (f.retailMin !== "") list = list.filter((p) => p.retailPrice >= (f.retailMin as number));
      if (f.retailMax !== "") list = list.filter((p) => p.retailPrice <= (f.retailMax as number));
      if (f.bulkMin !== "") list = list.filter((p) => p.bulkPrice >= (f.bulkMin as number));
      if (f.bulkMax !== "") list = list.filter((p) => p.bulkPrice <= (f.bulkMax as number));
      if (f.consumerMin !== "") list = list.filter((p) => p.consumerPrice >= (f.consumerMin as number));
      if (f.consumerMax !== "") list = list.filter((p) => p.consumerPrice <= (f.consumerMax as number));
    }
    return list;
  }, [products, productSearch, appliedProductFilters]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, displayedCount);
  }, [filteredProducts, displayedCount]);

  const categoryNames = useMemo(() => [...new Set(categories.map((c) => c.name))].sort(), [categories]);
  const companyNames = useMemo(() => [...new Set(companies.map((c) => c.name))].sort(), [companies]);

  // Reset displayed count when search or filters change
  useEffect(() => {
    setDisplayedCount(50);
  }, [productSearch, appliedProductFilters]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!observerTarget.current || displayedProducts.length >= filteredProducts.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayedCount((prev) => Math.min(prev + 50, filteredProducts.length));
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const currentTarget = observerTarget.current;
    observer.observe(currentTarget);

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [displayedProducts.length, filteredProducts.length]);

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      alert("Category name is required");
      return;
    }

    setSaving(true);
    try {
      const method = editingCategoryId ? "PATCH" : "POST";
      const url = editingCategoryId
        ? `/api/category/${editingCategoryId}`
        : "/api/category";

      let imageUrl = categoryForm.imageMode === "url" ? categoryForm.url.trim() : "";

      if (categoryForm.imageMode === "upload" && categoryForm.imageFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", categoryForm.imageFile);
        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          body: uploadForm,
        });
        if (!uploadRes.ok) {
          const error = await uploadRes.json().catch(() => ({}));
          throw new Error(error.error || "Image upload failed");
        }
        const data = await uploadRes.json();
        imageUrl = data.url;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          url: imageUrl,
          image: imageUrl || undefined,
          isHidden: Boolean(categoryForm.isHidden),
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save category");
      }

      const data = await res.json();
      if (editingCategoryId) {
        const updated = data as Category;
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = Array.isArray(data.categories) ? data.categories[0] : data;
        if (created) setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setCategoryForm(emptyCategory);
      setEditingCategoryId(null);
      setModalOpen(false);
      setSelectedCategory(null);
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm("Delete this category? Products linked to it will block deletion.")) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/category/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to delete category");
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name.trim()) {
      alert("Company name is required");
      return;
    }

    setSaving(true);
    try {
      const method = editingCompanyId ? "PATCH" : "POST";
      const url = editingCompanyId
        ? `/api/company/${editingCompanyId}`
        : "/api/company";

      let imageUrl = companyForm.imageMode === "url" ? companyForm.image.trim() : "";

      if (companyForm.imageMode === "upload" && companyForm.imageFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", companyForm.imageFile);
        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          body: uploadForm,
        });
        if (!uploadRes.ok) {
          const error = await uploadRes.json().catch(() => ({}));
          throw new Error(error.error || "Image upload failed");
        }
        const data = await uploadRes.json();
        imageUrl = data.url;
      }

      const payload = {
        name: companyForm.name.trim(),
        image: imageUrl || null,
        categoryIds: companyForm.categoryIds,
        productCount: companyForm.productCount
          ? Number(companyForm.productCount)
          : undefined,
        isHidden: Boolean(companyForm.isHidden),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save company");
      }

      const data = await res.json();
      const categoryNamesFromForm = (companyForm.categoryIds ?? [])
        .map((id) => categories.find((c) => c.id === id)?.name)
        .filter(Boolean) as string[];
      if (editingCompanyId) {
        const updated = { ...data, categories: categoryNamesFromForm };
        setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = Array.isArray(data.companies) ? data.companies[0] : data;
        if (created)
          setCompanies((prev) =>
            [...prev, { ...created, categories: categoryNamesFromForm }].sort((a, b) =>
              a.name.localeCompare(b.name)
            )
          );
      }
      setCompanyForm(emptyCompany);
      setEditingCompanyId(null);
      setModalOpen(false);
      setSelectedCompany(null);
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = async (id: number) => {
    if (!confirm("Delete this company? Existing products linked to it must be removed first.")) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/company/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to delete company");
      }
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setModalOpen(false);
      setSelectedCompany(null);
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      alert("Product name is required");
      return;
    }
    if (!productForm.companyId || !productForm.categoryId) {
      alert("Company and category are required");
      return;
    }

    let imageUrl =
      productForm.imageMode === "url" ? productForm.image.trim() : "";

    if (productForm.imageMode === "upload" && productForm.imageFile) {
      const uploadForm = new FormData();
      uploadForm.append("file", productForm.imageFile);
      const uploadRes = await fetch("/api/uploads", {
        method: "POST",
        body: uploadForm,
      });
      if (!uploadRes.ok) {
        const error = await uploadRes.json().catch(() => ({}));
        throw new Error(error.error || "Image upload failed");
      }
      const data = await uploadRes.json();
      imageUrl = data.url;
    }

    const payload = {
      name: productForm.name.trim(),
      companyId: Number(productForm.companyId),
      categoryId: Number(productForm.categoryId),
      retailPrice: Number(productForm.retailPrice || 0),
      consumerPrice: Number(productForm.consumerPrice || 0),
      bulkPrice: Number(productForm.bulkPrice || 0),
      bulkLimit: productForm.bulkLimit ? Number(productForm.bulkLimit) : null,
      image: imageUrl || undefined,
      description: productForm.description.trim() || null,
      isHidden: Boolean(productForm.isHidden),
    };

    if (
      !Number.isFinite(payload.retailPrice) ||
      !Number.isFinite(payload.consumerPrice) ||
      !Number.isFinite(payload.bulkPrice)
    ) {
      alert("Please enter valid numeric prices");
      return;
    }

    setSaving(true);
    try {
      const method = editingProductId ? "PATCH" : "POST";
      const url = editingProductId
        ? `/api/products/${editingProductId}`
        : "/api/products";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save product");
      }

      const data = await res.json();
      const productPayload = Array.isArray(data.products) ? data.products[0] : data;
      if (editingProductId) {
        setProducts((prev) => prev.map((p) => (p.id === productPayload.id ? productPayload : p)));
      } else if (productPayload) {
        setProducts((prev) => [...prev, productPayload].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setProductForm(emptyProduct);
      setEditingProductId(null);
      setModalOpen(false);
      setSelectedProduct(null);
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm("Delete this product? Orders containing it will block deletion.")) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to delete product");
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setModalOpen(false);
      setSelectedProduct(null);
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Modal handlers
  const openModalForAdd = (type: "category" | "company" | "product") => {
    setModalType(type);
    setSelectedCategory(null);
    setSelectedCompany(null);
    setSelectedProduct(null);
    setEditingCategoryId(null);
    setEditingCompanyId(null);
    setEditingProductId(null);
    if (type === "category") {
      setCategoryForm(emptyCategory);
    } else if (type === "company") {
      setCompanyForm(emptyCompany);
    } else {
      setProductForm(emptyProduct);
    }
    setModalOpen(true);
  };

  const openModalForEdit = (
    type: "category" | "company" | "product",
    item: Category | Company | Product
  ) => {
    setModalType(type);
    if (type === "category") {
      const cat = item as Category;
      setSelectedCategory(cat);
      setEditingCategoryId(cat.id);
      setCategoryForm({
        name: cat.name,
        url: cat.url,
        isHidden: cat.isHidden ?? false,
        imageMode: "url",
        imageFile: null,
      });
    } else if (type === "company") {
      const comp = item as Company;
      setSelectedCompany(comp);
      setEditingCompanyId(comp.id);
      const selectedCategoryIds = (comp.categories || [])
        .map((catName) => categories.find((c) => c.name === catName)?.id)
        .filter((id): id is number => Boolean(id));
      setCompanyForm({
        name: comp.name,
        image: comp.image || "",
        categoryIds: selectedCategoryIds,
        productCount: comp.productCount.toString(),
        isHidden: comp.isHidden ?? false,
        imageMode: "url",
        imageFile: null,
      });
    } else {
      const prod = item as Product;
      setSelectedProduct(prod);
      setEditingProductId(prod.id);
      setProductForm({
        name: prod.name,
        companyId: prod.companyId?.toString() || "",
        categoryId: prod.categoryId?.toString() || "",
        retailPrice: prod.retailPrice.toString(),
        consumerPrice: prod.consumerPrice.toString(),
        bulkPrice: prod.bulkPrice.toString(),
        bulkLimit: prod.bulkLimit?.toString() || "",
        image: prod.image,
        description: prod.description || "",
        isHidden: prod.isHidden ?? false,
        imageMode: "url",
        imageFile: null,
      });
    }
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setModalType(null);
    setSelectedCategory(null);
    setSelectedCompany(null);
    setSelectedProduct(null);
    setEditingCategoryId(null);
    setEditingCompanyId(null);
    setEditingProductId(null);
  };

  const handleModalDelete = () => {
    if (modalType === "category" && selectedCategory) {
      deleteCategory(selectedCategory.id);
    } else if (modalType === "company" && selectedCompany) {
      deleteCompany(selectedCompany.id);
    } else if (modalType === "product" && selectedProduct) {
      deleteProduct(selectedProduct.id);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-gray-100" />
        <div className="h-96 rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    return (
      <div className="text-center text-red-600">
        Access denied. Admins only.
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 p-3 sm:p-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Catalog</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Create, edit, or delete products, categories, and companies.
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          className="w-full sm:w-auto rounded-lg border border-gray-200 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Refresh
        </button>
      </div>

      {/* Categories */}
      <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Categories</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Add a new category or edit an existing one.
            </p>
          </div>
          <span className="text-xs text-gray-500">
            {filteredCategories.length} of {categories.length}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <input
            type="text"
            placeholder="Search categories..."
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            className="w-full sm:w-56 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            onClick={() => openModalForAdd("category")}
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add Category
          </button>
        </div>

        <div className="mt-4 overflow-x-auto -mx-3 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600 hidden sm:table-cell">URL</th>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600">Products</th>
                <th className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCategories.map((category) => (
                <tr
                  key={category.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    selectedCategory?.id === category.id ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-2 sm:px-3 py-2 font-medium">
                    {category.name}
                    {category.isHidden && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                        Hidden
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-3 py-2 text-gray-600 hidden sm:table-cell">{category.url}</td>
                  <td className="px-2 sm:px-3 py-2 text-gray-600">{category.productCount}</td>
                  <td className="px-2 sm:px-3 py-2 text-right">
                    <button
                      className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                      onClick={() => openModalForEdit("category", category)}
                      aria-label="Actions"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCategories.length === 0 && (
                <tr>
                  <td className="px-2 sm:px-3 py-3 text-sm text-gray-500" colSpan={4}>
                    {categories.length === 0 ? "No categories yet." : "No categories match the search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Companies */}
      <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Companies</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Link companies to categories for better browsing.
            </p>
          </div>
          <span className="text-xs text-gray-500">
            {filteredCompanies.length} of {companies.length}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <input
            type="text"
            placeholder="Search companies..."
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            className="w-full sm:w-56 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            onClick={() => openModalForAdd("company")}
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add Company
          </button>
        </div>

        <div className="mt-4 overflow-x-auto -mx-3 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600 hidden md:table-cell">Categories</th>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600">Products</th>
                <th className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCompanies.map((company) => (
                <tr
                  key={company.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    selectedCompany?.id === company.id ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-2 sm:px-3 py-2 font-medium text-gray-900">
                    {company.name}
                    {company.isHidden && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                        Hidden
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-3 py-2 text-gray-600 hidden md:table-cell">
                    {(company.categories || []).join(", ") || "—"}
                  </td>
                  <td className="px-2 sm:px-3 py-2 text-gray-600">{company.productCount}</td>
                  <td className="px-2 sm:px-3 py-2 text-right">
                    <button
                      className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                      onClick={() => openModalForEdit("company", company)}
                      aria-label="Actions"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCompanies.length === 0 && (
                <tr>
                  <td className="px-2 sm:px-3 py-3 text-sm text-gray-500" colSpan={4}>
                    {companies.length === 0 ? "No companies yet." : "No companies match the search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Products */}
      <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Products</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Add, edit, or remove products from your catalog.
            </p>
          </div>
          <span className="text-xs text-gray-500">
            Showing {displayedProducts.length} of {filteredProducts.length} {productSearch || appliedProductFilters ? "results" : "products"}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            type="text"
            placeholder="Search products..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="w-full sm:flex-1 sm:min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            type="button"
            onClick={() => {
              setDraftProductFilters(appliedProductFilters ?? emptyProductFilters());
              setFilterModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 w-full sm:w-auto shrink-0"
          >
            <Filter className="w-4 h-4 shrink-0" />
            Filter
          </button>
          <button
            onClick={() => openModalForAdd("product")}
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 w-full sm:w-auto shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add Product
          </button>
        </div>

        <div className="mt-4 overflow-x-auto -mx-3 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600">Product</th>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600 hidden sm:table-cell">Company</th>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600 hidden md:table-cell">Category</th>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600 hidden lg:table-cell">Consumer</th>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600 hidden lg:table-cell">Retail</th>
                <th className="px-2 sm:px-3 py-2 text-left font-semibold text-gray-600 hidden lg:table-cell">Bulk</th>
                <th className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayedProducts.map((product) => (
                <tr
                  key={product.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    selectedProduct?.id === product.id ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-2 sm:px-3 py-2 font-medium text-gray-900">
                    {product.name}
                    {product.isHidden && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                        Hidden
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-3 py-2 text-gray-700 hidden sm:table-cell">{product.company}</td>
                  <td className="px-2 sm:px-3 py-2 text-gray-700 hidden md:table-cell">{product.category}</td>
                  <td className="px-2 sm:px-3 py-2 text-gray-700 hidden lg:table-cell">Rs {product.consumerPrice}</td>
                  <td className="px-2 sm:px-3 py-2 text-gray-700 hidden lg:table-cell">Rs {product.retailPrice}</td>
                  <td className="px-2 sm:px-3 py-2 text-gray-700 hidden lg:table-cell">Rs {product.bulkPrice}</td>
                  <td className="px-2 sm:px-3 py-2 text-right">
                    <button
                      className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                      onClick={() => openModalForEdit("product", product)}
                      aria-label="Actions"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>
                  </td>
                </tr>
              ))}
              {displayedProducts.length === 0 && (
                <tr>
                  <td className="px-2 sm:px-3 py-3 text-sm text-gray-500" colSpan={7}>
                    No products match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Observer target for lazy loading */}
          {displayedProducts.length < filteredProducts.length && (
            <div ref={observerTarget} className="h-10 w-full flex items-center justify-center py-4">
              <div className="text-sm text-gray-500">Loading more products...</div>
            </div>
          )}
        </div>
      </section>

      {/* Inventory Filters Modal */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50" aria-hidden onClick={() => setFilterModalOpen(false)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="shrink-0 border-b border-gray-200 px-4 py-3 sm:px-6">
              <h3 className="text-lg font-semibold text-gray-900">Filter Products</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Select multiple companies/categories and optional price or quantity ranges.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {/* Companies */}
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 sm:p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Companies</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {companyNames.map((name) => (
                      <label key={name} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draftProductFilters.companyNames.includes(name)}
                          onChange={() => {
                            setDraftProductFilters((prev) => ({
                              ...prev,
                              companyNames: prev.companyNames.includes(name)
                                ? prev.companyNames.filter((n) => n !== name)
                                : [...prev.companyNames, name],
                            }));
                          }}
                          className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                        />
                        <span className="text-sm text-gray-800">{name}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftProductFilters((prev) => ({ ...prev, companyNames: [] }))}
                    className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Clear Companies
                  </button>
                </div>
                {/* Categories */}
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 sm:p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Categories</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {categoryNames.map((name) => (
                      <label key={name} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draftProductFilters.categoryNames.includes(name)}
                          onChange={() => {
                            setDraftProductFilters((prev) => ({
                              ...prev,
                              categoryNames: prev.categoryNames.includes(name)
                                ? prev.categoryNames.filter((n) => n !== name)
                                : [...prev.categoryNames, name],
                            }));
                          }}
                          className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                        />
                        <span className="text-sm text-gray-800">{name}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftProductFilters((prev) => ({ ...prev, categoryNames: [] }))}
                    className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Clear Categories
                  </button>
                </div>
                {/* Ranges */}
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 sm:p-4 space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Ranges</h4>
                  {[
                    { label: "Retail Price", minKey: "retailMin" as const, maxKey: "retailMax" as const },
                    { label: "Bulk Price", minKey: "bulkMin" as const, maxKey: "bulkMax" as const },
                    { label: "Consumer Price", minKey: "consumerMin" as const, maxKey: "consumerMax" as const },
                    { label: "Quantity", minKey: "quantityMin" as const, maxKey: "quantityMax" as const },
                  ].map(({ label, minKey, maxKey }) => (
                    <div key={label}>
                      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Min"
                          min={0}
                          step={minKey.includes("Price") ? 0.01 : 1}
                          value={draftProductFilters[minKey] === "" ? "" : draftProductFilters[minKey]}
                          onChange={(e) => {
                            const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                            if (v !== "" && Number.isNaN(v)) return;
                            setDraftProductFilters((prev) => ({ ...prev, [minKey]: v }));
                          }}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          min={0}
                          step={maxKey.includes("Price") ? 0.01 : 1}
                          value={draftProductFilters[maxKey] === "" ? "" : draftProductFilters[maxKey]}
                          onChange={(e) => {
                            const v = e.target.value === "" ? "" : parseFloat(e.target.value);
                            if (v !== "" && Number.isNaN(v)) return;
                            setDraftProductFilters((prev) => ({ ...prev, [maxKey]: v }));
                          }}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-gray-200 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setDraftProductFilters(emptyProductFilters())}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setAppliedProductFilters({ ...draftProductFilters });
                  setFilterModalOpen(false);
                }}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <CatalogEditModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        type={modalType}
        categoryData={selectedCategory}
        companyData={selectedCompany}
        productData={selectedProduct}
        categoryForm={categoryForm}
        companyForm={companyForm}
        productForm={productForm}
        onCategoryFormChange={setCategoryForm}
        onCompanyFormChange={setCompanyForm}
        onProductFormChange={setProductForm}
        onSave={(e) => {
          if (modalType === "category") saveCategory(e);
          else if (modalType === "company") saveCompany(e);
          else if (modalType === "product") saveProduct(e);
        }}
        onDelete={handleModalDelete}
        saving={saving}
        categories={categories}
        companies={companies}
      />
    </div>
  );
}


