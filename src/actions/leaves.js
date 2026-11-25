"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  calculateWorkingDays,
  diffCalendarDays,
  formatDays,
  getTodayDateString,
} from "@/lib/dateUtils";

// Skema validasi pengajuan cuti baru
const createLeaveSchema = z
  .object({
    leaveTypeId: z.coerce
      .number()
      .int("Jenis cuti tidak valid.")
      .positive("Jenis cuti wajib dipilih."),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai tidak valid."),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal selesai tidak valid."),
    isHalfDay: z.boolean().default(false),
    reason: z
      .string()
      .trim()
      .min(5, "Alasan cuti minimal 5 karakter.")
      .max(1000, "Alasan cuti maksimal 1000 karakter."),
    handoverUserId: z.union([
      z.coerce.number().int().positive(),
      z.literal(""),
      z.null(),
      z.undefined(),
    ]),
    handoverNotes: z
      .string()
      .trim()
      .max(1000, "Catatan serah terima tugas maksimal 1000 karakter.")
      .optional()
      .default(""),
    addressDuringLeave: z
      .string()
      .trim()
      .min(3, "Alamat selama cuti wajib diisi (minimal 3 karakter).")
      .max(500, "Alamat selama cuti maksimal 500 karakter."),
    emergencyPhone: z
      .string()
      .trim()
      .regex(
        /^\d{8,15}$/,
        "Nomor kontak darurat hanya boleh berisi angka (8–15 digit)."
      ),
    attachmentPath: z.string().trim().max(255).optional().default(""),
    attachmentName: z.string().trim().max(255).optional().default(""),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
    path: ["endDate"],
  })
  .refine((data) => !data.isHalfDay || data.startDate === data.endDate, {
    message: "Cuti setengah hari (0,5 hari) hanya berlaku untuk 1 tanggal yang sama.",
    path: ["endDate"],
  });

const cancelLeaveSchema = z.object({
  requestId: z.coerce.number().int().positive("ID pengajuan tidak valid."),
  cancelReason: z
    .string()
    .trim()
    .min(3, "Alasan pembatalan minimal 3 karakter.")
    .max(500, "Alasan pembatalan maksimal 500 karakter."),
});

const reviewLeaveSchema = z
  .object({
    requestId: z.coerce.number().int().positive("ID pengajuan tidak valid."),
    decision: z.enum(["approve", "reject"], {
      errorMap: () => ({ message: "Keputusan tidak valid." }),
    }),
    note: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional().default(""),
  })
  .refine((data) => data.decision !== "reject" || data.note.length >= 3, {
    message: "Catatan wajib diisi (minimal 3 karakter) saat menolak pengajuan.",
    path: ["note"],
  });

const bulkApproveSchema = z.object({
  requestIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "Pilih minimal satu pengajuan untuk disetujui."),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional().default(""),
});

/**
 * Helper internal: menyisipkan notifikasi untuk pengguna tujuan.
 */
async function insertNotification(client, userId, message) {
  if (!userId || !message) return;
  await client.query(
    `INSERT INTO notifications (user_id, message) VALUES ($1::int, $2)`,
    [userId, message]
  );
}

/**
 * Server Action: Mengajukan cuti baru (HANYA untuk role user dan leader).
 */
