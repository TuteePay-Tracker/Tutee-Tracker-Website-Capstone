import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  arrayUnion,
  arrayRemove,
  deleteField
} from 'firebase/firestore';
import { db, firebaseConfig } from '@/shared/lib/firebase/config';
import { relayRequest } from '@/shared/lib/relay';
import { logActivity } from '@/shared/utils/auditLogger';
import { normalizePhoneNumber, isValidPHPhoneNumber } from '@/shared/utils/phoneUtils';

export interface CreatedParentCredentials {
  name: string;
  contactNumber: string;
  tempPassword: string;
  studentName?: string;
  parentId: string;
}

export const generateTempPassword = (): string => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `JT${year}-${randomNum}`;
};

export interface RemoveParentResult {
  /** The UID deleted from Firebase Authentication. */
  uid: string;
  /** Email of the Auth record that was deleted, as verified by the server. */
  email: string | null;
  /** True when the Auth record was already absent before this call. */
  alreadyDeleted: boolean;
}

interface DeleteAuthUserResponse {
  ok: boolean;
  uid: string;
  email: string | null;
  alreadyDeleted: boolean;
}

/**
 * Remove parent account from Firebase Authentication and Firestore,
 * and unlink parent from all tutees.
 *
 * Firebase Authentication is deleted FIRST and the server must confirm the
 * record is gone. If that fails this function throws before touching any
 * Firestore data, so an account can never be left half-removed with working
 * credentials but no profile.
 */
export const removeParentAccount = async ({
  parentId,
  tutorId,
  tutorName,
  tutorRole,
  parentName,
}: {
  parentId: string;
  tutorId: string;
  tutorName: string;
  tutorRole: string;
  parentName?: string;
}): Promise<RemoveParentResult> => {
  if (!parentId) throw new Error('Parent ID is required for removal');

  // 1. Read the parent document to get the email the Auth record must match.
  const parentRef = doc(db, 'users', parentId);
  const parentSnap = await getDoc(parentRef);
  const parentDocData = parentSnap.exists() ? parentSnap.data() : null;
  const expectedEmail: string | null = parentDocData?.email ?? null;

  // 2. Delete the Firebase Authentication record via the relay (Admin SDK).
  //    The relay verifies the caller created this parent, confirms the UID
  //    really resolves to this parent's Auth record, deletes it, then re-reads
  //    it to prove it is gone. A failure here throws and aborts the removal.
  const result = await relayRequest<DeleteAuthUserResponse>('/delete-auth-user', {
    uid: parentId,
    ...(expectedEmail ? { expectedEmail } : {}),
  });

  // 3. Only now that the account can no longer sign in, unlink their tutees.
  if (tutorId) {
    try {
      const tuteesRef = collection(db, 'users', tutorId, 'tutees');
      const q = query(tuteesRef, where('parentId', '==', parentId));
      const snap = await getDocs(q);
      for (const tuteeDoc of snap.docs) {
        await updateDoc(doc(db, 'users', tutorId, 'tutees', tuteeDoc.id), {
          parentId: deleteField(),
        });
      }
    } catch (unlinkErr) {
      console.error('Error unlinking tutees:', unlinkErr);
    }
  }

  // 4. Delete parent document from Firestore users collection
  await deleteDoc(parentRef);

  // 5. Log audit activity
  if (tutorId) {
    await logActivity(
      tutorId,
      tutorName || 'Tutor',
      tutorRole || 'tutor',
      'Parent Account Deleted',
      'Parent Management',
      `Deleted parent account ${parentName || parentId} — Firebase Authentication UID ${result?.uid ?? parentId}` +
        `${result?.email ? ` (${result.email})` : ''}` +
        `${result?.alreadyDeleted ? ', Auth record was already absent' : ''}`
    );
  }

  return {
    uid: result?.uid ?? parentId,
    email: result?.email ?? null,
    alreadyDeleted: result?.alreadyDeleted ?? false,
  };
};

/**
 * Link an existing parent account to a student tutee.
 */
