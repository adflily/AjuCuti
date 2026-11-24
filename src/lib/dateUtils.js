// Utilitas tanggal dan perhitungan hari kerja untuk AjuCuti (zona waktu WIB / Asia/Jakarta)

const TIMEZONE_ID = "Asia/Jakarta";

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD (WIB).
 */
export function getTodayDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_ID,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Mengembalikan tahun berjalan (WIB) sebagai integer.
 */
export function getCurrentYear() {
  return Number(getTodayDateString().slice(0, 4));
}

/**
 * Mengonversi nilai Date atau string menjadi YYYY-MM-DD tanpa pergeseran zona waktu.
 *
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
export function toDateString(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return "";
}

/**
 * Mengurai string YYYY-MM-DD menjadi objek Date UTC (aman dari pergeseran DST/timezone).
 */
function parseUtcDate(dateStr) {
  const match = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Menghitung selisih hari kalender (endDateStr - startDateStr).
 * Positif jika endDateStr setelah startDateStr.
 */
export function diffCalendarDays(startDateStr, endDateStr) {
  const start = parseUtcDate(startDateStr);
  const end = parseUtcDate(endDateStr);
  if (!start || !end) return NaN;

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Menghitung jumlah hari kerja (Senin-Jumat dikurangi daftar tanggal holidays).
 * Jika isHalfDay = true, startDate dan endDate harus sama dan jatuh pada hari kerja -> 0.5 hari.
 *
 * @param {string} startDateStr - Format YYYY-MM-DD
 * @param {string} endDateStr - Format YYYY-MM-DD
 * @param {string[] | Set<string>} holidayDates - Daftar tanggal libur YYYY-MM-DD
 * @param {boolean} [isHalfDay=false]
 * @returns {number}
 */
export function calculateWorkingDays(
  startDateStr,
  endDateStr,
  holidayDates = [],
  isHalfDay = false
) {
  const start = parseUtcDate(startDateStr);
  const end = parseUtcDate(endDateStr);

  if (!start || !end || end.getTime() < start.getTime()) {
    return 0;
  }

  const holidaySet =
    holidayDates instanceof Set ? holidayDates : new Set(holidayDates);

  if (isHalfDay) {
    if (startDateStr !== endDateStr) {
      return 0;
    }
    const dayOfWeek = start.getUTCDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    if (!isWeekday || holidaySet.has(startDateStr)) {
      return 0;
    }
    return 0.5;
  }

  let count = 0;
  const cursor = new Date(start.getTime());

  while (cursor.getTime() <= end.getTime()) {
    const dayOfWeek = cursor.getUTCDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isWeekday) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
      const d = String(cursor.getUTCDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${d}`;

      if (!holidaySet.has(dateKey)) {
        count += 1;
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

/**
 * Format tanggal ke tampilan Bahasa Indonesia (contoh: 24 Des 2026).
 */
export function formatDateId(dateValue) {
  const dateStr = toDateString(dateValue);
  const date = parseUtcDate(dateStr);
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Format timestamp ke tanggal & jam WIB (contoh: 24 Des 2026, 14.30 WIB).
 */
export function formatDateTimeId(dateTimeValue) {
  if (!dateTimeValue) return "-";
  const date = new Date(dateTimeValue);
  if (Number.isNaN(date.getTime())) return "-";

  const formatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE_ID,
  }).format(date);

  return `${formatted} WIB`;
}

/**
 * Format angka durasi hari (mendukung setengah hari 0,5).
 */
export function formatDays(days) {
  const numeric = Number(days ?? 0);
  if (Number.isNaN(numeric)) return "0 hari";

  const formatted = Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toFixed(1).replace(".", ",");

  return `${formatted} hari`;
}