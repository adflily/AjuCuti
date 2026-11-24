"use client";

import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  formatDateId,
  formatDateTimeId,
  formatDays,
} from "@/lib/dateUtils";

// Modal detail lengkap pengajuan cuti (dipakai bersama di /employee, /leader, /hrd, /history)

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2.5 border-b border-slate-100 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 shrink-0">
        {label}
      </span>
      <span className="text-sm font-medium text-slate-900 sm:text-right break-words">
        {value || "-"}
      </span>
    </div>
  );
}

// Konfigurasi warna dan ikon konsisten untuk setiap langkah riwayat persetujuan
const STEP_TONES = {
  approved: {
    container: "border-emerald-200 bg-emerald-50/70",
    iconWrap: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-950",
    text: "text-emerald-900",
    note: "border-emerald-200/80 bg-white/80 text-emerald-900",
  },
  rejected: {
    container: "border-red-200 bg-red-50/70",
    iconWrap: "bg-red-100 text-red-700",
    title: "text-red-950",
    text: "text-red-900",
    note: "border-red-200/80 bg-white/80 text-red-900",
  },
  waiting: {
    container: "border-amber-200 bg-amber-50/70",
    iconWrap: "bg-amber-100 text-amber-700",
    title: "text-amber-950",
    text: "text-amber-900",
    note: "border-amber-200/80 bg-white/80 text-amber-900",
  },
  muted: {
    container: "border-slate-200 bg-slate-50",
    iconWrap: "bg-slate-200 text-slate-600",
    title: "text-slate-700",
    text: "text-slate-500",
    note: "border-slate-200 bg-white text-slate-700",
  },
};

