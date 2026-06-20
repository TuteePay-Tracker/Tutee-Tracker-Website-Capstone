import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';

/**
 * Logs an activity to the audit_logs collection in Firestore.
 * 
 * @param userId - The ID of the user performing the action
 * @param userName - The name of the user performing the action
 * @param userRole - The role of the user performing the action (e.g., tutor, parent)
 * @param actionType - The type of action performed (e.g., Student Added, Message Sent)
 * @param module - The system module (e.g., Students, Messaging, Billing)
 * @param description - Detailed description of the action
 */
export const logActivity = async (
  userId: string,
  userName: string,
  userRole: string,
  actionType: string,
  module: string,
  description: string
): Promise<void> => {
  try {
    let tutorId = userId;
    if (userRole === 'parent') {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        tutorId = userDoc.data().createdByTutorId || userId;
      }
    }

    const logRef = doc(collection(db, 'audit_logs'));
    await setDoc(logRef, {
      logId: logRef.id,
      userId,
      userName,
      userRole,
      actionType,
      module,
      description,
      tutorId,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
