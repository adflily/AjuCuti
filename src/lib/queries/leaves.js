import { query } from "@/lib/db";
import { getCurrentYear } from "@/lib/dateUtils";

// Kumpulan query RAW SQL terparameterisasi untuk alur cuti & perhitungan kuota dinamis

// Daftar status valid (whitelist)
const ALLOWED_STATUSES = new Set([
  "pending",
  "approved_leader",
  "approved",
  "rejected",
  "cancelled",
]);

// Daftar sortir aman (whitelist) untuk mencegah SQL injection pada ORDER BY
const SORT_CLAUSE_MAP = {
  newest: "lr.created_at DESC, lr.id DESC",
  oldest: "lr.created_at ASC, lr.id ASC",
  start_asc: "lr.start_date ASC, lr.id DESC",
  start_desc: "lr.start_date DESC, lr.id DESC",
  days_desc: "lr.total_days DESC, lr.created_at DESC",
  days_asc: "lr.total_days ASC, lr.created_at DESC",
};

function resolveSortClause(sortKey) {
  return SORT_CLAUSE_MAP[sortKey] || SORT_CLAUSE_MAP.newest;
}

/**
 * Mengonversi nilai ID/angka dari URL/form menjadi bilangan bulat positif.
 * Mengembalikan null jika kosong, 'all', NaN, bukan integer, atau <= 0.
 */
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

/**
 * Helper hasil kosong saat ID wajib tidak valid.
 */
function buildEmptyPageResult(pageSize = 10) {
  return {
    items: [],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      pageSize,
    },
  };
}

/**
 * Menghitung ringkasan kuota cuti tahunan pengguna secara dinamis dari leave_requests.
 * Aturan:
 * - Kuota dasar dari users.annual_leave_quota
 * - Dikurangi SUM(total_days) untuk status pending, approved_leader, approved
 * - Khusus jenis cuti dengan deducts_annual_quota = TRUE pada tahun target
 */
export async function getUserQuotaSummary(userId, year = getCurrentYear()) {
  const parsedUserId = parsePositiveInt(userId);
  const parsedYear = parsePositiveInt(year) || getCurrentYear();

  if (!parsedUserId) {
    return {
      year: parsedYear,
      annualQuota: 0,
      usedDays: 0,
      pendingDays: 0,
      heldDays: 0,
      remainingDays: 0,
    };
  }

  const result = await query(
    `SELECT
      u.annual_leave_quota::float AS annual_quota,
      COALESCE(
        SUM(lr.total_days) FILTER (
          WHERE lr.status = 'approved'
            AND lt.deducts_annual_quota = TRUE
            AND EXTRACT(YEAR FROM lr.start_date) = $2::int
        ),
        0
      )::float AS used_days,
      COALESCE(
        SUM(lr.total_days) FILTER (
          WHERE lr.status IN ('pending', 'approved_leader')
            AND lt.deducts_annual_quota = TRUE
            AND EXTRACT(YEAR FROM lr.start_date) = $2::int
        ),
        0
      )::float AS pending_days
    FROM users u
    LEFT JOIN leave_requests lr ON lr.user_id = u.id
    LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE u.id = $1::int
    GROUP BY u.id, u.annual_leave_quota`,
    [parsedUserId, parsedYear]
  );

  const row = result.rows[0];
  if (!row) {
    return {
      year: parsedYear,
      annualQuota: 0,
      usedDays: 0,
      pendingDays: 0,
      heldDays: 0,
      remainingDays: 0,
    };
  }

  const annualQuota = Number(row.annual_quota || 0);
  const usedDays = Number(row.used_days || 0);
  const pendingDays = Number(row.pending_days || 0);
  const heldDays = Number((usedDays + pendingDays).toFixed(1));
  const remainingDays = Math.max(
    0,
    Number((annualQuota - heldDays).toFixed(1))
  );

  return {
    year: parsedYear,
    annualQuota,
    usedDays,
    pendingDays,
    heldDays,
    remainingDays,
  };
}

/**
 * Mengambil seluruh jenis cuti yang aktif beserta seluruh aturan dinamisnya.
 */
export async function getActiveLeaveTypes() {
  const result = await query(
    `SELECT
      id,
      code,
      name,
      description,
      max_days_per_request,
      quota_per_year,
      min_notice_days,
      max_backdate_days,
      deducts_annual_quota,
      requires_attachment,
      is_system,
      is_active
    FROM leave_types
    WHERE is_active = TRUE
    ORDER BY is_system DESC, id ASC`
  );

  return result.rows;
}

