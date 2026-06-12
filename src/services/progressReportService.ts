import { ProgressReport } from '../types/progressReport';
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

class ProgressReportService {
  private getUserId(providedId?: string): string {
    const userId = providedId || auth.currentUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return userId;
  }

  private getCollectionRef(providedId?: string) {
    const userId = this.getUserId(providedId);
    return collection(db, 'users', userId, 'progressReports');
  }

  async getAll(tuteeId: string, tutorId?: string): Promise<ProgressReport[]> {
    try {
      const collectionRef = this.getCollectionRef(tutorId);
      const q = query(
        collectionRef,
        where('tuteeId', '==', tuteeId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as ProgressReport));
    } catch (error) {
      console.error('Error fetching progress reports:', error);
      throw error;
    }
  }

  async getById(id: string, tutorId?: string): Promise<ProgressReport | undefined> {
    try {
      const userId = this.getUserId(tutorId);
      const docRef = doc(db, 'users', userId, 'progressReports', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as ProgressReport;
      }
      return undefined;
    } catch (error) {
      console.error('Error fetching progress report:', error);
      throw error;
    }
  }

  async create(report: Omit<ProgressReport, 'id' | 'createdAt'>): Promise<ProgressReport> {
    try {
      const collectionRef = this.getCollectionRef();
      const now = new Date();

      // Clean undefined values
      const cleanedReport = Object.fromEntries(
        Object.entries(report).filter(([_, value]) => value !== undefined)
      );

      const reportData = {
        ...cleanedReport,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      const docRef = await addDoc(collectionRef, reportData);

      return {
        id: docRef.id,
        ...report,
        createdAt: now.toISOString(),
      } as ProgressReport;
    } catch (error) {
      console.error('Error creating progress report:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<ProgressReport>): Promise<ProgressReport> {
    try {
      const userId = this.getUserId();
      const docRef = doc(db, 'users', userId, 'progressReports', id);

      const cleanedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      const updateData: any = {
        ...cleanedUpdates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      delete updateData.id;
      delete updateData.createdAt;

      await updateDoc(docRef, updateData);

      const updatedDoc = await this.getById(id);
      if (!updatedDoc) {
        throw new Error('Progress report not found after update');
      }
      return updatedDoc;
    } catch (error) {
      console.error('Error updating progress report:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const userId = this.getUserId();
      const docRef = doc(db, 'users', userId, 'progressReports', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting progress report:', error);
      throw error;
    }
  }
}

export const progressReportService = new ProgressReportService();
