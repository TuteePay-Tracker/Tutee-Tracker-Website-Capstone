/**
 * School Year utilities — Flexible convention.
 * Supports customizable start months (e.g. June, August, September, January).
 * Format: "2026-27" (short form of SY 2026–2027)
 */

export const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June (Philippine traditional)' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August (DepEd / International)' },
  { value: 9, label: 'September (US / Europe)' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

export const DEFAULT_START_MONTH = 6;

/**
 * Returns the current active school year string based on today's date.
 */
export function getCurrentSchoolYear(startMonth: number = DEFAULT_START_MONTH): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  const startYear = month >= startMonth ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

/**
 * Returns the start and end Date for a given school year string.
 */
export function getSchoolYearRange(sy: string, startMonth: number = DEFAULT_START_MONTH): { start: Date; end: Date } {
  const parts = sy.split('-');
  const startYear = parseInt(parts[0], 10);
  const endYear = startYear + 1;

  const validStartMonth = Math.min(Math.max(startMonth || DEFAULT_START_MONTH, 1), 12);
  const start = new Date(startYear, validStartMonth - 1, 1, 0, 0, 0, 0);

  const endMonth = validStartMonth === 1 ? 12 : validStartMonth - 1;
  const targetEndYear = validStartMonth === 1 ? startYear : endYear;
  const end = new Date(targetEndYear, endMonth, 0, 23, 59, 59, 999);

  return { start, end };
}

/**
 * Returns an array of school year strings centered around the current SY.
 */
export function getAvailableSchoolYears(startMonth: number = DEFAULT_START_MONTH): string[] {
  return getDefaultSchoolYears(3, 1, startMonth);
}

/**
 * The fallback/default list of school years used when no
 * per-tutor school year list exists yet.
 */
export function getDefaultSchoolYears(back = 3, forward = 1, startMonth: number = DEFAULT_START_MONTH): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentStartYear = month >= startMonth ? year : year - 1;

  const years: string[] = [];
  for (let i = -back; i <= forward; i++) {
    const sy = currentStartYear + i;
    const endYearShort = String(sy + 1).slice(-2);
    years.push(`${sy}-${endYearShort}`);
  }
  return years;
}

/**
 * Returns the next consecutive school year string after the given one.
 * "2026-27" → "2027-28". Returns undefined for invalid input.
 */
export function getNextSchoolYear(sy: string): string | undefined {
  if (!/^\d{4}-\d{2}$/.test(sy)) return undefined;
  const startYear = parseInt(sy.slice(0, 4), 10);
  if (isNaN(startYear)) return undefined;
  const nextStart = startYear + 1;
  return `${nextStart}-${String(nextStart + 1).slice(-2)}`;
}

/**
 * Formats a school year string for display.
 * "2026-27" → "SY 2026–27"
 */
export function formatSchoolYear(sy: string): string {
  return `SY ${sy.replace('-', '–')}`;
}

/**
 * Returns true if a given date falls within the specified school year.
 */
export function isInSchoolYear(date: Date | string, sy: string, startMonth: number = DEFAULT_START_MONTH): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const { start, end } = getSchoolYearRange(sy, startMonth);
  return d >= start && d <= end;
}

/**
 * Derives the school year string from a given date.
 */
export function getSchoolYearFromDate(date: Date | string | undefined | null, startMonth: number = DEFAULT_START_MONTH): string | undefined {
  if (!date) return undefined;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return undefined;
  const m = d.getMonth() + 1;
  const startYear = m >= startMonth ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/**
 * Derives the school year from a "YYYY-MM" month key.
 */
export function getSchoolYearFromMonth(month: string | undefined | null, startMonth: number = DEFAULT_START_MONTH): string | undefined {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return undefined;
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(monthNum)) return undefined;
  const startYear = monthNum >= startMonth ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/**
 * Returns true if a "YYYY-MM" month key falls within the given school year.
 */
export function isMonthInSchoolYear(month: string, sy: string, startMonth: number = DEFAULT_START_MONTH): boolean {
  return getSchoolYearFromMonth(month, startMonth) === sy;
}

/**
 * Normalizes a Firestore Timestamp-like value into an ISO date string.
 */
function toDateInput(value: unknown): Date | string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  return undefined;
}

/**
 * Returns true if a record belongs to the given school year.
 */
export function belongsToSchoolYear(
  sy: string,
  record: {
    schoolYear?: string | null;
    paymentDate?: unknown;
    date?: unknown;
    createdAt?: unknown;
    month?: string | null;
  } = {},
  startMonth: number = DEFAULT_START_MONTH
): boolean {
  if (record.schoolYear) return record.schoolYear === sy;
  // 1. If month is provided (e.g. "2026-09"), that is the primary billing/attendance month
  if (record.month && /^\d{4}-\d{2}$/.test(record.month)) {
    return getSchoolYearFromMonth(record.month, startMonth) === sy;
  }
  // 2. Specific transaction or session date
  const dateSrc = toDateInput(record.paymentDate) ?? toDateInput(record.date);
  if (dateSrc !== undefined) {
    const derived = getSchoolYearFromDate(dateSrc, startMonth);
    if (derived !== undefined) return derived === sy;
  }
  // 3. Fallback to createdAt only if no month/date exists
  const createdSrc = toDateInput(record.createdAt);
  if (createdSrc !== undefined) {
    const derived = getSchoolYearFromDate(createdSrc, startMonth);
    if (derived !== undefined) return derived === sy;
  }
  return true;
}