export async function createLeaveRequestAction(payload) {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  // Pengecekan otorisasi ketat di server: hanya user dan leader yang boleh mengajukan cuti
  if (!["user", "leader"].includes(session.role)) {
    return { error: "Role Anda tidak dapat mengajukan cuti" };
  }

  const parsed = createLeaveSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data pengajuan cuti Anda.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const data = parsed.data;
  const handoverUserId =
    data.handoverUserId && Number(data.handoverUserId) > 0
      ? Number(data.handoverUserId)
      : null;

  if (handoverUserId && handoverUserId === session.id) {
    return {
      error: "Rekan pengganti tidak boleh diri Anda sendiri.",
      fieldErrors: { handoverUserId: "Pilih rekan kerja lain sebagai pengganti." },
    };
  }

  if (data.attachmentPath && !data.attachmentPath.startsWith("/uploads/leaves/")) {
    return { error: "Path lampiran tidak valid." };
  }

  const todayStr = getTodayDateString();
  const targetYear = Number(data.startDate.slice(0, 4));

  try {
    const createdId = await withTransaction(async (client) => {
      // 1. Verifikasi data & role terbaru pengguna di database
      const userRes = await client.query(
        `SELECT u.id, u.full_name, u.role, u.division_id, u.annual_leave_quota, u.is_active, d.leader_id
        FROM users u
        LEFT JOIN divisions d ON d.id = u.division_id
        WHERE u.id = $1::int
        LIMIT 1`,
        [session.id]
      );
      const applicant = userRes.rows[0];
      if (!applicant || !applicant.is_active) {
        throw new Error("APP_ERROR:Akun Anda tidak aktif.");
      }

      if (!["user", "leader"].includes(applicant.role)) {
        throw new Error("APP_ERROR:Role Anda tidak dapat mengajukan cuti");
      }

      // 2. Baca aturan jenis cuti dari database (tidak hardcode)
      const typeRes = await client.query(
        `SELECT
          id, code, name, max_days_per_request, quota_per_year,
          min_notice_days, max_backdate_days, deducts_annual_quota,
          requires_attachment, is_active
        FROM leave_types
        WHERE id = $1::int
        LIMIT 1`,
        [data.leaveTypeId]
      );
      const leaveType = typeRes.rows[0];
      if (!leaveType || !leaveType.is_active) {
        throw new Error("APP_ERROR:Jenis cuti tidak ditemukan atau tidak aktif.");
      }

      // 3. Cek wajib lampiran
      if (leaveType.requires_attachment && !data.attachmentPath) {
        throw new Error(
          `APP_ERROR:${leaveType.name} wajib melampirkan dokumen pendukung.`
        );
      }

      // 4. Cek aturan H-min (min_notice_days) dan pengajuan mundur (max_backdate_days)
      const daysUntilStart = diffCalendarDays(todayStr, data.startDate);
      const minNotice = Number(leaveType.min_notice_days ?? 0);
      const maxBackdate = Number(leaveType.max_backdate_days ?? 0);

      if (daysUntilStart < 0) {
        const backdateDays = Math.abs(daysUntilStart);
        if (backdateDays > maxBackdate) {
          if (maxBackdate === 0) {
            throw new Error(
              `APP_ERROR:${leaveType.name} tidak dapat diajukan untuk tanggal yang sudah lewat.`
            );
          }
          throw new Error(
            `APP_ERROR:${leaveType.name} maksimal diajukan mundur ${maxBackdate} hari dari hari ini.`
          );
        }
      } else if (minNotice > 0 && daysUntilStart < minNotice) {
        throw new Error(
          `APP_ERROR:${leaveType.name} harus diajukan minimal ${minNotice} hari sebelumnya.`
        );
      }

      // 5. Hitung hari kerja (Senin-Jumat dikurangi tabel holidays)
      const holidayRes = await client.query(
        `SELECT TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date
        FROM holidays
        WHERE holiday_date BETWEEN $1::date AND $2::date`,
        [data.startDate, data.endDate]
      );
      const holidayList = holidayRes.rows.map((r) => r.holiday_date);
      const totalDays = calculateWorkingDays(
        data.startDate,
        data.endDate,
        holidayList,
        data.isHalfDay
      );

      if (totalDays <= 0) {
        throw new Error(
          "APP_ERROR:Rentang tanggal yang dipilih tidak memiliki hari kerja (akhir pekan/hari libur)."
        );
      }

      // 6. Cek batas maksimal hari per pengajuan
      if (
        leaveType.max_days_per_request !== null &&
        totalDays > Number(leaveType.max_days_per_request)
      ) {
        throw new Error(
          `APP_ERROR:Maksimal durasi ${leaveType.name} adalah ${leaveType.max_days_per_request} hari per pengajuan (pengajuan Anda: ${formatDays(totalDays)}).`
        );
      }

      // 7. Cek periode blackout (untuk jenis cuti pemotong kuota tahunan)
      if (leaveType.deducts_annual_quota) {
        const blackoutRes = await client.query(
          `SELECT name,
            TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
            TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
          FROM blackout_periods
          WHERE start_date <= $2::date AND end_date >= $1::date
          LIMIT 1`,
          [data.startDate, data.endDate]
        );
        if (blackoutRes.rows[0]) {
          const bp = blackoutRes.rows[0];
          throw new Error(
            `APP_ERROR:Tanggal bertabrakan dengan periode blackout "${bp.name}" (${bp.start_date} s.d. ${bp.end_date}).`
          );
        }
      }

      // 8. Cek bentrok dengan pengajuan cuti aktif milik pengguna sendiri
      const overlapRes = await client.query(
        `SELECT id
        FROM leave_requests
        WHERE user_id = $1::int
          AND status IN ('pending', 'approved_leader', 'approved')
          AND start_date <= $3::date
          AND end_date >= $2::date
        LIMIT 1`,
        [session.id, data.startDate, data.endDate]
      );
      if (overlapRes.rows[0]) {
        throw new Error(
          "APP_ERROR:Tanggal cuti bertabrakan dengan pengajuan cuti Anda yang masih aktif atau sudah disetujui."
        );
      }

      // 9. Validasi rekan pengganti jika dipilih
      if (handoverUserId) {
        const handoverRes = await client.query(
          `SELECT id FROM users WHERE id = $1::int AND is_active = TRUE LIMIT 1`,
          [handoverUserId]
        );
        if (!handoverRes.rows[0]) {
          throw new Error(
            "APP_ERROR:Rekan pengganti yang dipilih tidak ditemukan atau nonaktif."
          );
        }
      }

      // 10. Cek sisa kuota tahunan (pending + approved_leader + approved menahan kuota)
      if (leaveType.deducts_annual_quota) {
        const quotaRes = await client.query(
          `SELECT COALESCE(SUM(lr.total_days), 0)::float AS held_days
          FROM leave_requests lr
          JOIN leave_types lt ON lt.id = lr.leave_type_id
          WHERE lr.user_id = $1::int
            AND lr.status IN ('pending', 'approved_leader', 'approved')
            AND lt.deducts_annual_quota = TRUE
            AND EXTRACT(YEAR FROM lr.start_date) = $2::int`,
          [session.id, targetYear]
        );
        const heldDays = Number(quotaRes.rows[0]?.held_days || 0);
        const remaining = Number(
          (Number(applicant.annual_leave_quota) - heldDays).toFixed(1)
        );

        if (totalDays > remaining) {
          throw new Error(
            `APP_ERROR:Sisa kuota cuti tahunan Anda pada tahun ${targetYear} tidak mencukupi (tersisa ${formatDays(Math.max(0, remaining))}, dibutuhkan ${formatDays(totalDays)}).`
          );
        }
      }

      // 11. Cek batas kuota tahunan khusus jenis cuti (jika quota_per_year diatur)
      if (leaveType.quota_per_year !== null) {
        const typeQuotaRes = await client.query(
          `SELECT COALESCE(SUM(total_days), 0)::float AS used_type_days
          FROM leave_requests
          WHERE user_id = $1::int
            AND leave_type_id = $2::int
            AND status IN ('pending', 'approved_leader', 'approved')
            AND EXTRACT(YEAR FROM start_date) = $3::int`,
          [session.id, leaveType.id, targetYear]
        );
        const usedTypeDays = Number(typeQuotaRes.rows[0]?.used_type_days || 0);
        const remainingType = Number(
          (Number(leaveType.quota_per_year) - usedTypeDays).toFixed(1)
        );

        if (totalDays > remainingType) {
          throw new Error(
            `APP_ERROR:Sisa kuota tahunan untuk ${leaveType.name} hanya ${formatDays(Math.max(0, remainingType))}.`
          );
        }
      }

      // 12. Simpan pengajuan cuti
      const insertRes = await client.query(
        `INSERT INTO leave_requests (
          user_id,
          leave_type_id,
          request_date,
          start_date,
          end_date,
          is_half_day,
          total_days,
          reason,
          handover_user_id,
          handover_notes,
          attachment_path,
          attachment_name,
          address_during_leave,
          emergency_phone,
          status
        ) VALUES (
          $1::int, $2::int, $3::date, $4::date, $5::date,
          $6, $7, $8, $9::int, $10,
          $11, $12, $13, $14, 'pending'
        )
        RETURNING id`,
        [
          session.id,
          leaveType.id,
          todayStr,
          data.startDate,
          data.endDate,
          data.isHalfDay,
          totalDays,
          data.reason,
          handoverUserId,
          data.handoverNotes || null,
          data.attachmentPath || null,
          data.attachmentName || null,
          data.addressDuringLeave,
          data.emergencyPhone,
        ]
      );

      // 13. Kirim notifikasi ke approver tahap pertama
      if (applicant.role === "user" && applicant.leader_id) {
        await insertNotification(
          client,
          applicant.leader_id,
          `${applicant.full_name} mengajukan ${leaveType.name} (${formatDays(totalDays)}) dan menunggu verifikasi Anda.`
        );
      } else if (applicant.role === "leader") {
        const hrdUsers = await client.query(
          `SELECT id FROM users WHERE role = 'hrd' AND is_active = TRUE`
        );
        for (const hrd of hrdUsers.rows) {
          await insertNotification(
            client,
            hrd.id,
            `Ketua Divisi ${applicant.full_name} mengajukan ${leaveType.name} (${formatDays(totalDays)}) dan menunggu persetujuan HRD.`
          );
        }
      }

      return insertRes.rows[0].id;
    });

    revalidatePath("/employee");
    revalidatePath("/leader");
    revalidatePath("/hrd");
    revalidatePath("/history");

    return {
      success: true,
      requestId: createdId,
      message: "Pengajuan cuti berhasil dikirim.",
    };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal membuat pengajuan cuti:", error);
    return {
      error: "Terjadi kesalahan saat menyimpan pengajuan cuti. Silakan coba lagi.",
    };
  }
}

