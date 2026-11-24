"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  assignUserToDivisionAction,
  createDivisionAction,
  deleteDivisionAction,
  removeUserFromDivisionAction,
  updateDivisionAction,
} from "@/actions/admin";

// CMS Divisi & Anggota Divisi (/admin/divisions)
// Ketentuan:
// - Field code opsional (nullable), tidak diwajibkan di form
// - leader_id unik (1 leader hanya memimpin 1 divisi)
// - Hapus divisi WAJIB konfirmasi dua kali (doubleConfirm)

const EMPTY_FORM = {
  code: "",
  name: "",
  description: "",
  leaderId: "",
};

export default function AdminDivisionsClient({
  divisions = [],
  pagination,
  allUsers = [],
  initialFilters,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialFilters.search || "");
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // State modal tambah / edit divisi
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState(null);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, startSaveTransition] = useTransition();

  // State konfirmasi hapus divisi (2 tahap)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  // State modal kelola anggota divisi
  const [membersModalDivisionId, setMembersModalDivisionId] = useState(null);
  const [selectedAddUserId, setSelectedAddUserId] = useState("");
  const [memberActionError, setMemberActionError] = useState("");
  const [isUpdatingMember, startMemberTransition] = useTransition();

  const activeMembersDivision = useMemo(
    () => divisions.find((d) => d.id === membersModalDivisionId) || null,
    [divisions, membersModalDivisionId]
  );

  // Kandidat ketua divisi: role 'leader' aktif yang belum memimpin divisi lain (atau sedang memimpin divisi ini)
  const leaderCandidates = useMemo(() => {
    return allUsers.filter((u) => {
      if (!u.is_active || u.role !== "leader") return false;
      if (!u.leading_division_id) return true;
      return editingDivision && u.leading_division_id === editingDivision.id;
    });
  }, [allUsers, editingDivision]);

  // Daftar anggota saat ini pada divisi yang dibuka di modal Kelola Anggota
  const currentDivisionMembers = useMemo(() => {
    if (!activeMembersDivision) return [];
    return allUsers.filter((u) => u.division_id === activeMembersDivision.id);
  }, [allUsers, activeMembersDivision]);

  // Kandidat pengguna yang dapat ditambahkan ke divisi yang sedang dibuka
  const addableUsers = useMemo(() => {
    if (!activeMembersDivision) return [];
    return allUsers.filter((u) => {
      if (!u.is_active) return false;
      if (u.division_id === activeMembersDivision.id) return false;
      if (
        u.leading_division_id &&
        u.leading_division_id !== activeMembersDivision.id
      ) {
        return false;
      }
      return true;
    });
  }, [allUsers, activeMembersDivision]);

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
    setEditingDivision(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function openEditModal(division) {
    setEditingDivision(division);
    setFormValues({
      code: division.code || "",
      name: division.name || "",
      description: division.description || "",
      leaderId: division.leader_id ? String(division.leader_id) : "",
    });
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  }

  function handleSaveSubmit(event) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    startSaveTransition(async () => {
      const payload = {
        code: formValues.code,
        name: formValues.name,
        description: formValues.description,
        leaderId: formValues.leaderId ? Number(formValues.leaderId) : null,
      };

      const result = editingDivision
        ? await updateDivisionAction({ ...payload, id: editingDivision.id })
        : await createDivisionAction(payload);

      if (result?.error) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors || {});
        return;
      }

      setIsFormOpen(false);
      setFeedback({
        type: "success",
        message: result.message || "Data divisi berhasil disimpan.",
      });
      router.refresh();
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;

    startDeleteTransition(async () => {
      const result = await deleteDivisionAction(deleteTarget.id);
      setDeleteTarget(null);

      if (result?.error) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      setFeedback({
        type: "success",
        message: result.message || "Divisi berhasil dihapus.",
      });
      router.refresh();
    });
  }

  function handleAddMember(event) {
    event.preventDefault();
    if (!activeMembersDivision || !selectedAddUserId) return;

    setMemberActionError("");
    startMemberTransition(async () => {
      const result = await assignUserToDivisionAction({
        divisionId: activeMembersDivision.id,
        userId: Number(selectedAddUserId),
      });

      if (result?.error) {
        setMemberActionError(result.error);
        return;
      }

      setSelectedAddUserId("");
      setFeedback({
        type: "success",
        message: result.message || "Anggota berhasil ditambahkan.",
      });
      router.refresh();
    });
  }

  function handleRemoveMember(userId) {
    if (!activeMembersDivision) return;

    setMemberActionError("");
    startMemberTransition(async () => {
      const result = await removeUserFromDivisionAction({
        divisionId: activeMembersDivision.id,
        userId,
      });

      if (result?.error) {
        setMemberActionError(result.error);
        return;
      }

      setFeedback({
        type: "success",
        message: result.message || "Anggota berhasil dikeluarkan.",
      });
      router.refresh();
    });
  }

  const columns = [
    {
      key: "name",
      header: "Nama Divisi",
      render: (row) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{row.name}</span>
            {row.code && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700">
                {row.code}
              </span>
            )}
          </div>
          {row.description && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "leader_name",
      header: "Ketua Divisi",
      render: (row) =>
        row.leader_name ? (
          <div>
            <p className="font-medium text-slate-900">{row.leader_name}</p>
            <p className="text-xs text-slate-500">{row.leader_email}</p>
          </div>
        ) : (
          <span className="text-xs italic text-slate-400">Belum ditetapkan</span>
        ),
    },
    {
      key: "member_count",
      header: "Jumlah Anggota",
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          {row.member_count} orang
        </span>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      isAction: true,
      render: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setMembersModalDivisionId(row.id);
              setSelectedAddUserId("");
              setMemberActionError("");
            }}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            Anggota ({row.member_count})
          </button>
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Hapus
          </button>
        </div>
      ),
    },
  ];

  const hasActiveFilter =
    Boolean(initialFilters.search) || initialFilters.sort !== "name_asc";

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

      {/* Toolbar divisi */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Divisi &amp; Anggota
            </h2>
            <p className="text-xs text-slate-500">
              Tetapkan ketua divisi (unik per divisi) serta atur keanggotaan karyawan.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Tambah Divisi
          </button>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div className="flex gap-2 sm:col-span-2">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama, kode, atau deskripsi divisi..."
              aria-label="Cari divisi"
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
            value={initialFilters.sort}
            onChange={(e) => updateQueryParam({ sort: e.target.value })}
            aria-label="Urutkan divisi"
            className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="name_asc">Urutkan: Nama (A–Z)</option>
            <option value="name_desc">Urutkan: Nama (Z–A)</option>
            <option value="members_desc">Urutkan: Anggota Terbanyak</option>
            <option value="newest">Urutkan: Terbaru Dibuat</option>
          </select>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              Reset Filter
            </button>
          )}
        </form>
      </div>

      <DataTable
        columns={columns}
        data={divisions}
        emptyTitle="Belum ada data divisi"
        emptyDescription="Tambahkan divisi baru untuk mengelompokkan karyawan dan ketua divisi."
      />

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
      />

      {/* Modal Tambah / Edit Divisi */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingDivision ? "Edit Divisi" : "Tambah Divisi Baru"}
        size="md"
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
              form="admin-division-form"
              disabled={isSaving}
              className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        }
      >
        <form
          id="admin-division-form"
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nama Divisi <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formValues.name}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              placeholder="contoh: Pemasaran Digital"
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Kode Divisi{" "}
              <span className="text-slate-400 font-normal">(Opsional)</span>
            </label>
            <input
              type="text"
              value={formValues.code}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, code: e.target.value }))
              }
              placeholder="contoh: MKT (boleh dikosongkan)"
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            {fieldErrors.code && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.code}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Ketua Divisi{" "}
              <span className="text-slate-400 font-normal">(Opsional)</span>
            </label>
            <select
              value={formValues.leaderId}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, leaderId: e.target.value }))
              }
              className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="">-- Belum ditetapkan --</option>
              {leaderCandidates.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.full_name} ({leader.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Hanya menampilkan pengguna aktif ber-role Ketua Divisi yang belum memimpin divisi lain.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Deskripsi
            </label>
            <textarea
              rows={3}
              value={formValues.description}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Keterangan singkat ruang lingkup divisi..."
              className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </form>
      </Modal>

      {/* Modal Kelola Anggota Divisi */}
      <Modal
        isOpen={Boolean(activeMembersDivision)}
        onClose={() => setMembersModalDivisionId(null)}
        title={
          activeMembersDivision
            ? `Anggota Divisi ${activeMembersDivision.name}`
            : "Anggota Divisi"
        }
        description="Tambahkan pengguna ke divisi ini atau keluarkan anggota yang ada."
        size="lg"
      >
        <div className="space-y-5">
          {memberActionError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {memberActionError}
            </div>
          )}

          {/* Form tambah anggota */}
          <form
            onSubmit={handleAddMember}
            className="flex flex-col sm:flex-row gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5"
          >
            <select
              value={selectedAddUserId}
              onChange={(e) => setSelectedAddUserId(e.target.value)}
              disabled={isUpdatingMember}
              aria-label="Pilih pengguna untuk ditambahkan"
              className="block flex-1 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="">-- Pilih pengguna untuk dimasukkan --</option>
              {addableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                  {u.division_name ? ` — pindah dari ${u.division_name}` : " — tanpa divisi"}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!selectedAddUserId || isUpdatingMember}
              className="min-h-[44px] shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isUpdatingMember ? "Memproses..." : "+ Tambahkan"}
            </button>
          </form>

          {/* Daftar anggota saat ini */}
          {currentDivisionMembers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
              Belum ada anggota di divisi ini.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {currentDivisionMembers.map((member) => {
                const isDivisionLeader =
                  activeMembersDivision?.leader_id === member.id;
                return (
                  <li
                    key={member.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">
                          {member.full_name}
                        </span>
                        <StatusBadge status={member.role} />
                        {isDivisionLeader && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Ketua Divisi Ini
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {member.email}
                        {member.position ? ` — ${member.position}` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isUpdatingMember}
                      className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Keluarkan
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      {/* Dialog Konfirmasi DUA KALI saat menghapus divisi */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        doubleConfirm
        title="Hapus Divisi?"
        description={
          deleteTarget
            ? `Anda akan menghapus Divisi "${deleteTarget.name}". Saat ini terdapat ${deleteTarget.member_count} anggota di divisi ini yang divisinya akan dikosongkan.`
            : ""
        }
        confirmLabel="Lanjut ke Konfirmasi Kedua"
        secondConfirmTitle="Konfirmasi Akhir Hapus Divisi"
        secondConfirmDescription={
          deleteTarget
            ? `Pastikan sekali lagi: Divisi "${deleteTarget.name}" akan dihapus permanen dari sistem dan tidak dapat dikembalikan.`
            : ""
        }
        secondConfirmLabel="Ya, Hapus Divisi Permanen"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}