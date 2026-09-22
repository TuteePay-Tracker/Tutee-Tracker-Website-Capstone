import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { formatSchoolYear } from '@/shared/utils/schoolYear';

interface SchoolYearConfirmDialogProps {
  pendingYear: string | null;
  currentYear: string;
  onConfirm: (year: string) => void;
  onCancel: () => void;
}

/**
 * Confirmation modal shown before switching the active school year.
 * The actual switch only happens when the tutor confirms.
 */
export const SchoolYearConfirmDialog = ({
  pendingYear,
  currentYear,
  onConfirm,
  onCancel,
}: SchoolYearConfirmDialogProps) => {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!pendingYear) return;
    setConfirming(true);
    try {
      await onConfirm(pendingYear);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog
      open={!!pendingYear}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <CalendarRange size={20} />
            </div>
            <DialogTitle className="text-base sm:text-lg">
              Switch school year?
            </DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {pendingYear && (
              <>
                You are switching from <strong>{formatSchoolYear(currentYear)}</strong> to{' '}
                <strong>{formatSchoolYear(pendingYear)}</strong>. All pages — students,
                payments, attendance, schedules, and reports — will only show data from{' '}
                {formatSchoolYear(pendingYear)}. Students not enrolled in that school year
                will be hidden.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start gap-2">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-4 py-2 bg-green-700 text-white font-semibold text-sm rounded-xl hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {confirming ? 'Switching...' : 'Switch School Year'}
          </button>
          <button
            onClick={onCancel}
            disabled={confirming}
            className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};