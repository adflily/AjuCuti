import { redirect } from "next/navigation";
import { requireRole } from "@/lib/session";
import { getUserProfileById } from "@/lib/queries/shared";
import { getUserQuotaSummary } from "@/lib/queries/leaves";
import AppShell from "@/components/layout/AppShell";
import ProfileClient from "@/components/shared/ProfileClient";

export const metadata = {
  title: "Profil Saya — AjuCuti",
};

// Halaman bersama /profile (dapat diakses seluruh role terautentikasi)
// Kuota cuti hanya dihitung untuk role user dan leader.
export default async function ProfilePage() {
  const session = await requireRole(["admin", "user", "leader", "hrd"]);
  const hasLeaveQuota = ["user", "leader"].includes(session.role);

  const [profile, quota] = await Promise.all([
    getUserProfileById(session.id),
    hasLeaveQuota ? getUserQuotaSummary(session.id) : Promise.resolve(null),
  ]);

  if (!profile) {
    redirect("/login");
  }

  return (
    <AppShell
      user={session}
      title="Profil Saya"
      subtitle="Lihat detail kepegawaian, ubah informasi kontak, dan kelola kata sandi Anda."
    >
      <ProfileClient profile={profile} quota={quota} />
    </AppShell>
  );
}