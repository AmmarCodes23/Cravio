"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MarketingBanner = {
  id: number;
  imageUrl: string;
  title: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const RECOMMENDED_SIZE = "1600×420 px";
const TARGET_ASPECT = 1600 / 420;

export default function BannersAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [banners, setBanners] = useState<MarketingBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [aspectWarning, setAspectWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = (session?.user as { role?: string } | undefined)?.role;
  const allowed = role === "ADMIN" || role === "EMPLOYEE";

  const loadBanners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/banners?includeInactive=true");
      if (!res.ok) throw new Error("Failed to load banners");
      const data = await res.json();
      setBanners(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load banners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || !allowed) {
      router.push("/");
      return;
    }
    void loadBanners();
  }, [status, session, allowed, router, loadBanners]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setSortOrder("0");
    setIsActive(true);
    setImageUrl("");
    setImageFile(null);
    setAspectWarning(null);
    setError(null);
  };

  const startEdit = (b: MarketingBanner) => {
    setEditingId(b.id);
    setTitle(b.title ?? "");
    setSortOrder(String(b.sortOrder ?? 0));
    setIsActive(b.isActive);
    setImageUrl(b.imageUrl);
    setImageFile(null);
    setAspectWarning(null);
    setError(null);
  };

  const onFileChange = (file: File | null) => {
    setImageFile(file);
    setAspectWarning(null);
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const aspect = img.width / img.height;
      if (Math.abs(aspect - TARGET_ASPECT) / TARGET_ASPECT > 0.15) {
        setAspectWarning(
          `Image is ${img.width}×${img.height}. Recommended ${RECOMMENDED_SIZE} (~3.8:1). It will still display with object-cover.`
        );
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const resolveImageUrl = async (): Promise<string | null> => {
    if (imageFile) {
      const form = new FormData();
      form.append("file", imageFile);
      const uploadRes = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !data.url) {
        throw new Error(data.error || "Image upload failed");
      }
      return data.url as string;
    }
    const trimmed = imageUrl.trim();
    return trimmed || null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const resolvedUrl = await resolveImageUrl();
      if (!resolvedUrl) {
        setError("Upload an image or paste an image URL.");
        return;
      }
      const payload = {
        imageUrl: resolvedUrl,
        title: title.trim() || null,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      };

      const res = editingId
        ? await fetch(`/api/banners/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/banners", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      resetForm();
      await loadBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this banner?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/banners/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (editingId === id) resetForm();
      await loadBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const toggleActive = async (b: MarketingBanner) => {
    setError(null);
    try {
      const res = await fetch(`/api/banners/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      await loadBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  if (status === "loading" || !allowed) {
    return (
      <div className="p-8 text-slate-600">
        {status === "loading" ? "Loading…" : "Redirecting…"}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Marketing banners</h1>
      <p className="text-sm text-slate-600 mb-6">
        Homepage carousel images. Recommended size:{" "}
        <span className="font-semibold text-slate-800">{RECOMMENDED_SIZE}</span> (~3.8:1).
        Images are shown with object-cover inside the fixed carousel height.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {editingId ? `Edit banner #${editingId}` : "Add banner"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Alt text / admin label"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sort order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-slate-700">Active on homepage</span>
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Upload image (recommended)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          {aspectWarning && (
            <p className="mt-1 text-xs text-amber-700">{aspectWarning}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Or paste image URL
          </label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="https://…"
          />
        </div>
        {(imageFile || imageUrl) && (
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-[120px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-teal-700 text-white px-4 py-2 rounded-lg hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId ? "Update" : "Create"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-300"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2 className="text-lg font-semibold text-slate-900 mb-3">All banners</h2>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : banners.length === 0 ? (
        <p className="text-slate-500">No banners yet. Add one above.</p>
      ) : (
        <ul className="space-y-3">
          {banners.map((b) => (
            <li
              key={b.id}
              className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="w-full sm:w-48 h-24 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imageUrl} alt={b.title || `Banner ${b.id}`} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {b.title || `Banner #${b.id}`}
                </p>
                <p className="text-xs text-slate-500">
                  Sort {b.sortOrder} · {b.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void toggleActive(b)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
                >
                  {b.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-white hover:bg-slate-900"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(b.id)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
