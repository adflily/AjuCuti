"use client";

import { useMemo, useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import { createLeaveRequestAction } from "@/actions/leaves";
import {
  calculateWorkingDays,
  formatDays,
  getTodayDateString,
} from "@/lib/dateUtils";

// Modal form pengajuan cuti lengkap (dipakai oleh /employee dan tab cuti pribadi /leader)

export default function LeaveRequestFormModal({
  isOpen,
  onClose,
  onSuccess,
  leaveTypes = [],
  holidayDates = [],
  handoverCandidates = [],
  quota,
  defaultAddress = "",
  defaultPhone = "",
}) {
  const defaultTypeId = leaveTypes[0]?.id ? String(leaveTypes[0].id) : "";
  const todayStr = getTodayDateString();

  const [leaveTypeId, setLeaveTypeId] = useState(defaultTypeId);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [handoverUserId, setHandoverUserId] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [addressDuringLeave, setAddressDuringLeave] = useState(defaultAddress);
  const [emergencyPhone, setEmergencyPhone] = useState(defaultPhone);

  // State unggah lampiran via Route Handler /api/upload
  const [attachmentPath, setAttachmentPath] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // State error dan submit
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isPending, startTransition] = useTransition();

  const selectedType = useMemo(
    () => leaveTypes.find((lt) => String(lt.id) === String(leaveTypeId)) || null,
    [leaveTypes, leaveTypeId]
  );

  const holidayDateSet = useMemo(
    () => new Set(holidayDates.map((h) => h.holiday_date || h)),
    [holidayDates]
  );

  // Pratinjau otomatis hari kerja (Senin-Jumat dikurangi tabel holidays)
  const previewDays = useMemo(() => {
    const effectiveEnd = isHalfDay ? startDate : endDate;
    return calculateWorkingDays(
      startDate,
      effectiveEnd,
      holidayDateSet,
      isHalfDay
    );
  }, [startDate, endDate, holidayDateSet, isHalfDay]);

  const exceedsAnnualQuota =
    Boolean(selectedType?.deducts_annual_quota) &&
    quota &&
    previewDays > quota.remainingDays;

  function resetForm() {
    setLeaveTypeId(defaultTypeId);
    setStartDate(todayStr);
    setEndDate(todayStr);
    setIsHalfDay(false);
    setReason("");
    setHandoverUserId("");
    setHandoverNotes("");
    setAddressDuringLeave(defaultAddress);
    setEmergencyPhone(defaultPhone);
    setAttachmentPath("");
    setAttachmentName("");
    setUploadError("");
    setErrorMessage("");
    setFieldErrors({});
  }

  function handleClose() {
    if (isPending || isUploading) return;
    resetForm();
    onClose?.();
  }

  function handleHalfDayToggle(checked) {
    setIsHalfDay(checked);
    if (checked) {
      setEndDate(startDate);
    }
  }

  function handleStartDateChange(value) {
    setStartDate(value);
    if (isHalfDay || !endDate || endDate < value) {
      setEndDate(value);
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadError(data.error || "Gagal mengunggah lampiran.");
        return;
      }

      setAttachmentPath(data.attachmentPath);
      setAttachmentName(data.attachmentName);
    } catch {
      setUploadError("Gagal menghubungi server saat mengunggah lampiran.");
    } finally {
      setIsUploading(false);
      // Kosongkan input agar berkas yang sama bisa dipilih ulang bila perlu
      event.target.value = "";
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setFieldErrors({});

    if (isUploading) {
      setErrorMessage("Tunggu hingga proses unggah lampiran selesai.");
      return;
    }

    if (selectedType?.requires_attachment && !attachmentPath) {
      setErrorMessage(
        `${selectedType.name} wajib melampirkan dokumen pendukung.`
      );
      return;
    }

    startTransition(async () => {
      const result = await createLeaveRequestAction({
        leaveTypeId: Number(leaveTypeId),
        startDate,
        endDate: isHalfDay ? startDate : endDate,
        isHalfDay,
        reason,
        handoverUserId: handoverUserId ? Number(handoverUserId) : null,
        handoverNotes,
        addressDuringLeave,
        emergencyPhone,
        attachmentPath,
        attachmentName,
      });

      if (result?.error) {
        setErrorMessage(result.error);
        setFieldErrors(result.fieldErrors || {});
        return;
      }

      const successMessage =
        result?.message || "Pengajuan cuti berhasil dikirim.";
      resetForm();
      onSuccess?.(successMessage);
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Ajukan Cuti Baru"
      description="Lengkapi formulir di bawah ini sesuai ketentuan jenis cuti yang dipilih."
      size="lg"
      preventClose={isPending || isUploading}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending || isUploading}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="submit"
            form="leave-request-form"
            disabled={isPending || isUploading || leaveTypes.length === 0}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "Mengirim..." : "Kirim Pengajuan"}
          </button>
        </div>
      }
    >
      <form
        id="leave-request-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
      >
        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        {/* Pilihan jenis cuti */}
        <div>
          <label
            htmlFor="leaveTypeId"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Jenis Cuti <span className="text-red-600">*</span>
          </label>
          <select
            id="leaveTypeId"
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            disabled={isPending}
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            {leaveTypes.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.name} ({lt.code})
              </option>
            ))}
          </select>
          {fieldErrors.leaveTypeId && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.leaveTypeId}</p>
          )}

          {/* Ringkasan aturan dinamis dari tabel leave_types */}
          {selectedType && (
            <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900 space-y-1">
              {selectedType.description && (
                <p className="font-medium">{selectedType.description}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-blue-800">
                <span>
                  Potong kuota tahunan:{" "}
                  <strong>
                    {selectedType.deducts_annual_quota ? "Ya" : "Tidak"}
                  </strong>
                </span>
                {selectedType.max_days_per_request !== null && (
                  <span>
                    Maks/pengajuan:{" "}
                    <strong>{selectedType.max_days_per_request} hari</strong>
                  </span>
                )}
                {Number(selectedType.min_notice_days || 0) > 0 && (
                  <span>
                    Minimal pengajuan:{" "}
                    <strong>H-{selectedType.min_notice_days}</strong>
                  </span>
                )}
                {Number(selectedType.max_backdate_days || 0) > 0 && (
                  <span>
                    Pengajuan mundur maks:{" "}
                    <strong>{selectedType.max_backdate_days} hari</strong>
                  </span>
                )}
                <span>
                  Lampiran:{" "}
                  <strong>
                    {selectedType.requires_attachment ? "Wajib" : "Opsional"}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Toggle cuti setengah hari (0.5 hari) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1">
          <label className="inline-flex items-center gap-2.5 min-h-[44px] cursor-pointer text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={isHalfDay}
              onChange={(e) => handleHalfDayToggle(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Ajukan cuti setengah hari (0,5 hari kerja)</span>
          </label>
        </div>

        {/* Tanggal mulai & selesai */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Tanggal Mulai <span className="text-red-600">*</span>
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              disabled={isPending}
              required
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            {fieldErrors.startDate && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.startDate}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="endDate"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Tanggal Selesai <span className="text-red-600">*</span>
            </label>
            <input
              id="endDate"
              type="date"
              value={isHalfDay ? startDate : endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isPending || isHalfDay}
              required
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100 disabled:text-slate-500"
            />
            {fieldErrors.endDate && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.endDate}</p>
            )}
          </div>
        </div>

        {/* Pratinjau estimasi hari kerja */}
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            previewDays <= 0 || exceedsAnnualQuota
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Estimasi durasi hari kerja (tidak termasuk Sabtu, Minggu &amp; hari libur):</span>
            <strong className="text-base">{formatDays(previewDays)}</strong>
          </div>
          {previewDays <= 0 && (
            <p className="mt-1 text-xs text-amber-800">
              Tanggal yang dipilih jatuh pada akhir pekan atau hari libur nasional/cuti bersama.
            </p>
          )}
          {exceedsAnnualQuota && (
            <p className="mt-1 text-xs font-medium text-red-700">
              Durasi melebihi sisa kuota cuti tahunan Anda ({formatDays(quota.remainingDays)}).
            </p>
          )}
        </div>

        {/* Alasan cuti */}
        <div>
          <label
            htmlFor="reason"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Alasan Cuti <span className="text-red-600">*</span>
          </label>
          <textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
            placeholder="Jelaskan keperluan cuti Anda secara ringkas..."
            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          {fieldErrors.reason && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.reason}</p>
          )}
        </div>

        {/* Rekan pengganti (handover) & catatan tugas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="handoverUserId"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Rekan Pengganti (Handover)
            </label>
            <select
              id="handoverUserId"
              value={handoverUserId}
              onChange={(e) => setHandoverUserId(e.target.value)}
              disabled={isPending}
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="">-- Pilih rekan pengganti (opsional) --</option>
              {handoverCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.full_name}
                  {candidate.division_name ? ` — ${candidate.division_name}` : ""}
                  {candidate.is_same_division ? " (Satu Divisi)" : ""}
                </option>
              ))}
            </select>
            {fieldErrors.handoverUserId && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.handoverUserId}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="emergencyPhone"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Nomor Darurat <span className="text-red-600">*</span>
            </label>
            <input
              id="emergencyPhone"
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              disabled={isPending}
              placeholder="contoh: 081234567890"
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            {fieldErrors.emergencyPhone && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.emergencyPhone}
              </p>
            )}
          </div>
        </div>

        {/* Catatan serah terima tugas */}
        <div>
          <label
            htmlFor="handoverNotes"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Catatan Serah Terima Tugas
          </label>
          <textarea
            id="handoverNotes"
            rows={2}
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            disabled={isPending}
            placeholder="Daftar pekerjaan yang dialihkan atau hal penting selama Anda cuti..."
            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        {/* Alamat selama cuti */}
        <div>
          <label
            htmlFor="addressDuringLeave"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Alamat Selama Cuti <span className="text-red-600">*</span>
          </label>
          <input
            id="addressDuringLeave"
            type="text"
            value={addressDuringLeave}
            onChange={(e) => setAddressDuringLeave(e.target.value)}
            disabled={isPending}
            placeholder="contoh: Jl. Merdeka No. 10, Bandung"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          {fieldErrors.addressDuringLeave && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.addressDuringLeave}
            </p>
          )}
        </div>

        {/* Upload lampiran via /api/upload */}
        <div>
          <label
            htmlFor="attachmentFile"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Lampiran Dokumen{" "}
            {selectedType?.requires_attachment ? (
              <span className="text-red-600">* (Wajib)</span>
            ) : (
              <span className="text-slate-400 font-normal">(Opsional)</span>
            )}
          </label>

          {attachmentPath ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-emerald-900 truncate">
                  {attachmentName}
                </p>
                <a
                  href={attachmentPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-700 underline"
                >
                  Pratinjau lampiran
                </a>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAttachmentPath("");
                  setAttachmentName("");
                }}
                disabled={isPending}
                className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Hapus
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3.5">
              <input
                id="attachmentFile"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                disabled={isPending || isUploading}
                className="block w-full text-sm text-slate-600 file:mr-3 file:min-h-[44px] file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {isUploading
                  ? "Sedang mengunggah berkas..."
                  : "Format: PDF, JPG, PNG, atau WEBP (maksimal 5 MB)."}
              </p>
            </div>
          )}

          {uploadError && (
            <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}