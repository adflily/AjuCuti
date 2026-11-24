import { requireRole } from "@/lib/session";
import { getAdminLeaveTypes } from "@/lib/queries/admin";
import AppShell from "@/components/layout/AppShell";
import AdminLeaveTypesClient from "@/components/admin/AdminLeaveTypesClient";

export const metadata = {
  title: "Kelola Jenis Cuti — AjuCuti",
};

export default async function AdminLeaveTypesPage({ searchParams }) {
  const session = await requireRole(["admin"]);
  const resolvedParams = (await searchParams) || {};

  const status = String(resolvedParams.status || "all");
  const deducts = String(resolvedParams.deducts || "all");
  const search = String(resolvedParams.search || "");
  const sort = String(resolvedParams.sort || "system_first");
  const page = Number(resolvedParams.page || 1);

  const leaveTypesData = await getAdminLeaveTypes({
    status,
    deducts,
    search,
    sort,
    page,
    pageSize: 10,
  });

  return (
    <AppShell
      user={session}
      title="Kelola Jenis Cuti"
      subtitle="Atur kebijakan, batas hari, kewajiban lampiran, dan potongan kuota tiap jenis cuti."
    >
      <AdminLeaveTypesClient
        leaveTypes={leaveTypesData.items}
        pagination={leaveTypesData.pagination}
        initialFilters={{ status, deducts, search, sort }}
      />
    </AppShell>
  );
}