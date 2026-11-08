import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '@/shared/lib/firebase/config';
import { relayRequest } from '@/shared/lib/relay';
import { logActivity } from '@/shared/utils/auditLogger';
import { generateTempPassword } from '@/shared/utils/tempPassword';
import type {
  DeleteTutorAccountResult,
  SetTutorAccountStatusResult,
  TutorAccountStatus,
} from '../types/superAdmin';

export interface CreateTutorParams {
  name: string;
  email: string;
  contactNumber?: string;
  adminId: string;
  adminName: string;
}

export interface CreatedTutorCredentials {
  uid: string;
  name: string;
  email: string;
  contactNumber?: string;
  tempPassword: string;
}

/**
 * Creates a tutor account using a secondary Firebase App instance so the super admin's
 * current session remains completely uninterrupted.
 */
export const createTutorAccount = async ({
  name,
  email,
  contactNumber,
  adminId,
  adminName,
}: CreateTutorParams): Promise<CreatedTutorCredentials> => {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = contactNumber?.trim() || '';

  if (!trimmedName) {
    throw new Error('Tutor name is required.');
  }
  if (!trimmedEmail) {
    throw new Error('Tutor email address is required.');
  }

  const tempPassword = generateTempPassword();

  // Create secondary app instance so super admin's auth state is unaffected
  const secondaryAppName = `tutor-creation-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      trimmedEmail,
      tempPassword
    );

    const tutorUid = credential.user.uid;

    if (trimmedName) {
      await updateProfile(credential.user, { displayName: trimmedName });
    }

    // Provision Firestore user document for the tutor
    const tutorDocData: Record<string, any> = {
      name: trimmedName,
      email: trimmedEmail,
      role: 'tutor',
      status: 'active',
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };

    if (trimmedPhone) {
      tutorDocData.contactNumber = trimmedPhone;
    }

    await setDoc(doc(db, 'users', tutorUid), tutorDocData);

    // Audit log entry for super admin action
    await logActivity(
      adminId,
      adminName,
      'super_admin',
      'Tutor Account Created',
      'Tutor Management',
      `Super Admin created tutor account for ${trimmedName} (${trimmedEmail})`
    );

    return {
      uid: tutorUid,
      name: trimmedName,
      email: trimmedEmail,
      contactNumber: trimmedPhone || undefined,
      tempPassword,
    };
  } finally {
    try {
      await deleteApp(secondaryApp);
    } catch (cleanupErr) {
      console.warn('Failed to delete secondary firebase app:', cleanupErr);
    }
  }
};

export interface SetTutorAccountStatusParams {
  tutorId: string;
  status: TutorAccountStatus;
  adminId: string;
  adminName: string;
}

export interface DeleteTutorAccountParams {
  tutorId: string;
  tutorName: string;
  tutorEmail?: string;
  adminId: string;
  adminName: string;
}

/**
 * Activates or deactivates a tutor account.
 *
 * The relay disables/enables the Firebase Authentication record (and revokes
 * refresh tokens on deactivation) before mirroring the status in Firestore, so
 * the tutor cannot sign in on any client while deactivated. Tutor data is kept.
 */
export const setTutorAccountStatus = async ({
  tutorId,
  status,
  adminId,
  adminName,
}: SetTutorAccountStatusParams): Promise<SetTutorAccountStatusResult> => {
  if (!tutorId) {
    throw new Error('A tutor account is required.');
  }

  const result = await relayRequest<SetTutorAccountStatusResult>('/set-tutor-status', {
    uid: tutorId,
    status,
  });

  const actionType =
    status === 'inactive' ? 'Tutor Account Deactivated' : 'Tutor Account Reactivated';
  const verb = status === 'inactive' ? 'deactivated' : 'reactivated';

  await logActivity(
    adminId,
    adminName,
    'super_admin',
    actionType,
    'Tutor Management',
    `Super Admin ${verb} tutor account ${tutorId}`
  );

  return result;
};

/**
 * Permanently deletes a tutor account.
 *
 * The relay deletes the Firebase Authentication record, the Firestore profile
 * and all subcollections, parent accounts created by the tutor, and the tutor's
 * chat threads. Only report success once the relay has verified the Auth records
 * are gone.
 */
export const deleteTutorAccount = async ({
  tutorId,
  tutorName,
  tutorEmail,
  adminId,
  adminName,
}: DeleteTutorAccountParams): Promise<DeleteTutorAccountResult> => {
  if (!tutorId) {
    throw new Error('A tutor account is required.');
  }

  const result = await relayRequest<DeleteTutorAccountResult>('/delete-tutor-account', {
    uid: tutorId,
    ...(tutorEmail ? { expectedEmail: tutorEmail } : {}),
  });

  await logActivity(
    adminId,
    adminName,
    'super_admin',
    'Tutor Account Deleted',
    'Tutor Management',
    `Super Admin permanently deleted tutor account ${tutorName} (${tutorEmail || tutorId}) — ` +
      `${result.deletedParents?.length ?? 0} parent account(s), ` +
      `${result.deletedChatThreads ?? 0} chat thread(s), ` +
      `${result.deletedCollections?.length ?? 0} tutor subcollection(s) removed.`
  );

  return result;
};

