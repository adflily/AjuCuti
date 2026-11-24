import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Nama cookie sesi httpOnly
export const SESSION_COOKIE_NAME = "session";

// Durasi "Ingat saya" = 30 hari (dalam detik)
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// Peta halaman utama untuk masing-masing role
export const ROLE_HOME_PATH = {
  admin: "/admin",
  user: "/employee",
  leader: "/leader",
  hrd: "/hrd",
};

const VALID_ROLES = new Set(Object.keys(ROLE_HOME_PATH));

/**
 * Mengembalikan URL dashboard sesuai role pengguna.
 *
 * @param {string} role
 * @returns {string}
 */
export function getRoleHomePath(role) {
  return ROLE_HOME_PATH[role] || "/login";
}

/**
 * Mengambil kunci rahasia JWT dalam bentuk Uint8Array untuk jose.
 */
function getSecretKey() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "Variabel lingkungan JWT_SECRET belum diatur. Periksa file .env Anda."
    );
  }

  return new TextEncoder().encode(secret);
}

/**
 * Opsi dasar cookie sesi yang aman.
 */
function getBaseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/**
 * Membuat JWT sesi dan menyimpannya ke cookie httpOnly "session".
 * - remember = true  -> cookie berlaku 30 hari
 * - remember = false -> cookie sesi (hilang saat browser ditutup, JWT kedaluwarsa 1 hari)
 *
 * @param {object} user - Data user dari tabel users
 * @param {boolean} [remember=false] - Status checkbox "Ingat saya"
 */
export async function createSession(user, remember = false) {
  const payload = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    username: user.username,
    role: user.role,
    divisionId: user.division_id ?? null,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(remember ? "30d" : "1d")
    .sign(getSecretKey());

  const cookieStore = await cookies();
  const cookieOptions = getBaseCookieOptions();

  if (remember) {
    cookieOptions.maxAge = REMEMBER_MAX_AGE_SECONDS;
  }

  cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions);

  return payload;
}

/**
 * Membaca dan memverifikasi JWT dari cookie "session".
 * Mengembalikan objek sesi jika valid, atau null jika belum login / token tidak valid.
 */
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    if (!payload?.id || !VALID_ROLES.has(payload.role)) {
      return null;
    }

    return {
      id: Number(payload.id),
      fullName: String(payload.fullName || ""),
      email: String(payload.email || ""),
      username: String(payload.username || ""),
      role: String(payload.role),
      divisionId:
        payload.divisionId !== null && payload.divisionId !== undefined
          ? Number(payload.divisionId)
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * Menghapus cookie sesi "session" saat logout.
 */
export async function destroySession() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getBaseCookieOptions(),
    maxAge: 0,
  });
}

/**
 * Memastikan pengguna sudah login dan memiliki salah satu role yang diizinkan.
 * - Belum login -> redirect ke /login
 * - Role tidak cocok -> redirect ke dashboard sesuai role pengguna
 *
 * @param {string | string[]} [roles] - Role atau daftar role yang diizinkan
 */
export async function requireRole(roles) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      redirect(getRoleHomePath(session.role));
    }
  }

  return session;
}