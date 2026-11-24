"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";

const SALT_ROUNDS = 10;
const ROLES_WITH_QUOTA = new Set(["user", "leader"]);

// Helper otorisasi wajib untuk seluruh Server Action Admin
async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return null;
  }
  return session;
}

// Helper konversi angka opsional (kosong -> null)
function parseOptionalInt(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const num = Number.parseInt(String(value).trim(), 10);
  return Number.isNaN(num) ? NaN : num;
}

// Membuat kode jenis cuti otomatis dari nama: huruf kapital, spasi menjadi underscore
function buildLeaveTypeCode(name) {
  const cleaned = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return cleaned || `CUTI_${Date.now().toString().slice(-4)}`;
}

// ============================================================================
// 1. SERVER ACTIONS: PENGGUNA (users)
// ============================================================================
const createUserSchema = z.object({
  fullName: z.string().trim().min(2, "Nama lengkap minimal 2 karakter.").max(120),
  email: z.string().trim().email("Format email tidak valid.").max(150),
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(50)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username hanya boleh huruf, angka, titik, garis bawah, atau tanda hubung."
    ),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(100),
  role: z.enum(["admin", "user", "leader", "hrd"], {
    errorMap: () => ({ message: "Role tidak valid." }),
  }),
  divisionId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null(), z.undefined()]),
  position: z.string().trim().max(100).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  annualLeaveQuota: z.coerce
    .number()
    .int("Kuota tahunan harus bilangan bulat.")
    .min(0, "Kuota tahunan minimal 0.")
    .max(60, "Kuota tahunan maksimal 60 hari.")
    .default(12),
  joinDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: "Tanggal bergabung tidak valid.",
    })
    .optional()
    .default(""),
});

const updateUserSchema = createUserSchema.omit({ password: true }).extend({
  id: z.coerce.number().int().positive("ID pengguna tidak valid."),
  isActive: z.boolean().default(true),
});

const resetPasswordSchema = z.object({
  id: z.coerce.number().int().positive("ID pengguna tidak valid."),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter.").max(100),
});

export async function createUserAction(payload) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak. Hanya Admin yang dapat mengelola pengguna." };
  }

  const parsed = createUserSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data pengguna.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const data = parsed.data;
  const divisionId =
    data.divisionId && Number(data.divisionId) > 0
      ? Number(data.divisionId)
      : null;

  // Aturan server: role admin dan hrd selalu disimpan annual_leave_quota = 0
  const effectiveAnnualQuota = ROLES_WITH_QUOTA.has(data.role)
    ? data.annualLeaveQuota
    : 0;

  try {
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const employeeCode = await withTransaction(async (client) => {
      const dupRes = await client.query(
        `SELECT email, username
        FROM users
        WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)
        LIMIT 1`,
        [data.email, data.username]
      );

      if (dupRes.rows[0]) {
        const dup = dupRes.rows[0];
        if (dup.email.toLowerCase() === data.email.toLowerCase()) {
          throw new Error("APP_ERROR:Email tersebut sudah terdaftar.");
        }
        throw new Error("APP_ERROR:Username tersebut sudah digunakan.");
      }

      if (divisionId !== null) {
        const divRes = await client.query(
          `SELECT id FROM divisions WHERE id = $1::int LIMIT 1`,
          [divisionId]
        );
        if (!divRes.rows[0]) {
          throw new Error("APP_ERROR:Divisi yang dipilih tidak ditemukan.");
        }
      }

      const insertRes = await client.query(
        `INSERT INTO users (
          full_name,
          email,
          username,
          password_hash,
          role,
          division_id,
          position,
          phone,
          address,
          annual_leave_quota,
          join_date,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6::int, $7, $8, $9,
          $10::int, $11::date, TRUE
        )
        RETURNING id`,
        [
          data.fullName,
          data.email.toLowerCase(),
          data.username,
          passwordHash,
          data.role,
          divisionId,
          data.position || null,
          data.phone || null,
          data.address || null,
          effectiveAnnualQuota,
          data.joinDate || null,
        ]
      );

      // Generate employee_code otomatis dari ID pengguna (mis. EMP-007)
      const newId = insertRes.rows[0].id;
      const autoCode = `EMP-${String(newId).padStart(3, "0")}`;

      await client.query(
        `UPDATE users SET employee_code = $2 WHERE id = $1::int`,
        [newId, autoCode]
      );

      return autoCode;
    });

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/divisions");

    return {
      success: true,
      message: `Pengguna berhasil ditambahkan dengan kode ${employeeCode}.`,
    };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal membuat pengguna:", error);
    return { error: "Gagal menambahkan pengguna. Silakan coba lagi." };
  }
}

