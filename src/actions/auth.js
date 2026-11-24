"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query } from "@/lib/db";
import {
  createSession,
  destroySession,
  getRoleHomePath,
  getSession,
} from "@/lib/session";

// Skema validasi input login
const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Email atau username wajib diisi."),
  password: z
    .string()
    .min(1, "Kata sandi wajib diisi."),
  remember: z.boolean().default(false),
  from: z.string().optional().default(""),
});

// Pemetaan prefix route yang dibatasi per role
const ROLE_PREFIX_MAP = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/employee", role: "user" },
  { prefix: "/leader", role: "leader" },
  { prefix: "/hrd", role: "hrd" },
];

// Prefix route bersama yang dapat diakses semua role terautentikasi
const SHARED_PREFIXES = ["/profile", "/history"];

/**
 * Memastikan URL redirect tujuan (?from=...) aman (tidak open-redirect)
 * dan sesuai dengan hak akses role pengguna.
 *
 * @param {string} fromPath
 * @param {string} role
 * @returns {string}
 */
function resolveSafeRedirect(fromPath, role) {
  const defaultHome = getRoleHomePath(role);

  if (
    !fromPath ||
    typeof fromPath !== "string" ||
    !fromPath.startsWith("/") ||
    fromPath.startsWith("//") ||
    fromPath.includes("\\") ||
    fromPath.startsWith("/login")
  ) {
    return defaultHome;
  }

  // Izinkan halaman shared untuk semua role
  const isSharedRoute = SHARED_PREFIXES.some(
    (prefix) => fromPath === prefix || fromPath.startsWith(`${prefix}/`) || fromPath.startsWith(`${prefix}?`)
  );
  if (isSharedRoute) {
    return fromPath;
  }

  // Cek apakah prefix sesuai dengan role pengguna
  const matchedRolePrefix = ROLE_PREFIX_MAP.find(
    ({ prefix }) =>
      fromPath === prefix ||
      fromPath.startsWith(`${prefix}/`) ||
      fromPath.startsWith(`${prefix}?`)
  );

  if (matchedRolePrefix && matchedRolePrefix.role === role) {
    return fromPath;
  }

  return defaultHome;
}

/**
 * Server Action untuk login menggunakan email ATAU username.
 * Mendukung pemanggilan (prevState, formData) maupun (formData).
 */
export async function loginAction(prevState, formData) {
  const actualFormData = prevState instanceof FormData ? prevState : formData;

  if (!(actualFormData instanceof FormData)) {
    return {
      error: "Permintaan login tidak valid.",
      fieldErrors: {},
    };
  }

  const rawRemember = actualFormData.get("remember");
  const parsed = loginSchema.safeParse({
    identifier: String(actualFormData.get("identifier") ?? ""),
    password: String(actualFormData.get("password") ?? ""),
    remember: rawRemember === "on" || rawRemember === "true",
    from: String(actualFormData.get("from") ?? ""),
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    return {
      error: "Mohon lengkapi email/username dan kata sandi dengan benar.",
      fieldErrors: {
        identifier: flattened.identifier?.[0] || "",
        password: flattened.password?.[0] || "",
      },
    };
  }

  const { identifier, password, remember, from } = parsed.data;
  let targetRedirect = "";

  try {
    // Query terparameterisasi untuk mencari akun berdasarkan email atau username
    const result = await query(
      `SELECT
        id,
        employee_code,
        full_name,
        email,
        username,
        password_hash,
        role,
        division_id,
        is_active
      FROM users
      WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
      LIMIT 1`,
      [identifier]
    );

    const user = result.rows[0];

    if (!user) {
      return {
        error: "Email/username atau kata sandi tidak sesuai.",
        fieldErrors: {},
      };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return {
        error: "Email/username atau kata sandi tidak sesuai.",
        fieldErrors: {},
      };
    }

    // Tolak pengguna yang status akunnya tidak aktif
    if (!user.is_active) {
      return {
        error: "Akun Anda sedang nonaktif. Silakan hubungi admin atau HRD.",
        fieldErrors: {},
      };
    }

    await createSession(user, remember);
    targetRedirect = resolveSafeRedirect(from, user.role);
  } catch (error) {
    console.error("Kesalahan saat login:", error);
    return {
      error: "Terjadi gangguan pada server. Silakan coba beberapa saat lagi.",
      fieldErrors: {},
    };
  }

  // redirect() dipanggil di luar blok try/catch sesuai standar Next.js App Router
  redirect(targetRedirect);
}

/**
 * Server Action untuk keluar dari sesi aktif.
 */
export async function logoutAction() {
  // Verifikasi sesi terlebih dahulu sebelum menghapus cookie
  await getSession();
  await destroySession();
  redirect("/login");
}