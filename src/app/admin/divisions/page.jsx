import { requireRole } from "@/lib/session";
import {
  getAdminDivisions,
  getUsersForDivisionManagement,
} from "@/lib/queries/admin";
import AppShell from "@/components/layout/AppShell";
import AdminDivisionsClient from "@/components/admin/AdminDivisionsClient";

export const metadata = {
  title: "Kelola Divisi & Anggota — AjuCuti",
};

export default async function AdminDivisionsPage({ searchParams }) {
  const session = await requireRole(["admin"]);
  const resolvedParams = (await searchParams) || {};

  const search = String(resolvedParams.search || "");
  const sort = String(resolvedParams.sort || "name_asc");
  const page = Number(resolvedParams.page || 1);

  const [divisionsData, allUsers] = await Promise.all([
    getAdminDivisions({ search, sort, page, pageSize: 10 }),
    getUsersForDivisionManagement(),
  ]);

  return (
    <AppShell
      user={session}
      title="Divisi & Anggota Divisi"
      subtitle="Kelola struktur divisi, penetapan ketua divisi, dan keanggotaan karyawan."
    >
      <AdminDivisionsClient
        divisions={divisionsData.items}
        pagination={divisionsData.pagination}
        allUsers={allUsers}
        initialFilters={{ search, sort }}
      />
    </AppShell>
  );
}