export async function updateUserAction(payload) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak. Hanya Admin yang dapat mengubah pengguna." };
  }

  const parsed = updateUserSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data pengguna.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const data = parsed.data;
  const divisionId =
    data.divisionId && Number(data.divisionId) > 0
      ? Number(data.divisionId)
      : null;

  // Aturan server: role admin dan hrd selalu disimpan annual_leave_quota = 0
  const effectiveAnnualQuota = ROLES_WITH_QUOTA.has(data.role)
    ? data.annualLeaveQuota
    : 0;

  if (data.id === session.id && data.role !== "admin") {
    return { error: "Anda tidak dapat mengubah role akun admin Anda sendiri." };
  }

  if (data.id === session.id && !data.isActive) {
    return { error: "Anda tidak dapat menonaktifkan akun Anda sendiri." };
  }

  try {
    await withTransaction(async (client) => {
      const dupRes = await client.query(
        `SELECT email, username
        FROM users
        WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2))
          AND id <> $3::int
        LIMIT 1`,
        [data.email, data.username, data.id]
      );

      if (dupRes.rows[0]) {
        const dup = dupRes.rows[0];
        if (dup.email.toLowerCase() === data.email.toLowerCase()) {
          throw new Error("APP_ERROR:Email tersebut sudah digunakan pengguna lain.");
        }
        throw new Error("APP_ERROR:Username tersebut sudah digunakan pengguna lain.");
      }

      // Jika role bukan lagi leader, lepaskan jabatan leader_id pada divisi jika ada
      if (data.role !== "leader") {
        await client.query(
          `UPDATE divisions SET leader_id = NULL WHERE leader_id = $1::int`,
          [data.id]
        );
      }

      const updateRes = await client.query(
        `UPDATE users
        SET full_name = $2,
            email = $3,
            username = $4,
            role = $5,
            division_id = $6::int,
            position = $7,
            phone = $8,
            address = $9,
            annual_leave_quota = $10::int,
            join_date = $11::date,
            is_active = $12
        WHERE id = $1::int
        RETURNING id`,
        [
          data.id,
          data.fullName,
          data.email.toLowerCase(),
          data.username,
          data.role,
          divisionId,
          data.position || null,
          data.phone || null,
          data.address || null,
          effectiveAnnualQuota,
          data.joinDate || null,
          data.isActive,
        ]
      );

      if (!updateRes.rows[0]) {
        throw new Error("APP_ERROR:Pengguna tidak ditemukan.");
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/divisions");
    revalidatePath("/profile");

    return { success: true, message: "Data pengguna berhasil diperbarui." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal memperbarui pengguna:", error);
    return { error: "Gagal memperbarui data pengguna. Silakan coba lagi." };
  }
}

export async function resetUserPasswordAction(payload) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsed = resetPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Kata sandi baru tidak valid.",
    };
  }

  try {
    const hash = await bcrypt.hash(parsed.data.newPassword, SALT_ROUNDS);
    await withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE users SET password_hash = $2 WHERE id = $1::int RETURNING id`,
        [parsed.data.id, hash]
      );
      if (!res.rows[0]) {
        throw new Error("APP_ERROR:Pengguna tidak ditemukan.");
      }
    });

    return { success: true, message: "Kata sandi pengguna berhasil direset." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal mereset kata sandi:", error);
    return { error: "Gagal mereset kata sandi pengguna." };
  }
}

export async function toggleUserActiveAction(userId) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsedId = parseOptionalInt(userId);
  if (!parsedId || Number.isNaN(parsedId) || parsedId <= 0) {
    return { error: "ID pengguna tidak valid." };
  }

  if (parsedId === session.id) {
    return { error: "Anda tidak dapat menonaktifkan akun Anda sendiri." };
  }

  try {
    const nextActive = await withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE users
        SET is_active = NOT is_active
        WHERE id = $1::int
        RETURNING is_active`,
        [parsedId]
      );
      if (!res.rows[0]) {
        throw new Error("APP_ERROR:Pengguna tidak ditemukan.");
      }
      return res.rows[0].is_active;
    });

    revalidatePath("/admin");
    revalidatePath("/admin/users");

    return {
      success: true,
      message: nextActive
        ? "Akun pengguna berhasil diaktifkan kembali."
        : "Akun pengguna berhasil dinonaktifkan.",
    };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal mengubah status pengguna:", error);
    return { error: "Gagal mengubah status aktif pengguna." };
  }
}

