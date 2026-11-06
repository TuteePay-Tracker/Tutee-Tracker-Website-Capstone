import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import {
  Topic,
  StudentTopicProgress,
  TopicProgressFormData,
} from '@/features/tutee-progress/types/topic';

class TopicService {
  /** Subscribe to all topics created by a tutor */
  subscribeTopics(
    tutorId: string,
    callback: (topics: Topic[]) => void
  ): () => void {
    try {
      const colRef = collection(db, 'users', tutorId, 'topics');
      const q = query(colRef, orderBy('createdAt', 'asc'));

      return onSnapshot(
        q,
        (snapshot) => {
          const topics: Topic[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              subject: data.subject || '',
              name: data.name || '',
              description: data.description || '',
              schoolYear: data.schoolYear || undefined,
              createdAt:
                typeof data.createdAt === 'string'
                  ? data.createdAt
                  : data.createdAt?.toDate?.()?.toISOString() ||
                    new Date().toISOString(),
              updatedAt:
                typeof data.updatedAt === 'string'
                  ? data.updatedAt
                  : data.updatedAt?.toDate?.()?.toISOString() || undefined,
            };
          });
          callback(topics);
        },
        (error) => {
          console.error('Error subscribing to topics:', error);
          callback([]);
        }
      );
    } catch (error) {
      console.error('Error setting up topics subscription:', error);
      return () => {};
    }
  }

  /** Add a new tutor-defined topic for a subject */
  async addTopic(
    tutorId: string,
    data: { subject: string; name: string; description?: string; schoolYear?: string }
  ): Promise<string> {
    const colRef = collection(db, 'users', tutorId, 'topics');
    const now = new Date().toISOString();
    const docRef = await addDoc(colRef, {
      subject: data.subject.trim(),
      name: data.name.trim(),
      description: data.description?.trim() || '',
      ...(data.schoolYear ? { schoolYear: data.schoolYear } : {}),
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }

  /** Update an existing topic */
  async updateTopic(
    tutorId: string,
    topicId: string,
    data: { name: string; description?: string }
  ): Promise<void> {
    const docRef = doc(db, 'users', tutorId, 'topics', topicId);
    await updateDoc(docRef, {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      updatedAt: new Date().toISOString(),
    });
  }

  /** Delete a topic */
  async deleteTopic(tutorId: string, topicId: string): Promise<void> {
    const docRef = doc(db, 'users', tutorId, 'topics', topicId);
    await deleteDoc(docRef);
  }

  /** Subscribe to student topic progress evaluations */
  subscribeTopicProgress(
    tutorId: string,
    callback: (progress: StudentTopicProgress[]) => void
  ): () => void {
    try {
      const colRef = collection(db, 'users', tutorId, 'topicProgress');

      return onSnapshot(
        colRef,
        (snapshot) => {
          const list: StudentTopicProgress[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              tuteeId: data.tuteeId || '',
              tuteeName: data.tuteeName || '',
              subject: data.subject || '',
              topicId: data.topicId || '',
              topicName: data.topicName || '',
              score: typeof data.score === 'number' ? data.score : 0,
              performanceLevel: data.performanceLevel || 'not-started',
              strengths: data.strengths || '',
              areasForImprovement: data.areasForImprovement || '',
              notes: data.notes || '',
              lastUpdated:
                typeof data.lastUpdated === 'string'
                  ? data.lastUpdated
                  : data.lastUpdated?.toDate?.()?.toISOString() ||
                    new Date().toISOString(),
              schoolYear: data.schoolYear || undefined,
            };
          });
          callback(list);
        },
        (error) => {
          console.error('Error subscribing to topic progress:', error);
          callback([]);
        }
      );
    } catch (error) {
      console.error('Error setting up topic progress subscription:', error);
      return () => {};
    }
  }

  /** Save or update a student's progress on a specific topic */
  async saveTopicProgress(
    tutorId: string,
    data: TopicProgressFormData
  ): Promise<void> {
    // Unique deterministic ID per student + topic
    const docId = `${data.tuteeId}_${data.topicId}`;
    const docRef = doc(db, 'users', tutorId, 'topicProgress', docId);
    const now = new Date().toISOString();

    await setDoc(
      docRef,
      {
        tuteeId: data.tuteeId,
        tuteeName: data.tuteeName,
        subject: data.subject,
        topicId: data.topicId,
        topicName: data.topicName,
        score: data.score,
        performanceLevel: data.performanceLevel,
        strengths: data.strengths ?? '',
        areasForImprovement: data.areasForImprovement ?? '',
        notes: data.notes ?? '',
        ...(data.schoolYear ? { schoolYear: data.schoolYear } : {}),
        lastUpdated: now,
      },
      { merge: true }
    );
  }

  /** Delete student progress for a topic */
  async deleteTopicProgress(
    tutorId: string,
    progressId: string
  ): Promise<void> {
    const docRef = doc(db, 'users', tutorId, 'topicProgress', progressId);
    await deleteDoc(docRef);
  }
}

export const topicService = new TopicService();

