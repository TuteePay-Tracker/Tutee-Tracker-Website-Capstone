import { auth } from '@/shared/lib/firebase/config';
import { toast } from 'sonner';

let isLoggingOut = false;

/** Set while sign-out is in progress so in-flight Firestore errors stay silent. */
export function setLoggingOut(value: boolean): void {
  isLoggingOut = value;
}

export function isFirestorePermissionError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return (
    err?.code === 'permission-denied' ||
    err?.message === 'Missing or insufficient permissions.' ||
    (typeof err?.message === 'string' && err.message.includes('insufficient permissions'))
  );
}

/** Returns false when the user is signing out or the error is an expected permission denial. */
export function shouldShowFirestoreError(error?: unknown): boolean {
  if (isLoggingOut || !auth.currentUser) return false;
  if (error && isFirestorePermissionError(error)) return false;
  return true;
}

/** Show a toast for a Firestore error, or do nothing when the error should be suppressed. */
export function showFirestoreErrorToast(fallbackMessage: string, error?: unknown): void {
  if (!shouldShowFirestoreError(error)) return;

  const err = error as { message?: string };
  const message = err?.message || fallbackMessage;
  if (message === 'Missing or insufficient permissions.') return;

  toast.error(message);
}