/**
 * Mengambil daftar tanggal hari libur (YYYY-MM-DD) untuk kalkulasi hari kerja di client/server.
 */
export async function getHolidayDates() {
  const result = await query(
    `SELECT
      TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date,
      name,
      is_joint_leave
    FROM holidays
    ORDER BY holiday_date ASC`
  );

  return result.rows;
}

/**
 * Mengambil periode blackout aktif (untuk ditampilkan/dicek saat pengajuan).
 */
export async function getBlackoutPeriods() {
  const result = await query(
    `SELECT
      id,
      name,
      TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
      TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date
    FROM blackout_periods
    ORDER BY start_date ASC`
  );

  return result.rows;
}

/**
 * Mengambil daftar kandidat rekan pengganti (handover) aktif, diutamakan satu divisi.
 * Query dipisah berdasarkan ada/tidaknya divisionId agar tidak mengirim parameter null ambigu.
 */
export async function getHandoverCandidates(divisionId, excludeUserId) {
  const parsedExcludeId = parsePositiveInt(excludeUserId);
  if (!parsedExcludeId) {
    return [];
  }

  const parsedDivisionId = parsePositiveInt(divisionId);

  if (parsedDivisionId !== null) {
    const result = await query(
      `SELECT
        u.id,
        u.full_name,
        u.position,
        d.name AS division_name,
        (u.division_id = $1::int) AS is_same_division
      FROM users u
      LEFT JOIN divisions d ON d.id = u.division_id
      WHERE u.is_active = TRUE
        AND u.id <> $2::int
        AND u.role IN ('user', 'leader', 'hrd')
      ORDER BY (u.division_id = $1::int) DESC NULLS LAST, u.full_name ASC`,
      [parsedDivisionId, parsedExcludeId]
    );
    return result.rows;
  }

  const result = await query(
    `SELECT
      u.id,
      u.full_name,
      u.position,
      d.name AS division_name,
      FALSE AS is_same_division
    FROM users u
    LEFT JOIN divisions d ON d.id = u.division_id
    WHERE u.is_active = TRUE
      AND u.id <> $1::int
      AND u.role IN ('user', 'leader', 'hrd')
    ORDER BY u.full_name ASC`,
    [parsedExcludeId]
  );

  return result.rows;
}

/**
 * Mengambil daftar divisi untuk dropdown filter (mis. di halaman HRD).
 */
export async function getDivisionsForFilter() {
  const result = await query(
    `SELECT id, name
    FROM divisions
    ORDER BY name ASC`
  );
  return result.rows;
}

// Kolom standar untuk daftar pengajuan cuti.
// Catatan: lr.rejected_by bertipe VARCHAR (bukan FK users.id), sehingga tidak di-JOIN ke users.id.
const BASE_LEAVE_SELECT = `
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

/**
 * Menormalkan angka numeric total_days dan timestamp agar aman di-serialize ke Client Component.
 */
function normalizeLeaveRow(row) {
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
 * Membangun klausa WHERE dinamis khusus pengajuan milik satu pengguna.
 * Kondisi ditambahkan HANYA jika filter terisi dan valid.
 */
function buildUserLeaveWhere(userId, options = {}) {
  const conditions = ["lr.user_id = $1::int"];
  const params = [userId];

  if (options.status && ALLOWED_STATUSES.has(options.status)) {
    params.push(options.status);
    conditions.push(`lr.status = $${params.length}`);
  }

  const parsedLeaveTypeId = parsePositiveInt(options.leaveTypeId);
  if (parsedLeaveTypeId !== null) {
    params.push(parsedLeaveTypeId);
    conditions.push(`lr.leave_type_id = $${params.length}::int`);
  }

  const trimmedSearch = String(options.search || "").trim();
  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    conditions.push(
      `(lr.reason ILIKE $${params.length} OR lt.name ILIKE $${params.length})`
    );
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
}

/**
 * Menghitung total pengajuan cuti milik pengguna (pasangan getUserLeaveRequests).
 */
export async function countUserLeaveRequests(userId, options = {}) {
  const parsedUserId = parsePositiveInt(userId);
  if (!parsedUserId) {
    return 0;
  }

  const { whereClause, params } = buildUserLeaveWhere(parsedUserId, options);

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    ${whereClause}`,
    params
  );

  return countResult.rows[0]?.total || 0;
}

