import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '@/shared/lib/firebase/config';
import { Assessment, AssessmentFormData } from '@/features/tutee-progress/types/assessment';

class AssessmentService {
  private getCollectionRef(tutorId: string) {
    return collection(db, 'users', tutorId, 'assessments');
  }

  private getCurrentUserId(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');
    return uid;
  }

  /** Subscribe to real-time updates for all assessments under a tutor */
  subscribeAll(
    tutorId: string,
    callback: (assessments: Assessment[]) => void
  ): () => void {
    try {
      const colRef = this.getCollectionRef(tutorId);
      const q = query(colRef, orderBy('date', 'desc'));

      return onSnapshot(
        q,
        (snapshot) => {
          const assessments: Assessment[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              tuteeId: data.tuteeId || '',
              tuteeName: data.tuteeName || '',
              subject: data.subject || '',
              date: data.date || '',
              assessmentScores: data.assessmentScores || [],
              totalScore: typeof data.totalScore === 'number' ? data.totalScore : undefined,
              topicsCovered: data.topicsCovered || '',
              notes: data.notes || '',
              recommendations: data.recommendations || '',
              score: typeof data.score === 'number' ? data.score : 0,
              remarks: data.remarks || 'Good',
              createdAt:
                data.createdAt?.toDate?.()?.toISOString() ||
                new Date().toISOString(),
              updatedAt:
                data.updatedAt?.toDate?.()?.toISOString() ||
                new Date().toISOString(),
            } as Assessment;
          });
          callback(assessments);
        },
        (error) => {
          console.error('Error in assessments subscription:', error);
          callback([]);
        }
      );
    } catch (error) {
      console.error('Error setting up assessments subscription:', error);
      return () => {};
    }
  }

  /** Add a new assessment record */
  async add(tutorId: string, data: AssessmentFormData): Promise<Assessment> {
    const colRef = this.getCollectionRef(tutorId);
    const now = Timestamp.now();

    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: docRef.id,
      ...data,
      createdAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
    };
  }

  /** Update an existing assessment */
  async update(
    tutorId: string,
    assessmentId: string,
    updates: Partial<AssessmentFormData>
  ): Promise<void> {
    const docRef = doc(db, 'users', tutorId, 'assessments', assessmentId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  /** Delete an assessment */
  async delete(tutorId: string, assessmentId: string): Promise<void> {
    const docRef = doc(db, 'users', tutorId, 'assessments', assessmentId);
    await deleteDoc(docRef);
  }
}

export const assessmentService = new AssessmentService();