function StepIcon({ tone }) {
  const iconProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.25",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "h-4 w-4 shrink-0",
    "aria-hidden": true,
  };

  if (tone === "approved") {
    return (
      <svg {...iconProps}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }

  if (tone === "rejected") {
    return (
      <svg {...iconProps}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }

  if (tone === "waiting") {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    );
  }

  // Ikon abu-abu untuk status tidak diproses / dibatalkan
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function ApprovalStepCard({ title, message, note, tone = "muted" }) {
  const styles = STEP_TONES[tone] || STEP_TONES.muted;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3.5 ${styles.container}`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${styles.iconWrap}`}
      >
        <StepIcon tone={tone} />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className={`text-sm font-semibold leading-snug ${styles.title}`}>
          {title}
        </p>
        <p className={`text-sm leading-relaxed break-words ${styles.text}`}>
          {message}
        </p>
        {note && (
          <p
            className={`mt-1.5 rounded-lg border px-3 py-2 text-xs leading-relaxed break-words whitespace-pre-line ${styles.note}`}
          >
            Catatan: &ldquo;{note}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Menyusun kalimat aktor dan waktu WIB untuk tahap disetujui/ditolak.
 */
function formatActorMessage(actionLabel, actorName, actedAt) {
  const nameText = actorName || "-";
  if (actedAt) {
    return `${actionLabel} oleh ${nameText} (${formatDateTimeId(actedAt)})`;
  }
  return `${actionLabel} oleh ${nameText}`;
}

/**
 * Menyusun daftar langkah riwayat persetujuan sesuai status, rejected_by, dan role pemohon.
 */
function buildApprovalSteps(leave) {
  const isLeaderApplicant = leave.employee_role === "leader";
  const status = leave.status;
  const rejectedBy =
    leave.rejected_by ||
    (status === "rejected"
      ? leave.hrd_acted_at || isLeaderApplicant
        ? "hrd"
        : "leader"
      : null);

  const steps = [];

  // Jika dibatalkan oleh pemohon, tampilkan kartu pembatalan di paling atas
  if (status === "cancelled") {
    const cancelledTime = leave.cancelled_at
      ? ` (${formatDateTimeId(leave.cancelled_at)})`
      : "";

    steps.push({
      key: "cancelled",
      title: "Pembatalan Pengajuan",
      message: `Dibatalkan oleh pemohon${cancelledTime}`,
      note: leave.cancel_reason || "",
      tone: "muted",
    });

    if (!isLeaderApplicant) {
      steps.push({
        key: "leader",
        title: "Verifikasi Ketua Divisi",
        message: "Tidak diproses",
        note: "",
        tone: "muted",
      });
    }

    steps.push({
      key: "hrd",
      title: "Persetujuan Final HRD",
      message: "Tidak diproses",
      note: "",
      tone: "muted",
    });

    return steps;
  }

  // Alur khusus Ketua Divisi -> HRD (tahap Ketua Divisi disembunyikan sepenuhnya)
  if (isLeaderApplicant) {
    if (status === "pending") {
      steps.push({
        key: "hrd",
        title: "Persetujuan Final HRD",
        message: "Menunggu persetujuan final",
        note: "",
        tone: "waiting",
      });
    } else if (status === "approved") {
      steps.push({
        key: "hrd",
        title: "Persetujuan Final HRD",
        message: formatActorMessage("Disetujui", leave.hrd_name, leave.hrd_acted_at),
        note: leave.hrd_note || "",
        tone: "approved",
      });
    } else if (status === "rejected") {
      steps.push({
        key: "hrd",
        title: "Persetujuan Final HRD",
        message: formatActorMessage("Ditolak", leave.hrd_name, leave.hrd_acted_at),
        note: leave.hrd_note || "",
        tone: "rejected",
      });
    }

    return steps;
  }

  // Alur standar Karyawan (user) -> Ketua Divisi -> HRD
  if (status === "pending") {
    steps.push(
      {
        key: "leader",
        title: "1. Verifikasi Ketua Divisi",
        message: "Menunggu verifikasi",
        note: "",
        tone: "waiting",
      },
      {
        key: "hrd",
        title: "2. Persetujuan Final HRD",
        message: "Menunggu",
        note: "",
        tone: "waiting",
      }
    );
  } else if (status === "approved_leader") {
    steps.push(
      {
        key: "leader",
        title: "1. Verifikasi Ketua Divisi",
        message: formatActorMessage(
          "Disetujui",
          leave.leader_name,
          leave.leader_acted_at
        ),
        note: leave.leader_note || "",
        tone: "approved",
      },
      {
        key: "hrd",
        title: "2. Persetujuan Final HRD",
        message: "Menunggu persetujuan final",
        note: "",
        tone: "waiting",
      }
    );
  } else if (status === "approved") {
    steps.push(
      {
        key: "leader",
        title: "1. Verifikasi Ketua Divisi",
        message: formatActorMessage(
          "Disetujui",
          leave.leader_name,
          leave.leader_acted_at
        ),
        note: leave.leader_note || "",
        tone: "approved",
      },
      {
        key: "hrd",
        title: "2. Persetujuan Final HRD",
        message: formatActorMessage("Disetujui", leave.hrd_name, leave.hrd_acted_at),
        note: leave.hrd_note || "",
        tone: "approved",
      }
    );
  } else if (status === "rejected" && rejectedBy === "leader") {
    steps.push(
      {
        key: "leader",
        title: "1. Verifikasi Ketua Divisi",
        message: formatActorMessage(
          "Ditolak",
          leave.leader_name,
          leave.leader_acted_at
        ),
        note: leave.leader_note || "",
        tone: "rejected",
      },
      {
        key: "hrd",
        title: "2. Persetujuan Final HRD",
        message: "Tidak diteruskan ke HRD karena ditolak Ketua Divisi",
        note: "",
        tone: "muted",
      }
    );
  } else if (status === "rejected" && rejectedBy === "hrd") {
    steps.push(
      {
        key: "leader",
        title: "1. Verifikasi Ketua Divisi",
        message: formatActorMessage(
          "Disetujui",
          leave.leader_name,
          leave.leader_acted_at
        ),
        note: leave.leader_note || "",
        tone: "approved",
      },
      {
        key: "hrd",
        title: "2. Persetujuan Final HRD",
        message: formatActorMessage("Ditolak", leave.hrd_name, leave.hrd_acted_at),
        note: leave.hrd_note || "",
        tone: "rejected",
      }
    );
  }

  return steps;
}

export default function LeaveDetailModal({
  isOpen,
  onClose,
  leave,
  footerActions,
}) {
  if (!leave) {
    return null;
  }

  const dateRangeText =
    leave.start_date === leave.end_date
      ? formatDateId(leave.start_date)
      : `${formatDateId(leave.start_date)} s.d. ${formatDateId(leave.end_date)}`;

  const approvalSteps = buildApprovalSteps(leave);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detail Pengajuan #${leave.id}`}
      description={`${leave.leave_type_name} — ${leave.employee_name}`}
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Tutup
          </button>
          {footerActions && (
            <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
              {footerActions}
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Status & ringkasan utama */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Status Saat Ini</p>
            <div className="mt-1">
              <StatusBadge status={leave.status} />
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs font-medium text-slate-500">Durasi Hari Kerja</p>
            <p className="mt-0.5 text-base font-bold text-slate-900">
              {formatDays(leave.total_days)}
              {leave.is_half_day ? " (Setengah Hari)" : ""}
            </p>
          </div>
        </div>

        {/* Informasi pemohon & jadwal */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-1">
          <DetailRow label="Pemohon" value={leave.employee_name} />
          <DetailRow
            label="Divisi / Jabatan"
            value={[leave.division_name, leave.employee_position]
              .filter(Boolean)
              .join(" — ")}
          />
          <DetailRow
            label="Jenis Cuti"
            value={`${leave.leave_type_name}${
              leave.deducts_annual_quota
                ? " (Potong Kuota Tahunan)"
                : " (Tidak Potong Kuota Tahunan)"
            }`}
          />
          <DetailRow label="Tanggal Cuti" value={dateRangeText} />
          <DetailRow
            label="Tanggal Pengajuan"
            value={formatDateId(leave.request_date)}
          />
          <DetailRow label="Alamat Selama Cuti" value={leave.address_during_leave} />
          <DetailRow label="Nomor Darurat" value={leave.emergency_phone} />
        </div>

        {/* Alasan cuti */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Alasan Cuti
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-800 whitespace-pre-line break-words">
            {leave.reason}
          </p>
        </div>

        {/* Serah terima tugas (handover) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Serah Terima Tugas (Handover)
          </p>
          <p className="text-sm text-slate-800">
            <span className="font-medium text-slate-600">Rekan Pengganti: </span>
            {leave.handover_user_name || "Tidak ditentukan"}
          </p>
          {leave.handover_notes && (
            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line break-words bg-slate-50 rounded-lg p-3 border border-slate-100">
              {leave.handover_notes}
            </p>
          )}
        </div>

        {/* Lampiran dokumen */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lampiran Dokumen
          </p>
          {leave.attachment_path ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-800 break-all">
                {leave.attachment_name || "Berkas Lampiran"}
              </span>
              <a
                href={leave.attachment_path}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                Lihat / Unduh Lampiran
              </a>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Tidak ada lampiran.</p>
          )}
        </div>

        {/* Riwayat Proses Persetujuan */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Riwayat Proses Persetujuan
            </p>
            {leave.employee_role === "leader" && (
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                Alur Ketua Divisi &rarr; HRD
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {approvalSteps.map((step) => (
              <ApprovalStepCard
                key={step.key}
                title={step.title}
                message={step.message}
                note={step.note}
                tone={step.tone}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}