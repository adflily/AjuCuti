"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  createLeaveTypeAction,
  deleteLeaveTypeAction,
  updateLeaveTypeAction,
} from "@/actions/admin";

// CMS Jenis Cuti (/admin/leave-types)
// Saat Admin membuat jenis cuti baru, kolom code dibuat otomatis dari nama (kapital, spasi -> underscore).

const EMPTY_FORM = {
  name: "",
  description: "",
  maxDaysPerRequest: "",
  quotaPerYear: "",
  minNoticeDays: "0",
  maxBackdateDays: "0",
  deductsAnnualQuota: false,
  requiresAttachment: false,
  isActive: true,
};

function previewAutoCode(name) {
  return String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

export default function AdminLeaveTypesClient({
  leaveTypes = [],
  pagination,
  initialFilters,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialFilters.search || "");
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, startSaveTransition] = useTransition();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const generatedCodePreview = useMemo(
    () => previewAutoCode(formValues.name),
    [formValues.name]
  );

  function updateQueryParam(updates) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateQueryParam({ search: searchInput.trim() });
  }

  function handleResetFilters() {
    setSearchInput("");
    router.push(pathname);
  }

  function openCreateModal() {
    setEditingType(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function openEditModal(lt) {
    setEditingType(lt);
    setFormValues({
      name: lt.name || "",
      description: lt.description || "",
      maxDaysPerRequest:
        lt.max_days_per_request !== null && lt.max_days_per_request !== undefined
          ? String(lt.max_days_per_request)
          : "",
      quotaPerYear:
        lt.quota_per_year !== null && lt.quota_per_year !== undefined
          ? String(lt.quota_per_year)
          : "",
      minNoticeDays: String(lt.min_notice_days ?? 0),
      maxBackdateDays: String(lt.max_backdate_days ?? 0),
      deductsAnnualQuota: Boolean(lt.deducts_annual_quota),
      requiresAttachment: Boolean(lt.requires_attachment),
      isActive: Boolean(lt.is_active),
    });
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function handleFieldChange(key, value) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSaveSubmit(event) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    startSaveTransition(async () => {
      const payload = {
        name: formValues.name,
        description: formValues.description,
        maxDaysPerRequest:
          formValues.maxDaysPerRequest.trim() === ""
            ? null
            : Number(formValues.maxDaysPerRequest),
        quotaPerYear:
          formValues.quotaPerYear.trim() === ""
            ? null
            : Number(formValues.quotaPerYear),
        minNoticeDays: Number(formValues.minNoticeDays || 0),
        maxBackdateDays: Number(formValues.maxBackdateDays || 0),
        deductsAnnualQuota: formValues.deductsAnnualQuota,
        requiresAttachment: formValues.requiresAttachment,
        isActive: formValues.isActive,
      };

      const result = editingType
        ? await updateLeaveTypeAction({ ...payload, id: editingType.id })
        : await createLeaveTypeAction(payload);

      if (result?.error) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors || {});
        return;
      }

      setIsFormOpen(false);
      setFeedback({
        type: "success",
        message: result.message || "Jenis cuti berhasil disimpan.",
      });
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;

    startDeleteTransition(async () => {
      const result = await deleteLeaveTypeAction(deleteTarget.id);
      setDeleteTarget(null);

      if (result?.error) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      setFeedback({
        type: "success",
        message: result.message || "Jenis cuti berhasil dihapus.",
      });
      router.refresh();
    });
  }

  const columns = [
    {
      key: "name",
      header: "Jenis Cuti",
      render: (row) => (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-900">{row.name}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700">
              {row.code}
            </span>
            {row.is_system && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                Sistem
              </span>
            )}
          </div>
          {row.description && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "rules",
      header: "Aturan Durasi & Pemberitahuan",
      render: (row) => (
        <div className="text-xs text-slate-700 space-y-0.5">
          <p>
            Maks/pengajuan:{" "}
            <strong>
              {row.max_days_per_request !== null
                ? `${row.max_days_per_request} hari`
                : "Tanpa batas"}
            </strong>
          </p>
          <p>
            Kuota/tahun:{" "}
            <strong>
              {row.quota_per_year !== null
                ? `${row.quota_per_year} hari`
                : "Ikut aturan kuota"}
            </strong>
          </p>
          <p>
            Min H-{row.min_notice_days ?? 0} &middot; Mundur maks{" "}
            {row.max_backdate_days ?? 0} hari
          </p>
        </div>
      ),
    },
    {
      key: "flags",
      header: "Ketentuan",
      render: (row) => (
        <div className="flex flex-col gap-1 text-xs">
          <span
            className={`inline-flex w-fit rounded-full px-2 py-0.5 font-medium ${
              row.deducts_annual_quota
                ? "bg-amber-50 text-amber-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {row.deducts_annual_quota
              ? "Potong Kuota Tahunan"
              : "Tidak Potong Kuota"}
          </span>
          <span
            className={`inline-flex w-fit rounded-full px-2 py-0.5 font-medium ${
              row.requires_attachment
                ? "bg-purple-50 text-purple-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {row.requires_attachment ? "Wajib Lampiran" : "Lampiran Opsional"}
          </span>
        </div>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (row) => (
        <StatusBadge status={row.is_active ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      isAction: true,
      render: (row) => {
        const canDelete = !row.is_system && row.usage_count === 0;
        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => openEditModal(row)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteTarget(row)}
                className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Hapus
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const hasActiveFilter =
    initialFilters.status !== "all" ||
    initialFilters.deducts !== "all" ||
    Boolean(initialFilters.search) ||
    initialFilters.sort !== "system_first";

  return (
    <div className="space-y-6">
      {feedback.message && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: "", message: "" })}
            aria-label="Tutup pemberitahuan"
            className="min-h-[44px] min-w-[44px] -mr-2 inline-flex items-center justify-center rounded-lg hover:bg-black/5"
          >
            &times;
          </button>
        </div>
      )}

      {/* Toolbar filter & sortir */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Jenis Cuti
            </h2>
            <p className="text-xs text-slate-500">
              Seluruh validasi pengajuan cuti membaca aturan dinamis dari tabel ini.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Tambah Jenis Cuti
          </button>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div className="flex gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama atau kode cuti..."
              aria-label="Cari jenis cuti"
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="submit"
              className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cari
            </button>
          </div>

          <select
            value={initialFilters.status}
            onChange={(e) => updateQueryParam({ status: e.target.value })}
            aria-label="Filter status"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <select
            value={initialFilters.deducts}
            onChange={(e) => updateQueryParam({ deducts: e.target.value })}
            aria-label="Filter potong kuota"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Kebijakan Kuota</option>
            <option value="yes">Potong Kuota Tahunan</option>
            <option value="no">Tidak Potong Kuota</option>
          </select>

          <select
            value={initialFilters.sort}
            onChange={(e) => updateQueryParam({ sort: e.target.value })}
            aria-label="Urutkan jenis cuti"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="system_first">Urutkan: Bawaan Sistem Dulu</option>
            <option value="name_asc">Urutkan: Nama (A–Z)</option>
            <option value="name_desc">Urutkan: Nama (Z–A)</option>
            <option value="newest">Urutkan: Terbaru Dibuat</option>
          </select>
        </form>

        {hasActiveFilter && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] inline-flex items-center rounded-lg px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={leaveTypes}
        emptyTitle="Jenis cuti tidak ditemukan"
        emptyDescription="Tambahkan jenis cuti baru atau ubah filter pencarian Anda."
      />

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
      />

      {/* Modal Tambah / Edit Jenis Cuti */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingType ? "Edit Jenis Cuti" : "Tambah Jenis Cuti Baru"}
        description={
          editingType
            ? `Kode permanen: ${editingType.code}`
            : "Kode jenis cuti dibuat otomatis dari nama (kapital, spasi menjadi garis bawah)."
        }
        size="lg"
        preventClose={isSaving}
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              disabled={isSaving}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              form="admin-leavetype-form"
              disabled={isSaving}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        }
      >
        <form
          id="admin-leavetype-form"
          onSubmit={handleSaveSubmit}
          className="space-y-4"
          noValidate
        >
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nama Jenis Cuti <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formValues.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder="contoh: Cuti Haji"
              required
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
            )}

            {!editingType && generatedCodePreview && (
              <p className="mt-1.5 text-xs text-slate-500">
                Pratinjau kode otomatis:{" "}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-800">
                  {generatedCodePreview}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Deskripsi
            </label>
            <textarea
              rows={2}
              value={formValues.description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Penjelasan singkat aturan jenis cuti..."
              className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Maks Hari per Pengajuan{" "}
                <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <input
                type="number"
                min={1}
                value={formValues.maxDaysPerRequest}
                onChange={(e) =>
                  handleFieldChange("maxDaysPerRequest", e.target.value)
                }
                placeholder="Kosongkan jika tanpa batas"
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Kuota Khusus per Tahun{" "}
                <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <input
                type="number"
                min={1}
                value={formValues.quotaPerYear}
                onChange={(e) =>
                  handleFieldChange("quotaPerYear", e.target.value)
                }
                placeholder="Kosongkan jika tanpa batas khusus"
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Minimal Pemberitahuan (H-hari)
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={formValues.minNoticeDays}
                onChange={(e) =>
                  handleFieldChange("minNoticeDays", e.target.value)
                }
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Maks Pengajuan Mundur (hari)
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={formValues.maxBackdateDays}
                onChange={(e) =>
                  handleFieldChange("maxBackdateDays", e.target.value)
                }
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
            <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formValues.deductsAnnualQuota}
                onChange={(e) =>
                  handleFieldChange("deductsAnnualQuota", e.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Memotong kuota cuti tahunan karyawan (deducts_annual_quota)</span>
            </label>

            <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formValues.requiresAttachment}
                onChange={(e) =>
                  handleFieldChange("requiresAttachment", e.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Wajib mengunggah dokumen lampiran (requires_attachment)</span>
            </label>

            <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formValues.isActive}
                onChange={(e) =>
                  handleFieldChange("isActive", e.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Jenis cuti aktif (tampil pada form pengajuan)</span>
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Jenis Cuti?"
        description={
          deleteTarget
            ? `Anda akan menghapus jenis cuti "${deleteTarget.name}" (${deleteTarget.code}).`
            : ""
        }
        confirmLabel="Ya, Hapus"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}