// ============================================================================
// 2. SERVER ACTIONS: DIVISI & ANGGOTA DIVISI (divisions)
// ============================================================================
const divisionSchema = z.object({
  // Kolom code bersifat opsional (nullable) sesuai ketentuan
  code: z.string().trim().max(30, "Kode divisi maksimal 30 karakter.").optional().default(""),
  name: z.string().trim().min(2, "Nama divisi minimal 2 karakter.").max(100),
  description: z.string().trim().max(500).optional().default(""),
  leaderId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null(), z.undefined()]),
});

export async function createDivisionAction(payload) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsed = divisionSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data divisi.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const data = parsed.data;
  const code = data.code ? data.code.toUpperCase() : null;
  const leaderId =
    data.leaderId && Number(data.leaderId) > 0 ? Number(data.leaderId) : null;

  try {
    await withTransaction(async (client) => {
      const dupName = await client.query(
        `SELECT id FROM divisions WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [data.name]
      );
      if (dupName.rows[0]) {
        throw new Error("APP_ERROR:Nama divisi tersebut sudah terdaftar.");
      }

      if (code) {
        const dupCode = await client.query(
          `SELECT id FROM divisions WHERE LOWER(code) = LOWER($1) LIMIT 1`,
          [code]
        );
        if (dupCode.rows[0]) {
          throw new Error("APP_ERROR:Kode divisi tersebut sudah digunakan.");
        }
      }

      if (leaderId !== null) {
        const leaderRes = await client.query(
          `SELECT id, role, is_active FROM users WHERE id = $1::int LIMIT 1`,
          [leaderId]
        );
        const leader = leaderRes.rows[0];
        if (!leader || !leader.is_active || leader.role !== "leader") {
          throw new Error(
            "APP_ERROR:Ketua divisi harus pengguna aktif dengan role Ketua Divisi (leader)."
          );
        }

        const existingLead = await client.query(
          `SELECT name FROM divisions WHERE leader_id = $1::int LIMIT 1`,
          [leaderId]
        );
        if (existingLead.rows[0]) {
          throw new Error(
            `APP_ERROR:Pengguna tersebut sudah menjadi ketua di Divisi ${existingLead.rows[0].name}.`
          );
        }
      }

      const insertRes = await client.query(
        `INSERT INTO divisions (code, name, description, leader_id)
        VALUES ($1, $2, $3, $4::int)
        RETURNING id`,
        [code, data.name, data.description || null, leaderId]
      );

      // Sinkronkan division_id milik ketua divisi
      if (leaderId !== null) {
        await client.query(
          `UPDATE users SET division_id = $1::int WHERE id = $2::int`,
          [insertRes.rows[0].id, leaderId]
        );
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/divisions");
    revalidatePath("/admin/users");

    return { success: true, message: "Divisi baru berhasil ditambahkan." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal membuat divisi:", error);
    return { error: "Gagal menambahkan divisi. Silakan coba lagi." };
  }
}

export async function updateDivisionAction(payload) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsedId = parseOptionalInt(payload?.id);
  if (!parsedId || Number.isNaN(parsedId) || parsedId <= 0) {
    return { error: "ID divisi tidak valid." };
  }

  const parsed = divisionSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data divisi.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const data = parsed.data;
  const code = data.code ? data.code.toUpperCase() : null;
  const leaderId =
    data.leaderId && Number(data.leaderId) > 0 ? Number(data.leaderId) : null;

  try {
    await withTransaction(async (client) => {
      const dupName = await client.query(
        `SELECT id FROM divisions WHERE LOWER(name) = LOWER($1) AND id <> $2::int LIMIT 1`,
        [data.name, parsedId]
      );
      if (dupName.rows[0]) {
        throw new Error("APP_ERROR:Nama divisi sudah digunakan divisi lain.");
      }

      if (code) {
        const dupCode = await client.query(
          `SELECT id FROM divisions WHERE LOWER(code) = LOWER($1) AND id <> $2::int LIMIT 1`,
          [code, parsedId]
        );
        if (dupCode.rows[0]) {
          throw new Error("APP_ERROR:Kode divisi sudah digunakan divisi lain.");
        }
      }

      if (leaderId !== null) {
        const leaderRes = await client.query(
          `SELECT id, role, is_active FROM users WHERE id = $1::int LIMIT 1`,
          [leaderId]
        );
        const leader = leaderRes.rows[0];
        if (!leader || !leader.is_active || leader.role !== "leader") {
          throw new Error(
            "APP_ERROR:Ketua divisi harus pengguna aktif dengan role Ketua Divisi (leader)."
          );
        }

        const existingLead = await client.query(
          `SELECT name FROM divisions WHERE leader_id = $1::int AND id <> $2::int LIMIT 1`,
          [leaderId, parsedId]
        );
        if (existingLead.rows[0]) {
          throw new Error(
            `APP_ERROR:Pengguna tersebut sudah menjadi ketua di Divisi ${existingLead.rows[0].name}.`
          );
        }
      }

      const updateRes = await client.query(
        `UPDATE divisions
        SET code = $2,
            name = $3,
            description = $4,
            leader_id = $5::int
        WHERE id = $1::int
        RETURNING id`,
        [parsedId, code, data.name, data.description || null, leaderId]
      );

      if (!updateRes.rows[0]) {
        throw new Error("APP_ERROR:Divisi tidak ditemukan.");
      }

      if (leaderId !== null) {
        await client.query(
          `UPDATE users SET division_id = $1::int WHERE id = $2::int`,
          [parsedId, leaderId]
        );
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/divisions");
    revalidatePath("/admin/users");

    return { success: true, message: "Data divisi berhasil diperbarui." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal memperbarui divisi:", error);
    return { error: "Gagal memperbarui divisi. Silakan coba lagi." };
  }
}

export async function deleteDivisionAction(divisionId) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsedId = parseOptionalInt(divisionId);
  if (!parsedId || Number.isNaN(parsedId) || parsedId <= 0) {
    return { error: "ID divisi tidak valid." };
  }

  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE users SET division_id = NULL WHERE division_id = $1::int`,
        [parsedId]
      );

      const delRes = await client.query(
        `DELETE FROM divisions WHERE id = $1::int RETURNING id`,
        [parsedId]
      );

      if (!delRes.rows[0]) {
        throw new Error("APP_ERROR:Divisi tidak ditemukan.");
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/divisions");
    revalidatePath("/admin/users");

    return { success: true, message: "Divisi berhasil dihapus." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal menghapus divisi:", error);
    return { error: "Gagal menghapus divisi. Silakan coba lagi." };
  }
}

export async function assignUserToDivisionAction({ divisionId, userId }) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsedDivId = parseOptionalInt(divisionId);
  const parsedUserId = parseOptionalInt(userId);
  if (!parsedDivId || !parsedUserId || Number.isNaN(parsedDivId) || Number.isNaN(parsedUserId)) {
    return { error: "Divisi atau pengguna tidak valid." };
  }

  try {
    await withTransaction(async (client) => {
      const leadingRes = await client.query(
        `SELECT id, name FROM divisions WHERE leader_id = $1::int AND id <> $2::int LIMIT 1`,
        [parsedUserId, parsedDivId]
      );
      if (leadingRes.rows[0]) {
        throw new Error(
          `APP_ERROR:Pengguna ini masih menjadi Ketua di Divisi ${leadingRes.rows[0].name}. Ganti ketua divisi tersebut terlebih dahulu.`
        );
      }

      const res = await client.query(
        `UPDATE users SET division_id = $1::int WHERE id = $2::int RETURNING id`,
        [parsedDivId, parsedUserId]
      );
      if (!res.rows[0]) {
        throw new Error("APP_ERROR:Pengguna tidak ditemukan.");
      }
    });

    revalidatePath("/admin/divisions");
    revalidatePath("/admin/users");

    return { success: true, message: "Anggota berhasil dimasukkan ke divisi." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal menambah anggota divisi:", error);
    return { error: "Gagal menambahkan anggota divisi." };
  }
}

export async function removeUserFromDivisionAction({ divisionId, userId }) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsedDivId = parseOptionalInt(divisionId);
  const parsedUserId = parseOptionalInt(userId);
  if (!parsedDivId || !parsedUserId || Number.isNaN(parsedDivId) || Number.isNaN(parsedUserId)) {
    return { error: "Divisi atau pengguna tidak valid." };
  }

  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE divisions SET leader_id = NULL WHERE id = $1::int AND leader_id = $2::int`,
        [parsedDivId, parsedUserId]
      );

      await client.query(
        `UPDATE users SET division_id = NULL WHERE id = $1::int AND division_id = $2::int`,
        [parsedUserId, parsedDivId]
      );
    });

    revalidatePath("/admin/divisions");
    revalidatePath("/admin/users");

    return { success: true, message: "Anggota berhasil dikeluarkan dari divisi." };
  } catch (error) {
    console.error("Gagal mengeluarkan anggota divisi:", error);
    return { error: "Gagal mengeluarkan anggota dari divisi." };
  }
}

// ============================================================================
// 3. SERVER ACTIONS: JENIS CUTI (leave_types)
// ============================================================================
const leaveTypeSchema = z.object({
  name: z.string().trim().min(2, "Nama jenis cuti minimal 2 karakter.").max(100),
  description: z.string().trim().max(500).optional().default(""),
  maxDaysPerRequest: z.union([
    z.coerce.number().int("Harus bilangan bulat.").positive("Minimal 1 hari."),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  quotaPerYear: z.union([
    z.coerce.number().int("Harus bilangan bulat.").positive("Minimal 1 hari."),
    z.literal(""),
    z.null(),
    z.undefined(),
  ]),
  minNoticeDays: z.coerce
    .number()
    .int("Harus bilangan bulat.")
    .min(0, "Minimal 0 hari.")
    .max(365)
    .default(0),
  maxBackdateDays: z.coerce
    .number()
    .int("Harus bilangan bulat.")
    .min(0, "Minimal 0 hari.")
    .max(365)
    .default(0),
  deductsAnnualQuota: z.boolean().default(false),
  requiresAttachment: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function createLeaveTypeAction(payload) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsed = leaveTypeSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data jenis cuti.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const data = parsed.data;
  const maxDays = parseOptionalInt(data.maxDaysPerRequest);
  const quotaPerYear = parseOptionalInt(data.quotaPerYear);

  try {
    const finalCode = await withTransaction(async (client) => {
      const dupName = await client.query(
        `SELECT id FROM leave_types WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [data.name]
      );
      if (dupName.rows[0]) {
        throw new Error("APP_ERROR:Nama jenis cuti tersebut sudah terdaftar.");
      }

      const baseCode = buildLeaveTypeCode(data.name);
      let candidateCode = baseCode;
      let suffix = 2;

      while (true) {
        const exists = await client.query(
          `SELECT id FROM leave_types WHERE code = $1 LIMIT 1`,
          [candidateCode]
        );
        if (!exists.rows[0]) break;
        candidateCode = `${baseCode}_${suffix}`;
        suffix += 1;
      }

      await client.query(
        `INSERT INTO leave_types (
          code,
          name,
          description,
          max_days_per_request,
          quota_per_year,
          min_notice_days,
          max_backdate_days,
          deducts_annual_quota,
          requires_attachment,
          is_system,
          is_active
        ) VALUES (
          $1, $2, $3, $4::int, $5::int,
          $6::int, $7::int, $8, $9, FALSE, $10
        )`,
        [
          candidateCode,
          data.name,
          data.description || null,
          maxDays,
          quotaPerYear,
          data.minNoticeDays,
          data.maxBackdateDays,
          data.deductsAnnualQuota,
          data.requiresAttachment,
          data.isActive,
        ]
      );

      return candidateCode;
    });

    revalidatePath("/admin");
    revalidatePath("/admin/leave-types");
    revalidatePath("/employee");
    revalidatePath("/leader");

    return {
      success: true,
      message: `Jenis cuti berhasil ditambahkan dengan kode otomatis ${finalCode}.`,
    };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal membuat jenis cuti:", error);
    return { error: "Gagal menambahkan jenis cuti. Silakan coba lagi." };
  }
}

