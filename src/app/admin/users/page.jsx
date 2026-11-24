import { requireRole } from "@/lib/session";
import { getAdminUsers, getAllDivisionsSimple } from "@/lib/queries/admin";
import AppShell from "@/components/layout/AppShell";
import AdminUsersClient from "@/components/admin/AdminUsersClient";

export const metadata = {
  title: "Kelola Pengguna — AjuCuti",
};

export default async function AdminUsersPage({ searchParams }) {
  const session = await requireRole(["admin"]);
  const resolvedParams = (await searchParams) || {};

  const role = String(resolvedParams.role || "all");
  const divisionId = String(resolvedParams.divisionId || "all");
  const status = String(resolvedParams.status || "all");
  const search = String(resolvedParams.search || "");
  const sort = String(resolvedParams.sort || "newest");
  const page = Number(resolvedParams.page || 1);

  const [usersData, divisions] = await Promise.all([
    getAdminUsers({
      role,
      divisionId,
      status,
      search,
      sort,
      page,
      pageSize: 10,
    }),
    getAllDivisionsSimple(),
  ]);

  return (
    <AppShell
      user={session}
      title="Kelola Pengguna"
      subtitle="Tambah, ubah, reset kata sandi, dan atur status aktif seluruh pengguna AjuCuti."
    >
      <AdminUsersClient
        currentAdminId={session.id}
        users={usersData.items}
        pagination={usersData.pagination}
        divisions={divisions}
        initialFilters={{ role, divisionId, status, search, sort }}
      />
    </AppShell>
  );
}