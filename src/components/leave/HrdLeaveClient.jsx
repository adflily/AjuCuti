"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import StatCard, { StatCardGrid } from "@/components/ui/StatCard";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LeaveDetailModal from "@/components/leave/LeaveDetailModal";
import {
  hrdBulkApproveAction,
  hrdReviewLeaveAction,
} from "@/actions/leaves";
import { formatDateId, formatDays } from "@/lib/dateUtils";

// Menentukan apakah baris pengajuan berhak diproses final oleh HRD:
// - Karyawan (user): harus sudah berstatus 'approved_leader'
// - Ketua Divisi (leader): langsung dari status 'pending'
function isEligibleForHrd(row) {
  return (
    (row.employee_role === "user" && row.status === "approved_leader") ||
    (row.employee_role === "leader" && row.status === "pending")
  );
}

export default function HrdLeaveClient({
  leaves = [],
  summary,
  pagination,
  divisions = [],
  leaveTypes = [],
  initialFilters,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialFilters.search || "");
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailLeave, setDetailLeave] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // State review satuan (approve / reject)
  const [reviewState, setReviewState] = useState({
    leave: null,
    decision: null,
  });
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [isReviewing, startReviewTransition] = useTransition();

  // State multi-approve massal HRD
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [isBulkApproving, startBulkTransition] = useTransition();

  // Bersihkan pilihan checkbox setiap kali daftar berubah (filter/halaman)
  useEffect(() => {
    setSelectedIds([]);
  }, [leaves]);

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

  function openReviewDialog(leave, decision) {
    setReviewState({ leave, decision });
    setReviewNote("");
    setReviewError("");
  }

  function handleConfirmReview() {
    if (!reviewState.leave || !reviewState.decision) return;

    if (reviewState.decision === "reject" && reviewNote.trim().length < 3) {
      setReviewError("Catatan penolakan wajib diisi minimal 3 karakter.");
      return;
    }

    setReviewError("");
    startReviewTransition(async () => {
      const result = await hrdReviewLeaveAction({
        requestId: reviewState.leave.id,
        decision: reviewState.decision,
        note: reviewNote.trim(),
      });

      if (result?.error) {
        setReviewError(result.error);
        return;
      }

      setReviewState({ leave: null, decision: null });
      setDetailLeave(null);
      setFeedback({
        type: "success",
        message: result.message || "Persetujuan HRD berhasil disimpan.",
      });
      router.refresh();
    });
  }

  function handleConfirmBulkApprove() {
    if (selectedIds.length === 0) return;

    setBulkError("");
    startBulkTransition(async () => {
      const result = await hrdBulkApproveAction({
        requestIds: selectedIds,
        note: bulkNote.trim(),
      });

      if (result?.error) {
        setBulkError(result.error);
        return;
      }

      setIsBulkModalOpen(false);
      setBulkNote("");
      setSelectedIds([]);
      setFeedback({
        type: "success",
        message:
          result.message || "Pengajuan terpilih berhasil disetujui massal.",
      });
      router.refresh();
    });
  }

  const columns = [
    {
      key: "employee_name",
      header: "Pemohon",
      render: (row) => (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-900">
              {row.employee_name}
            </span>
            {row.employee_role === "leader" && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                Ketua Divisi
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {row.division_name || "Tanpa Divisi"}
          </p>
        </div>
      ),
    },
    {
      key: "leave_type_name",
      header: "Jenis & Tanggal",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.leave_type_name}</p>
          <p className="text-xs text-slate-500 whitespace-nowrap">
            {row.start_date === row.end_date
              ? formatDateId(row.start_date)
              : `${formatDateId(row.start_date)} – ${formatDateId(row.end_date)}`}
          </p>
        </div>
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
      render: (row) => (
        <StatusBadge
          status={row.status}
          label={
            row.employee_role === "leader" && row.status === "pending"
              ? "Menunggu HRD (Langsung)"
              : undefined
          }
        />
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      isAction: true,
      render: (row) => {
        const eligible = isEligibleForHrd(row);
        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDetailLeave(row)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Detail
            </button>
            {eligible && (
              <>
                <button
                  type="button"
                  onClick={() => openReviewDialog(row, "approve")}
                  className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Setujui
                </button>
                <button
                  type="button"
                  onClick={() => openReviewDialog(row, "reject")}
                  className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Tolak
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const hasActiveFilter =
    initialFilters.status !== "waiting_hrd" ||
    initialFilters.divisionId !== "all" ||
    initialFilters.leaveTypeId !== "all" ||
    Boolean(initialFilters.search) ||
    initialFilters.sort !== "newest";

  return (
    <div className="space-y-6">
      {/* Pemberitahuan hasil aksi */}
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

      {/* Ringkasan statistik HRD */}
      <StatCardGrid>
        <StatCard
          label="Siap Diproses HRD"
          value={summary?.waiting_hrd_count ?? 0}
          subtext="Disetujui leader & cuti leader"
          tone="blue"
        />
        <StatCard
          label="Menunggu Ketua Divisi"
          value={summary?.waiting_leader_count ?? 0}
          subtext="Belum masuk antrean HRD"
          tone="amber"
        />
        <StatCard
          label="Disetujui Final"
          value={summary?.approved_count ?? 0}
          subtext="Total cuti disetujui"
          tone="emerald"
        />
        <StatCard
          label="Ditolak"
          value={summary?.rejected_count ?? 0}
          subtext="Total cuti ditolak"
          tone="red"
        />
      </StatCardGrid>

      {/* Toolbar filter & sortir */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Persetujuan Final HRD
          </h2>
          <p className="text-xs text-slate-500">
            Centang beberapa pengajuan untuk melakukan persetujuan sekaligus (multi-approve).
          </p>
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
              placeholder="Cari nama, divisi, alasan..."
              aria-label="Cari pengajuan"
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
            <option value="waiting_hrd">Antrean HRD (Siap Diproses)</option>
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="approved_leader">Disetujui Ketua Divisi</option>
            <option value="approved">Disetujui Final</option>
            <option value="rejected">Ditolak</option>
            <option value="cancelled">Dibatalkan</option>
          </select>

          {/* Filter divisi */}
          <select
            value={initialFilters.divisionId}
            onChange={(e) => updateQueryParam({ divisionId: e.target.value })}
            aria-label="Filter divisi"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Divisi</option>
            {divisions.map((div) => (
              <option key={div.id} value={div.id}>
                {div.name}
              </option>
            ))}
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
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <div className="w-full sm:w-64">
            <select
              value={initialFilters.sort}
              onChange={(e) => updateQueryParam({ sort: e.target.value })}
              aria-label="Urutkan daftar"
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="newest">Urutkan: Terbaru Diajukan</option>
              <option value="oldest">Urutkan: Terlama Diajukan</option>
              <option value="start_asc">Urutkan: Tanggal Mulai (Terdekat)</option>
              <option value="start_desc">Urutkan: Tanggal Mulai (Terbaru)</option>
              <option value="days_desc">Urutkan: Durasi Terlama</option>
              <option value="days_asc">Urutkan: Durasi Terpendek</option>
            </select>
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Bar aksi multi-approve saat ada baris terpilih */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-blue-900">
            {selectedIds.length} pengajuan dipilih untuk disetujui sekaligus.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100/50"
            >
              Batal Pilih
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkNote("");
                setBulkError("");
                setIsBulkModalOpen(true);
              }}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Setujui Terpilih ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Daftar pengajuan (checkbox multi-approve aktif) */}
      <DataTable
        columns={columns}
        data={leaves}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        isRowSelectable={isEligibleForHrd}
        emptyTitle="Tidak ada pengajuan di antrean HRD"
        emptyDescription="Belum ada pengajuan yang sesuai dengan filter saat ini."
        emptyAction={
          hasActiveFilter ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset Filter
            </button>
          ) : null
        }
      />

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
      />

      {/* Modal Detail Pengajuan */}
      <LeaveDetailModal
        isOpen={Boolean(detailLeave)}
        onClose={() => setDetailLeave(null)}
        leave={detailLeave}
        footerActions={
          detailLeave && isEligibleForHrd(detailLeave) ? (
            <>
              <button
                type="button"
                onClick={() => openReviewDialog(detailLeave, "reject")}
                className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Tolak
              </button>
              <button
                type="button"
                onClick={() => openReviewDialog(detailLeave, "approve")}
                className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Setujui Final
              </button>
            </>
          ) : null
        }
      />

      {/* Dialog Persetujuan / Penolakan Satuan HRD */}
      <ConfirmDialog
        isOpen={Boolean(reviewState.leave)}
        onClose={() => setReviewState({ leave: null, decision: null })}
        onConfirm={handleConfirmReview}
        title={
          reviewState.decision === "approve"
            ? "Setujui Final Pengajuan Cuti?"
            : "Tolak Pengajuan Cuti?"
        }
        description={
          reviewState.leave
            ? `${reviewState.leave.employee_name} (${reviewState.leave.division_name || "-"}) — ${reviewState.leave.leave_type_name} (${formatDays(reviewState.leave.total_days)}).`
            : ""
        }
        confirmLabel={
          reviewState.decision === "approve"
            ? "Ya, Setujui Final"
            : "Ya, Tolak Pengajuan"
        }
        variant={reviewState.decision === "approve" ? "primary" : "danger"}
        isLoading={isReviewing}
      >
        <div>
          <label
            htmlFor="hrdReviewNote"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Catatan HRD{" "}
            {reviewState.decision === "reject" ? (
              <span className="text-red-600">* (Wajib)</span>
            ) : (
              <span className="text-slate-400 font-normal">(Opsional)</span>
            )}
          </label>
          <textarea
            id="hrdReviewNote"
            rows={3}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            disabled={isReviewing}
            placeholder={
              reviewState.decision === "reject"
                ? "Tuliskan alasan penolakan HRD (minimal 3 karakter)..."
                : "Tambahkan catatan persetujuan HRD bila perlu..."
            }
            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          {reviewError && (
            <p className="mt-1.5 text-xs text-red-600">{reviewError}</p>
          )}
        </div>
      </ConfirmDialog>

      {/* Dialog Konfirmasi Multi-Approve HRD */}
      <ConfirmDialog
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onConfirm={handleConfirmBulkApprove}
        title={`Setujui ${selectedIds.length} Pengajuan Sekaligus?`}
        description="Seluruh pengajuan yang Anda pilih akan langsung berubah status menjadi Disetujui Final."
        confirmLabel={`Ya, Setujui ${selectedIds.length} Pengajuan`}
        variant="primary"
        isLoading={isBulkApproving}
      >
        <div>
          <label
            htmlFor="hrdBulkNote"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Catatan Massal HRD{" "}
            <span className="text-slate-400 font-normal">(Opsional)</span>
          </label>
          <textarea
            id="hrdBulkNote"
            rows={2}
            value={bulkNote}
            onChange={(e) => setBulkNote(e.target.value)}
            disabled={isBulkApproving}
            placeholder="contoh: Disetujui bersama oleh HRD."
            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          {bulkError && (
            <p className="mt-1.5 text-xs text-red-600">{bulkError}</p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}