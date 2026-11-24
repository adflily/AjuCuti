import Link from "next/link";

// Halaman 404 berbahasa Indonesia
export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg">
          AC
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
          Error 404
        </p>
        <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Halaman yang Anda cari tidak tersedia atau telah dipindahkan di AjuCuti.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Kembali ke Beranda AjuCuti
          </Link>
        </div>
      </div>
    </main>
  );
}