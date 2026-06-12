import { Payment } from '@/features/payments/types/payment';
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
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '@/shared/lib/firebase/config';
import { tuteeService } from '@/features/tutees/services/tuteeService';

class PaymentService {
  private getUserId(providedId?: string): string {
    const userId = providedId || auth.currentUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return userId;
  }

  private getCollectionRef(providedId?: string) {
    const userId = this.getUserId(providedId);
    return collection(db, 'users', userId, 'payments');
  }

  async getAll(tutorId?: string): Promise<Payment[]> {
    try {
      const collectionRef = this.getCollectionRef(tutorId);
      const q = query(collectionRef, orderBy('paymentDate', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        paymentDate: doc.data().paymentDate,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as Payment));
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Payment | undefined> {
    try {
      const userId = this.getUserId();
      const docRef = doc(db, 'users', userId, 'payments', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          paymentDate: docSnap.data().paymentDate,
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as Payment;
      }
      return undefined;
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  }

  async getByTuteeId(tuteeId: string, tutorId?: string): Promise<Payment[]> {
    try {
      const collectionRef = this.getCollectionRef(tutorId);
      const q = query(
        collectionRef, 
        where('tuteeId', '==', tuteeId),
        orderBy('paymentDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        paymentDate: doc.data().paymentDate,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as Payment));
    } catch (error) {
      console.error('Error fetching payments by tutee:', error);
      throw error;
    }
  }

  subscribeAll(callback: (payments: Payment[]) => void, tutorId?: string): () => void {
    try {
      const userId = tutorId || this.getUserId();
      if (!userId) {
        return () => {};
      }
      const collectionRef = collection(db, 'users', userId, 'payments');
      const q = query(collectionRef, orderBy('paymentDate', 'desc'));

      return onSnapshot(q, (querySnapshot) => {
        const list = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          paymentDate: docSnap.data().paymentDate,
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as Payment));
        callback(list);
      }, (error) => {
        console.error('Error in payments subscription:', error);
      });
    } catch (error) {
      console.error('Error setting up payments subscription:', error);
      return () => {};
    }
  }

  subscribeByTuteeId(tuteeId: string, callback: (payments: Payment[]) => void, tutorId?: string): () => void {
    try {
      const userId = tutorId || this.getUserId();
      if (!userId) {
        return () => {};
      }
      const collectionRef = collection(db, 'users', userId, 'payments');
      const q = query(
        collectionRef, 
        where('tuteeId', '==', tuteeId),
        orderBy('paymentDate', 'desc')
      );

      return onSnapshot(q, (querySnapshot) => {
        const list = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          paymentDate: docSnap.data().paymentDate,
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as Payment));
        callback(list);
      }, (error) => {
        console.error('Error in payments subscription by tutee:', error);
      });
    } catch (error) {
      console.error('Error setting up payments subscription by tutee:', error);
      return () => {};
    }
  }

  async create(payment: Omit<Payment, 'id' | 'createdAt'>, tutorId?: string): Promise<Payment> {
    try {
      const collectionRef = this.getCollectionRef(tutorId);
      const now = new Date();

      // Strip undefined values — Firestore rejects them
      const rawData: Record<string, unknown> = {
        ...payment,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };
      const paymentData = Object.fromEntries(
        Object.entries(rawData).filter(([, v]) => v !== undefined)
      );

      const docRef = await addDoc(collectionRef, paymentData);
      
      // Update tutee totals only if this is not a pending payment proof submission
      if (payment.status !== 'pending') {
        const tutee = await tuteeService.getById(payment.tuteeId, tutorId);
        if (tutee) {
          const newTotalPaid = tutee.totalPaid + payment.amount;
          const newTotalSessions = tutee.totalSessions + payment.sessionsCovered;
          const totalDue = newTotalSessions * tutee.ratePerSession;
          const newBalance = totalDue - newTotalPaid;

          await tuteeService.update(payment.tuteeId, {
            totalSessions: newTotalSessions,
            totalPaid: newTotalPaid,
            balance: newBalance,
            lastPaymentDate: payment.paymentDate,
          }, tutorId);
        }
      }
      
      return {
        id: docRef.id,
        ...payment,
        createdAt: now.toISOString(),
      };
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Payment>): Promise<Payment> {
    try {
      const userId = this.getUserId();
      const docRef = doc(db, 'users', userId, 'payments', id);

      const rawUpdate: Record<string, unknown> = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      delete rawUpdate.id;
      delete rawUpdate.createdAt;

      // Strip undefined values — Firestore rejects them
      const updateData = Object.fromEntries(
        Object.entries(rawUpdate).filter(([, v]) => v !== undefined)
      );

      await updateDoc(docRef, updateData);

      const updatedDoc = await this.getById(id);
      if (!updatedDoc) {
        throw new Error('Payment not found after update');
      }
      return updatedDoc;
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const userId = this.getUserId();
      const docRef = doc(db, 'users', userId, 'payments', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting payment:', error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();