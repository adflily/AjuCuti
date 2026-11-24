import { query } from "@/lib/db";

// Kumpulan query RAW SQL terparameterisasi untuk CMS Admin (/admin/*)
// Seluruh whereClause dibangun dinamis dan parameter non-teks memakai cast eksplisit ($n::int / $n::date).

const VALID_ROLES = new Set(["admin", "user", "leader", "hrd"]);

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

// ============================================================================
// 1. RINGKASAN DASHBOARD ADMIN
// ============================================================================
export async function getAdminOverviewStats() {
  const [usersRes, divisionsRes, leaveTypesRes, holidaysRes, pendingLeavesRes] =
    await Promise.all([
      query(
        `SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_users
        FROM users`
      ),
      query(`SELECT COUNT(*)::int AS total_divisions FROM divisions`),
      query(
        `SELECT
          COUNT(*)::int AS total_leave_types,
          COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_leave_types
        FROM leave_types`
      ),
      query(
        `SELECT COUNT(*)::int AS upcoming_holidays
        FROM holidays
        WHERE holiday_date >= CURRENT_DATE`
      ),
      query(
        `SELECT
          COUNT(*) FILTER (WHERE status IN ('pending', 'approved_leader'))::int AS active_requests,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_requests
        FROM leave_requests`
      ),
    ]);

  return {
    totalUsers: usersRes.rows[0]?.total_users || 0,
    activeUsers: usersRes.rows[0]?.active_users || 0,
    totalDivisions: divisionsRes.rows[0]?.total_divisions || 0,
    totalLeaveTypes: leaveTypesRes.rows[0]?.total_leave_types || 0,
    activeLeaveTypes: leaveTypesRes.rows[0]?.active_leave_types || 0,
    upcomingHolidays: holidaysRes.rows[0]?.upcoming_holidays || 0,
    activeRequests: pendingLeavesRes.rows[0]?.active_requests || 0,
    approvedRequests: pendingLeavesRes.rows[0]?.approved_requests || 0,
  };
}

// ============================================================================
// 2. CMS PENGGUNA (users)
// ============================================================================
const USER_SORT_MAP = {
  newest: "u.created_at DESC, u.id DESC",
  oldest: "u.created_at ASC, u.id ASC",
  name_asc: "u.full_name ASC, u.id ASC",
  name_desc: "u.full_name DESC, u.id DESC",
  role_asc: "u.role ASC, u.full_name ASC",
};

