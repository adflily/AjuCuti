"use client";

import { useEffect } from "react";

// Modal responsif: bottom-sheet di layar mobile dan dialog terpusat di tablet/desktop

const SIZE_CLASSES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  preventClose = false,
}) {
  // Mengunci scroll halaman belakang dan menangani tombol Escape saat modal terbuka
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !preventClose) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, preventClose]);

  if (!isOpen) {
    return null;
  }

  function handleBackdropClick() {
    if (closeOnBackdrop && !preventClose) {
      onClose?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Latar gelap semi-transparan */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Kontainer modal: bottom-sheet penuh lebar di mobile, kartu membulat di desktop */}
      <div
        className={`relative z-10 flex w-full flex-col bg-white shadow-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl ${
          SIZE_CLASSES[size] || SIZE_CLASSES.md
        }`}
      >
        {/* Indikator pegangan bottom-sheet khusus mobile */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-slate-300" />
        </div>

        {/* Header modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            {title && (
              <h2
                id="modal-title"
                className="text-base sm:text-lg font-semibold text-slate-900"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>

          {!preventClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="flex min-h-[44px] min-w-[44px] -mr-2 -mt-1.5 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
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
          )}
        </div>

        {/* Isi konten yang dapat di-scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>

        {/* Footer opsional */}
        {footer && (
          <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-6 sm:py-4 rounded-b-none sm:rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}