import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { Announcement, AnnouncementFormData } from '@/features/announcements/types/announcement';

class AnnouncementService {
  subscribe(tutorId: string, callback: (announcements: Announcement[]) => void) {
    const collRef = collection(db, 'users', tutorId, 'announcements');
    const q = query(collRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const announcements = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as Announcement;
      });
      callback(announcements);
    });
  }

  async create(tutorId: string, data: AnnouncementFormData) {
    const collRef = collection(db, 'users', tutorId, 'announcements');
    return addDoc(collRef, {
      ...data,
      tutorId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  async update(tutorId: string, id: string, data: Partial<AnnouncementFormData>) {
    const docRef = doc(db, 'users', tutorId, 'announcements', id);
    return updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  }

  async delete(tutorId: string, id: string) {
    const docRef = doc(db, 'users', tutorId, 'announcements', id);
    return deleteDoc(docRef);
  }
}

export const announcementService = new AnnouncementService();
