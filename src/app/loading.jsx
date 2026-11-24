// Loading state global saat perpindahan halaman di AjuCuti
export default function GlobalLoading() {
  return (
    <div
      className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-sm mb-4">
        AC
      </div>
      <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
        <svg
          className="h-4 w-4 animate-spin text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <span>Memuat halaman AjuCuti...</span>
      </div>
    </div>
  );
}