// Kartu statistik ringkasan untuk dashboard (gunakan dalam grid-cols-1 sm:grid-cols-2 lg:grid-cols-4)

const TONE_CLASSES = {
  blue: {
    iconBg: "bg-blue-50 text-blue-600",
    accent: "text-blue-600",
  },
  emerald: {
    iconBg: "bg-emerald-50 text-emerald-600",
    accent: "text-emerald-600",
  },
  amber: {
    iconBg: "bg-amber-50 text-amber-600",
    accent: "text-amber-600",
  },
  red: {
    iconBg: "bg-red-50 text-red-600",
    accent: "text-red-600",
  },
  purple: {
    iconBg: "bg-purple-50 text-purple-600",
    accent: "text-purple-600",
  },
  slate: {
    iconBg: "bg-slate-100 text-slate-600",
    accent: "text-slate-700",
  },
};

export function StatCardGrid({ children, className = "" }) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}
    >
      {children}
    </div>
  );
}

export default function StatCard({
  label,
  value,
  subtext,
  icon,
  tone = "blue",
  loading = false,
  className = "",
}) {
  const styles = TONE_CLASSES[tone] || TONE_CLASSES.blue;

  if (loading) {
    return (
      <div
        className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2.5 flex-1">
            <div className="h-3.5 w-24 rounded bg-slate-200" />
            <div className="h-7 w-16 rounded bg-slate-200" />
            <div className="h-3 w-32 rounded bg-slate-100" />
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-200 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          {subtext && (
            <p className="mt-1 text-xs text-slate-500">{subtext}</p>
          )}
        </div>

        {icon && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles.iconBg}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}