/**
 * Server Action: Membatalkan pengajuan cuti milik sendiri.
 */
export async function cancelLeaveRequestAction(payload) {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const parsed = cancelLeaveSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ||
        "Data pembatalan pengajuan tidak valid.",
    };
  }

  const { requestId, cancelReason } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const existingRes = await client.query(
        `SELECT id, user_id, status
        FROM leave_requests
        WHERE id = $1::int
        FOR UPDATE`,
        [requestId]
      );
      const existing = existingRes.rows[0];

      if (!existing || existing.user_id !== session.id) {
        throw new Error("APP_ERROR:Pengajuan cuti tidak ditemukan.");
      }

      if (!["pending", "approved_leader"].includes(existing.status)) {
        throw new Error(
          "APP_ERROR:Pengajuan yang sudah final atau dibatalkan tidak dapat dibatalkan lagi."
        );
      }

      await client.query(
        `UPDATE leave_requests
        SET status = 'cancelled',
            cancel_reason = $2,
            cancelled_at = NOW()
        WHERE id = $1::int`,
        [requestId, cancelReason]
      );
    });

    revalidatePath("/employee");
    revalidatePath("/leader");
    revalidatePath("/hrd");
    revalidatePath("/history");

    return {
      success: true,
      message: "Pengajuan cuti berhasil dibatalkan dan kuota Anda telah dikembalikan.",
    };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal membatalkan pengajuan cuti:", error);
    return { error: "Gagal membatalkan pengajuan cuti. Silakan coba lagi." };
  }
}

