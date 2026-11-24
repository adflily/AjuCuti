"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";

// Dialog konfirmasi yang mendukung konfirmasi 1 tahap maupun 2 tahap (doubleConfirm)
// Contoh pemakaian 2 tahap: konfirmasi dua kali saat Admin menghapus divisi.

const BUTTON_VARIANTS = {
  danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-600",
  warning: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-600",
  primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-600",
};

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Konfirmasi Tindakan",
  description = "Apakah Anda yakin ingin melanjutkan tindakan ini?",
  confirmLabel = "Ya, Lanjutkan",
  cancelLabel = "Batal",
  variant = "danger",
  isLoading = false,
  confirmDisabled = false,
  doubleConfirm = false,
  secondConfirmTitle = "Konfirmasi Sekali Lagi",
  secondConfirmDescription = "Tindakan ini bersifat permanen dan tidak dapat dibatalkan. Pastikan Anda benar-benar yakin.",
  secondConfirmLabel = "Ya, Saya Yakin",
  children,
}) {
  const [step, setStep] = useState(1);

  // Reset kembali ke langkah 1 setiap kali dialog ditutup
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  const isSecondStep = doubleConfirm && step === 2;
  const activeTitle = isSecondStep ? secondConfirmTitle : title;
  const activeDescription = isSecondStep ? secondConfirmDescription : description;
  const activeConfirmLabel = isSecondStep ? secondConfirmLabel : confirmLabel;

  function handleConfirmClick() {
    if (doubleConfirm && step === 1) {
      setStep(2);
      return;
    }
    onConfirm?.();
  }

  function handleCancelClick() {
    if (isLoading) return;
    if (isSecondStep) {
      setStep(1);
      return;
    }
    onClose?.();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeTitle}
      size="sm"
      preventClose={isLoading}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isLoading}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {isSecondStep ? "Kembali" : cancelLabel}
          </button>

          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isLoading || confirmDisabled}
            className={`min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
              BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.danger
            }`}
          >
            {isLoading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span>Memproses...</span>
              </>
            ) : (
              activeConfirmLabel
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {doubleConfirm && (
          <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">
            Langkah Konfirmasi {step} dari 2
          </div>
        )}

        {activeDescription && (
          <p className="text-sm leading-relaxed text-slate-600">
            {activeDescription}
          </p>
        )}

        {/* Slot konten tambahan (mis. textarea alasan penolakan/pembatalan) */}
        {!isSecondStep && children}
      </div>
    </Modal>
  );
}