import { query } from "@/lib/db";
import { getCurrentYear } from "@/lib/dateUtils";

// Query RAW SQL terparameterisasi untuk halaman bersama (/history dan /profile)

const ALLOWED_STATUSES = new Set([
  "pending",
  "approved_leader",
  "approved",
  "rejected",
  "cancelled",
]);

const HISTORY_SORT_MAP = {
  newest: "lr.created_at DESC, lr.id DESC",
  oldest: "lr.created_at ASC, lr.id ASC",
  start_desc: "lr.start_date DESC, lr.id DESC",
  start_asc: "lr.start_date ASC, lr.id DESC",
  days_desc: "lr.total_days DESC, lr.created_at DESC",
  days_asc: "lr.total_days ASC, lr.created_at DESC",
};

function parsePositiveInt(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "all"
  ) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

// Kolom standar riwayat cuti (konsisten dengan LeaveDetailModal; tanpa JOIN users ke lr.rejected_by)
const BASE_HISTORY_SELECT = `
  SELECT
    lr.id,
    lr.user_id,
    lr.leave_type_id,
    TO_CHAR(lr.request_date, 'YYYY-MM-DD') AS request_date,
    TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS start_date,
    TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS end_date,
    lr.is_half_day,
    lr.total_days::float AS total_days,
    lr.reason,
    lr.handover_user_id,
    lr.handover_notes,
    lr.attachment_path,
    lr.attachment_name,
    lr.address_during_leave,
    lr.emergency_phone,
    lr.status,
    lr.leader_id,
    lr.leader_note,
    lr.leader_acted_at,
    lr.hrd_id,
    lr.hrd_note,
    lr.hrd_acted_at,
    lr.rejected_by,
    lr.cancel_reason,
    lr.cancelled_at,
    lr.created_at,
    u.full_name AS employee_name,
    u.employee_code,
    u.role AS employee_role,
    u.position AS employee_position,
    u.division_id,
    d.name AS division_name,
    lt.code AS leave_type_code,
    lt.name AS leave_type_name,
    lt.deducts_annual_quota,
    hu.full_name AS handover_user_name,
    lu.full_name AS leader_name,
    hrdu.full_name AS hrd_name,
    CASE
      WHEN lr.rejected_by = 'leader' THEN lu.full_name
      WHEN lr.rejected_by = 'hrd' THEN hrdu.full_name
      ELSE COALESCE(hrdu.full_name, lu.full_name)
    END AS rejected_by_name
  FROM leave_requests lr
  JOIN users u ON u.id = lr.user_id
  LEFT JOIN divisions d ON d.id = u.division_id
  JOIN leave_types lt ON lt.id = lr.leave_type_id
  LEFT JOIN users hu ON hu.id = lr.handover_user_id
  LEFT JOIN users lu ON lu.id = lr.leader_id
  LEFT JOIN users hrdu ON hrdu.id = lr.hrd_id
`;

