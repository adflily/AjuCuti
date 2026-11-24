"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import LeaveDetailModal from "@/components/leave/LeaveDetailModal";
import { formatDateId, formatDays } from "@/lib/dateUtils";

// Komponen interaktif halaman bersama /history (cakupan data otomatis sesuai role)

export default function HistoryClient({
  userRole,
  leaves = [],
  pagination,
  availableYears = [],
  leaveTypes = [],
  divisions = [],
  initialFilters,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialFilters.search || "");
  const [detailLeave, setDetailLeave] = useState(null);

  const canFilterDivision = ["admin", "hrd"].includes(userRole);
  const showEmployeeColumn = userRole !== "user";

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

  const columns = [
    ...(showEmployeeColumn
      ? [
          {
            key: "employee_name",
            header: "Pemohon",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-900">
                  {row.employee_name}
                </p>
                <p className="text-xs text-slate-500">
                  {row.division_name || "Tanpa Divisi"}
                </p>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "leave_type_name",
      header: "Jenis Cuti",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.leave_type_name}</p>
          <p className="text-xs text-slate-500">
            Diajukan {formatDateId(row.request_date)}
          </p>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Tanggal Cuti",
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
      render: (row) => (
        <button
          type="button"
          onClick={() => setDetailLeave(row)}
          className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Detail
        </button>
      ),
    },
  ];

  const hasActiveFilter =
    initialFilters.status !== "all" ||
    initialFilters.leaveTypeId !== "all" ||
    initialFilters.divisionId !== "all" ||
    initialFilters.year !== "all" ||
    Boolean(initialFilters.search) ||
    initialFilters.sort !== "newest";

  return (
    <div className="space-y-6">
      {/* Toolbar filter & sortir */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
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
                showEmployeeColumn
                  ? "Cari nama, divisi, alasan..."
                  : "Cari jenis cuti atau alasan..."
              }
              aria-label="Cari riwayat cuti"
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
            <option value="pending">Menunggu</option>
            <option value="approved_leader">Disetujui Ketua Divisi</option>
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
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {canFilterDivision && (
              <select
                value={initialFilters.divisionId}
                onChange={(e) =>
                  updateQueryParam({ divisionId: e.target.value })
                }
                aria-label="Filter divisi"
                className="block w-full sm:w-56 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="all">Semua Divisi</option>
                {divisions.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={initialFilters.sort}
              onChange={(e) => updateQueryParam({ sort: e.target.value })}
              aria-label="Urutkan riwayat"
              className="block w-full sm:w-64 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="newest">Urutkan: Terbaru Diajukan</option>
              <option value="oldest">Urutkan: Terlama Diajukan</option>
              <option value="start_desc">Urutkan: Tanggal Mulai (Terbaru)</option>
              <option value="start_asc">Urutkan: Tanggal Mulai (Terdekat)</option>
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

      <DataTable
        columns={columns}
        data={leaves}
        emptyTitle="Belum ada riwayat cuti"
        emptyDescription="Tidak ada riwayat pengajuan cuti yang cocok dengan filter saat ini."
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

      <LeaveDetailModal
        isOpen={Boolean(detailLeave)}
        onClose={() => setDetailLeave(null)}
        leave={detailLeave}
      />
    </div>
  );
}