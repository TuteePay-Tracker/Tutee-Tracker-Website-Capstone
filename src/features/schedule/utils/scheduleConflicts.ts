import {
  getTuteeScheduleForYear,
  isTuteeArchivedForYear,
  isTuteeInSchoolYear,
  normalizeScheduleItems,
  type NormalizedScheduleItem,
  type ScheduleItem,
  type Tutee,
} from '@/features/tutees/types/tutee';
import { formatTime12h } from '@/shared/utils/formatDate';

export type GradeRelation = 'same' | 'different' | 'unknown';
export type ConflictSeverity = 'blocking' | 'warning';

export interface ScheduleConflict {
  day: string;
  firstTuteeId: string;
  firstTuteeName: string;
  firstGradeLevel?: string;
  firstStartTime: string;
  firstEndTime: string;
  secondTuteeId: string;
  secondTuteeName: string;
  secondGradeLevel?: string;
  secondSubject?: string;
  secondStartTime: string;
  secondEndTime: string;
  gradeRelation: GradeRelation;
  severity: ConflictSeverity;
  message: string;
}

export interface ScheduleEntry {
  tutee: Tutee;
  slot: NormalizedScheduleItem;
}

export interface FindScheduleConflictsOptions {
  candidateSchedule: ScheduleItem[] | string | null | undefined;
  candidateGradeLevel?: string;
  candidateSubject?: string;
  candidateName?: string;
  candidateTuteeId?: string;
  tutees: Tutee[];
  schoolYear: string;
  /** The tutee being edited — never compared against itself. */
  excludeTuteeId?: string;
}

const WEEKDAY_ORDER: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_ALIASES: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

