import { useState } from 'react';
import { Link } from 'react-router';
import { Eye, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  deleteTutorAccount,
  setTutorAccountStatus,
} from '../services/tutorManagementService';
import {
  ConfirmTutorActionDialog,
  type TutorActionType,
} from './ConfirmTutorActionDialog';

interface TutorAccountActionsProps {
  tutor: {
    id: string;
    name: string;
    email: string;
    status?: string;
  };
  onChanged?: () => void;
  onDeleted?: () => void;
  showViewDetails?: boolean;
}

const actionMessages: Record<TutorActionType, string> = {
  deactivate: 'Tutor account deactivated.',
  reactivate: 'Tutor account reactivated.',
  delete: 'Tutor account permanently deleted.',
};

export const TutorAccountActions = ({
  tutor,
  onChanged,
  onDeleted,
  showViewDetails = true,
}: TutorAccountActionsProps) => {
  const { user } = useAuth();
  const [pendingAction, setPendingAction] = useState<TutorActionType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isInactive = tutor.status === 'inactive' || tutor.status === 'deactivated';

  // Defence in depth: the route, Firestore rules, and relay also enforce this.
  if (!user || user.role !== 'super_admin') {
    return null;
  }

  const handleConfirm = async () => {
    if (!pendingAction) return;

    setIsProcessing(true);
    try {
      if (pendingAction === 'delete') {
        await deleteTutorAccount({
          tutorId: tutor.id,
          tutorName: tutor.name,
          tutorEmail: tutor.email,
          adminId: user.id,
          adminName: user.name,
        });
      } else {
        await setTutorAccountStatus({
          tutorId: tutor.id,
          status: pendingAction === 'deactivate' ? 'inactive' : 'active',
          adminId: user.id,
          adminName: user.name,
        });
      }

      toast.success(actionMessages[pendingAction]);
      setPendingAction(null);

      if (pendingAction === 'delete') {
        if (onDeleted) onDeleted();
        else onChanged?.();
      } else {
        onChanged?.();
      }
    } catch (error) {
      console.error(`Failed to ${pendingAction} tutor account:`, error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${pendingAction} the tutor account.`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {showViewDetails && (
          <Link
            to={`/super-admin/tutors/${tutor.id}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            <Eye size={14} /> View
          </Link>
        )}

        <button
          type="button"
          onClick={() => setPendingAction(isInactive ? 'reactivate' : 'deactivate')}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
            isInactive
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          {isInactive ? <UserCheck size={14} /> : <UserX size={14} />}
          {isInactive ? 'Reactivate' : 'Deactivate'}
        </button>

        <button
          type="button"
          onClick={() => setPendingAction('delete')}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      <ConfirmTutorActionDialog
        isOpen={pendingAction !== null}
        action={pendingAction ?? 'deactivate'}
        tutor={tutor}
        isProcessing={isProcessing}
        onClose={() => {
          if (!isProcessing) setPendingAction(null);
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
};