/**
 * Mengambil daftar pengajuan cuti milik pengguna tertentu (/employee dan tab cuti pribadi /leader).
 */
export async function getUserLeaveRequests(userId, options = {}) {
  const parsedPageSize = parsePositiveInt(options.pageSize) || 10;
  const parsedUserId = parsePositiveInt(userId);

  if (!parsedUserId) {
    return buildEmptyPageResult(parsedPageSize);
  }

  const totalItems = await countUserLeaveRequests(parsedUserId, options);
  const totalPages = Math.max(1, Math.ceil(totalItems / parsedPageSize));
  const requestedPage = parsePositiveInt(options.page) || 1;
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * parsedPageSize;

  const { whereClause, params } = buildUserLeaveWhere(parsedUserId, options);
  const orderBy = resolveSortClause(options.sort);
  const dataParams = [...params, parsedPageSize, offset];

  const dataResult = await query(
    `${BASE_LEAVE_SELECT}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${dataParams.length - 1}::int OFFSET $${dataParams.length}::int`,
    dataParams
  );

  return {
    items: dataResult.rows.map(normalizeLeaveRow),
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems,
      pageSize: parsedPageSize,
    },
  };
}

/**
 * Membangun klausa WHERE dinamis untuk antrean verifikasi Ketua Divisi (/leader).
 */
function buildLeaderDivisionWhere(leaderId, divisionId, options = {}) {
  const conditions = ["u.role = 'user'"];
  const params = [];

  if (divisionId !== null) {
    params.push(leaderId, divisionId);
    conditions.push(`(d.leader_id = $1::int OR u.division_id = $2::int)`);
  } else {
    params.push(leaderId);
    conditions.push(`d.leader_id = $1::int`);
  }

  if (options.status && ALLOWED_STATUSES.has(options.status)) {
    params.push(options.status);
    conditions.push(`lr.status = $${params.length}`);
  }

  const parsedLeaveTypeId = parsePositiveInt(options.leaveTypeId);
  if (parsedLeaveTypeId !== null) {
    params.push(parsedLeaveTypeId);
    conditions.push(`lr.leave_type_id = $${params.length}::int`);
  }

  const trimmedSearch = String(options.search || "").trim();
  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    conditions.push(
      `(u.full_name ILIKE $${params.length} OR lr.reason ILIKE $${params.length} OR lt.name ILIKE $${params.length})`
    );
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
}

/**
 * Mengambil daftar pengajuan cuti anggota divisi untuk diverifikasi Ketua Divisi (/leader).
 */