export const linkExistingParent = async ({
  studentId,
  parentId,
  tutorId,
  tutorName,
  tutorRole,
  studentName,
}: {
  studentId: string;
  parentId: string;
  tutorId: string;
  tutorName: string;
  tutorRole: string;
  studentName?: string;
}): Promise<void> => {
  // 1. Link student to parent
  await updateDoc(doc(db, 'users', tutorId, 'tutees', studentId), {
    parentId: parentId,
  });

  // 2. Add studentId to parent's linkedStudentIds and ensure createdByTutorId is set
  const parentRef = doc(db, 'users', parentId);
  const parentDoc = await getDoc(parentRef);
  if (parentDoc.exists()) {
    const parentData = parentDoc.data();
    const currentLinked = parentData.linkedStudentIds || [];
    const updatePayload: Record<string, any> = {};
    if (!currentLinked.includes(studentId)) {
      updatePayload.linkedStudentIds = arrayUnion(studentId);
    }
    if (!parentData.createdByTutorId) {
      updatePayload.createdByTutorId = tutorId;
    }
    if (Object.keys(updatePayload).length > 0) {
      await updateDoc(parentRef, updatePayload);
    }

    await logActivity(
      tutorId,
      tutorName,
      tutorRole,
      'Parent Account Updated',
      'Parent Management',
      `Linked student ${studentName || studentId} to parent ${parentData.name || 'Parent'}`
    );
  }
};

/**
 * Create a brand new parent account in Firebase Auth and Firestore,
 * and link it to the specified student tutee.
 */
export const createNewParentAccount = async ({
  name,
  contactNumber,
  studentId,
  tutorId,
  tutorName,
  tutorRole,
  studentName,
}: {
  name: string;
  contactNumber: string;
  studentId: string;
  tutorId: string;
  tutorName: string;
  tutorRole: string;
  studentName?: string;
}): Promise<CreatedParentCredentials> => {
  const sanitizedContact = normalizePhoneNumber(contactNumber);
  if (!isValidPHPhoneNumber(sanitizedContact)) {
    throw new Error('Please enter a valid Philippine contact number (e.g. 09171234567).');
  }

  // Check for duplicate phone/email first
  const parentEmail = `${sanitizedContact}@tuteepay.local`;
  const existingQuery = query(
    collection(db, 'users'),
    where('role', '==', 'parent'),
    where('contactNumber', '==', contactNumber)
  );
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    throw new Error('A parent account with this contact number already exists.');
  }

  const tempPassword = generateTempPassword();
  const secondaryAppName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, parentEmail, tempPassword);
    await updateProfile(credential.user, { displayName: name });

    const parentUid = credential.user.uid;

    // Save parent to Firestore
    await setDoc(doc(db, 'users', parentUid), {
      name,
      email: parentEmail,
      contactNumber,
      role: 'parent',
      mustChangePassword: true,
      tempPassword,
      linkedStudentIds: [studentId],
      createdAt: new Date().toISOString(),
      createdByTutorId: tutorId,
    });

    // Link student to new parent
    await updateDoc(doc(db, 'users', tutorId, 'tutees', studentId), {
      parentId: parentUid,
    });

    await logActivity(
      tutorId,
      tutorName,
      tutorRole,
      'Parent Account Created',
      'Parent Management',
      `Created parent account ${name} for student ${studentName || studentId}`
    );

    return {
      name,
      contactNumber,
      tempPassword,
      studentName,
      parentId: parentUid,
    };
  } finally {
    await deleteApp(secondaryApp).catch(() => { });
  }
};

/**
 * Generate and save a new temporary password for a parent account.
 *
 * The password is written to Firebase Authentication first. The Firestore copy
 * is only updated once the server confirms the change took effect, so the
 * password shown to a parent always matches the one that actually works.
 */
export const updateParentTempPassword = async ({
  parentId,
  tutorId,
  tutorName,
  tutorRole,
}: {
  parentId: string;
  tutorId: string;
  tutorName: string;
  tutorRole: string;
}): Promise<string> => {
  if (!parentId) throw new Error('Parent ID is required for a password reset');

  const newPassword = generateTempPassword();

  // 1. Update Firebase Authentication first. Throws on failure, leaving both
  //    the real password and the stored copy untouched.
  await relayRequest<{ ok: boolean }>('/update-user-password', {
    uid: parentId,
    newPassword,
  });

  // 2. Only now record it in Firestore
  await updateDoc(doc(db, 'users', parentId), {
    tempPassword: newPassword,
    mustChangePassword: true,
  });

  // 3. Log audit activity
  if (tutorId) {
    await logActivity(
      tutorId,
      tutorName,
      tutorRole,
      'Parent Password Reset',
      'Parent Management',
      `Generated new temporary password for parent account ${parentId}`
    );
  }

  return newPassword;
};
