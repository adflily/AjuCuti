import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Middleware Edge-safe: HANYA membaca cookie dan verifikasi JWT via jose.
// DILARANG mengimpor pg atau modul database di file ini.

const SESSION_COOKIE_NAME = "session";

// Peta dashboard utama untuk setiap role
const ROLE_HOME_PATH = {
  admin: "/admin",
  user: "/employee",
  leader: "/leader",
  hrd: "/hrd",
};

// Aturan prefix URL yang hanya boleh diakses oleh role tertentu
const ROLE_PREFIX_RULES = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/employee", role: "user" },
  { prefix: "/leader", role: "leader" },
  { prefix: "/hrd", role: "hrd" },
];

/**
 * Memverifikasi token JWT sesi menggunakan jose.
 * Mengembalikan payload ringkas jika valid, atau null jika tidak valid / kedaluwarsa.
 *
 * @param {string | undefined} token
 */
async function verifySessionToken(token) {
  if (!token) {
    return null;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (!payload?.id || !ROLE_HOME_PATH[payload.role]) {
      return null;
    }

    return {
      id: Number(payload.id),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  // 1. Jika membuka /login
  if (pathname === "/login") {
    if (session) {
      // Sudah login -> arahkan ke dashboard sesuai role
      const homeUrl = new URL(ROLE_HOME_PATH[session.role], request.url);
      return NextResponse.redirect(homeUrl);
    }

    const response = NextResponse.next();
    // Bersihkan cookie jika token lama sudah tidak valid atau kedaluwarsa
    if (token) {
      response.cookies.delete(SESSION_COOKIE_NAME);
    }
    return response;
  }

  // 2. Halaman terproteksi tetapi pengguna belum login / token tidak valid
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", `${pathname}${search}`);

    const response = NextResponse.redirect(loginUrl);
    if (token) {
      response.cookies.delete(SESSION_COOKIE_NAME);
    }
    return response;
  }

  // 3. Cek kesesuaian role terhadap prefix URL (/admin, /employee, /leader, /hrd)
  const matchedRule = ROLE_PREFIX_RULES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (matchedRule && matchedRule.role !== session.role) {
    const homeUrl = new URL(ROLE_HOME_PATH[session.role], request.url);
    return NextResponse.redirect(homeUrl);
  }

  // 4. Lolos pemeriksaan (termasuk route bersama /profile dan /history)
  return NextResponse.next();
}

// Matcher hanya mencakup halaman login dan seluruh route terproteksi
export const config = {
  matcher: [
    "/login",
    "/admin/:path*",
    "/employee/:path*",
    "/leader/:path*",
    "/hrd/:path*",
    "/profile/:path*",
    "/history/:path*",
  ],
};