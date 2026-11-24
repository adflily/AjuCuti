import "./globals.css";

export const metadata = {
  title: "AjuCuti — Sistem Manajemen Cuti Karyawan",
  description:
    "AjuCuti adalah sistem manajemen pengajuan, verifikasi, dan persetujuan cuti karyawan berbasis web.",
};

// Root layout aplikasi AjuCuti
export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}