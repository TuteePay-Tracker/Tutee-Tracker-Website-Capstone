import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import type { ScheduleConflict } from '@/features/schedule/utils/scheduleConflicts';

interface ScheduleConflictOverrideDialogProps {
  open: boolean;
  conflicts: ScheduleConflict[];
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

/**
 * Explicit confirmation required before saving a booking that overlaps a tutee
 * in a different grade level.
 */
export const ScheduleConflictOverrideDialog = ({
  open,
  conflicts,
  onConfirm,
  onCancel,
  confirming = false,
}: ScheduleConflictOverrideDialogProps) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <DialogTitle className="text-base sm:text-lg">
              Schedule anyway?
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            This booking overlaps {conflicts.length} tutee
            {conflicts.length === 1 ? '' : 's'} in a different grade level. Saving
            will create a conflicting timetable slot.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-1.5 rounded-xl border border-red-100 bg-red-50/60 p-3 text-xs text-red-800">
          {conflicts.map((conflict, index) => (
            <li key={`${conflict.secondTuteeId}-${conflict.day}-${index}`}>
              {conflict.message}
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2 sm:justify-start">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {confirming ? 'Saving...' : 'Schedule anyway'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            Go back
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
