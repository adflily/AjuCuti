import { requireRole } from "@/lib/session";
import {
  getActiveLeaveTypes,
  getDivisionsForFilter,
  getHrdLeaveRequests,
} from "@/lib/queries/leaves";
import AppShell from "@/components/layout/AppShell";
import HrdLeaveClient from "@/components/leave/HrdLeaveClient";

export const metadata = {
  title: "Persetujuan HRD — AjuCuti",
};

// Halaman portal persetujuan final HRD (role: hrd)
export default async function HrdPage({ searchParams }) {
  const session = await requireRole(["hrd"]);
  const resolvedParams = (await searchParams) || {};

  const status = String(resolvedParams.status || "waiting_hrd");
  const divisionId = String(resolvedParams.divisionId || "all");
  const leaveTypeId = String(resolvedParams.leaveTypeId || "all");
  const search = String(resolvedParams.search || "");
  const sort = String(resolvedParams.sort || "newest");
  const page = Number(resolvedParams.page || 1);

  const [hrdData, divisions, leaveTypes] = await Promise.all([
    getHrdLeaveRequests({
      status,
      divisionId,
      leaveTypeId,
      search,
      sort,
      page,
      pageSize: 10,
    }),
    getDivisionsForFilter(),
    getActiveLeaveTypes(),
  ]);

  return (
    <AppShell
      user={session}
      title="Portal Persetujuan HRD"
      subtitle="Tinjau pengajuan yang sudah diverifikasi Ketua Divisi serta pengajuan cuti Ketua Divisi."
    >
      <HrdLeaveClient
        leaves={hrdData.items}
        summary={hrdData.summary}
        pagination={hrdData.pagination}
        divisions={divisions}
        leaveTypes={leaveTypes}
        initialFilters={{ status, divisionId, leaveTypeId, search, sort }}
      />
    </AppShell>
  );
}