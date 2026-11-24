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
import {
  cancelLeaveRequestAction,
  leaderReviewLeaveAction,
} from "@/actions/leaves";
import { formatDateId, formatDays } from "@/lib/dateUtils";

// Komponen interaktif halaman /leader:
// Tab 1: Verifikasi pengajuan anggota divisi (pending -> approved_leader / rejected)
// Tab 2: Cuti pribadi Ketua Divisi (pending -> langsung ke antrean HRD)

export default function LeaderLeaveClient({
  activeTab = "verification",
  divisionName = "",
  divisionLeaves = [],
  divisionSummary,
  divisionPagination,
  myQuota,
  myLeaves = [],
  myPagination,
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
  const [detailLeave, setDetailLeave] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // State modal verifikasi (approve / reject)
  const [reviewState, setReviewState] = useState({
    leave: null,
    decision: null, // 'approve' | 'reject'
  });
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [isReviewing, startReviewTransition] = useTransition();

  // State pengajuan & pembatalan cuti pribadi leader
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [isCancelling, startCancelTransition] = useTransition();

  function switchTab(nextTab) {
    setSearchInput("");
    const params = new URLSearchParams();
    params.set("tab", nextTab);
    router.push(`${pathname}?${params.toString()}`);
  }

  function updateQueryParam(updates) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateQueryParam({ search: searchInput.trim() });
  }

  function handleResetFilters() {
    setSearchInput("");
    router.push(`${pathname}?tab=${activeTab}`);
  }

  function openReviewDialog(leave, decision) {
    setReviewState({ leave, decision });
    setReviewNote("");
    setReviewError("");
  }

  function handleConfirmReview() {
    if (!reviewState.leave || !reviewState.decision) return;

    if (reviewState.decision === "reject" && reviewNote.trim().length < 3) {
      setReviewError(
        "Catatan penolakan wajib diisi minimal 3 karakter."
      );
      return;
    }

    setReviewError("");
    startReviewTransition(async () => {
      const result = await leaderReviewLeaveAction({
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
        message: result.message || "Verifikasi pengajuan berhasil disimpan.",
      });
      router.refresh();
    });
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
        message: result.message || "Pengajuan cuti pribadi berhasil dibatalkan.",
      });
      router.refresh();
    });
  }

  // Kolom untuk Tab 1: Verifikasi Anggota Divisi
  const divisionColumns = [
    {
      key: "employee_name",
      header: "Karyawan",
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.employee_name}</p>
          <p className="text-xs text-slate-500">
            {row.employee_position || row.division_name || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "leave_type_name",
      header: "Jenis Cuti",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.leave_type_name}</p>
          <p className="text-xs text-slate-500">
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
      render: (row) => <StatusBadge status={row.status} />,
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
            onClick={() => setDetailLeave(row)}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Detail
          </button>
          {row.status === "pending" && (
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
      ),
    },
  ];

  // Kolom untuk Tab 2: Cuti Pribadi Ketua Divisi
  const myLeaveColumns = [
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
      render: (row) => (
        <StatusBadge
          status={row.status}
          label={row.status === "pending" ? "Menunggu HRD" : undefined}
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
            onClick={() => setDetailLeave(row)}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Detail
          </button>
          {row.status === "pending" && (
            <button
              type="button"
              onClick={() => openCancelDialog(row)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Batalkan
            </button>
          )}
        </div>
      ),
    },
  ];

  const isVerificationTab = activeTab === "verification";
  const defaultStatusForTab = isVerificationTab ? "pending" : "all";
  const hasActiveFilter =
    initialFilters.status !== defaultStatusForTab ||
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

      {/* Navigasi Tab Verifikasi Divisi vs Cuti Pribadi */}
      <div className="flex flex-col sm:flex-row gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => switchTab("verification")}
          className={`min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            isVerificationTab
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Verifikasi Divisi {divisionName ? `(${divisionName})` : ""}</span>
          {divisionSummary?.pending_count > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                isVerificationTab
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {divisionSummary.pending_count}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => switchTab("my-leaves")}
          className={`min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            !isVerificationTab
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>Cuti Pribadi Saya</span>
        </button>
      </div>

      {/* Ringkasan statistik sesuai tab aktif */}
      {isVerificationTab ? (
        <StatCardGrid>
          <StatCard
            label="Menunggu Verifikasi"
            value={divisionSummary?.pending_count ?? 0}
            subtext="Perlu ditinjau Ketua Divisi"
            tone="amber"
          />
          <StatCard
            label="Diteruskan ke HRD"
            value={divisionSummary?.approved_leader_count ?? 0}
            subtext="Menunggu persetujuan final HRD"
            tone="blue"
          />
          <StatCard
            label="Disetujui Final"
            value={divisionSummary?.approved_count ?? 0}
            subtext="Pengajuan divisi disetujui"
            tone="emerald"
          />
          <StatCard
            label="Ditolak"
            value={divisionSummary?.rejected_count ?? 0}
            subtext="Total pengajuan ditolak"
            tone="red"
          />
        </StatCardGrid>
      ) : (
        <>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Pengajuan cuti Ketua Divisi akan <strong>langsung masuk ke antrean HRD</strong> untuk persetujuan final.
          </div>

          <StatCardGrid>
            <StatCard
              label={`Sisa Kuota ${myQuota.year}`}
              value={formatDays(myQuota.remainingDays)}
              subtext="Tersedia untuk cuti tahunan"
              tone="blue"
            />
            <StatCard
              label="Jatah Tahunan"
              value={formatDays(myQuota.annualQuota)}
              subtext="Kuota dasar per tahun"
              tone="slate"
            />
            <StatCard
              label="Menunggu HRD"
              value={formatDays(myQuota.pendingDays)}
              subtext="Kuota sedang tertahan"
              tone="amber"
            />
            <StatCard
              label="Sudah Disetujui"
              value={formatDays(myQuota.usedDays)}
              subtext="Cuti tahunan terpakai"
              tone="emerald"
            />
          </StatCardGrid>
        </>
      )}

      {/* Toolbar filter & sortir */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isVerificationTab
                ? "Antrean Verifikasi Pengajuan Divisi"
                : "Daftar Cuti Pribadi Saya"}
            </h2>
            <p className="text-xs text-slate-500">
              {isVerificationTab
                ? "Setujui untuk meneruskan ke HRD, atau tolak dengan catatan wajib."
                : "Ajukan atau pantau status persetujuan cuti pribadi Anda di HRD."}
            </p>
          </div>

          {!isVerificationTab && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Ajukan Cuti Pribadi
            </button>
          )}
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
              placeholder={
                isVerificationTab
                  ? "Cari nama karyawan atau alasan..."
                  : "Cari alasan atau jenis cuti..."
              }
              aria-label="Pencarian pengajuan"
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
            <option value="pending">
              {isVerificationTab ? "Menunggu Verifikasi" : "Menunggu HRD"}
            </option>
            {isVerificationTab && (
              <option value="approved_leader">Disetujui Ketua Divisi</option>
            )}
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="cancelled">Dibatalkan</option>
          </select>

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

          <select
            value={initialFilters.sort}
            onChange={(e) => updateQueryParam({ sort: e.target.value })}
            aria-label="Urutkan daftar"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="newest">Terbaru Diajukan</option>
            <option value="oldest">Terlama Diajukan</option>
            <option value="start_asc">Tanggal Mulai (Terdekat)</option>
            <option value="start_desc">Tanggal Mulai (Terbaru)</option>
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

      {/* Daftar data & paginasi sesuai tab */}
      {isVerificationTab ? (
        <>
          <DataTable
            columns={divisionColumns}
            data={divisionLeaves}
            emptyTitle="Tidak ada pengajuan di antrean"
            emptyDescription="Belum ada pengajuan cuti anggota divisi yang sesuai dengan filter saat ini."
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
            currentPage={divisionPagination.currentPage}
            totalPages={divisionPagination.totalPages}
            totalItems={divisionPagination.totalItems}
            pageSize={divisionPagination.pageSize}
          />
        </>
      ) : (
        <>
          <DataTable
            columns={myLeaveColumns}
            data={myLeaves}
            emptyTitle="Belum ada pengajuan cuti pribadi"
            emptyDescription="Klik Ajukan Cuti Pribadi untuk mengirim pengajuan cuti langsung ke HRD."
            emptyAction={
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                + Ajukan Cuti Pribadi
              </button>
            }
          />
          <Pagination
            currentPage={myPagination.currentPage}
            totalPages={myPagination.totalPages}
            totalItems={myPagination.totalItems}
            pageSize={myPagination.pageSize}
          />
        </>
      )}

      {/* Modal Detail Pengajuan */}
      <LeaveDetailModal
        isOpen={Boolean(detailLeave)}
        onClose={() => setDetailLeave(null)}
        leave={detailLeave}
        footerActions={
          detailLeave && isVerificationTab && detailLeave.status === "pending" ? (
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
                Setujui &amp; Teruskan ke HRD
              </button>
            </>
          ) : detailLeave && !isVerificationTab && detailLeave.status === "pending" ? (
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

      {/* Dialog Verifikasi (Setujui / Tolak) oleh Ketua Divisi */}
      <ConfirmDialog
        isOpen={Boolean(reviewState.leave)}
        onClose={() => setReviewState({ leave: null, decision: null })}
        onConfirm={handleConfirmReview}
        title={
          reviewState.decision === "approve"
            ? "Setujui & Teruskan ke HRD?"
            : "Tolak Pengajuan Cuti?"
        }
        description={
          reviewState.leave
            ? `${reviewState.leave.employee_name} — ${reviewState.leave.leave_type_name} (${formatDays(reviewState.leave.total_days)}).`
            : ""
        }
        confirmLabel={
          reviewState.decision === "approve"
            ? "Ya, Setujui"
            : "Ya, Tolak Pengajuan"
        }
        variant={reviewState.decision === "approve" ? "primary" : "danger"}
        isLoading={isReviewing}
      >
        <div>
          <label
            htmlFor="leaderReviewNote"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Catatan Ketua Divisi{" "}
            {reviewState.decision === "reject" ? (
              <span className="text-red-600">* (Wajib)</span>
            ) : (
              <span className="text-slate-400 font-normal">(Opsional)</span>
            )}
          </label>
          <textarea
            id="leaderReviewNote"
            rows={3}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            disabled={isReviewing}
            placeholder={
              reviewState.decision === "reject"
                ? "Tuliskan alasan penolakan (minimal 3 karakter)..."
                : "Tambahkan catatan verifikasi bila diperlukan..."
            }
            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          {reviewError && (
            <p className="mt-1.5 text-xs text-red-600">{reviewError}</p>
          )}
        </div>
      </ConfirmDialog>

      {/* Modal Form Pengajuan Cuti Pribadi Ketua Divisi */}
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
        quota={myQuota}
        defaultAddress={defaultAddress}
        defaultPhone={defaultPhone}
      />

      {/* Dialog Pembatalan Cuti Pribadi */}
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title="Batalkan Pengajuan Cuti Pribadi?"
        description={
          cancelTarget
            ? `Anda akan membatalkan pengajuan ${cancelTarget.leave_type_name} (${formatDays(cancelTarget.total_days)}).`
            : ""
        }
        confirmLabel="Ya, Batalkan"
        variant="danger"
        isLoading={isCancelling}
      >
        <div>
          <label
            htmlFor="leaderCancelReason"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Alasan Pembatalan <span className="text-red-600">*</span>
          </label>
          <textarea
            id="leaderCancelReason"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            disabled={isCancelling}
            placeholder="Tuliskan alasan pembatalan..."
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