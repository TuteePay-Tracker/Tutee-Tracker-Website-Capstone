import { AlertTriangle, Users } from 'lucide-react';
import type { ScheduleConflict } from '@/features/schedule/utils/scheduleConflicts';

interface ScheduleConflictAlertProps {
  conflicts: ScheduleConflict[];
  className?: string;
}

/**
 * Inline warning shown while a tutor is booking a schedule.
 *
 * Red = different grade level overlap (requires explicit override).
 * Amber = same grade level overlap (allowed, possible group session).
 */
export const ScheduleConflictAlert = ({
  conflicts,
  className = '',
}: ScheduleConflictAlertProps) => {
  if (conflicts.length === 0) return null;

  const blocking = conflicts.filter((conflict) => conflict.severity === 'blocking');
  const warnings = conflicts.filter((conflict) => conflict.severity === 'warning');

  return (
    <div className={`space-y-2 ${className}`} aria-live="polite">
      {blocking.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-800">
                {blocking.length} schedule conflict{blocking.length === 1 ? '' : 's'} — different grade level
              </p>
              <ul className="mt-1 space-y-1 text-xs text-red-700">
                {blocking.map((conflict, index) => (
                  <li key={`${conflict.secondTuteeId}-${conflict.day}-${index}`}>
                    {conflict.message}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] font-medium text-red-600">
                Saving will require an explicit confirmation.
              </p>
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800">
                {warnings.length} same-grade overlap{warnings.length === 1 ? '' : 's'}
              </p>
              <ul className="mt-1 space-y-1 text-xs text-amber-700">
                {warnings.map((conflict, index) => (
                  <li key={`${conflict.secondTuteeId}-${conflict.day}-${index}`}>
                    {conflict.message}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] font-medium text-amber-600">
                This is allowed and may be treated as a group session.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
