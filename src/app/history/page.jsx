import { requireRole } from "@/lib/session";
import { getHistoryLeaveRequests } from "@/lib/queries/shared";
import {
  getActiveLeaveTypes,
  getDivisionsForFilter,
} from "@/lib/queries/leaves";
import AppShell from "@/components/layout/AppShell";
import HistoryClient from "@/components/shared/HistoryClient";

export const metadata = {
  title: "Riwayat Cuti — AjuCuti",
};

const SUBTITLE_BY_ROLE = {
  user: "Seluruh riwayat pengajuan cuti Anda di AjuCuti.",
  leader: "Riwayat cuti pribadi Anda dan seluruh anggota divisi yang Anda pimpin.",
  hrd: "Riwayat lengkap pengajuan cuti seluruh karyawan perusahaan.",
  admin: "Riwayat lengkap pengajuan cuti seluruh pengguna sistem.",
};

// Halaman bersama /history (dapat diakses admin, user, leader, hrd)
export default async function HistoryPage({ searchParams }) {
  const session = await requireRole(["admin", "user", "leader", "hrd"]);
  const resolvedParams = (await searchParams) || {};

  const status = String(resolvedParams.status || "all");
  const leaveTypeId = String(resolvedParams.leaveTypeId || "all");
  const divisionId = String(resolvedParams.divisionId || "all");
  const year = String(resolvedParams.year || "all");
  const search = String(resolvedParams.search || "");
  const sort = String(resolvedParams.sort || "newest");
  const page = Number(resolvedParams.page || 1);

  const [historyData, leaveTypes, divisions] = await Promise.all([
    getHistoryLeaveRequests(session, {
      status,
      leaveTypeId,
      divisionId,
      year,
      search,
      sort,
      page,
      pageSize: 10,
    }),
    getActiveLeaveTypes(),
    ["admin", "hrd"].includes(session.role)
      ? getDivisionsForFilter()
      : Promise.resolve([]),
  ]);

  return (
    <AppShell
      user={session}
      title="Riwayat Cuti"
      subtitle={SUBTITLE_BY_ROLE[session.role] || "Daftar riwayat pengajuan cuti."}
    >
      <HistoryClient
        userRole={session.role}
        leaves={historyData.items}
        pagination={historyData.pagination}
        availableYears={historyData.availableYears}
        leaveTypes={leaveTypes}
        divisions={divisions}
        initialFilters={{ status, leaveTypeId, divisionId, year, search, sort }}
      />
    </AppShell>
  );
}