/** Converts an `HH:mm` value to minutes since midnight. */
export function toMinutes(time: string): number {
  const [hours, minutes] = (time || '').split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function normalizeRange(startTime: string, endTime: string): { start: number; end: number } {
  const start = toMinutes(startTime);
  let end = toMinutes(endTime);
  // Treat an end at/before the start as an overnight range.
  if (end <= start) end += 24 * 60;
  return { start, end };
}

/**
 * True when two time ranges overlap. Ranges that only touch end-to-end
 * (e.g. 09:00-10:00 and 10:00-11:00) do not conflict. Handles overnight ranges.
 */
export function rangesOverlap(
  aStartTime: string,
  aEndTime: string,
  bStartTime: string,
  bEndTime: string
): boolean {
  const a = normalizeRange(aStartTime, aEndTime);
  const b = normalizeRange(bStartTime, bEndTime);
  const day = 24 * 60;

  return (
    (a.start < b.end && b.start < a.end) ||
    // One range may cross midnight while the other sits on the next day.
    (a.start < b.end + day && b.start + day < a.end) ||
    (a.start + day < b.end && b.start < a.end + day)
  );
}

function normalizeDay(day: string): string {
  const value = (day || '').trim();
  if (!value) return '';
  const lower = value.toLowerCase();
  const alias = DAY_ALIASES[lower.slice(0, 4)] ?? DAY_ALIASES[lower.slice(0, 3)];
  if (alias) return alias;
  const full = Object.keys(WEEKDAY_ORDER).find((name) => name === lower);
  if (full) return full.charAt(0).toUpperCase() + full.slice(1);
  return value;
}

function sameDay(a: string, b: string): boolean {
  return normalizeDay(a).toLowerCase() === normalizeDay(b).toLowerCase();
}

function getGradeRelation(first?: string, second?: string): GradeRelation {
  const a = (first || '').trim().toLowerCase();
  const b = (second || '').trim().toLowerCase();
  if (!a || !b) return 'unknown';
  return a === b ? 'same' : 'different';
}

function severityFor(relation: GradeRelation): ConflictSeverity {
  return relation === 'different' ? 'blocking' : 'warning';
}

function formatRange(startTime: string, endTime: string): string {
  return `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
}

function buildConflict(params: {
  day: string;
  firstTuteeId: string;
  firstTuteeName: string;
  firstGradeLevel?: string;
  firstStartTime: string;
  firstEndTime: string;
  secondTuteeId: string;
  secondTuteeName: string;
  secondGradeLevel?: string;
  secondSubject?: string;
  secondStartTime: string;
  secondEndTime: string;
}): ScheduleConflict {
  const relation = getGradeRelation(params.firstGradeLevel, params.secondGradeLevel);
  const severity = severityFor(relation);

  const gradeLabel = relation === 'different'
    ? 'different grade level'
    : relation === 'same'
      ? 'same grade level — possible group session'
      : 'grade level not set';

  return {
    ...params,
    gradeRelation: relation,
    severity,
    message: `${normalizeDay(params.day)} ${formatRange(params.firstStartTime, params.firstEndTime)} overlaps ${params.secondTuteeName}${params.secondGradeLevel ? ` (${params.secondGradeLevel})` : ''
      } · ${gradeLabel}`,
  };
}

function sortConflicts(conflicts: ScheduleConflict[]): ScheduleConflict[] {
  return conflicts.sort((a, b) => {
    const dayDiff =
      (WEEKDAY_ORDER[normalizeDay(a.day).toLowerCase()] ?? 99) -
      (WEEKDAY_ORDER[normalizeDay(b.day).toLowerCase()] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return toMinutes(a.firstStartTime) - toMinutes(b.firstStartTime);
  });
}

/**
 * Compares a candidate weekly schedule against every other active tutee in the
 * given school year.
 *
 * - Same grade level overlaps are `warning` (allowed, possible group session).
 * - Different grade level overlaps are `blocking` (requires explicit override).
 * - Missing grade data is treated as `warning` to avoid blocking legacy records.
 */
export function findScheduleConflicts({
  candidateSchedule,
  candidateGradeLevel,
  candidateSubject,
  candidateName = 'This tutee',
  candidateTuteeId = 'candidate',
  tutees,
  schoolYear,
  excludeTuteeId,
}: FindScheduleConflictsOptions): ScheduleConflict[] {
  const candidateSlots = normalizeScheduleItems(candidateSchedule);
  if (candidateSlots.length === 0) return [];

  const conflicts: ScheduleConflict[] = [];
  const seen = new Set<string>();

  tutees.forEach((tutee) => {
    if (tutee.id === excludeTuteeId) return;
    if (!isTuteeInSchoolYear(tutee, schoolYear)) return;
    if (isTuteeArchivedForYear(tutee, schoolYear)) return;

    const existingSlots = normalizeScheduleItems(getTuteeScheduleForYear(tutee, schoolYear));
    const tuteeName = `${tutee.firstName || ''} ${tutee.surname || ''}`.trim() || 'Unnamed tutee';

    existingSlots.forEach((existing) => {
      candidateSlots.forEach((slot) => {
        if (!sameDay(slot.day, existing.day)) return;
        if (!rangesOverlap(slot.startTime, slot.endTime, existing.startTime, existing.endTime)) return;

        const key = [
          tutee.id,
          normalizeDay(slot.day),
          slot.startTime,
          slot.endTime,
          existing.startTime,
          existing.endTime,
        ].join('|');
        if (seen.has(key)) return;
        seen.add(key);

        conflicts.push(
          buildConflict({
            day: slot.day,
            firstTuteeId: candidateTuteeId,
            firstTuteeName: candidateName,
            firstGradeLevel: candidateGradeLevel,
            firstStartTime: slot.startTime,
            firstEndTime: slot.endTime,
            secondTuteeId: tutee.id,
            secondTuteeName: tuteeName,
            secondGradeLevel: tutee.gradeLevel,
            secondSubject: candidateSubject || tutee.subject,
            secondStartTime: existing.startTime,
            secondEndTime: existing.endTime,
          })
        );
      });
    });
  });

  return sortConflicts(conflicts);
}

/** True when at least one conflict needs an explicit override. */
export function hasBlockingConflicts(conflicts: ScheduleConflict[]): boolean {
  return conflicts.some((conflict) => conflict.severity === 'blocking');
}

/**
 * Pairwise conflict detection for a flat list of sessions (used by the
 * Schedule calendar to badge overlapping entries on screen).
 */
export function findDayConflicts(entries: ScheduleEntry[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const first = entries[i];
      const second = entries[j];
      if (first.tutee.id === second.tutee.id) continue;
      if (!sameDay(first.slot.day, second.slot.day)) continue;
      if (
        !rangesOverlap(
          first.slot.startTime,
          first.slot.endTime,
          second.slot.startTime,
          second.slot.endTime
        )
      ) {
        continue;
      }

      const key = [
        normalizeDay(first.slot.day),
        first.tutee.id,
        first.slot.startTime,
        first.slot.endTime,
        second.tutee.id,
        second.slot.startTime,
        second.slot.endTime,
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      const firstName = `${first.tutee.firstName || ''} ${first.tutee.surname || ''}`.trim() || 'Unnamed tutee';
      const secondName = `${second.tutee.firstName || ''} ${second.tutee.surname || ''}`.trim() || 'Unnamed tutee';

      conflicts.push(
        buildConflict({
          day: first.slot.day,
          firstTuteeId: first.tutee.id,
          firstTuteeName: firstName,
          firstGradeLevel: first.tutee.gradeLevel,
          firstStartTime: first.slot.startTime,
          firstEndTime: first.slot.endTime,
          secondTuteeId: second.tutee.id,
          secondTuteeName: secondName,
          secondGradeLevel: second.tutee.gradeLevel,
          secondSubject: second.tutee.subject,
          secondStartTime: second.slot.startTime,
          secondEndTime: second.slot.endTime,
        })
      );
    }
  }

  return sortConflicts(conflicts);
}

/** True when the conflict involves the given tutee's session. */
export function conflictTouchesSession(
  conflict: ScheduleConflict,
  tuteeId: string,
  slot: NormalizedScheduleItem
): boolean {
  return (
    (conflict.firstTuteeId === tuteeId &&
      conflict.firstStartTime === slot.startTime &&
      conflict.firstEndTime === slot.endTime) ||
    (conflict.secondTuteeId === tuteeId &&
      conflict.secondStartTime === slot.startTime &&
      conflict.secondEndTime === slot.endTime)
  );
}

/**
 * Returns the most severe conflict touching a session, or `undefined` when the
 * session is clear. Blocking conflicts take precedence over warnings.
 */
export function getSessionConflict(
  conflicts: ScheduleConflict[],
  tuteeId: string,
  slot: NormalizedScheduleItem
): ScheduleConflict | undefined {
  const touching = conflicts.filter((conflict) => conflictTouchesSession(conflict, tuteeId, slot));
  return touching.find((conflict) => conflict.severity === 'blocking') ?? touching[0];
}
