import { Session } from '../types/session';
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
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

class SessionService {
  private getUserId(): string {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return userId;
  }

  private getCollectionRef() {
    const userId = this.getUserId();
    return collection(db, 'users', userId, 'sessions');
  }

  async getAll(): Promise<Session[]> {
    try {
      const collectionRef = this.getCollectionRef();
      const q = query(collectionRef, orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as Session));
    } catch (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Session | undefined> {
    try {
      const userId = this.getUserId();
      const docRef = doc(db, 'users', userId, 'sessions', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          date: docSnap.data().date,
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as Session;
      }
      return undefined;
    } catch (error) {
      console.error('Error fetching session:', error);
      throw error;
    }
  }

  async getByTuteeId(tuteeId: string): Promise<Session[]> {
    try {
      const collectionRef = this.getCollectionRef();
      const q = query(
        collectionRef, 
        where('tuteeId', '==', tuteeId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as Session));
    } catch (error) {
      console.error('Error fetching sessions by tutee:', error);
      throw error;
    }
  }

  async create(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
    try {
      const collectionRef = this.getCollectionRef();
      const now = new Date();

      const sessionData = {
        ...session,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      const docRef = await addDoc(collectionRef, sessionData);

      return {
        id: docRef.id,
        ...session,
        createdAt: now.toISOString(),
      };
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Session>): Promise<Session> {
    try {
      const userId = this.getUserId();
      const docRef = doc(db, 'users', userId, 'sessions', id);

      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Remove id and createdAt from updates if they exist
      delete updateData.id;
      delete updateData.createdAt;

      await updateDoc(docRef, updateData);

      const updatedDoc = await this.getById(id);
      if (!updatedDoc) {
        throw new Error('Session not found after update');
      }
      return updatedDoc;
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const userId = this.getUserId();
      const docRef = doc(db, 'users', userId, 'sessions', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }
}

export const sessionService = new SessionService();