/**
 * Server Action: Verifikasi pengajuan cuti oleh Ketua Divisi (role: leader).
 */
export async function leaderReviewLeaveAction(payload) {
  const session = await getSession();
  if (!session || session.role !== "leader") {
    return { error: "Akses ditolak. Hanya Ketua Divisi yang dapat memverifikasi." };
  }

  const parsed = reviewLeaveSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Data verifikasi tidak valid.",
    };
  }

  const { requestId, decision, note } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const reqRes = await client.query(
        `SELECT
          lr.id, lr.user_id, lr.status, lr.total_days::float AS total_days,
          u.full_name AS employee_name, u.role AS employee_role, u.division_id,
          d.leader_id AS division_leader_id,
          lt.name AS leave_type_name
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        LEFT JOIN divisions d ON d.id = u.division_id
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.id = $1::int
        FOR UPDATE OF lr`,
        [requestId]
      );
      const req = reqRes.rows[0];

      if (!req) {
        throw new Error("APP_ERROR:Pengajuan cuti tidak ditemukan.");
      }

      if (req.user_id === session.id) {
        throw new Error(
          "APP_ERROR:Anda tidak dapat memverifikasi pengajuan cuti Anda sendiri."
        );
      }

      if (req.employee_role !== "user") {
        throw new Error(
          "APP_ERROR:Ketua Divisi hanya dapat memverifikasi pengajuan karyawan."
        );
      }

      const isSameDivision =
        req.division_leader_id === session.id ||
        (session.divisionId !== null && req.division_id === session.divisionId);

      if (!isSameDivision) {
        throw new Error(
          "APP_ERROR:Anda hanya dapat memverifikasi pengajuan anggota divisi Anda."
        );
      }

      if (req.status !== "pending") {
        throw new Error("APP_ERROR:Pengajuan ini sudah diproses sebelumnya.");
      }

      if (decision === "approve") {
        await client.query(
          `UPDATE leave_requests
          SET status = 'approved_leader',
              leader_id = $2::int,
              leader_note = $3,
              leader_acted_at = NOW()
          WHERE id = $1::int`,
          [requestId, session.id, note || null]
        );

        await insertNotification(
          client,
          req.user_id,
          `Pengajuan ${req.leave_type_name} Anda disetujui oleh Ketua Divisi dan diteruskan ke HRD.`
        );

        const hrdUsers = await client.query(
          `SELECT id FROM users WHERE role = 'hrd' AND is_active = TRUE`
        );
        for (const hrd of hrdUsers.rows) {
          await insertNotification(
            client,
            hrd.id,
            `Pengajuan ${req.leave_type_name} milik ${req.employee_name} telah disetujui Ketua Divisi dan menunggu persetujuan final HRD.`
          );
        }
      } else {
        await client.query(
          `UPDATE leave_requests
          SET status = 'rejected',
              leader_id = $2::int,
              leader_note = $3,
              leader_acted_at = NOW(),
              rejected_by = 'leader'
          WHERE id = $1::int`,
          [requestId, session.id, note]
        );

        await insertNotification(
          client,
          req.user_id,
          `Pengajuan ${req.leave_type_name} Anda ditolak oleh Ketua Divisi. Catatan: ${note}`
        );
      }
    });

    revalidatePath("/leader");
    revalidatePath("/employee");
    revalidatePath("/hrd");
    revalidatePath("/history");

    return {
      success: true,
      message:
        decision === "approve"
          ? "Pengajuan berhasil diverifikasi dan diteruskan ke HRD."
          : "Pengajuan berhasil ditolak.",
    };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal memverifikasi pengajuan (leader):", error);
    return { error: "Gagal memproses verifikasi pengajuan. Silakan coba lagi." };
  }
}

