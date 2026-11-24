"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  createHolidayAction,
  deleteHolidayAction,
  updateHolidayAction,
} from "@/actions/admin";

// CMS Hari Libur Nasional & Cuti Bersama (/admin/holidays)

function formatHolidayFullDate(dateStr) {
  const match = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { formatted: dateStr || "-", isWeekend: false };

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  const day = date.getUTCDay();
  const isWeekend = day === 0 || day === 6;

  const formatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

  return { formatted, isWeekend };
}

const EMPTY_FORM = {
  holidayDate: "",
  name: "",
  isJointLeave: false,
};

export default function AdminHolidaysClient({
  holidays = [],
  availableYears = [],
  pagination,
  initialFilters,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialFilters.search || "");
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, startSaveTransition] = useTransition();

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, startDeleteTransition] = useTransition();

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
    setEditingHoliday(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function openEditModal(item) {
    setEditingHoliday(item);
    setFormValues({
      holidayDate: item.holiday_date || "",
      name: item.name || "",
      isJointLeave: Boolean(item.is_joint_leave),
    });
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function handleSaveSubmit(event) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    startSaveTransition(async () => {
      const payload = {
        holidayDate: formValues.holidayDate,
        name: formValues.name,
        isJointLeave: formValues.isJointLeave,
      };

      const result = editingHoliday
        ? await updateHolidayAction({ ...payload, id: editingHoliday.id })
        : await createHolidayAction(payload);

      if (result?.error) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors || {});
        return;
      }

      setIsFormOpen(false);
      setFeedback({
        type: "success",
        message: result.message || "Data hari libur berhasil disimpan.",
      });
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;

    startDeleteTransition(async () => {
      const result = await deleteHolidayAction(deleteTarget.id);
      setDeleteTarget(null);

      if (result?.error) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      setFeedback({
        type: "success",
        message: result.message || "Hari libur berhasil dihapus.",
      });
      router.refresh();
    });
  }

  const columns = [
    {
      key: "holiday_date",
      header: "Tanggal",
      render: (row) => {
        const { formatted, isWeekend } = formatHolidayFullDate(row.holiday_date);
        return (
          <div>
            <p className="font-semibold text-slate-900 whitespace-nowrap">
              {formatted}
            </p>
            {isWeekend && (
              <span className="text-[11px] font-medium text-slate-500">
                Jatuh pada akhir pekan
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "name",
      header: "Nama Hari Libur",
      render: (row) => (
        <span className="font-medium text-slate-900">{row.name}</span>
      ),
    },
    {
      key: "is_joint_leave",
      header: "Kategori",
      render: (row) => (
        <StatusBadge
          status={row.is_joint_leave ? "joint_leave" : "national_holiday"}
        />
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      isAction: true,
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Hapus
          </button>
        </div>
      ),
    },
  ];

  const hasActiveFilter =
    initialFilters.year !== "all" ||
    initialFilters.type !== "all" ||
    Boolean(initialFilters.search) ||
    initialFilters.sort !== "date_asc";

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
              Daftar Hari Libur &amp; Cuti Bersama
            </h2>
            <p className="text-xs text-slate-500">
              Tanggal di daftar ini otomatis dikecualikan dari perhitungan hari kerja pengajuan cuti.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Tambah Hari Libur
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
              placeholder="Cari nama hari libur..."
              aria-label="Cari hari libur"
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
            value={initialFilters.year}
            onChange={(e) => updateQueryParam({ year: e.target.value })}
            aria-label="Filter tahun"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Tahun</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>

          <select
            value={initialFilters.type}
            onChange={(e) => updateQueryParam({ type: e.target.value })}
            aria-label="Filter kategori"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Kategori</option>
            <option value="national">Libur Nasional</option>
            <option value="joint">Cuti Bersama</option>
          </select>

          <select
            value={initialFilters.sort}
            onChange={(e) => updateQueryParam({ sort: e.target.value })}
            aria-label="Urutkan hari libur"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="date_asc">Urutkan: Tanggal Terdekat</option>
            <option value="date_desc">Urutkan: Tanggal Terbaru</option>
            <option value="name_asc">Urutkan: Nama (A–Z)</option>
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
        data={holidays}
        emptyTitle="Belum ada data hari libur"
        emptyDescription="Tambahkan hari libur nasional atau cuti bersama untuk perhitungan hari kerja."
      />

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
      />

      {/* Modal Tambah / Edit Hari Libur */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingHoliday ? "Edit Hari Libur" : "Tambah Hari Libur Baru"}
        size="sm"
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
              form="admin-holiday-form"
              disabled={isSaving}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        }
      >
        <form
          id="admin-holiday-form"
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
              Tanggal <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={formValues.holidayDate}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  holidayDate: e.target.value,
                }))
              }
              required
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            {fieldErrors.holidayDate && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.holidayDate}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nama Hari Libur <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formValues.name}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="contoh: Hari Kemerdekaan RI"
              maxLength={100}
              required
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formValues.isJointLeave}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  isJointLeave: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Tandai sebagai Cuti Bersama (is_joint_leave)</span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Hari Libur?"
        description={
          deleteTarget
            ? `Anda akan menghapus "${deleteTarget.name}" (${deleteTarget.holiday_date}).`
            : ""
        }
        confirmLabel="Ya, Hapus"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}