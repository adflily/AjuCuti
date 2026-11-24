"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth";

// Label role dalam Bahasa Indonesia
const ROLE_LABELS = {
  admin: "Administrator",
  user: "Karyawan",
  leader: "Ketua Divisi",
  hrd: "HRD",
};

// Daftar menu sidebar yang berbeda untuk setiap role
const MENU_BY_ROLE = {
  admin: [
    { href: "/admin", label: "Dashboard", exact: true, icon: "home" },
    { href: "/admin/users", label: "Pengguna", icon: "users" },
    { href: "/admin/divisions", label: "Divisi & Anggota", icon: "building" },
    { href: "/admin/leave-types", label: "Jenis Cuti", icon: "tag" },
    { href: "/admin/holidays", label: "Hari Libur", icon: "calendar" },
    { href: "/history", label: "Riwayat Cuti", icon: "history" },
    { href: "/profile", label: "Profil Saya", icon: "profile" },
  ],
  user: [
    { href: "/employee", label: "Cuti Saya", exact: true, icon: "home" },
    { href: "/history", label: "Riwayat Cuti", icon: "history" },
    { href: "/profile", label: "Profil Saya", icon: "profile" },
  ],
  leader: [
    { href: "/leader", label: "Verifikasi & Cuti", exact: true, icon: "check" },
    { href: "/history", label: "Riwayat Cuti", icon: "history" },
    { href: "/profile", label: "Profil Saya", icon: "profile" },
  ],
  hrd: [
    { href: "/hrd", label: "Persetujuan HRD", exact: true, icon: "check" },
    { href: "/history", label: "Riwayat Cuti", icon: "history" },
    { href: "/profile", label: "Profil Saya", icon: "profile" },
  ],
};

// Ikon SVG ringan agar tidak bergantung pada library ikon eksternal
function MenuIcon({ name }) {
  const commonProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "h-5 w-5 shrink-0",
    "aria-hidden": true,
  };

  switch (name) {
    case "users":
      return (
        <svg {...commonProps}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "building":
      return (
        <svg {...commonProps}>
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
        </svg>
      );
    case "tag":
      return (
        <svg {...commonProps}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...commonProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "check":
      return (
        <svg {...commonProps}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "history":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "profile":
      return (
        <svg {...commonProps}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
  }
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function AppShell({
  user,
  title,
  subtitle,
  actions,
  children,
}) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const menuItems = MENU_BY_ROLE[user?.role] || [];
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || "-";

  // Tutup drawer otomatis saat berpindah halaman
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Tutup drawer dengan tombol Escape dan kunci scroll body saat terbuka di mobile
  useEffect(() => {
    if (!isDrawerOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  function isMenuActive(item) {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  function renderSidebarContent() {
    return (
      <div className="flex h-full flex-col">
        {/* Identitas brand AjuCuti */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm">
              AC
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight text-slate-900 truncate">
                AjuCuti
              </p>
              <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
            </div>
          </div>

          {/* Tombol tutup drawer khusus mobile */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Tutup menu navigasi"
            className="lg:hidden flex min-h-[44px] min-w-[44px] -mr-2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Daftar tautan navigasi */}
        <nav
          aria-label="Navigasi utama"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
        >
          {menuItems.map((item) => {
            const active = isMenuActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <MenuIcon name={item.icon} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Info akun ringkas di bagian bawah sidebar */}
        <div className="border-t border-slate-200 p-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {user?.fullName || "Pengguna"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {user?.email || user?.username || "-"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar permanen di desktop (>= lg) */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col border-r border-slate-200 bg-white">
        {renderSidebarContent()}
      </aside>

      {/* Drawer sidebar untuk mobile & tablet (< lg) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Area utama (Navbar + Konten) */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Navbar atas sticky */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Tombol hamburger untuk membuka drawer di mobile */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden flex min-h-[44px] min-w-[44px] -ml-2 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <span className="lg:hidden font-bold text-slate-900 text-base truncate">
              AjuCuti
            </span>
            <span className="hidden lg:inline text-sm font-medium text-slate-500 truncate">
              Sistem Manajemen Cuti Karyawan
            </span>
          </div>

          {/* Kanan navbar: nama user + tombol logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/profile"
              className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-2 py-1 hover:bg-slate-100 transition-colors"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {getInitials(user?.fullName)}
              </span>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-sm font-semibold text-slate-900 max-w-[160px] truncate">
                  {user?.fullName || "Pengguna"}
                </p>
                <p className="text-xs text-slate-500">{roleLabel}</p>
              </div>
            </Link>

            <form action={logoutAction}>
              <button
                type="submit"
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 sm:px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Keluar</span>
              </button>
            </form>
          </div>
        </header>

        {/* Konten halaman */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {(title || subtitle || actions) && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  {title && (
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
                  )}
                </div>
                {actions && (
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {actions}
                  </div>
                )}
              </div>
            )}

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}