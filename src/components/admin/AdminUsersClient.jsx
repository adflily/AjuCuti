"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  createUserAction,
  resetUserPasswordAction,
  toggleUserActiveAction,
  updateUserAction,
} from "@/actions/admin";
import { formatDateId } from "@/lib/dateUtils";

// CMS Pengguna untuk Admin (/admin/users)
// Aturan:
// - Create User tidak punya input employee_code (otomatis EMP-<id>)
// - Field kuota cuti hanya tampil jika role = user atau leader
// - Kolom kuota di tabel menampilkan "-" untuk admin dan hrd

const ROLES_WITH_QUOTA = new Set(["user", "leader"]);

const EMPTY_FORM = {
  fullName: "",
  email: "",
  username: "",
  password: "",
  role: "user",
  divisionId: "",
  position: "",
  phone: "",
  address: "",
  annualLeaveQuota: "12",
  joinDate: "",
  isActive: true,
};

export default function AdminUsersClient({
  currentAdminId,
  users = [],
  pagination,
  divisions = [],
  initialFilters,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialFilters.search || "");
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // State modal tambah / edit pengguna
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, startSaveTransition] = useTransition();

  // State modal reset kata sandi
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetError, setResetError] = useState("");
  const [isResetting, startResetTransition] = useTransition();

  // State konfirmasi aktif/nonaktif akun
  const [toggleTarget, setToggleTarget] = useState(null);
  const [isToggling, startToggleTransition] = useTransition();

  const showQuotaField = ROLES_WITH_QUOTA.has(formValues.role);

  function updateQueryParam(updates) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateQueryParam({ search: searchInput.trim() });
  }

  function handleResetFilters() {
    setSearchInput("");
    router.push(pathname);
  }

  function openCreateModal() {
    setEditingUser(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function openEditModal(user) {
    setEditingUser(user);
    const hasQuota = ROLES_WITH_QUOTA.has(user.role);
    setFormValues({
      fullName: user.full_name || "",
      email: user.email || "",
      username: user.username || "",
      password: "",
      role: user.role || "user",
      divisionId: user.division_id ? String(user.division_id) : "",
      position: user.position || "",
      phone: user.phone || "",
      address: user.address || "",
      annualLeaveQuota: hasQuota ? String(user.annual_leave_quota ?? 12) : "0",
      joinDate: user.join_date || "",
      isActive: Boolean(user.is_active),
    });
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function handleFieldChange(key, value) {
    if (key === "role") {
      setFormValues((prev) => {
        const nextHasQuota = ROLES_WITH_QUOTA.has(value);
        const prevHasQuota = ROLES_WITH_QUOTA.has(prev.role);
        let nextQuota = prev.annualLeaveQuota;

        // Jika berpindah dari admin/hrd ke user/leader dan kuota masih 0/kosong, isi bawaan 12
        if (nextHasQuota && !prevHasQuota && (!nextQuota || nextQuota === "0")) {
          nextQuota = "12";
        }
        return { ...prev, role: value, annualLeaveQuota: nextQuota };
      });
      return;
    }

    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSaveSubmit(event) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    startSaveTransition(async () => {
      const payload = {
        fullName: formValues.fullName,
        email: formValues.email,
        username: formValues.username,
        role: formValues.role,
        divisionId: formValues.divisionId ? Number(formValues.divisionId) : null,
        position: formValues.position,
        phone: formValues.phone,
        address: formValues.address,
        annualLeaveQuota: showQuotaField ? Number(formValues.annualLeaveQuota) : 0,
        joinDate: formValues.joinDate,
      };

      const result = editingUser
        ? await updateUserAction({
            ...payload,
            id: editingUser.id,
            isActive: formValues.isActive,
          })
        : await createUserAction({
            ...payload,
            password: formValues.password,
          });

      if (result?.error) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors || {});
        return;
      }

      setIsFormOpen(false);
      setFeedback({
        type: "success",
        message: result.message || "Data pengguna berhasil disimpan.",
      });
      router.refresh();
    });
  }

  function openResetModal(user) {
    setResetTarget(user);
    setNewPassword("");
    setShowNewPassword(false);
    setResetError("");
  }

  function handleConfirmResetPassword(event) {
    event.preventDefault();
    if (!resetTarget) return;

    if (newPassword.length < 8) {
      setResetError("Kata sandi baru minimal 8 karakter.");
      return;
    }

    setResetError("");
    startResetTransition(async () => {
      const result = await resetUserPasswordAction({
        id: resetTarget.id,
        newPassword,
      });

      if (result?.error) {
        setResetError(result.error);
        return;
      }

      setResetTarget(null);
      setFeedback({
        type: "success",
        message: result.message || "Kata sandi berhasil direset.",
      });
    });
  }

  function handleConfirmToggleActive() {
    if (!toggleTarget) return;

    startToggleTransition(async () => {
      const result = await toggleUserActiveAction(toggleTarget.id);
      setToggleTarget(null);

      if (result?.error) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      setFeedback({
        type: "success",
        message: result.message || "Status akun berhasil diperbarui.",
      });
      router.refresh();
    });
  }

  const columns = [
    {
      key: "full_name",
      header: "Pengguna",
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.full_name}</p>
          <p className="text-xs text-slate-500">
            {row.email} &middot; @{row.username}
          </p>
          {row.employee_code && (
            <p className="text-[11px] font-medium text-slate-400">
              {row.employee_code}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => <StatusBadge status={row.role} />,
    },
    {
      key: "division_name",
      header: "Divisi & Jabatan",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.division_name || "Tanpa Divisi"}
          </p>
          <p className="text-xs text-slate-500">{row.position || "-"}</p>
        </div>
      ),
    },
    {
      key: "annual_leave_quota",
      header: "Kuota / Tahun",
      render: (row) => {
        const hasQuota = ROLES_WITH_QUOTA.has(row.role);
        return (
          <div>
            {hasQuota ? (
              <p className="font-medium text-slate-900">
                {row.annual_leave_quota} hari
              </p>
            ) : (
              <p className="font-medium text-slate-400">-</p>
            )}
            {row.join_date && (
              <p className="text-xs text-slate-500">
                Masuk {formatDateId(row.join_date)}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "is_active",
      header: "Status",
      render: (row) => (
        <StatusBadge status={row.is_active ? "active" : "inactive"} />
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      isAction: true,
      render: (row) => {
        const isSelf = row.id === currentAdminId;
        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => openEditModal(row)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => openResetModal(row)}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              Reset Sandi
            </button>
            {!isSelf && (
              <button
                type="button"
                onClick={() => setToggleTarget(row)}
                className={`min-h-[44px] inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold ${
                  row.is_active
                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                {row.is_active ? "Nonaktifkan" : "Aktifkan"}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const hasActiveFilter =
    initialFilters.role !== "all" ||
    initialFilters.divisionId !== "all" ||
    initialFilters.status !== "all" ||
    Boolean(initialFilters.search) ||
    initialFilters.sort !== "newest";

  return (
    <div className="space-y-6">
      {feedback.message && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: "", message: "" })}
            aria-label="Tutup pemberitahuan"
            className="min-h-[44px] min-w-[44px] -mr-2 inline-flex items-center justify-center rounded-lg hover:bg-black/5"
          >
            &times;
          </button>
        </div>
      )}

      {/* Toolbar tambah, filter, dan sortir */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Pengguna
            </h2>
            <p className="text-xs text-slate-500">
              Kelola akun karyawan, ketua divisi, HRD, dan administrator.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Tambah Pengguna
          </button>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div className="flex gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama, email, username..."
              aria-label="Cari pengguna"
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="submit"
              className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cari
            </button>
          </div>

          <select
            value={initialFilters.role}
            onChange={(e) => updateQueryParam({ role: e.target.value })}
            aria-label="Filter role"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Role</option>
            <option value="user">Karyawan (user)</option>
            <option value="leader">Ketua Divisi (leader)</option>
            <option value="hrd">HRD (hrd)</option>
            <option value="admin">Admin (admin)</option>
          </select>

          <select
            value={initialFilters.divisionId}
            onChange={(e) => updateQueryParam({ divisionId: e.target.value })}
            aria-label="Filter divisi"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Divisi</option>
            {divisions.map((div) => (
              <option key={div.id} value={div.id}>
                {div.name}
              </option>
            ))}
          </select>

          <select
            value={initialFilters.status}
            onChange={(e) => updateQueryParam({ status: e.target.value })}
            aria-label="Filter status akun"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:w-64">
            <select
              value={initialFilters.sort}
              onChange={(e) => updateQueryParam({ sort: e.target.value })}
              aria-label="Urutkan pengguna"
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="newest">Urutkan: Terbaru Ditambahkan</option>
              <option value="oldest">Urutkan: Terlama Ditambahkan</option>
              <option value="name_asc">Urutkan: Nama (A–Z)</option>
              <option value="name_desc">Urutkan: Nama (Z–A)</option>
              <option value="role_asc">Urutkan: Role</option>
            </select>
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users}
        emptyTitle="Pengguna tidak ditemukan"
        emptyDescription="Belum ada pengguna yang cocok dengan filter pencarian Anda."
        emptyAction={
          hasActiveFilter ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset Filter
            </button>
          ) : null
        }
      />

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
      />

      {/* Modal Tambah / Edit Pengguna */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingUser ? "Edit Data Pengguna" : "Tambah Pengguna Baru"}
        description={
          editingUser
            ? `Mengubah akun ${editingUser.full_name} (${editingUser.employee_code || "-"})`
            : "Kode karyawan (employee_code) akan dibuat otomatis oleh sistem."
        }
        size="lg"
        preventClose={isSaving}
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              disabled={isSaving}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              form="admin-user-form"
              disabled={isSaving}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        }
      >
        <form
          id="admin-user-form"
          onSubmit={handleSaveSubmit}
          className="space-y-4"
          noValidate
        >
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nama Lengkap <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formValues.fullName}
                onChange={(e) => handleFieldChange("fullName", e.target.value)}
                required
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {fieldErrors.fullName && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Username <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formValues.username}
                onChange={(e) => handleFieldChange("username", e.target.value)}
                required
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {fieldErrors.username && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={formValues.email}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                required
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {!editingUser && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Kata Sandi Awal <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  value={formValues.password}
                  onChange={(e) => handleFieldChange("password", e.target.value)}
                  placeholder="Minimal 8 karakter"
                  required
                  className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Role <span className="text-red-600">*</span>
              </label>
              <select
                value={formValues.role}
                onChange={(e) => handleFieldChange("role", e.target.value)}
                disabled={editingUser?.id === currentAdminId}
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100"
              >
                <option value="user">Karyawan (user)</option>
                <option value="leader">Ketua Divisi (leader)</option>
                <option value="hrd">HRD (hrd)</option>
                <option value="admin">Admin (admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Divisi
              </label>
              <select
                value={formValues.divisionId}
                onChange={(e) => handleFieldChange("divisionId", e.target.value)}
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value="">-- Tanpa Divisi --</option>
                {divisions.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Jabatan
              </label>
              <input
                type="text"
                value={formValues.position}
                onChange={(e) => handleFieldChange("position", e.target.value)}
                placeholder="contoh: Staf Keuangan"
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nomor Telepon
              </label>
              <input
                type="tel"
                value={formValues.phone}
                onChange={(e) => handleFieldChange("phone", e.target.value)}
                placeholder="contoh: 081234567890"
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {/* Field Kuota Cuti Awal hanya tampil untuk role user dan leader */}
            {showQuotaField && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Kuota Cuti Awal (hari / tahun)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={formValues.annualLeaveQuota}
                  onChange={(e) =>
                    handleFieldChange("annualLeaveQuota", e.target.value)
                  }
                  className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                {fieldErrors.annualLeaveQuota && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.annualLeaveQuota}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tanggal Bergabung
              </label>
              <input
                type="date"
                value={formValues.joinDate}
                onChange={(e) => handleFieldChange("joinDate", e.target.value)}
                className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          {!showQuotaField && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
              Role <strong>{formValues.role.toUpperCase()}</strong> tidak memiliki kuota cuti tahunan (otomatis disimpan sebagai 0).
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Alamat
            </label>
            <textarea
              rows={2}
              value={formValues.address}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {editingUser && editingUser.id !== currentAdminId && (
            <label className="inline-flex items-center gap-2.5 min-h-[44px] cursor-pointer text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={formValues.isActive}
                onChange={(e) => handleFieldChange("isActive", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Akun aktif (dapat masuk ke AjuCuti)</span>
            </label>
          )}
        </form>
      </Modal>

      {/* Modal Reset Kata Sandi */}
      <Modal
        isOpen={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="Reset Kata Sandi Pengguna"
        description={
          resetTarget ? `Atur kata sandi baru untuk ${resetTarget.full_name}.` : ""
        }
        size="sm"
        preventClose={isResetting}
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setResetTarget(null)}
              disabled={isResetting}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              form="reset-password-form"
              disabled={isResetting}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isResetting ? "Menyimpan..." : "Simpan Kata Sandi"}
            </button>
          </div>
        }
      >
        <form
          id="reset-password-form"
          onSubmit={handleConfirmResetPassword}
          className="space-y-3"
        >
          <label className="block text-sm font-medium text-slate-700">
            Kata Sandi Baru <span className="text-red-600">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              required
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {showNewPassword ? "Sembunyi" : "Lihat"}
            </button>
          </div>
          {resetError && <p className="text-xs text-red-600">{resetError}</p>}
        </form>
      </Modal>

      {/* Konfirmasi Aktifkan / Nonaktifkan Pengguna */}
      <ConfirmDialog
        isOpen={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleConfirmToggleActive}
        title={
          toggleTarget?.is_active
            ? "Nonaktifkan Akun Pengguna?"
            : "Aktifkan Kembali Akun?"
        }
        description={
          toggleTarget
            ? toggleTarget.is_active
              ? `${toggleTarget.full_name} tidak akan bisa masuk ke AjuCuti sampai diaktifkan kembali.`
              : `${toggleTarget.full_name} akan kembali dapat masuk ke AjuCuti.`
            : ""
        }
        confirmLabel={
          toggleTarget?.is_active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"
        }
        variant={toggleTarget?.is_active ? "danger" : "primary"}
        isLoading={isToggling}
      />
    </div>
  );
}