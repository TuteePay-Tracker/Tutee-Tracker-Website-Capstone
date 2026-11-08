import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';

export type TutorActionType = 'deactivate' | 'reactivate' | 'delete';

interface ConfirmTutorActionDialogProps {
  isOpen: boolean;
  action: TutorActionType;
  tutor: { name: string; email: string } | null;
  isProcessing?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const actionContent = {
  deactivate: {
    title: 'Deactivate tutor account',
    icon: UserX,
    confirmLabel: 'Deactivate account',
    confirmClassName: 'bg-amber-600 text-white hover:bg-amber-700',
  },
  reactivate: {
    title: 'Reactivate tutor account',
    icon: UserCheck,
    confirmLabel: 'Reactivate account',
    confirmClassName: 'bg-blue-600 text-white hover:bg-blue-700',
  },
  delete: {
    title: 'Permanently delete tutor account',
    icon: Trash2,
    confirmLabel: 'Delete permanently',
    confirmClassName: 'bg-red-600 text-white hover:bg-red-700',
  },
} as const;

export const ConfirmTutorActionDialog = ({
  isOpen,
  action,
  tutor,
  isProcessing = false,
  onClose,
  onConfirm,
}: ConfirmTutorActionDialogProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const content = actionContent[action];
  const Icon = content.icon;
  const isDelete = action === 'delete';

  useEffect(() => {
    if (isOpen) setConfirmed(false);
  }, [isOpen, action, tutor?.email]);

  const handleOpenChange = (open: boolean) => {
    if (!open && !isProcessing) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div
            className={`mb-1 flex h-11 w-11 items-center justify-center rounded-xl ${
              isDelete
                ? 'bg-red-50 text-red-600'
                : action === 'deactivate'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-blue-50 text-blue-600'
            }`}
          >
            <Icon size={20} />
          </div>
          <DialogTitle className="text-lg font-bold text-gray-900">
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {action === 'deactivate' && (
              <>
                Deactivate <strong className="text-gray-900">{tutor?.name}</strong>?
                They will be signed out and prevented from logging in until the
                account is reactivated. Their tutees, payments, schedules, and
                reports will be preserved.
              </>
            )}
            {action === 'reactivate' && (
              <>
                Reactivate <strong className="text-gray-900">{tutor?.name}</strong>?
                They will be able to log in and access their account again.
              </>
            )}
            {isDelete && (
              <>
                Permanently delete <strong className="text-gray-900">{tutor?.name}</strong>{' '}
                ({tutor?.email})? This action cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {isDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
              <div>
                <span className="mb-1 block font-semibold">
                  All of the following will be removed
                </span>
                The Firebase Authentication login, profile, tutees, payments,
                attendance, schedules, progress reports, parent accounts created
                by this tutor, and chat threads.
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-gray-700">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
                disabled={isProcessing}
                className="mt-0.5"
              />
              <span>
                I understand this permanently deletes the tutor account and all
                related data.
              </span>
            </label>
          </div>
        )}

        {action === 'deactivate' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>
              The tutor's existing records are kept. Reactivating the account
              restores access without losing any data.
            </span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing || (isDelete && !confirmed)}
            className={content.confirmClassName}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              content.confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
