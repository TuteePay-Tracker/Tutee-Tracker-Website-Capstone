import { AlertTriangle, Users } from 'lucide-react';
import type { ScheduleConflict } from '@/features/schedule/utils/scheduleConflicts';

interface ScheduleConflictAlertProps {
  conflicts: ScheduleConflict[];
  className?: string;
}

/**
 * Inline alert shown when a candidate schedule overlaps with an existing tutee.
 * - Different grade level overlaps and same-grade partial overlaps are blocking conflicts (disables saving).
 * - Only exact matching same-grade schedules are allowed as group sessions.
 */
export const ScheduleConflictAlert = ({
  conflicts,
  className = '',
}: ScheduleConflictAlertProps) => {
  if (conflicts.length === 0) return null;

  const blocking = conflicts.filter((conflict) => conflict.severity === 'blocking');
  const warnings = conflicts.filter((conflict) => conflict.severity === 'warning');

  return (
    <div className={`space-y-2.5 ${className}`} aria-live="polite">
      {blocking.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3.5 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-red-900">
                {blocking.length} Schedule Conflict{blocking.length === 1 ? '' : 's'} Detected
              </p>
              <p className="mt-0.5 text-xs text-red-700">
                Overlapping schedules are not allowed unless tutees are in the same grade level and their schedules match exactly. Saving is disabled until resolved.
              </p>
              <ul className="mt-2 space-y-1.5 rounded-lg border border-red-200 bg-white/90 p-2.5 text-xs text-red-800">
                {blocking.map((conflict, index) => (
                  <li
                    key={`${conflict.secondTuteeId}-${conflict.day}-${index}`}
                    className="flex items-start gap-2"
                  >
                    <span className="font-bold text-red-600 shrink-0">•</span>
                    <span>{conflict.message}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] font-semibold text-red-600">
                Please adjust the schedule to resolve this conflict.
              </p>
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-emerald-900">
                {warnings.length} Exact-Match Same-Grade Schedule{warnings.length === 1 ? '' : 's'} (Group Session Allowed)
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-700">
                Students in the same grade level with exact matching schedules are allowed as group sessions.
              </p>
              <ul className="mt-1.5 space-y-1 rounded-lg border border-emerald-200 bg-white/80 p-2 text-xs text-emerald-800">
                {warnings.map((conflict, index) => (
                  <li
                    key={`${conflict.secondTuteeId}-${conflict.day}-${index}`}
                    className="flex items-start gap-1.5"
                  >
                    <span className="font-semibold text-emerald-600 shrink-0">•</span>
                    <span>{conflict.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
