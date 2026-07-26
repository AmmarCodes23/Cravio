"use client";

import { X } from "lucide-react";
import type {
  CatalogCategory as Category,
  CatalogCompany as Company,
  CatalogProduct as Product,
  CategoryFormState,
  CompanyFormState,
  ProductFormState,
} from "@/app/Data/database";

type ModalType = "category" | "company" | "product" | null;

interface CatalogEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ModalType;
  categoryData?: Category | null;
  companyData?: Company | null;
  productData?: Product | null;
  categoryForm: CategoryFormState;
  companyForm: CompanyFormState;
  productForm: ProductFormState;
  onCategoryFormChange: (form: CategoryFormState) => void;
  onCompanyFormChange: (form: CompanyFormState) => void;
  onProductFormChange: (form: ProductFormState) => void;
  onSave: (e: React.FormEvent) => void;
  onDelete: () => void;
  saving: boolean;
  categories: Category[];
  companies: Company[];
}

export default function CatalogEditModal({
  isOpen,
  onClose,
  type,
  categoryData,
  companyData,
  productData,
  categoryForm,
  companyForm,
  productForm,
  onCategoryFormChange,
  onCompanyFormChange,
  onProductFormChange,
  onSave,
  onDelete,
  saving,
  categories,
  companies,
}: CatalogEditModalProps) {
  if (!isOpen || !type) return null;

  const isEditing = Boolean(
    (type === "category" && categoryData) ||
    (type === "company" && companyData) ||
    (type === "product" && productData)
  );

  const getTitle = () => {
    if (!isEditing) {
      return type === "category" ? "Add Category" : type === "company" ? "Add Company" : "Add Product";
    }
    return type === "category" ? "Edit Category" : type === "company" ? "Edit Company" : "Edit Product";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={onSave} className="flex-1 overflow-y-auto p-6">
          {type === "category" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter category name"
                  value={categoryForm.name}
                  onChange={(e) =>
                    onCategoryFormChange({ ...categoryForm, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Image Mode
                </label>
                <select
                  value={categoryForm.imageMode || "url"}
                  onChange={(e) =>
                    onCategoryFormChange({
                      ...categoryForm,
                      imageMode: e.target.value as "url" | "upload",
                      imageFile: null,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="url">Image URL</option>
                  <option value="upload">Upload Image</option>
                </select>
              </div>

              {categoryForm.imageMode === "url" ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    value={categoryForm.url}
                    onChange={(e) =>
                      onCategoryFormChange({ ...categoryForm, url: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Upload Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      onCategoryFormChange({
                        ...categoryForm,
                        imageFile: e.target.files?.[0] || null,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={categoryForm.isHidden ?? false}
                  onChange={(e) =>
                    onCategoryFormChange({ ...categoryForm, isHidden: e.target.checked })
                  }
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm font-semibold text-gray-700">Hide from Website & App</span>
              </label>
            </div>
          )}

          {type === "company" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter company name"
                  value={companyForm.name}
                  onChange={(e) =>
                    onCompanyFormChange({ ...companyForm, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Image Mode
                </label>
                <select
                  value={companyForm.imageMode}
                  onChange={(e) =>
                    onCompanyFormChange({
                      ...companyForm,
                      imageMode: e.target.value as "url" | "upload",
                      imageFile: null,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="url">Image URL</option>
                  <option value="upload">Upload Image</option>
                </select>
              </div>

              {companyForm.imageMode === "url" ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    value={companyForm.image}
                    onChange={(e) =>
                      onCompanyFormChange({ ...companyForm, image: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Upload Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      onCompanyFormChange({
                        ...companyForm,
                        imageFile: e.target.files?.[0] || null,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Product Count (optional)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={companyForm.productCount}
                  onChange={(e) =>
                    onCompanyFormChange({ ...companyForm, productCount: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Categories
                </label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-300 p-3 space-y-2">
                  {categories.length === 0 ? (
                    <p className="text-sm text-gray-500">Create a category first.</p>
                  ) : (
                    categories.map((category) => {
                      const checked = companyForm.categoryIds.includes(category.id);
                      return (
                        <label
                          key={category.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              onCompanyFormChange({
                                ...companyForm,
                                categoryIds: checked
                                  ? companyForm.categoryIds.filter((id) => id !== category.id)
                                  : [...companyForm.categoryIds, category.id],
                              });
                            }}
                            className="w-4 h-4 text-primary rounded focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">{category.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={companyForm.isHidden ?? false}
                  onChange={(e) =>
                    onCompanyFormChange({ ...companyForm, isHidden: e.target.checked })
                  }
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm font-semibold text-gray-700">Hide from Website & App</span>
              </label>
            </div>
          )}

          {type === "product" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter product name"
                  value={productForm.name}
                  onChange={(e) =>
                    onProductFormChange({ ...productForm, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Company <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={productForm.companyId}
                    onChange={(e) =>
                      onProductFormChange({ ...productForm, companyId: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="">Select company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) =>
                      onProductFormChange({ ...productForm, categoryId: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Image Mode
                </label>
                <select
                  value={productForm.imageMode}
                  onChange={(e) =>
                    onProductFormChange({
                      ...productForm,
                      imageMode: e.target.value as "url" | "upload",
                      imageFile: null,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="url">Image URL</option>
                  <option value="upload">Upload Image</option>
                </select>
              </div>

              {productForm.imageMode === "url" ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    value={productForm.image}
                    onChange={(e) =>
                      onProductFormChange({ ...productForm, image: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Upload Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      onProductFormChange({
                        ...productForm,
                        imageFile: e.target.files?.[0] || null,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Retail Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={productForm.retailPrice}
                    onChange={(e) =>
                      onProductFormChange({ ...productForm, retailPrice: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Consumer Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={productForm.consumerPrice}
                    onChange={(e) =>
                      onProductFormChange({ ...productForm, consumerPrice: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Bulk Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={productForm.bulkPrice}
                    onChange={(e) =>
                      onProductFormChange({ ...productForm, bulkPrice: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Bulk Limit (optional)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={productForm.bulkLimit}
                  onChange={(e) =>
                    onProductFormChange({ ...productForm, bulkLimit: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  placeholder="Enter product description"
                  value={productForm.description}
                  onChange={(e) =>
                    onProductFormChange({ ...productForm, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={3}
                />
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productForm.isHidden ?? false}
                  onChange={(e) =>
                    onProductFormChange({ ...productForm, isHidden: e.target.checked })
                  }
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm font-semibold text-gray-700">Hide from Website & App</span>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 mt-6 pt-6 border-t border-gray-200">
            {isEditing && (
              <button
                type="button"
                onClick={onDelete}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : isEditing ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
