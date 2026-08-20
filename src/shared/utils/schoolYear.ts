/**
 * School Year utilities — Philippine convention.
 * A school year runs from June 1 of year N to May 31 of year N+1.
 * Format: "2026-27" (short form of SY 2026–2027)
 */

/**
 * Returns the current active school year string based on today's date.
 * E.g. in June–December 2026 → "2026-27", in Jan–May 2027 → "2026-27"
 */
export function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  // June (6) onwards → SY starts this calendar year
  // January–May → SY started previous calendar year
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

/**
 * Returns the start and end Date for a given school year string.
 * SY "2026-27" → { start: June 1 2026, end: May 31 2027 }
 */
export function getSchoolYearRange(sy: string): { start: Date; end: Date } {
  const parts = sy.split('-');
  const startYear = parseInt(parts[0], 10);
  const endYear = startYear + 1;

  const start = new Date(startYear, 5, 1, 0, 0, 0, 0); // June 1
  const end = new Date(endYear, 4, 31, 23, 59, 59, 999); // May 31

  return { start, end };
}

/**
 * Returns an array of school year strings centered around the current SY.
 * Goes 3 years back and 1 year forward from the current SY.
 */
export function getAvailableSchoolYears(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentStartYear = month >= 6 ? year : year - 1;

  const years: string[] = [];
  for (let i = -3; i <= 1; i++) {
    const sy = currentStartYear + i;
    const endYearShort = String(sy + 1).slice(-2);
    years.push(`${sy}-${endYearShort}`);
  }
  return years;
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
export function isInSchoolYear(date: Date | string, sy: string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const { start, end } = getSchoolYearRange(sy);
  return d >= start && d <= end;
}
