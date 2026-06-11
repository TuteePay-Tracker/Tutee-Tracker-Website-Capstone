import { PaymentRecord, PaymentTransaction, DayPayment, PaymentStatus } from '../types/dayPayment';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { tuteeService } from './tuteeService';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

class DayPaymentService {
  private getUserId(providedId?: string): string {
    const userId = providedId || auth.currentUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return userId;
  }

  private getPaymentRecordsRef(providedId?: string) {
    const userId = this.getUserId(providedId);
    return collection(db, 'users', userId, 'paymentRecords');
  }

  private getTransactionsRef(providedId?: string) {
    const userId = this.getUserId(providedId);
    return collection(db, 'users', userId, 'paymentTransactions');
  }

  // Get or create payment record for a specific month and tutee
  async getMonthlyRecord(tuteeId: string, month: string, tutorId?: string): Promise<PaymentRecord> {
    try {
      const userId = this.getUserId(tutorId);
      const recordId = `${tuteeId}_${month}`;
      const docRef = doc(db, 'users', userId, 'paymentRecords', recordId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        let parentId = data.parentId;

        // Auto-heal parentId if tutor is checking and it is missing/outdated in Firestore
        if (!tutorId) {
          const tutee = await tuteeService.getById(tuteeId);
          if (tutee && tutee.parentId && data.parentId !== tutee.parentId) {
            parentId = tutee.parentId;
            await updateDoc(docRef, { parentId: tutee.parentId });
          }
        }

        return {
          id: docSnap.id,
          ...data,
          parentId,
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString(),
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as PaymentRecord;
      }

      if (tutorId) {
        // If query is from a parent, don't auto-create the document (they don't have write rules)
        throw new Error('Monthly payment record not found');
      }

      // Create new record if it doesn't exist
      return await this.createMonthlyRecord(tuteeId, month);
    } catch (error) {
      console.error('Error getting monthly record:', error);
      throw error;
    }
  }

  // Create a new monthly payment record with all days
  async createMonthlyRecord(tuteeId: string, month: string): Promise<PaymentRecord> {
    try {
      const tutee = await tuteeService.getById(tuteeId);
      if (!tutee) {
        throw new Error('Tutee not found');
      }

      const userId = this.getUserId();
      const recordId = `${tuteeId}_${month}`;

      // Generate days for the month
      const monthDate = new Date(month + '-01');
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

      // Get tutee's schedule days
      const scheduleDays = Array.isArray(tutee.schedule)
        ? tutee.schedule.map(s => s.day)
        : [];

      // Create day payments only for scheduled days
      const dayPayments: DayPayment[] = allDays
        .filter(day => {
          const dayName = format(day, 'EEEE');
          return scheduleDays.includes(dayName);
        })
        .map(day => ({
          date: format(day, 'yyyy-MM-dd'),
          amountDue: 0,
          amountPaid: 0,
          status: 'unpaid' as PaymentStatus,
          tuteeId,
          tuteeName: `${tutee.firstName} ${tutee.surname}`,
        }));

      const totalDue = tutee.ratePerSession;

      const record: Omit<PaymentRecord, 'id'> = {
        tuteeId,
        tuteeName: `${tutee.firstName} ${tutee.surname}`,
        parentId: tutee.parentId || null,
        tutorId: userId,
        month,
        dayPayments,
        totalDue,
        totalPaid: 0,
        totalBalance: totalDue,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const docRef = doc(db, 'users', userId, 'paymentRecords', recordId);
      await setDoc(docRef, {
        ...record,
        createdAt: Timestamp.fromDate(new Date()),
        lastUpdated: Timestamp.fromDate(new Date()),
      });

      return {
        id: recordId,
        ...record,
      };
    } catch (error) {
      console.error('Error creating monthly record:', error);
      throw error;
    }
  }

  // Record a payment transaction
  async recordPayment(
    tuteeId: string,
    month: string,
    daysPaid: { date: string; amountPaid: number }[],
    paymentMethod: string,
    notes?: string
  ): Promise<{ transaction: PaymentTransaction; updatedRecord: PaymentRecord }> {
    try {
      const record = await this.getMonthlyRecord(tuteeId, month);
      const tutee = await tuteeService.getById(tuteeId);
      if (!tutee) {
        throw new Error('Tutee not found');
      }

      // Update day payments
      const updatedDayPayments = record.dayPayments.map(day => {
        const payment = daysPaid.find(p => p.date === day.date);
        if (payment) {
          const newAmountPaid = day.amountPaid + payment.amountPaid;
          const newStatus: PaymentStatus =
            newAmountPaid >= day.amountDue ? 'paid' :
            newAmountPaid > 0 ? 'partial' : 'unpaid';

          return {
            ...day,
            amountPaid: newAmountPaid,
            status: newStatus,
          };
        }
        return day;
      });

      const totalPaid = updatedDayPayments.reduce((sum, day) => sum + day.amountPaid, 0);
      const totalBalance = record.totalDue - totalPaid;

      // Update the record
      const userId = this.getUserId();
      const recordId = `${tuteeId}_${month}`;
      const docRef = doc(db, 'users', userId, 'paymentRecords', recordId);

      await updateDoc(docRef, {
        dayPayments: updatedDayPayments,
        totalPaid,
        totalBalance,
        lastUpdated: Timestamp.fromDate(new Date()),
      });

      // Create transaction record
      const totalAmount = daysPaid.reduce((sum, day) => sum + day.amountPaid, 0);
      const transaction: Omit<PaymentTransaction, 'id'> = {
        tuteeId,
        tuteeName: `${tutee.firstName} ${tutee.surname}`,
        paymentDate: new Date().toISOString().split('T')[0],
        daysPaid: daysPaid.map(dp => {
          const day = updatedDayPayments.find(d => d.date === dp.date)!;
          return {
            date: dp.date,
            amountDue: day.amountDue,
            amountPaid: dp.amountPaid,
            status: day.status,
          };
        }),
        totalAmount,
        paymentMethod,
        notes,
        createdAt: new Date().toISOString(),
      };

      const transRef = collection(db, 'users', userId, 'paymentTransactions');
      const transDoc = await addDoc(transRef, {
        ...transaction,
        createdAt: Timestamp.fromDate(new Date()),
      });

      return {
        transaction: {
          id: transDoc.id,
          ...transaction,
        },
        updatedRecord: {
          id: recordId,
          tuteeId,
          tuteeName: `${tutee.firstName} ${tutee.surname}`,
          month,
          dayPayments: updatedDayPayments,
          totalDue: record.totalDue,
          totalPaid,
          totalBalance,
          lastUpdated: new Date().toISOString(),
          createdAt: record.createdAt,
        },
      };
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  // Get all transactions for a tutee
  async getTransactionsByTutee(tuteeId: string, tutorId?: string): Promise<PaymentTransaction[]> {
    try {
      const transRef = this.getTransactionsRef(tutorId);
      const q = query(
        transRef,
        where('tuteeId', '==', tuteeId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as PaymentTransaction));
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }

  // Toggle day attendance/completion status
  async toggleDayStatus(tuteeId: string, month: string, date: string): Promise<PaymentRecord> {
    try {
      const record = await this.getMonthlyRecord(tuteeId, month);
      const updatedDayPayments = record.dayPayments.map(day => {
        if (day.date === date) {
          let newStatus: PaymentStatus;
          if (day.status === 'unpaid') newStatus = 'paid';
          else if (day.status === 'paid') newStatus = 'partial';
          else newStatus = 'unpaid';
          return { ...day, status: newStatus };
        }
        return day;
      });

      const userId = this.getUserId();
      const recordId = `${tuteeId}_${month}`;
      const docRef = doc(db, 'users', userId, 'paymentRecords', recordId);

      await updateDoc(docRef, {
        dayPayments: updatedDayPayments,
        lastUpdated: Timestamp.fromDate(new Date()),
      });

      return {
        ...record,
        dayPayments: updatedDayPayments,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error toggling day status:', error);
      throw error;
    }
  }

  // Record a monthly flat-rate payment
  async recordMonthlyPayment(
    tuteeId: string,
    month: string,
    amount: number,
    paymentMethod: string,
    notes?: string
  ): Promise<{ transaction: PaymentTransaction; updatedRecord: PaymentRecord }> {
    try {
      const record = await this.getMonthlyRecord(tuteeId, month);
      const tutee = await tuteeService.getById(tuteeId);
      if (!tutee) {
        throw new Error('Tutee not found');
      }

      const totalPaid = record.totalPaid + amount;
      const totalBalance = record.totalDue - totalPaid;

      const userId = this.getUserId();
      const recordId = `${tuteeId}_${month}`;
      const docRef = doc(db, 'users', userId, 'paymentRecords', recordId);

      await updateDoc(docRef, {
        totalPaid,
        totalBalance,
        lastUpdated: Timestamp.fromDate(new Date()),
      });

      // Create transaction record
      const transaction: Omit<PaymentTransaction, 'id'> = {
        tuteeId,
        tuteeName: `${tutee.firstName} ${tutee.surname}`,
        paymentDate: new Date().toISOString().split('T')[0],
        daysPaid: [], // Flat rate doesn't track specific days paid
        totalAmount: amount,
        paymentMethod,
        notes,
        createdAt: new Date().toISOString(),
      };

      const transRef = collection(db, 'users', userId, 'paymentTransactions');
      const transDoc = await addDoc(transRef, {
        ...transaction,
        createdAt: Timestamp.fromDate(new Date()),
      });

      const updatedRecord: PaymentRecord = {
        ...record,
        totalPaid,
        totalBalance,
        lastUpdated: new Date().toISOString(),
      };

      return {
        transaction: {
          id: transDoc.id,
          ...transaction,
        },
        updatedRecord,
      };
    } catch (error) {
      console.error('Error recording monthly payment:', error);
      throw error;
    }
  }

  // Subscribe to all monthly records for a tutee in real-time
  subscribeToRecordsByTutee(
    tuteeId: string,
    callback: (records: PaymentRecord[]) => void,
    tutorId?: string
  ): () => void {
    const userId = tutorId || this.getUserId();
    const recordsRef = collection(db, 'users', userId, 'paymentRecords');
    const q = query(
      recordsRef,
      where('tuteeId', '==', tuteeId)
    );

    return onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString(),
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as PaymentRecord;
      });

      // Sort in memory by month descending to avoid composite index requirements
      records.sort((a, b) => b.month.localeCompare(a.month));

      callback(records);
    }, (error) => {
      console.error('Error in records subscription:', error);
    });
  }

  // Get all payment records for a tutee
  async getRecordsByTutee(tuteeId: string, tutorId?: string): Promise<PaymentRecord[]> {
    try {
      const recordsRef = this.getPaymentRecordsRef(tutorId);
      const q = query(
        recordsRef,
        where('tuteeId', '==', tuteeId),
        orderBy('month', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as PaymentRecord));
    } catch (error) {
      console.error('Error getting records:', error);
      throw error;
    }
  }
}

export const dayPaymentService = new DayPaymentService();
