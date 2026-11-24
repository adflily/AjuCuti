"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

const SALT_ROUNDS = 10;

const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter.")
    .max(120, "Nama lengkap maksimal 120 karakter."),
  phone: z
    .string()
    .trim()
    .max(30, "Nomor telepon maksimal 30 karakter.")
    .refine((val) => val === "" || /^[0-9+\-\s()]{8,30}$/.test(val), {
      message: "Format nomor telepon tidak valid (minimal 8 digit).",
    })
    .optional()
    .default(""),
  address: z
    .string()
    .trim()
    .max(500, "Alamat maksimal 500 karakter.")
    .optional()
    .default(""),
});

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Kata sandi saat ini wajib diisi."),
    newPassword: z
      .string()
      .min(8, "Kata sandi baru minimal 8 karakter.")
      .max(100, "Kata sandi baru maksimal 100 karakter."),
    confirmPassword: z
      .string()
      .min(1, "Konfirmasi kata sandi baru wajib diisi."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Kata sandi baru harus berbeda dari kata sandi saat ini.",
    path: ["newPassword"],
  });

/**
 * Server Action: Memperbarui profil dasar pengguna yang sedang login.
 */
export async function updateProfileAction(payload) {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const parsed = updateProfileSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali data profil Anda.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const { fullName, phone, address } = parsed.data;

  try {
    await query(
      `UPDATE users
      SET full_name = $2,
          phone = $3,
          address = $4
      WHERE id = $1::int`,
      [session.id, fullName, phone || null, address || null]
    );

    revalidatePath("/profile");
    revalidatePath("/employee");
    revalidatePath("/leader");

    return {
      success: true,
      message: "Profil Anda berhasil diperbarui.",
    };
  } catch (error) {
    console.error("Gagal memperbarui profil:", error);
    return { error: "Gagal menyimpan perubahan profil. Silakan coba lagi." };
  }
}

/**
 * Server Action: Mengganti kata sandi pengguna yang sedang login (verifikasi sandi lama via bcryptjs).
 */
export async function changePasswordAction(payload) {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const parsed = changePasswordSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon periksa kembali input kata sandi Anda.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
      ),
    };
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const userRes = await query(
      `SELECT password_hash FROM users WHERE id = $1::int LIMIT 1`,
      [session.id]
    );
    const user = userRes.rows[0];
    if (!user) {
      return { error: "Akun pengguna tidak ditemukan." };
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return {
        error: "Kata sandi saat ini tidak sesuai.",
        fieldErrors: { currentPassword: "Kata sandi saat ini salah." },
      };
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query(
      `UPDATE users SET password_hash = $2 WHERE id = $1::int`,
      [session.id, newHash]
    );

    return {
      success: true,
      message: "Kata sandi Anda berhasil diganti.",
    };
  } catch (error) {
    console.error("Gagal mengganti kata sandi:", error);
    return { error: "Gagal mengganti kata sandi. Silakan coba lagi." };
  }
}