export async function updateLeaveTypeAction(payload) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsedId = parseOptionalInt(payload?.id);
  if (!parsedId || Number.isNaN(parsedId) || parsedId <= 0) {
    return { error: "ID jenis cuti tidak valid." };
  }

  const parsed = leaveTypeSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data jenis cuti.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const data = parsed.data;
  const maxDays = parseOptionalInt(data.maxDaysPerRequest);
  const quotaPerYear = parseOptionalInt(data.quotaPerYear);

  try {
    await withTransaction(async (client) => {
      const dupName = await client.query(
        `SELECT id FROM leave_types WHERE LOWER(name) = LOWER($1) AND id <> $2::int LIMIT 1`,
        [data.name, parsedId]
      );
      if (dupName.rows[0]) {
        throw new Error("APP_ERROR:Nama jenis cuti sudah digunakan jenis lain.");
      }

      const res = await client.query(
        `UPDATE leave_types
        SET name = $2,
            description = $3,
            max_days_per_request = $4::int,
            quota_per_year = $5::int,
            min_notice_days = $6::int,
            max_backdate_days = $7::int,
            deducts_annual_quota = $8,
            requires_attachment = $9,
            is_active = $10
        WHERE id = $1::int
        RETURNING id`,
        [
          parsedId,
          data.name,
          data.description || null,
          maxDays,
          quotaPerYear,
          data.minNoticeDays,
          data.maxBackdateDays,
          data.deductsAnnualQuota,
          data.requiresAttachment,
          data.isActive,
        ]
      );

      if (!res.rows[0]) {
        throw new Error("APP_ERROR:Jenis cuti tidak ditemukan.");
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/leave-types");
    revalidatePath("/employee");
    revalidatePath("/leader");

    return { success: true, message: "Aturan jenis cuti berhasil diperbarui." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal memperbarui jenis cuti:", error);
    return { error: "Gagal memperbarui jenis cuti." };
  }
}

export async function deleteLeaveTypeAction(leaveTypeId) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsedId = parseOptionalInt(leaveTypeId);
  if (!parsedId || Number.isNaN(parsedId) || parsedId <= 0) {
    return { error: "ID jenis cuti tidak valid." };
  }

  try {
    await withTransaction(async (client) => {
      const existingRes = await client.query(
        `SELECT id, is_system FROM leave_types WHERE id = $1::int LIMIT 1`,
        [parsedId]
      );
      const existing = existingRes.rows[0];
      if (!existing) {
        throw new Error("APP_ERROR:Jenis cuti tidak ditemukan.");
      }

      if (existing.is_system) {
        throw new Error(
          "APP_ERROR:Jenis cuti bawaan sistem (is_system) tidak dapat dihapus."
        );
      }

      const usageRes = await client.query(
        `SELECT id FROM leave_requests WHERE leave_type_id = $1::int LIMIT 1`,
        [parsedId]
      );
      if (usageRes.rows[0]) {
        throw new Error(
          "APP_ERROR:Jenis cuti tidak dapat dihapus karena sudah dipakai pada pengajuan cuti. Nonaktifkan saja bila tidak lagi digunakan."
        );
      }

      await client.query(`DELETE FROM leave_types WHERE id = $1::int`, [parsedId]);
    });

    revalidatePath("/admin");
    revalidatePath("/admin/leave-types");
    revalidatePath("/employee");

    return { success: true, message: "Jenis cuti berhasil dihapus." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal menghapus jenis cuti:", error);
    return { error: "Gagal menghapus jenis cuti." };
  }
}

// ============================================================================
// 4. SERVER ACTIONS: HARI LIBUR (holidays)
// ============================================================================
const holidaySchema = z.object({
  holidayDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  name: z.string().trim().min(2, "Nama hari libur minimal 2 karakter.").max(100),
  isJointLeave: z.boolean().default(false),
});

export async function createHolidayAction(payload) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsed = holidaySchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data hari libur.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const data = parsed.data;

  try {
    await withTransaction(async (client) => {
      const dup = await client.query(
        `SELECT id FROM holidays WHERE holiday_date = $1::date LIMIT 1`,
        [data.holidayDate]
      );
      if (dup.rows[0]) {
        throw new Error("APP_ERROR:Tanggal libur tersebut sudah terdaftar.");
      }

      await client.query(
        `INSERT INTO holidays (holiday_date, name, is_joint_leave)
        VALUES ($1::date, $2, $3)`,
        [data.holidayDate, data.name, data.isJointLeave]
      );
    });

    revalidatePath("/admin");
    revalidatePath("/admin/holidays");
    revalidatePath("/employee");
    revalidatePath("/leader");

    return { success: true, message: "Hari libur berhasil ditambahkan." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal menambah hari libur:", error);
    return { error: "Gagal menambahkan hari libur." };
  }
}

export async function updateHolidayAction(payload) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsedId = parseOptionalInt(payload?.id);
  if (!parsedId || Number.isNaN(parsedId) || parsedId <= 0) {
    return { error: "ID hari libur tidak valid." };
  }

  const parsed = holidaySchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data hari libur.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const data = parsed.data;

  try {
    await withTransaction(async (client) => {
      const dup = await client.query(
        `SELECT id FROM holidays WHERE holiday_date = $1::date AND id <> $2::int LIMIT 1`,
        [data.holidayDate, parsedId]
      );
      if (dup.rows[0]) {
        throw new Error("APP_ERROR:Tanggal libur tersebut sudah digunakan data lain.");
      }

      const res = await client.query(
        `UPDATE holidays
        SET holiday_date = $2::date,
            name = $3,
            is_joint_leave = $4
        WHERE id = $1::int
        RETURNING id`,
        [parsedId, data.holidayDate, data.name, data.isJointLeave]
      );

      if (!res.rows[0]) {
        throw new Error("APP_ERROR:Data hari libur tidak ditemukan.");
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/holidays");
    revalidatePath("/employee");
    revalidatePath("/leader");

    return { success: true, message: "Data hari libur berhasil diperbarui." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal mengubah hari libur:", error);
    return { error: "Gagal memperbarui hari libur." };
  }
}

export async function deleteHolidayAction(holidayId) {
  const session = await requireAdminSession();
  if (!session) {
    return { error: "Akses ditolak." };
  }

  const parsedId = parseOptionalInt(holidayId);
  if (!parsedId || Number.isNaN(parsedId) || parsedId <= 0) {
    return { error: "ID hari libur tidak valid." };
  }

  try {
    await withTransaction(async (client) => {
      const res = await client.query(
        `DELETE FROM holidays WHERE id = $1::int RETURNING id`,
        [parsedId]
      );
      if (!res.rows[0]) {
        throw new Error("APP_ERROR:Data hari libur tidak ditemukan.");
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/holidays");
    revalidatePath("/employee");
    revalidatePath("/leader");

    return { success: true, message: "Hari libur berhasil dihapus." };
  } catch (error) {
    if (error?.message?.startsWith("APP_ERROR:")) {
      return { error: error.message.replace("APP_ERROR:", "") };
    }
    console.error("Gagal menghapus hari libur:", error);
    return { error: "Gagal menghapus hari libur." };
  }
}