export async function getLeaderDivisionLeaveRequests(
  leaderId,
  leaderDivisionId,
  options = {}
) {
  const parsedPageSize = parsePositiveInt(options.pageSize) || 10;
  const parsedLeaderId = parsePositiveInt(leaderId);
  const parsedDivisionId = parsePositiveInt(leaderDivisionId);

  const emptySummary = {
    pending_count: 0,
    approved_leader_count: 0,
    approved_count: 0,
    rejected_count: 0,
  };

  if (!parsedLeaderId) {
    return {
      ...buildEmptyPageResult(parsedPageSize),
      summary: emptySummary,
    };
  }

  const effectiveOptions = {
    status: options.status ?? "pending",
    leaveTypeId: options.leaveTypeId,
    search: options.search,
  };

  const { whereClause, params } = buildLeaderDivisionWhere(
    parsedLeaderId,
    parsedDivisionId,
    effectiveOptions
  );
  const orderBy = resolveSortClause(options.sort);

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM leave_requests lr
    JOIN users u ON u.id = lr.user_id
    LEFT JOIN divisions d ON d.id = u.division_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    ${whereClause}`,
    params
  );

  const totalItems = countResult.rows[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / parsedPageSize));
  const requestedPage = parsePositiveInt(options.page) || 1;
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * parsedPageSize;

  const dataParams = [...params, parsedPageSize, offset];
  const dataResult = await query(
    `${BASE_LEAVE_SELECT}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${dataParams.length - 1}::int OFFSET $${dataParams.length}::int`,
    dataParams
  );

  // Ringkasan cepat antrean divisi (tanpa parameter null ambigu)
  const scopeParams =
    parsedDivisionId !== null
      ? [parsedLeaderId, parsedDivisionId]
      : [parsedLeaderId];
  const scopeCondition =
    parsedDivisionId !== null
      ? `(d.leader_id = $1::int OR u.division_id = $2::int)`
      : `d.leader_id = $1::int`;

  const summaryResult = await query(
    `SELECT
      COUNT(*) FILTER (WHERE lr.status = 'pending')::int AS pending_count,
      COUNT(*) FILTER (WHERE lr.status = 'approved_leader')::int AS approved_leader_count,
      COUNT(*) FILTER (WHERE lr.status = 'approved')::int AS approved_count,
      COUNT(*) FILTER (WHERE lr.status = 'rejected')::int AS rejected_count
    FROM leave_requests lr
    JOIN users u ON u.id = lr.user_id
    LEFT JOIN divisions d ON d.id = u.division_id
    WHERE u.role = 'user'
      AND ${scopeCondition}`,
    scopeParams
  );

  return {
    items: dataResult.rows.map(normalizeLeaveRow),
    summary: summaryResult.rows[0] || emptySummary,
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems,
      pageSize: parsedPageSize,
    },
  };
}

/**
 * Membangun klausa WHERE dinamis untuk daftar pengajuan di halaman HRD (/hrd).
 */
function buildHrdLeaveWhere(options = {}) {
  const conditions = [];
  const params = [];

  if (options.status === "waiting_hrd") {
    conditions.push(
      `((lr.status = 'approved_leader' AND u.role = 'user') OR (lr.status = 'pending' AND u.role = 'leader'))`
    );
  } else if (options.status && ALLOWED_STATUSES.has(options.status)) {
    params.push(options.status);
    conditions.push(`lr.status = $${params.length}`);
  }

  const parsedDivisionId = parsePositiveInt(options.divisionId);
  if (parsedDivisionId !== null) {
    params.push(parsedDivisionId);
    conditions.push(`u.division_id = $${params.length}::int`);
  }

  const parsedLeaveTypeId = parsePositiveInt(options.leaveTypeId);
  if (parsedLeaveTypeId !== null) {
    params.push(parsedLeaveTypeId);
    conditions.push(`lr.leave_type_id = $${params.length}::int`);
  }

  const trimmedSearch = String(options.search || "").trim();
  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    conditions.push(
      `(u.full_name ILIKE $${params.length} OR d.name ILIKE $${params.length} OR lr.reason ILIKE $${params.length} OR lt.name ILIKE $${params.length})`
    );
  }

  return {
    whereClause:
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

/**
 * Mengambil daftar pengajuan cuti untuk HRD (/hrd).
 */
export async function getHrdLeaveRequests(options = {}) {
  const parsedPageSize = parsePositiveInt(options.pageSize) || 10;
  const effectiveOptions = {
    status: options.status ?? "waiting_hrd",
    divisionId: options.divisionId,
    leaveTypeId: options.leaveTypeId,
    search: options.search,
  };

  const { whereClause, params } = buildHrdLeaveWhere(effectiveOptions);
  const orderBy = resolveSortClause(options.sort);

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM leave_requests lr
    JOIN users u ON u.id = lr.user_id
    LEFT JOIN divisions d ON d.id = u.division_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    ${whereClause}`,
    params
  );

  const totalItems = countResult.rows[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / parsedPageSize));
  const requestedPage = parsePositiveInt(options.page) || 1;
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * parsedPageSize;

  const dataParams = [...params, parsedPageSize, offset];
  const dataResult = await query(
    `${BASE_LEAVE_SELECT}
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${dataParams.length - 1}::int OFFSET $${dataParams.length}::int`,
    dataParams
  );

  const summaryResult = await query(
    `SELECT
      COUNT(*) FILTER (
        WHERE (lr.status = 'approved_leader' AND u.role = 'user')
           OR (lr.status = 'pending' AND u.role = 'leader')
      )::int AS waiting_hrd_count,
      COUNT(*) FILTER (WHERE lr.status = 'pending' AND u.role = 'user')::int AS waiting_leader_count,
      COUNT(*) FILTER (WHERE lr.status = 'approved')::int AS approved_count,
      COUNT(*) FILTER (WHERE lr.status = 'rejected')::int AS rejected_count
    FROM leave_requests lr
    JOIN users u ON u.id = lr.user_id`
  );

  return {
    items: dataResult.rows.map(normalizeLeaveRow),
    summary: summaryResult.rows[0] || {
      waiting_hrd_count: 0,
      waiting_leader_count: 0,
      approved_count: 0,
      rejected_count: 0,
    },
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems,
      pageSize: parsedPageSize,
    },
  };
}