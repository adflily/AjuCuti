"use client";

import EmptyState from "@/components/ui/EmptyState";

// Komponen daftar data responsif:
// - Desktop (>= md): tampil sebagai tabel HTML rapi
// - Mobile (< md): otomatis menjadi kartu bertumpuk tanpa scroll horizontal sempit
// Mendukung loading skeleton, empty state, dan checkbox seleksi (untuk multi-approve HRD).

function resolveRowKey(row, rowKey, index) {
  if (typeof rowKey === "function") {
    return rowKey(row);
  }
  return row?.[rowKey] ?? index;
}

const ALIGN_CLASSES = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export default function DataTable({
  columns = [],
  data = [],
  rowKey = "id",
  isLoading = false,
  skeletonRows = 5,
  emptyTitle = "Belum ada data",
  emptyDescription = "Belum ada data yang sesuai untuk ditampilkan.",
  emptyAction,
  renderMobileCard,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  isRowSelectable = () => true,
}) {
  const selectedSet = new Set(selectedIds);
  const selectableRows = selectable
    ? data.filter((row) => isRowSelectable(row))
    : [];
  const selectableKeys = selectableRows.map((row, idx) =>
    resolveRowKey(row, rowKey, idx)
  );
  const allSelected =
    selectableKeys.length > 0 &&
    selectableKeys.every((key) => selectedSet.has(key));

  function handleToggleAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      const remaining = selectedIds.filter((id) => !selectableKeys.includes(id));
      onSelectionChange(remaining);
    } else {
      const merged = Array.from(new Set([...selectedIds, ...selectableKeys]));
      onSelectionChange(merged);
    }
  }

  function handleToggleRow(key) {
    if (!onSelectionChange) return;
    if (selectedSet.has(key)) {
      onSelectionChange(selectedIds.filter((id) => id !== key));
    } else {
      onSelectionChange([...selectedIds, key]);
    }
  }

  // Tampilan skeleton saat memuat data
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Memuat data">
        {/* Skeleton mobile */}
        <div className="space-y-3 md:hidden">
          {Array.from({ length: skeletonRows }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse space-y-2.5"
            >
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-3.5 w-1/2 rounded bg-slate-100" />
              <div className="h-3.5 w-3/4 rounded bg-slate-100" />
            </div>
          ))}
        </div>

        {/* Skeleton desktop */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100 animate-pulse">
            <div className="h-11 bg-slate-50" />
            {Array.from({ length: skeletonRows }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 flex-1 rounded bg-slate-200" />
                <div className="h-4 flex-1 rounded bg-slate-100" />
                <div className="h-4 w-28 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Tampilan kosong
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div>
      {/* Tampilan KARTU BERTUMPUK untuk mobile (< md) */}
      <div className="space-y-3 md:hidden">
        {selectable && selectableKeys.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2">
            <label className="inline-flex items-center gap-2.5 min-h-[44px] text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleAll}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Pilih semua ({selectableKeys.length})</span>
            </label>
            {selectedIds.length > 0 && (
              <span className="text-xs font-semibold text-blue-600">
                {selectedIds.length} dipilih
              </span>
            )}
          </div>
        )}

        {data.map((row, rowIndex) => {
          const key = resolveRowKey(row, rowKey, rowIndex);
          const canSelect = selectable && isRowSelectable(row);
          const isChecked = selectedSet.has(key);

          if (renderMobileCard) {
            return (
              <div
                key={key}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  isChecked ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"
                }`}
              >
                {canSelect && (
                  <div className="mb-2 border-b border-slate-100 pb-2">
                    <label className="inline-flex items-center gap-2.5 min-h-[44px] text-xs font-medium text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRow(key)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span>Pilih pengajuan ini</span>
                    </label>
                  </div>
                )}
                {renderMobileCard(row)}
              </div>
            );
          }

          const visibleColumns = columns.filter((col) => !col.hideOnMobile);

          return (
            <div
              key={key}
              className={`rounded-2xl border bg-white p-4 shadow-sm space-y-2.5 ${
                isChecked ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"
              }`}
            >
              {canSelect && (
                <div className="border-b border-slate-100 pb-2">
                  <label className="inline-flex items-center gap-2.5 min-h-[44px] text-xs font-medium text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleRow(key)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span>Pilih baris ini</span>
                  </label>
                </div>
              )}

              {visibleColumns.map((col) => {
                const cellContent = col.render
                  ? col.render(row)
                  : row[col.key] ?? "-";

                if (col.isAction) {
                  return (
                    <div
                      key={col.key}
                      className="pt-2.5 mt-2.5 border-t border-slate-100 flex flex-wrap gap-2"
                    >
                      {cellContent}
                    </div>
                  );
                }

                return (
                  <div
                    key={col.key}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-500 shrink-0 font-medium">
                      {col.mobileLabel || col.header}
                    </span>
                    <div className="text-right text-slate-900 min-w-0 break-words">
                      {cellContent}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Tampilan TABEL untuk tablet/desktop (>= md) */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {selectable && (
                  <th scope="col" className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={selectableKeys.length === 0}
                      onChange={handleToggleAll}
                      aria-label="Pilih semua baris"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-40"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap ${
                      ALIGN_CLASSES[col.align] || ALIGN_CLASSES.left
                    } ${col.headerClassName || ""}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.map((row, rowIndex) => {
                const key = resolveRowKey(row, rowKey, rowIndex);
                const canSelect = selectable && isRowSelectable(row);
                const isChecked = selectedSet.has(key);

                return (
                  <tr
                    key={key}
                    className={`transition-colors ${
                      isChecked ? "bg-blue-50/50" : "hover:bg-slate-50/80"
                    }`}
                  >
                    {selectable && (
                      <td className="px-4 py-3.5 text-center">
                        {canSelect ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleRow(key)}
                            aria-label={`Pilih baris ${key}`}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                          />
                        ) : (
                          <span className="text-slate-300" aria-hidden="true">
                            &mdash;
                          </span>
                        )}
                      </td>
                    )}

                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 text-sm text-slate-700 align-middle ${
                          ALIGN_CLASSES[col.align] || ALIGN_CLASSES.left
                        } ${col.className || ""}`}
                      >
                        {col.render ? col.render(row) : row[col.key] ?? "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}