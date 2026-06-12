import { Tutee } from '../types/tutee';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

class TuteeService {
  private getUserId(providedId?: string): string {
    const userId = providedId || auth.currentUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return userId;
  }

  private getCollectionRef(providedId?: string) {
    const userId = this.getUserId(providedId);
    return collection(db, 'users', userId, 'tutees');
  }

  async getAll(tutorId?: string): Promise<Tutee[]> {
    try {
      const collectionRef = this.getCollectionRef(tutorId);
      let q;
      if (tutorId) {
        const parentUid = auth.currentUser?.uid;
        if (!parentUid) {
          // Not authenticated; avoid invalid where clause
          console.warn('getAll called for parent without authenticated user; returning empty list');
          return [];
        }
        // If we are a parent, we must filter by parentId to comply with security rules and avoid permission error
        q = query(collectionRef, where('parentId', '==', parentUid));
      } else {
        q = query(collectionRef, orderBy('createdAt', 'desc'));
      }
      const querySnapshot = await getDocs(q);
      
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        lastPaymentDate: doc.data().lastPaymentDate || null,
      } as Tutee));

      if (tutorId) {
        // Sort in memory by createdAt descending to avoid composite index requirements
        docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      return docs;
    } catch (error) {
      console.error('Error fetching tutees:', error);
      throw error;
    }
  }

  subscribeAll(callback: (tutees: Tutee[]) => void, tutorId?: string): () => void {
    try {
      const userId = tutorId || auth.currentUser?.uid;
      if (!userId) {
        console.warn('subscribeAll called without authenticated user');
        return () => {};
      }
      const collectionRef = collection(db, 'users', userId, 'tutees');
      let q;
      if (tutorId) {
        const parentUid = auth.currentUser?.uid;
        if (!parentUid) {
          return () => {};
        }
        // If we are a parent, we filter by parentId to comply with rules
        q = query(collectionRef, where('parentId', '==', parentUid));
      } else {
        q = query(collectionRef, orderBy('createdAt', 'desc'));
      }

      return onSnapshot(q, (querySnapshot) => {
        const docs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          lastPaymentDate: doc.data().lastPaymentDate || null,
        } as Tutee));

        if (tutorId) {
          // Sort in memory to avoid index requirement
          docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        callback(docs);
      }, (error) => {
        console.error('Error in tutees subscription:', error);
      });
    } catch (error) {
      console.error('Error setting up tutees subscription:', error);
      return () => {};
    }
  }

  async getById(id: string, tutorId?: string): Promise<Tutee | undefined> {
    try {
      const userId = this.getUserId(tutorId);
      const docRef = doc(db, 'users', userId, 'tutees', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          lastPaymentDate: docSnap.data().lastPaymentDate || null,
        } as Tutee;
      }
      return undefined;
    } catch (error) {
      console.error('Error fetching tutee:', error);
      throw error;
    }
  }

  async create(tutee: Omit<Tutee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tutee> {
    try {
      const collectionRef = this.getCollectionRef();
      const now = new Date();

      // Filter out undefined values to avoid Firestore errors
      const cleanedTutee = Object.fromEntries(
        Object.entries(tutee).filter(([_, value]) => value !== undefined)
      );

      const tuteeData = {
        ...cleanedTutee,
        totalSessions: tutee.totalSessions || 0,
        totalPaid: tutee.totalPaid || 0,
        balance: tutee.balance || 0,
        lastPaymentDate: tutee.lastPaymentDate || undefined,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      const docRef = await addDoc(collectionRef, tuteeData);

      return {
        id: docRef.id,
        ...tutee,
        totalSessions: tutee.totalSessions || 0,
        totalPaid: tutee.totalPaid || 0,
        balance: tutee.balance || 0,
        lastPaymentDate: tutee.lastPaymentDate || undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    } catch (error) {
      console.error('Error creating tutee:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Tutee>, tutorId?: string): Promise<Tutee> {
    try {
      const userId = this.getUserId(tutorId);
      const docRef = doc(db, 'users', userId, 'tutees', id);

      // Filter out undefined values to avoid Firestore errors
      const cleanedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      const updateData: any = {
        ...cleanedUpdates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Remove id, createdAt from updates if they exist
      delete updateData.id;
      delete updateData.createdAt;

      await updateDoc(docRef, updateData);

      const updatedDoc = await this.getById(id, tutorId);
      if (!updatedDoc) {
        throw new Error('Tutee not found after update');
      }
      return updatedDoc;
    } catch (error) {
      console.error('Error updating tutee:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const userId = this.getUserId();
      const docRef = doc(db, 'users', userId, 'tutees', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting tutee:', error);
      throw error;
    }
  }

  async search(query: string): Promise<Tutee[]> {
    try {
      const allTutees = await this.getAll();
      return allTutees.filter(t => {
        const fullName = `${t.firstName} ${t.surname}`.toLowerCase();
        return fullName.includes(query.toLowerCase()) ||
               t.subject.toLowerCase().includes(query.toLowerCase());
      });
    } catch (error) {
      console.error('Error searching tutees:', error);
      throw error;
    }
  }

  async filterBySubject(subject: string): Promise<Tutee[]> {
    try {
      const allTutees = await this.getAll();
      return allTutees.filter(t =>
        t.subject.toLowerCase() === subject.toLowerCase()
      );
    } catch (error) {
      console.error('Error filtering tutees:', error);
      throw error;
    }
  }
}

export const tuteeService = new TuteeService();