import { requireRole } from "@/lib/session";
import { getAdminHolidays } from "@/lib/queries/admin";
import AppShell from "@/components/layout/AppShell";
import AdminHolidaysClient from "@/components/admin/AdminHolidaysClient";

export const metadata = {
  title: "Kelola Hari Libur — AjuCuti",
};

export default async function AdminHolidaysPage({ searchParams }) {
  const session = await requireRole(["admin"]);
  const resolvedParams = (await searchParams) || {};

  const year = String(resolvedParams.year || "all");
  const type = String(resolvedParams.type || "all");
  const search = String(resolvedParams.search || "");
  const sort = String(resolvedParams.sort || "date_asc");
  const page = Number(resolvedParams.page || 1);

  const holidaysData = await getAdminHolidays({
    year,
    type,
    search,
    sort,
    page,
    pageSize: 15,
  });

  return (
    <AppShell
      user={session}
      title="Kelola Hari Libur"
      subtitle="Atur kalender hari libur nasional dan cuti bersama Indonesia untuk AjuCuti."
    >
      <AdminHolidaysClient
        holidays={holidaysData.items}
        availableYears={holidaysData.availableYears}
        pagination={holidaysData.pagination}
        initialFilters={{ year, type, search, sort }}
      />
    </AppShell>
  );
}