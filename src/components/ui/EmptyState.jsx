// Komponen tampilan kosong (empty state) yang konsisten di seluruh halaman

export default function EmptyState({
  title = "Belum ada data",
  description = "Data akan tampil di sini setelah tersedia atau sesuai filter pencarian Anda.",
  icon,
  action,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center ${className}`}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon || (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M4 13.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7.5" />
            <path d="M4 13.5h4.5l2 2.5h3l2-2.5H20V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4.5z" />
          </svg>
        )}
      </div>

      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}