/**
 * Server Action: Persetujuan/Penolakan final oleh HRD (role: hrd).
 */
export async function hrdReviewLeaveAction(payload) {
  const session = await getSession();
  if (!session || session.role !== "hrd") {
    return { error: "Akses ditolak. Hanya HRD yang dapat memberikan persetujuan final." };
  }

  const parsed = reviewLeaveSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Data persetujuan HRD tidak valid.",
    };
  }

  const { requestId, decision, note } = parsed.data;

  try {
    await withTransaction(async (client) => {
      const reqRes = await client.query(
        `SELECT
          lr.id, lr.user_id, lr.status,
          u.role AS employee_role,
          lt.name AS leave_type_name
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.id = $1::int
        FOR UPDATE OF lr`,
        [requestId]
      );
      const req = reqRes.rows[0];

      if (!req) {
        throw new Error("APP_ERROR:Pengajuan cuti tidak ditemukan.");
      }

      const isEligibleForHrd =
        (req.employee_role === "user" && req.status === "approved_leader") ||
        (req.employee_role === "leader" && req.status === "pending");

      if (!isEligibleForHrd) {
        throw new Error(
          "APP_ERROR:Pengajuan ini belum siap diproses HRD atau sudah selesai."
        );
      }

      if (decision === "approve") {
        await client.query(
          `UPDATE leave_requests
          SET status = 'approved',
              hrd_id = $2::int,
              hrd_note = $3,
              hrd_acted_at = NOW()
          WHERE id = $1::int`,
          [requestId, session.id, note || null]
        );

        await insertNotification(
          client,
          req.user_id,
          `Pengajuan ${req.leave_type_name} Anda telah disetujui secara final oleh HRD.`
        );
      } else {
        await client.query(
          `UPDATE leave_requests
          SET status = 'rejected',
              hrd_id = $2::int,
              hrd_note = $3,
              hrd_acted_at = NOW(),
              rejected_by = 'hrd'
          WHERE id = $1::int`,
          [requestId, session.id, note]
        );

        await insertNotification(
          client,
          req.user_id,
          `Pengajuan ${req.leave_type_name} Anda ditolak oleh HRD. Catatan: ${note}`
        );
      }
    });

    revalidatePath("/hrd");
    revalidatePath("/leader");
    revalidatePath("/employee");
    revalidatePath("/history");

    return {
      success: true,
      message:
        decision === "approve"
          ? "Pengajuan cuti berhasil disetujui secara final."
          : "Pengajuan cuti berhasil ditolak.",
    };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal memproses persetujuan HRD:", error);
    return { error: "Gagal memproses persetujuan HRD. Silakan coba lagi." };
  }
}

