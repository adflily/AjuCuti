"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/ui/StatusBadge";
import { changePasswordAction, updateProfileAction } from "@/actions/profile";
import { formatDateId, formatDays } from "@/lib/dateUtils";


// Membuang semua karakter selain angka 0-9 (maksimal 15 digit)
function sanitizePhoneInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

// Komponen interaktif halaman bersama /profile
// Kartu Sisa Kuota Cuti dan Jatah Cuti Tahunan hanya tampil untuk role user dan leader.

export default function ProfileClient({ profile, quota }) {
  const router = useRouter();
  const hasLeaveQuota = ["user", "leader"].includes(profile.role);

  // State form ubah profil
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [phone, setPhone] = useState(sanitizePhoneInput(profile.phone || ""));
  const [address, setAddress] = useState(profile.address || "");
  const [profileFeedback, setProfileFeedback] = useState({ type: "", message: "" });
  const [profileErrors, setProfileErrors] = useState({});
  const [isSavingProfile, startProfileTransition] = useTransition();

  // State form ganti kata sandi
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState({ type: "", message: "" });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [isSavingPassword, startPasswordTransition] = useTransition();

  function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileFeedback({ type: "", message: "" });
    setProfileErrors({});

    startProfileTransition(async () => {
      const result = await updateProfileAction({ fullName, phone, address });
      if (result?.error) {
        setProfileFeedback({ type: "error", message: result.error });
        setProfileErrors(result.fieldErrors || {});
        return;
      }

      setProfileFeedback({
        type: "success",
        message: result.message || "Profil berhasil diperbarui.",
      });
      router.refresh();
    });
  }

  function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordFeedback({ type: "", message: "" });
    setPasswordErrors({});

    startPasswordTransition(async () => {
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (result?.error) {
        setPasswordFeedback({ type: "error", message: result.error });
        setPasswordErrors(result.fieldErrors || {});
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({
        type: "success",
        message: result.message || "Kata sandi berhasil diganti.",
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* Kartu ringkasan identitas kepegawaian */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 break-words">
                {profile.full_name}
              </h2>
              <StatusBadge status={profile.role} />
              <StatusBadge status={profile.is_active ? "active" : "inactive"} />
            </div>
            <p className="text-sm text-slate-600 break-all">
              {profile.email} &middot; @{profile.username}
              {profile.employee_code ? ` · ${profile.employee_code}` : ""}
            </p>
          </div>

          {/* Kartu Sisa Kuota Cuti hanya untuk role user dan leader */}
          {hasLeaveQuota && quota && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-left sm:text-right shrink-0">
              <p className="text-xs font-medium text-blue-700">
                Sisa Kuota Cuti {quota.year}
              </p>
              <p className="text-lg font-bold text-blue-950">
                {formatDays(quota.remainingDays)}{" "}
                <span className="text-xs font-normal text-blue-700">
                  / {formatDays(quota.annualQuota)}
                </span>
              </p>
            </div>
          )}
        </div>

        <div
          className={`mt-5 grid grid-cols-1 sm:grid-cols-2 ${
            hasLeaveQuota ? "lg:grid-cols-4" : "lg:grid-cols-3"
          } gap-4 border-t border-slate-100 pt-4 text-sm`}
        >
          <div>
            <p className="text-xs text-slate-500">Divisi</p>
            <p className="mt-0.5 font-medium text-slate-900">
              {profile.division_name || "Tanpa Divisi"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Jabatan</p>
            <p className="mt-0.5 font-medium text-slate-900">
              {profile.position || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tanggal Bergabung</p>
            <p className="mt-0.5 font-medium text-slate-900">
              {profile.join_date ? formatDateId(profile.join_date) : "-"}
            </p>
          </div>

          {/* Item Jatah Cuti Tahunan disembunyikan untuk admin dan hrd */}
          {hasLeaveQuota && (
            <div>
              <p className="text-xs text-slate-500">Jatah Cuti Tahunan</p>
              <p className="mt-0.5 font-medium text-slate-900">
                {formatDays(profile.annual_leave_quota)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Form Ubah Profil & Ganti Kata Sandi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form 1: Data Profil */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Ubah Informasi Profil
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {hasLeaveQuota
              ? "Data nomor telepon dan alamat akan otomatis terisi sebagai bawaan saat pengajuan cuti."
              : "Perbarui nama lengkap, nomor telepon, dan alamat akun Anda."}
          </p>

          {profileFeedback.message && (
            <div
              role={profileFeedback.type === "error" ? "alert" : "status"}
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                profileFeedback.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {profileFeedback.message}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="mt-4 space-y-4" noValidate>
            <div>
              <label
                htmlFor="profileFullName"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Nama Lengkap <span className="text-red-600">*</span>
              </label>
              <input
                id="profileFullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSavingProfile}
                required
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {profileErrors.fullName && (
                <p className="mt-1 text-xs text-red-600">
                  {profileErrors.fullName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="profilePhone"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Nomor Telepon
              </label>
              <input
                id="profilePhone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={15}
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                disabled={isSavingProfile}
                placeholder="contoh: 081234567890"
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {profileErrors.phone && (
                <p className="mt-1 text-xs text-red-600">
                  {profileErrors.phone}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="profileAddress"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Alamat
              </label>
              <textarea
                id="profileAddress"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isSavingProfile}
                placeholder="Masukkan alamat tempat tinggal Anda..."
                className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {profileErrors.address && (
                <p className="mt-1 text-xs text-red-600">
                  {profileErrors.address}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {isSavingProfile ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </form>
        </section>

        {/* Form 2: Ganti Kata Sandi */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Ganti Kata Sandi
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Gunakan kata sandi minimal 8 karakter yang sulit ditebak.
          </p>

          {passwordFeedback.message && (
            <div
              role={passwordFeedback.type === "error" ? "alert" : "status"}
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                passwordFeedback.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {passwordFeedback.message}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4" noValidate>
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Kata Sandi Saat Ini <span className="text-red-600">*</span>
              </label>
              <input
                id="currentPassword"
                type={showPasswords ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSavingPassword}
                required
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {passwordErrors.currentPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {passwordErrors.currentPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Kata Sandi Baru <span className="text-red-600">*</span>
              </label>
              <input
                id="newPassword"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSavingPassword}
                placeholder="Minimal 8 karakter"
                required
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {passwordErrors.newPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {passwordErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Konfirmasi Kata Sandi Baru <span className="text-red-600">*</span>
              </label>
              <input
                id="confirmPassword"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSavingPassword}
                required
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {passwordErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {passwordErrors.confirmPassword}
                </p>
              )}
            </div>

            <label className="inline-flex items-center gap-2.5 min-h-[44px] cursor-pointer text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Tampilkan kata sandi</span>
            </label>

            <div>
              <button
                type="submit"
                disabled={isSavingPassword}
                className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              >
                {isSavingPassword ? "Memperbarui..." : "Ganti Kata Sandi"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}