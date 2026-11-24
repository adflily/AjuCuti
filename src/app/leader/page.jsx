import { query } from "@/lib/db";
import { requireRole } from "@/lib/session";
import {
  getActiveLeaveTypes,
  getHandoverCandidates,
  getHolidayDates,
  getLeaderDivisionLeaveRequests,
  getUserLeaveRequests,
  getUserQuotaSummary,
} from "@/lib/queries/leaves";
import AppShell from "@/components/layout/AppShell";
import LeaderLeaveClient from "@/components/leave/LeaderLeaveClient";

export const metadata = {
  title: "Verifikasi Ketua Divisi — AjuCuti",
};

// Halaman portal Ketua Divisi (role: leader)
export default async function LeaderPage({ searchParams }) {
  const session = await requireRole(["leader"]);
  const resolvedParams = (await searchParams) || {};

  const activeTab =
    resolvedParams.tab === "my-leaves" ? "my-leaves" : "verification";
  const defaultStatus = activeTab === "verification" ? "pending" : "all";
  const status = String(resolvedParams.status || defaultStatus);
  const leaveTypeId = String(resolvedParams.leaveTypeId || "all");
  const search = String(resolvedParams.search || "");
  const sort = String(resolvedParams.sort || "newest");
  const page = Number(resolvedParams.page || 1);

  const [
    divisionData,
    myQuota,
    myLeaveData,
    leaveTypes,
    holidayDates,
    handoverCandidates,
    profileRes,
  ] = await Promise.all([
    getLeaderDivisionLeaveRequests(session.id, session.divisionId, {
      status: activeTab === "verification" ? status : "pending",
      leaveTypeId: activeTab === "verification" ? leaveTypeId : "all",
      search: activeTab === "verification" ? search : "",
      sort: activeTab === "verification" ? sort : "newest",
      page: activeTab === "verification" ? page : 1,
      pageSize: 10,
    }),
    getUserQuotaSummary(session.id),
    getUserLeaveRequests(session.id, {
      status: activeTab === "my-leaves" ? status : "all",
      leaveTypeId: activeTab === "my-leaves" ? leaveTypeId : "all",
      search: activeTab === "my-leaves" ? search : "",
      sort: activeTab === "my-leaves" ? sort : "newest",
      page: activeTab === "my-leaves" ? page : 1,
      pageSize: 10,
    }),
    getActiveLeaveTypes(),
    getHolidayDates(),
    getHandoverCandidates(session.divisionId, session.id),
    query(
      `SELECT u.address, u.phone, d.name AS division_name
      FROM users u
      LEFT JOIN divisions d ON d.leader_id = u.id OR d.id = u.division_id
      WHERE u.id = $1::int
      LIMIT 1`,
      [session.id]
    ),
  ]);

  const leaderProfile = profileRes.rows[0] || {};

  return (
    <AppShell
      user={session}
      title="Portal Ketua Divisi"
      subtitle={
        leaderProfile.division_name
          ? `Verifikasi cuti anggota Divisi ${leaderProfile.division_name} dan kelola cuti pribadi Anda.`
          : "Verifikasi cuti anggota divisi dan kelola cuti pribadi Anda."
      }
    >
      <LeaderLeaveClient
        activeTab={activeTab}
        divisionName={leaderProfile.division_name || ""}
        divisionLeaves={divisionData.items}
        divisionSummary={divisionData.summary}
        divisionPagination={divisionData.pagination}
        myQuota={myQuota}
        myLeaves={myLeaveData.items}
        myPagination={myLeaveData.pagination}
        leaveTypes={leaveTypes}
        holidayDates={holidayDates}
        handoverCandidates={handoverCandidates}
        initialFilters={{ status, leaveTypeId, search, sort }}
        defaultAddress={leaderProfile.address || ""}
        defaultPhone={leaderProfile.phone || ""}
      />
    </AppShell>
  );
}