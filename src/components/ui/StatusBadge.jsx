// Komponen badge status cuti, status aktif, jenis hari libur, dan role pengguna

const STATUS_STYLES = {
  // Status pengajuan cuti
  pending: {
    label: "Menunggu",
    className: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  approved_leader: {
    label: "Disetujui Ketua Divisi",
    className: "bg-sky-50 text-sky-800 border-sky-200",
    dotClass: "bg-sky-500",
  },
  approved: {
    label: "Disetujui",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  rejected: {
    label: "Ditolak",
    className: "bg-red-50 text-red-800 border-red-200",
    dotClass: "bg-red-500",
  },
  cancelled: {
    label: "Dibatalkan",
    className: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
  },

  // Status akun / master data
  active: {
    label: "Aktif",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  inactive: {
    label: "Nonaktif",
    className: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
  },

  // Jenis hari libur
  national_holiday: {
    label: "Libur Nasional",
    className: "bg-red-50 text-red-700 border-red-200",
    dotClass: "bg-red-500",
  },
  joint_leave: {
    label: "Cuti Bersama",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dotClass: "bg-indigo-500",
  },

  // Role pengguna
  admin: {
    label: "Admin",
    className: "bg-purple-50 text-purple-800 border-purple-200",
    dotClass: "bg-purple-500",
  },
  user: {
    label: "Karyawan",
    className: "bg-blue-50 text-blue-800 border-blue-200",
    dotClass: "bg-blue-500",
  },
  leader: {
    label: "Ketua Divisi",
    className: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  hrd: {
    label: "HRD",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
};

export default function StatusBadge({
  status,
  label,
  showDot = true,
  className = "",
}) {
  const config = STATUS_STYLES[status] || {
    label: status || "-",
    className: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${config.className} ${className}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dotClass}`}
          aria-hidden="true"
        />
      )}
      <span>{label || config.label}</span>
    </span>
  );
}