/**
 * Server Action: Multi-approve pengajuan cuti secara massal oleh HRD.
 */
export async function hrdBulkApproveAction(payload) {
  const session = await getSession();
  if (!session || session.role !== "hrd") {
    return { error: "Akses ditolak. Hanya HRD yang dapat menyetujui massal." };
  }

  const parsed = bulkApproveSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Daftar pengajuan tidak valid.",
    };
  }

  const { requestIds, note } = parsed.data;
  const uniqueIds = Array.from(new Set(requestIds));

  try {
    const approvedCount = await withTransaction(async (client) => {
      const eligibleRes = await client.query(
        `SELECT
          lr.id,
          lr.user_id,
          lt.name AS leave_type_name
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.id = ANY($1::int[])
          AND (
            (u.role = 'user' AND lr.status = 'approved_leader')
            OR (u.role = 'leader' AND lr.status = 'pending')
          )
        FOR UPDATE OF lr`,
        [uniqueIds]
      );

      const eligibleRows = eligibleRes.rows;
      if (eligibleRows.length === 0) {
        throw new Error(
          "APP_ERROR:Tidak ada pengajuan terpilih yang memenuhi syarat persetujuan HRD."
        );
      }

      const eligibleIds = eligibleRows.map((row) => row.id);

      await client.query(
        `UPDATE leave_requests
        SET status = 'approved',
            hrd_id = $2::int,
            hrd_note = $3,
            hrd_acted_at = NOW()
        WHERE id = ANY($1::int[])`,
        [eligibleIds, session.id, note || "Disetujui secara massal oleh HRD."]
      );

      for (const row of eligibleRows) {
        await insertNotification(
          client,
          row.user_id,
          `Pengajuan ${row.leave_type_name} Anda telah disetujui secara final oleh HRD.`
        );
      }

      return eligibleRows.length;
    });

    revalidatePath("/hrd");
    revalidatePath("/leader");
    revalidatePath("/employee");
    revalidatePath("/history");

    return {
      success: true,
      approvedCount,
      message: `${approvedCount} pengajuan cuti berhasil disetujui sekaligus.`,
    };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal multi-approve HRD:", error);
    return { error: "Gagal memproses persetujuan massal. Silakan coba lagi." };
  }
}