export async function getAdminUsers(options = {}) {
  const pageSize = parsePositiveInt(options.pageSize) || 10;
  const conditions = [];
  const params = [];

  if (options.role && VALID_ROLES.has(options.role)) {
    params.push(options.role);
    conditions.push(`u.role = $${params.length}`);
  }

  const parsedDivisionId = parsePositiveInt(options.divisionId);
  if (parsedDivisionId !== null) {
    params.push(parsedDivisionId);
    conditions.push(`u.division_id = $${params.length}::int`);
  }

  if (options.status === "active") {
    conditions.push(`u.is_active = TRUE`);
  } else if (options.status === "inactive") {
    conditions.push(`u.is_active = FALSE`);
  }

  const trimmedSearch = String(options.search || "").trim();
  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    conditions.push(
      `(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.username ILIKE $${params.length} OR COALESCE(u.employee_code, '') ILIKE $${params.length})`
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = USER_SORT_MAP[options.sort] || USER_SORT_MAP.newest;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM users u
    ${whereClause}`,
    params
  );

  const totalItems = countResult.rows[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = parsePositiveInt(options.page) || 1;
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * pageSize;

  const dataParams = [...params, pageSize, offset];
  const dataResult = await query(
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
      u.annual_leave_quota,
      TO_CHAR(u.join_date, 'YYYY-MM-DD') AS join_date,
      u.is_active,
      u.created_at
    FROM users u
    LEFT JOIN divisions d ON d.id = u.division_id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${dataParams.length - 1}::int OFFSET $${dataParams.length}::int`,
    dataParams
  );

  return {
    items: dataResult.rows.map((row) => ({
      ...row,
      annual_leave_quota: Number(row.annual_leave_quota ?? 12),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems,
      pageSize,
    },
  };
}

// ============================================================================
// 3. CMS DIVISI & ANGGOTA DIVISI (divisions + users)
// ============================================================================
const DIVISION_SORT_MAP = {
  name_asc: "d.name ASC, d.id ASC",
  name_desc: "d.name DESC, d.id DESC",
  newest: "d.created_at DESC, d.id DESC",
  members_desc: "member_count DESC, d.name ASC",
};

export async function getAdminDivisions(options = {}) {
  const pageSize = parsePositiveInt(options.pageSize) || 10;
  const conditions = [];
  const params = [];

  const trimmedSearch = String(options.search || "").trim();
  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    conditions.push(
      `(d.name ILIKE $${params.length} OR COALESCE(d.code, '') ILIKE $${params.length} OR COALESCE(d.description, '') ILIKE $${params.length})`
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = DIVISION_SORT_MAP[options.sort] || DIVISION_SORT_MAP.name_asc;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM divisions d
    ${whereClause}`,
    params
  );

  const totalItems = countResult.rows[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = parsePositiveInt(options.page) || 1;
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * pageSize;

  const dataParams = [...params, pageSize, offset];
  const dataResult = await query(
    `SELECT
      d.id,
      d.code,
      d.name,
      d.description,
      d.leader_id,
      lu.full_name AS leader_name,
      lu.email AS leader_email,
      COUNT(m.id)::int AS member_count,
      d.created_at
    FROM divisions d
    LEFT JOIN users lu ON lu.id = d.leader_id
    LEFT JOIN users m ON m.division_id = d.id
    ${whereClause}
    GROUP BY d.id, lu.full_name, lu.email
    ORDER BY ${orderBy}
    LIMIT $${dataParams.length - 1}::int OFFSET $${dataParams.length}::int`,
    dataParams
  );

  return {
    items: dataResult.rows.map((row) => ({
      ...row,
      member_count: Number(row.member_count || 0),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems,
      pageSize,
    },
  };
}

/**
 * Mengambil seluruh pengguna aktif beserta info divisinya untuk dropdown ketua & kelola anggota divisi.
 */
export async function getUsersForDivisionManagement() {
  const result = await query(
    `SELECT
      u.id,
      u.employee_code,
      u.full_name,
      u.email,
      u.role,
      u.position,
      u.division_id,
      u.is_active,
      d.name AS division_name,
      ld.id AS leading_division_id,
      ld.name AS leading_division_name
    FROM users u
    LEFT JOIN divisions d ON d.id = u.division_id
    LEFT JOIN divisions ld ON ld.leader_id = u.id
    ORDER BY u.full_name ASC`
  );

  return result.rows;
}

/**
 * Daftar ringkas semua divisi (untuk dropdown di form pengguna).
 */
export async function getAllDivisionsSimple() {
  const result = await query(
    `SELECT id, code, name
    FROM divisions
    ORDER BY name ASC`
  );
  return result.rows;
}

// ============================================================================
// 4. CMS JENIS CUTI (leave_types)
// ============================================================================
const LEAVE_TYPE_SORT_MAP = {
  system_first: "lt.is_system DESC, lt.id ASC",
  name_asc: "lt.name ASC, lt.id ASC",
  name_desc: "lt.name DESC, lt.id DESC",
  newest: "lt.created_at DESC, lt.id DESC",
};

export async function getAdminLeaveTypes(options = {}) {
  const pageSize = parsePositiveInt(options.pageSize) || 10;
  const conditions = [];
  const params = [];

  if (options.status === "active") {
    conditions.push(`lt.is_active = TRUE`);
  } else if (options.status === "inactive") {
    conditions.push(`lt.is_active = FALSE`);
  }

  if (options.deducts === "yes") {
    conditions.push(`lt.deducts_annual_quota = TRUE`);
  } else if (options.deducts === "no") {
    conditions.push(`lt.deducts_annual_quota = FALSE`);
  }

  const trimmedSearch = String(options.search || "").trim();
  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    conditions.push(
      `(lt.name ILIKE $${params.length} OR lt.code ILIKE $${params.length} OR COALESCE(lt.description, '') ILIKE $${params.length})`
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy =
    LEAVE_TYPE_SORT_MAP[options.sort] || LEAVE_TYPE_SORT_MAP.system_first;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM leave_types lt
    ${whereClause}`,
    params
  );

  const totalItems = countResult.rows[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = parsePositiveInt(options.page) || 1;
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * pageSize;

  const dataParams = [...params, pageSize, offset];
  const dataResult = await query(
    `SELECT
      lt.id,
      lt.code,
      lt.name,
      lt.description,
      lt.max_days_per_request,
      lt.quota_per_year,
      lt.min_notice_days,
      lt.max_backdate_days,
      lt.deducts_annual_quota,
      lt.requires_attachment,
      lt.is_system,
      lt.is_active,
      COUNT(lr.id)::int AS usage_count
    FROM leave_types lt
    LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id
    ${whereClause}
    GROUP BY lt.id
    ORDER BY ${orderBy}
    LIMIT $${dataParams.length - 1}::int OFFSET $${dataParams.length}::int`,
    dataParams
  );

  return {
    items: dataResult.rows.map((row) => ({
      ...row,
      usage_count: Number(row.usage_count || 0),
    })),
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems,
      pageSize,
    },
  };
}

// ============================================================================
// 5. CMS HARI LIBUR (holidays)
// ============================================================================
const HOLIDAY_SORT_MAP = {
  date_asc: "holiday_date ASC, id ASC",
  date_desc: "holiday_date DESC, id DESC",
  name_asc: "name ASC, holiday_date ASC",
};

export async function getAdminHolidays(options = {}) {
  const pageSize = parsePositiveInt(options.pageSize) || 15;
  const conditions = [];
  const params = [];

  const parsedYear = parsePositiveInt(options.year);
  if (parsedYear !== null) {
    params.push(parsedYear);
    conditions.push(`EXTRACT(YEAR FROM holiday_date) = $${params.length}::int`);
  }

  if (options.type === "national") {
    conditions.push(`is_joint_leave = FALSE`);
  } else if (options.type === "joint") {
    conditions.push(`is_joint_leave = TRUE`);
  }

  const trimmedSearch = String(options.search || "").trim();
  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    conditions.push(`name ILIKE $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = HOLIDAY_SORT_MAP[options.sort] || HOLIDAY_SORT_MAP.date_asc;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM holidays
    ${whereClause}`,
    params
  );

  const totalItems = countResult.rows[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = parsePositiveInt(options.page) || 1;
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * pageSize;

  const dataParams = [...params, pageSize, offset];
  const [dataResult, yearsResult] = await Promise.all([
    query(
      `SELECT
        id,
        TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date,
        name,
        is_joint_leave
      FROM holidays
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${dataParams.length - 1}::int OFFSET $${dataParams.length}::int`,
      dataParams
    ),
    query(
      `SELECT DISTINCT EXTRACT(YEAR FROM holiday_date)::int AS year
      FROM holidays
      ORDER BY year ASC`
    ),
  ]);

  return {
    items: dataResult.rows,
    availableYears: yearsResult.rows.map((r) => Number(r.year)),
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems,
      pageSize,
    },
  };
}