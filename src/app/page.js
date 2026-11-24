import { redirect } from "next/navigation";
import { getRoleHomePath, getSession } from "@/lib/session";

// Halaman root mengarahkan pengunjung ke /login, atau ke dashboard jika sudah memiliki sesi
export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect(getRoleHomePath(session.role));
  }

  redirect("/login");
}