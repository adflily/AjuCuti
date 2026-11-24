import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getAdminOverviewStats } from "@/lib/queries/admin";
import AppShell from "@/components/layout/AppShell";
import StatCard, { StatCardGrid } from "@/components/ui/StatCard";

export const metadata = {
  title: "Dashboard Admin — AjuCuti",
};

// Dashboard utama Administrator AjuCuti
export default async function AdminPage() {
  const session = await requireRole(["admin"]);
  const stats = await getAdminOverviewStats();

  const quickLinks = [
    {
      href: "/admin/users",
      title: "Kelola Pengguna",
      description: "Tambah akun baru, ubah role, reset kata sandi, dan atur kuota tahunan.",
      badge: `${stats.activeUsers}/${stats.totalUsers} aktif`,
    },
    {
      href: "/admin/divisions",
      title: "Divisi & Anggota",
      description: "Atur struktur divisi, penetapan ketua divisi, dan perpindahan anggota.",
      badge: `${stats.totalDivisions} divisi`,
    },
    {
      href: "/admin/leave-types",
      title: "Jenis Cuti",
      description: "Konfigurasi aturan dinamis: batas hari, H-min, lampiran, dan potong kuota.",
      badge: `${stats.activeLeaveTypes} aktif`,
    },
    {
      href: "/admin/holidays",
      title: "Hari Libur",
      description: "Kelola daftar libur nasional dan cuti bersama untuk perhitungan hari kerja.",
      badge: `${stats.upcomingHolidays} mendatang`,
    },
  ];

  return (
    <AppShell
      user={session}
      title="Dashboard Administrator"
      subtitle="Ringkasan data master dan aktivitas pengajuan cuti di AjuCuti."
    >
      <StatCardGrid>
        <StatCard
          label="Pengguna Aktif"
          value={stats.activeUsers}
          subtext={`Dari total ${stats.totalUsers} akun terdaftar`}
          tone="blue"
        />
        <StatCard
          label="Total Divisi"
          value={stats.totalDivisions}
          subtext="Struktur divisi perusahaan"
          tone="purple"
        />
        <StatCard
          label="Pengajuan Diproses"
          value={stats.activeRequests}
          subtext={`${stats.approvedRequests} pengajuan sudah disetujui`}
          tone="amber"
        />
        <StatCard
          label="Hari Libur Mendatang"
          value={stats.upcomingHolidays}
          subtext={`${stats.activeLeaveTypes} jenis cuti aktif`}
          tone="emerald"
        />
      </StatCardGrid>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Menu Pengelolaan Data Master
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700">
                    {item.title}
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {item.badge}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </div>
              <span className="mt-4 inline-flex items-center text-xs font-semibold text-blue-600">
                Buka halaman &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}