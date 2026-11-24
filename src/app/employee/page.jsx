import { query } from "@/lib/db";
import { requireRole } from "@/lib/session";
import {
  getActiveLeaveTypes,
  getHandoverCandidates,
  getHolidayDates,
  getUserLeaveRequests,
  getUserQuotaSummary,
} from "@/lib/queries/leaves";
import AppShell from "@/components/layout/AppShell";
import EmployeeLeaveClient from "@/components/leave/EmployeeLeaveClient";

export const metadata = {
  title: "Cuti Karyawan — AjuCuti",
};

// Halaman portal cuti karyawan (role: user)
export default async function EmployeePage({ searchParams }) {
  const session = await requireRole(["user"]);
  const resolvedParams = (await searchParams) || {};

  const status = String(resolvedParams.status || "all");
  const leaveTypeId = String(resolvedParams.leaveTypeId || "all");
  const search = String(resolvedParams.search || "");
  const sort = String(resolvedParams.sort || "newest");
  const page = Number(resolvedParams.page || 1);

  const [
    quota,
    leaveData,
    leaveTypes,
    holidayDates,
    handoverCandidates,
    profileResult,
  ] = await Promise.all([
    getUserQuotaSummary(session.id),
    getUserLeaveRequests(session.id, {
      status,
      leaveTypeId,
      search,
      sort,
      page,
      pageSize: 10,
    }),
    getActiveLeaveTypes(),
    getHolidayDates(),
    getHandoverCandidates(session.divisionId, session.id),
    query(`SELECT address, phone FROM users WHERE id = $1 LIMIT 1`, [
      session.id,
    ]),
  ]);

  const userProfile = profileResult.rows[0] || {};

  return (
    <AppShell
      user={session}
      title="Portal Cuti Karyawan"
      subtitle={`Kelola pengajuan cuti dan pantau sisa kuota tahun ${quota.year}.`}
    >
      <EmployeeLeaveClient
        quota={quota}
        leaves={leaveData.items}
        pagination={leaveData.pagination}
        leaveTypes={leaveTypes}
        holidayDates={holidayDates}
        handoverCandidates={handoverCandidates}
        initialFilters={{ status, leaveTypeId, search, sort }}
        defaultAddress={userProfile.address || ""}
        defaultPhone={userProfile.phone || ""}
      />
    </AppShell>
  );
}