function normalizeRow(row) {
  return {
    ...row,
    total_days: Number(row.total_days ?? 0),
    leader_acted_at: row.leader_acted_at
      ? new Date(row.leader_acted_at).toISOString()
      : null,
    hrd_acted_at: row.hrd_acted_at
      ? new Date(row.hrd_acted_at).toISOString()
      : null,
    cancelled_at: row.cancelled_at
      ? new Date(row.cancelled_at).toISOString()
      : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

/**
 * Mengambil riwayat pengajuan cuti sesuai cakupan role:
 * - user         : hanya pengajuan milik sendiri
 * - leader       : pengajuan pribadi + seluruh anggota divisi yang dipimpinnya
 * - hrd / admin  : seluruh pengajuan di perusahaan
 */
export async function getHistoryLeaveRequests(session, options = {}) {
  const pageSize = parsePositiveInt(options.pageSize) || 10;
  const conditions = [];
  const params = [];

  const parsedUserId = parsePositiveInt(session?.id);
  const parsedLeaderDivId = parsePositiveInt(session?.divisionId);

  if (!parsedUserId) {
    return {
      items: [],
      availableYears: [getCurrentYear()],
      pagination: { currentPage: 1, totalPages: 1, totalItems: 0, pageSize },
    };
  }

  // Batasan cakupan data berdasarkan role
  if (session.role === "user") {
    params.push(parsedUserId);
    conditions.push(`lr.user_id = $${params.length}::int`);
  } else if (session.role === "leader") {
    if (parsedLeaderDivId !== null) {
      params.push(parsedUserId, parsedLeaderDivId);
      conditions.push(
        `(lr.user_id = $1::int OR d.leader_id = $1::int OR u.division_id = $2::int)`
      );
    } else {
      params.push(parsedUserId);
      conditions.push(`(lr.user_id = $1::int OR d.leader_id = $1::int)`);
    }
  }

  // Filter dinamis (hanya ditambahkan jika terisi & valid)
  if (options.status && ALLOWED_STATUSES.has(options.status)) {
    params.push(options.status);
    conditions.push(`lr.status = $${params.length}`);
  }

  const parsedLeaveTypeId = parsePositiveInt(options.leaveTypeId);
  if (parsedLeaveTypeId !== null) {
    params.push(parsedLeaveTypeId);
    conditions.push(`lr.leave_type_id = $${params.length}::int`);
  }

  if (["hrd", "admin"].includes(session.role)) {
    const parsedDivisionId = parsePositiveInt(options.divisionId);
    if (parsedDivisionId !== null) {
      params.push(parsedDivisionId);
      conditions.push(`u.division_id = $${params.length}::int`);
    }
  }

  const parsedYear = parsePositiveInt(options.year);
  if (parsedYear !== null) {
    params.push(parsedYear);
    conditions.push(`EXTRACT(YEAR FROM lr.start_date) = $${params.length}::int`);
  }

  const trimmedSearch = String(options.search || "").trim();
  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    conditions.push(
      `(u.full_name ILIKE $${params.length} OR lt.name ILIKE $${params.length} OR lr.reason ILIKE $${params.length} OR COALESCE(d.name, '') ILIKE $${params.length})`
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = HISTORY_SORT_MAP[options.sort] || HISTORY_SORT_MAP.newest;

  const [countRes, yearsRes] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total
      FROM leave_requests lr
      JOIN users u ON u.id = lr.user_id
      LEFT JOIN divisions d ON d.id = u.division_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      ${whereClause}`,
      params
    ),
    query(
      `SELECT DISTINCT EXTRACT(YEAR FROM start_date)::int AS year
      FROM leave_requests
      ORDER BY year DESC`
    ),
  ]);

  const totalItems = countRes.rows[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = parsePositiveInt(options.page) || 1;
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * pageSize;

  const dataParams = [...params, pageSize, offset];
  const dataRes = await query(
    `${BASE_HISTORY_SELECT}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${dataParams.length - 1}::int OFFSET $${dataParams.length}::int`,
    dataParams
  );

  const years = yearsRes.rows.map((r) => Number(r.year));
  const currentYear = getCurrentYear();
  if (!years.includes(currentYear)) {
    years.unshift(currentYear);
  }

  return {
    items: dataRes.rows.map(normalizeRow),
    availableYears: years,
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems,
      pageSize,
    },
  };
}

/**
 * Mengambil data lengkap profil pengguna yang sedang login (/profile).
 */
export async function getUserProfileById(userId) {
  const parsedUserId = parsePositiveInt(userId);
  if (!parsedUserId) return null;

  const result = await query(
    `SELECT
      u.id,
      u.employee_code,
      u.full_name,
      u.email,
      u.username,
      u.role,
      u.division_id,
      d.name AS division_name,
      u.position,
      u.phone,
      u.address,
      u.photo_path,
      u.annual_leave_quota,
      TO_CHAR(u.join_date, 'YYYY-MM-DD') AS join_date,
      u.is_active
    FROM users u
    LEFT JOIN divisions d ON d.id = u.division_id
    WHERE u.id = $1::int
    LIMIT 1`,
    [parsedUserId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    ...row,
    annual_leave_quota: Number(row.annual_leave_quota ?? 12),
  };
}