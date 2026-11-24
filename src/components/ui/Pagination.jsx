"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Komponen paginasi responsif.
// Mendukung mode callback (onPageChange) maupun mode otomatis berbasis query URL (?page=...).

function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("...");
  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }
  if (end < totalPages - 1) pages.push("...");
  pages.push(totalPages);

  return pages;
}

function PaginationInner({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  pageParam = "page",
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }

  const safeCurrent = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = (safeCurrent - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrent * pageSize, totalItems);
  const pageNumbers = buildPageNumbers(safeCurrent, totalPages);

  function goToPage(targetPage) {
    if (targetPage < 1 || targetPage > totalPages || targetPage === safeCurrent) {
      return;
    }

    if (onPageChange) {
      onPageChange(targetPage);
      return;
    }

    // Pertahankan filter dan parameter sortir yang sudah ada di URL
    const params = new URLSearchParams(searchParams.toString());
    params.set(pageParam, String(targetPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <nav
      aria-label="Navigasi halaman"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4"
    >
      <p className="text-sm text-slate-600">
        Menampilkan <span className="font-semibold text-slate-900">{startItem}</span>
        &ndash;
        <span className="font-semibold text-slate-900">{endItem}</span> dari{" "}
        <span className="font-semibold text-slate-900">{totalItems}</span> data
      </p>

      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
        <button
          type="button"
          onClick={() => goToPage(safeCurrent - 1)}
          disabled={safeCurrent <= 1}
          className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Sebelumnya
        </button>

        {/* Indikator ringkas di mobile */}
        <span className="text-sm font-medium text-slate-700 sm:hidden">
          {safeCurrent} / {totalPages}
        </span>

        {/* Nomor halaman untuk layar >= sm */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((item, idx) =>
            item === "..." ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 text-sm text-slate-400 select-none"
              >
                &hellip;
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => goToPage(item)}
                aria-current={item === safeCurrent ? "page" : undefined}
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors ${
                  item === safeCurrent
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => goToPage(safeCurrent + 1)}
          disabled={safeCurrent >= totalPages}
          className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Berikutnya
        </button>
      </div>
    </nav>
  );
}

export default function Pagination(props) {
  return (
    <Suspense fallback={null}>
      <PaginationInner {...props} />
    </Suspense>
  );
}