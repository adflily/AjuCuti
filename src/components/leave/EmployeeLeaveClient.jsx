"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import StatCard, { StatCardGrid } from "@/components/ui/StatCard";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LeaveDetailModal from "@/components/leave/LeaveDetailModal";
import LeaveRequestFormModal from "@/components/leave/LeaveRequestFormModal";
import { cancelLeaveRequestAction } from "@/actions/leaves";
import { formatDateId, formatDays } from "@/lib/dateUtils";

// Komponen interaktif halaman /employee (dashboard kuota, filter, sortir, pengajuan & pembatalan)

export default function EmployeeLeaveClient({
  quota,
  leaves = [],
  pagination,
  leaveTypes = [],
  holidayDates = [],
  handoverCandidates = [],
  initialFilters,
  defaultAddress = "",
  defaultPhone = "",
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialFilters.search || "");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [detailLeave, setDetailLeave] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [isCancelling, startCancelTransition] = useTransition();

  function updateQueryParam(updates) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    // Kembali ke halaman 1 setiap kali filter atau sortir berubah
    params.delete("page");
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateQueryParam({ search: searchInput.trim() });
  }

  function handleResetFilters() {
    setSearchInput("");
    router.push(pathname);
  }

  function openCancelDialog(leave) {
    setCancelTarget(leave);
    setCancelReason("");
    setCancelError("");
  }

  function handleConfirmCancel() {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      setCancelError("Alasan pembatalan minimal 3 karakter.");
      return;
    }

    setCancelError("");
    startCancelTransition(async () => {
      const result = await cancelLeaveRequestAction({
        requestId: cancelTarget.id,
        cancelReason: cancelReason.trim(),
      });

      if (result?.error) {
        setCancelError(result.error);
        return;
      }

      setCancelTarget(null);
      setDetailLeave(null);
      setFeedback({
        type: "success",
        message: result.message || "Pengajuan cuti berhasil dibatalkan.",
      });
      router.refresh();
    });
  }

  const columns = [
    {
      key: "leave_type_name",
      header: "Jenis Cuti",
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.leave_type_name}</p>
          <p className="text-xs text-slate-500">
            Diajukan {formatDateId(row.request_date)}
          </p>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Tanggal",
      render: (row) => (
        <span className="whitespace-nowrap">
          {row.start_date === row.end_date
            ? formatDateId(row.start_date)
            : `${formatDateId(row.start_date)} – ${formatDateId(row.end_date)}`}
        </span>
      ),
    },
    {
      key: "total_days",
      header: "Durasi",
      render: (row) => (
        <span className="font-medium text-slate-900 whitespace-nowrap">
          {formatDays(row.total_days)}
          {row.is_half_day ? " (½)" : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      isAction: true,
      render: (row) => {
        const canCancel = ["pending", "approved_leader"].includes(row.status);
        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDetailLeave(row)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Detail
            </button>
            {canCancel && (
              <button
                type="button"
                onClick={() => openCancelDialog(row)}
                className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Batalkan
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const hasActiveFilter =
    initialFilters.status !== "all" ||
    initialFilters.leaveTypeId !== "all" ||
    Boolean(initialFilters.search) ||
    initialFilters.sort !== "newest";

  return (
    <div className="space-y-6">
      {/* Pesan notifikasi hasil aksi */}
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

      {/* Ringkasan kuota tahun berjalan (dihitung dinamis dari leave_requests) */}
      <StatCardGrid>
        <StatCard
          label={`Sisa Kuota ${quota.year}`}
          value={formatDays(quota.remainingDays)}
          subtext="Tersedia untuk cuti tahunan"
          tone="blue"
        />
        <StatCard
          label="Jatah Tahunan"
          value={formatDays(quota.annualQuota)}
          subtext="Kuota dasar per tahun"
          tone="slate"
        />
        <StatCard
          label="Sedang Diproses"
          value={formatDays(quota.pendingDays)}
          subtext="Pending & disetujui ketua divisi"
          tone="amber"
        />
        <StatCard
          label="Sudah Disetujui"
          value={formatDays(quota.usedDays)}
          subtext="Cuti tahunan terpakai"
          tone="emerald"
        />
      </StatCardGrid>

      {/* Toolbar aksi + filter + sortir */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Pengajuan Cuti Saya
            </h2>
            <p className="text-xs text-slate-500">
              Pantau status persetujuan Ketua Divisi dan HRD secara real-time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <span>+ Ajukan Cuti</span>
          </button>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {/* Pencarian */}
          <div className="flex gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari alasan atau jenis cuti..."
              aria-label="Cari pengajuan cuti"
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="submit"
              className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cari
            </button>
          </div>

          {/* Filter status */}
          <select
            value={initialFilters.status}
            onChange={(e) => updateQueryParam({ status: e.target.value })}
            aria-label="Filter status"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="approved_leader">Disetujui Ketua Divisi</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="cancelled">Dibatalkan</option>
          </select>

          {/* Filter jenis cuti */}
          <select
            value={initialFilters.leaveTypeId}
            onChange={(e) => updateQueryParam({ leaveTypeId: e.target.value })}
            aria-label="Filter jenis cuti"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Jenis Cuti</option>
            {leaveTypes.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.name}
              </option>
            ))}
          </select>

          {/* Sortir */}
          <select
            value={initialFilters.sort}
            onChange={(e) => updateQueryParam({ sort: e.target.value })}
            aria-label="Urutkan daftar"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="newest">Terbaru Diajukan</option>
            <option value="oldest">Terlama Diajukan</option>
            <option value="start_desc">Tanggal Mulai (Terbaru)</option>
            <option value="start_asc">Tanggal Mulai (Terdekat)</option>
            <option value="days_desc">Durasi Terlama</option>
            <option value="days_asc">Durasi Terpendek</option>
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

      {/* Tabel desktop / kartu mobile */}
      <DataTable
        columns={columns}
        data={leaves}
        emptyTitle="Belum ada pengajuan cuti"
        emptyDescription={
          hasActiveFilter
            ? "Tidak ada pengajuan yang cocok dengan filter Anda."
            : "Klik tombol Ajukan Cuti untuk membuat pengajuan cuti pertama Anda."
        }
        emptyAction={
          hasActiveFilter ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset Filter
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Ajukan Cuti
            </button>
          )
        }
      />

      {/* Paginasi */}
      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
      />

      {/* Modal form pengajuan cuti baru */}
      <LeaveRequestFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={(message) => {
          setIsFormOpen(false);
          setFeedback({ type: "success", message });
          router.refresh();
        }}
        leaveTypes={leaveTypes}
        holidayDates={holidayDates}
        handoverCandidates={handoverCandidates}
        quota={quota}
        defaultAddress={defaultAddress}
        defaultPhone={defaultPhone}
      />

      {/* Modal detail pengajuan */}
      <LeaveDetailModal
        isOpen={Boolean(detailLeave)}
        onClose={() => setDetailLeave(null)}
        leave={detailLeave}
        footerActions={
          detailLeave &&
          ["pending", "approved_leader"].includes(detailLeave.status) ? (
            <button
              type="button"
              onClick={() => openCancelDialog(detailLeave)}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Batalkan Pengajuan
            </button>
          ) : null
        }
      />

      {/* Dialog konfirmasi pembatalan */}
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title="Batalkan Pengajuan Cuti?"
        description={
          cancelTarget
            ? `Anda akan membatalkan pengajuan ${cancelTarget.leave_type_name} (${formatDays(cancelTarget.total_days)}). Kuota yang tertahan akan otomatis dikembalikan.`
            : ""
        }
        confirmLabel="Ya, Batalkan Pengajuan"
        variant="danger"
        isLoading={isCancelling}
      >
        <div>
          <label
            htmlFor="cancelReason"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Alasan Pembatalan <span className="text-red-600">*</span>
          </label>
          <textarea
            id="cancelReason"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            disabled={isCancelling}
            placeholder="Tuliskan alasan pembatalan cuti..."
            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          {cancelError && (
            <p className="mt-1.5 text-xs text-red-600">{cancelError}</p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}