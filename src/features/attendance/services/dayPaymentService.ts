import { PaymentRecord, PaymentTransaction, DayPayment, PaymentStatus, AttendanceMark } from '@/features/attendance/types/dayPayment';
import { Payment } from '@/features/payments/types/payment';
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
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '@/shared/lib/firebase/config';
import { tuteeService } from '@/features/tutees/services/tuteeService';
import { paymentService } from '@/features/payments/services/paymentService';
import { sendPaymentStatusNotification } from '@/shared/lib/notifications/sendPush';
import { logActivity } from '@/shared/utils/auditLogger';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO } from 'date-fns';
import { getSchoolYearFromMonth } from '@/shared/utils/schoolYear';

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

  // Serialize syncTuteeTotals per (tutor, tutee) so concurrent syncs (delete + re-add,
  // migration, payment recording) never produce a stale last-write that drops a month's totals.
  private syncQueues = new Map<string, Promise<void>>();

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

      // A billing month must only exist after the tutor explicitly initialized it
      // ("+ Add Month"). Never auto-create a record from a read — that caused months to
      // appear in the tracker before the tutor ever added them.
      throw new Error('Monthly payment record not found');
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
      const scheduleDays: string[] = Array.isArray(tutee.schedule)
        ? tutee.schedule.map((s: any) => typeof s === 'string' ? s : s?.day).filter(Boolean)
        : typeof tutee.schedule === 'string'
          ? (tutee.schedule as string).split(/,|\r?\n/).map(s => s.trim()).filter(Boolean)
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
      const schoolYear = getSchoolYearFromMonth(month) || '';

      const record: Omit<PaymentRecord, 'id'> = {
        tuteeId,
        tuteeName: `${tutee.firstName} ${tutee.surname}`,
        parentId: tutee.parentId || null,
        tutorId: userId,
        month,
        schoolYear,
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

      // Ensure the record's school year is part of the student's enrolled years.
      if (schoolYear) {
        const current = tutee.schoolYears || [];
        if (!current.includes(schoolYear)) {
          await tuteeService.update(tuteeId, { schoolYears: [...current, schoolYear] });
        }
      }

      await this.syncTuteeTotals(tuteeId, userId);

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
        month,
        notes,
        schoolYear: getSchoolYearFromMonth(month) || undefined,
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

  // Set a day's attendance mark explicitly (does NOT touch payment status/amounts)
  async setDayAttendance(
    tuteeId: string,
    month: string,
    date: string,
    attendance: AttendanceMark | 'none'
  ): Promise<PaymentRecord> {
    try {
      const record = await this.getMonthlyRecord(tuteeId, month);
      let found = false;
      const updatedDayPayments = record.dayPayments.map(day => {
        if (day.date === date) {
          found = true;
          const next = { ...day };
          if (attendance === 'none') {
            delete next.attendance;
          } else {
            next.attendance = attendance;
          }
          return next;
        }
        return day;
      });

      if (!found && attendance !== 'none') {
        updatedDayPayments.push({
          date,
          amountDue: 0,
          amountPaid: 0,
          status: 'unpaid' as PaymentStatus,
          attendance,
          tuteeId,
          tuteeName: record.tuteeName,
        });
        updatedDayPayments.sort((a, b) => a.date.localeCompare(b.date));
      }

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
      console.error('Error setting day attendance:', error);
      throw error;
    }
  }

  // Synchronize all existing payment records for a tutee with a new schedule
  async syncTuteeScheduleRecords(tuteeId: string, schedule: any): Promise<void> {
    try {
      const userId = this.getUserId();
      const recordsRef = collection(db, 'users', userId, 'paymentRecords');
      const q = query(recordsRef, where('tuteeId', '==', tuteeId));
      const snap = await getDocs(q);

      const scheduleDays: string[] = Array.isArray(schedule)
        ? schedule.map((s: any) => typeof s === 'string' ? s : s?.day).filter(Boolean)
        : typeof schedule === 'string'
          ? (schedule as string).split(/,|\r?\n/).map(s => s.trim()).filter(Boolean)
          : [];

      for (const docSnap of snap.docs) {
        const recordData = docSnap.data();
        const month = recordData.month;
        if (!month) continue;

        const monthDate = parseISO(month + '-01');
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

        const expectedDates = allDaysInMonth
          .filter(day => scheduleDays.includes(format(day, 'EEEE')))
          .map(day => format(day, 'yyyy-MM-dd'));

        const existingMap = new Map<string, DayPayment>();
        (recordData.dayPayments || []).forEach((dp: DayPayment) => {
          existingMap.set(dp.date, dp);
        });

        const newDayPayments: DayPayment[] = expectedDates.map(date => {
          if (existingMap.has(date)) {
            return existingMap.get(date)!;
          }
          return {
            date,
            amountDue: 0,
            amountPaid: 0,
            status: 'unpaid' as PaymentStatus,
            tuteeId,
            tuteeName: recordData.tuteeName || '',
          };
        });

        await updateDoc(docSnap.ref, {
          dayPayments: newDayPayments,
          lastUpdated: Timestamp.fromDate(new Date()),
        });
      }
    } catch (error) {
      console.error('Error syncing tutee schedule records:', error);
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

      // Determine coverageType: full if amount >= totalDue, partial otherwise
      const resolvedCoverageType: 'full' | 'partial' = amount >= record.totalDue ? 'full' : 'partial';

      // Create the payment via the central payments service.
      // paymentService.create also writes the matching paymentTransactions row (with paymentId),
      // so we must NOT add a second transaction here (that caused double-booked parent totals).
      const createdPayment = await paymentService.create({
        tuteeId,
        tuteeName: `${tutee.firstName} ${tutee.surname}`,
        amount,
        sessionsCovered: 1,
        paymentMethod: paymentMethod as any,
        paymentDate: new Date().toISOString().split('T')[0],
        notes: notes || `Payment for ${month}`,
        month,
        coverageType: resolvedCoverageType,
      } as any);

      // Log audit activity
      const currentUser = auth.currentUser;
      if (currentUser) {
        const tutorSnap = await getDoc(doc(db, 'users', currentUser.uid));
        const tutorName = tutorSnap.exists() ? (tutorSnap.data().name || 'Tutor') : 'Tutor';
        await logActivity(
          currentUser.uid,
          tutorName,
          'tutor',
          'Payment Recorded',
          'Billing',
          `Recorded ${paymentMethod} payment of ₱${amount} for student ${tutee.firstName} ${tutee.surname} (${month}) — ${resolvedCoverageType} payment`
        );
      }

      // Sync overall totals
      await this.syncTuteeTotals(tuteeId, userId);

      const updatedRecord: PaymentRecord = {
        ...record,
        totalPaid,
        totalBalance,
        lastUpdated: new Date().toISOString(),
      };

      const paymentDate = createdPayment.paymentDate || new Date().toISOString().split('T')[0];

      return {
        transaction: {
          id: createdPayment.id,
          tuteeId,
          tuteeName: `${tutee.firstName} ${tutee.surname}`,
          paymentDate,
          daysPaid: [], // Flat rate doesn't track specific days paid
          totalAmount: amount,
          paymentMethod,
          month,
          notes,
          coverageType: resolvedCoverageType,
          createdAt: createdPayment.createdAt,
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
        where('tuteeId', '==', tuteeId)
      );

      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as PaymentRecord));

      // Sort in memory by month descending to avoid composite index requirements
      records.sort((a, b) => b.month.localeCompare(a.month));
      return records;
    } catch (error) {
      console.error('Error getting records:', error);
      throw error;
    }
  }

  async removeMonthlyRecord(tuteeId: string, month: string): Promise<void> {
    try {
      const userId = this.getUserId();
      const recordId = `${tuteeId}_${month}`;
      const recordDocRef = doc(db, 'users', userId, 'paymentRecords', recordId);

      // Read the record directly so removing a month never re-creates it.
      const recordSnap = await getDoc(recordDocRef);

      const payments = await paymentService.getByTuteeId(tuteeId, userId);
      const paymentsToDelete = payments.filter((payment: any) => payment.month === month);

      for (const payment of paymentsToDelete) {
        await paymentService.delete(payment.id);
      }

      const transactionsRef = this.getTransactionsRef(userId);
      const transactionsQuery = query(transactionsRef, where('tuteeId', '==', tuteeId));
      const transactionsSnapshot = await getDocs(transactionsQuery);

      for (const transactionDoc of transactionsSnapshot.docs) {
        const data = transactionDoc.data();
        if (data.month === month) {
          await deleteDoc(transactionDoc.ref);
        }
      }

      if (recordSnap.exists()) {
        await deleteDoc(recordDocRef);
      }
      await this.syncTuteeTotals(tuteeId, userId);

      console.info(`Removed monthly billing record ${recordId}`, recordSnap.data());
    } catch (error) {
      console.error('Error removing monthly record:', error);
      throw error;
    }
  }

  async syncTuteeTotals(tuteeId: string, tutorId?: string): Promise<void> {
    // Chain concurrent sync calls per (tutor, tutee) so each one recomputes from fresh
    // data and no stale read-modify-write can clobber a newer result (delete → re-add race).
    const userId = tutorId || auth.currentUser?.uid;
    const key = `${userId || ''}|${tuteeId}`;
    const previous = this.syncQueues.get(key) || Promise.resolve();
    const run = previous
      .catch(() => {})
      .then(() => this.performSyncTuteeTotals(tuteeId, userId));
    this.syncQueues.set(key, run);
    return run;
  }

  private async performSyncTuteeTotals(tuteeId: string, tutorId?: string): Promise<void> {
    try {
      const userId = tutorId || this.getUserId();
      const records = await this.getRecordsByTutee(tuteeId, userId);
      const tutee = await tuteeService.getById(tuteeId, userId);
      if (!tutee) return;

      // Fetch all confirmed payments for this tutee (exclude pending AND rejected)
      const payments = (await paymentService.getByTuteeId(tuteeId, userId)).filter(
        (p) => p.status !== 'pending' && p.status !== 'rejected'
      );

      // Per-year financial rollups.
      // Billed months come ONLY from monthly records the tutor explicitly initialized
      // ("+ Add Month"). Payments never create a billing month — a payment recorded via
      // the Payments tab without a matching record must not inflate the month count or
      // the amount due. Payments still count toward the year's paid total.
      const yearMap = new Map<string, {
        months: Set<string>;
        paid: number;
        lastPaymentDate?: string;
      }>();

      const ensureYear = (month: string) => {
        const year = getSchoolYearFromMonth(month);
        if (!year) return undefined;
        let entry = yearMap.get(year);
        if (!entry) {
          entry = { months: new Set(), paid: 0 };
          yearMap.set(year, entry);
        }
        return entry;
      };

      const addRecordMonth = (month: string | undefined | null) => {
        if (!month) return;
        const entry = ensureYear(month);
        if (!entry) return;
        entry.months.add(month);
      };

      const addPaidAmount = (month: string | undefined | null, paid: number, paymentDate?: string) => {
        if (!month) return;
        const entry = ensureYear(month);
        if (!entry) return;
        entry.paid += paid;
        if (paymentDate && (!entry.lastPaymentDate || paymentDate > entry.lastPaymentDate)) {
          entry.lastPaymentDate = paymentDate;
        }
      };

      records.forEach((r) => addRecordMonth(r.month));
      payments.forEach((p) => addPaidAmount(p.month || p.paymentDate?.slice(0, 7), p.amount, p.paymentDate));

      const totalsByYear: Record<string, { totalSessions: number; totalPaid: number; balance: number; lastPaymentDate?: string }> = {};

      // Initialize all enrolled school years to 0
      const enrolledYears = Array.isArray(tutee.schoolYears) ? tutee.schoolYears : [];
      enrolledYears.forEach((year) => {
        totalsByYear[year] = { totalSessions: 0, totalPaid: 0, balance: 0 };
      });

      // Also ensure any existing tracked years are preserved with clean initial values
      if (tutee.totalsByYear) {
        Object.keys(tutee.totalsByYear).forEach((year) => {
          totalsByYear[year] = { totalSessions: 0, totalPaid: 0, balance: 0 };
        });
      }

      let totalSessions = 0;
      let totalPaid = 0;

      yearMap.forEach((entry, year) => {
        const sessions = entry.months.size;
        const due = sessions * tutee.ratePerSession;
        const balance = Math.round((due - entry.paid) * 100) / 100;
        const yearData: { totalSessions: number; totalPaid: number; balance: number; lastPaymentDate?: string } = {
          totalSessions: sessions,
          totalPaid: Math.round(entry.paid * 100) / 100,
          balance,
        };
        if (entry.lastPaymentDate) {
          yearData.lastPaymentDate = entry.lastPaymentDate;
        }
        totalsByYear[year] = yearData;
        totalSessions += sessions;
        totalPaid += entry.paid;
      });

      totalPaid = Math.round(totalPaid * 100) / 100;
      const totalDue = totalSessions * tutee.ratePerSession;
      const balance = Math.round((totalDue - totalPaid) * 100) / 100;

      // Find latest payment date overall
      let lastPaymentDate: string | undefined = undefined;
      if (payments.length > 0) {
        const sorted = [...payments].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
        lastPaymentDate = sorted[0].paymentDate;
      }

      await tuteeService.update(tuteeId, {
        totalSessions,
        totalPaid,
        balance,
        lastPaymentDate,
        totalsByYear,
      }, userId);
    } catch (error) {
      console.error('Error syncing tutee totals:', error);
    }
  }

  async toggleMonthPaymentStatus(tuteeId: string, month: string): Promise<PaymentRecord> {
    try {
      const record = await this.getMonthlyRecord(tuteeId, month);
      const tutee = await tuteeService.getById(tuteeId);
      if (!tutee) {
        throw new Error('Tutee not found');
      }

      const isCurrentlyPaid = record.totalPaid > 0 && record.totalBalance <= 0;
      const userId = this.getUserId();
      const recordId = `${tuteeId}_${month}`;
      const docRef = doc(db, 'users', userId, 'paymentRecords', recordId);

      if (!isCurrentlyPaid) {
        // Mark as Fully Paid
        const remainingBalance = record.totalBalance;
        if (remainingBalance > 0) {
          // Create a payment transaction in central 'payments' collection.
          // Tag it with `source: 'month-toggle'` so uncommenting can revert ONLY this auto payment
          // without deleting real/verified payments.
          await paymentService.create({
            tuteeId,
            tuteeName: `${tutee.firstName} ${tutee.surname}`,
            amount: remainingBalance,
            sessionsCovered: 1,
            paymentMethod: 'Cash',
            paymentDate: new Date().toISOString().split('T')[0],
            notes: `Marked as Paid via monthly checkbox for ${month}`,
            month,
            coverageType: 'full',
            source: 'month-toggle',
          } as any);

          // Log audit activity for cash mark-as-paid
          const currentUser = auth.currentUser;
          if (currentUser) {
            const tutorSnap = await getDoc(doc(db, 'users', currentUser.uid));
            const tutorName = tutorSnap.exists() ? (tutorSnap.data().name || 'Tutor') : 'Tutor';
            await logActivity(
              currentUser.uid,
              tutorName,
              'tutor',
              'Payment Recorded',
              'Billing',
              `Marked Cash payment of ₱${remainingBalance} as Full Payment for student ${tutee.firstName} ${tutee.surname} (${month})`
            );
          }
        }

        // Update monthly record to show fully paid
        await updateDoc(docRef, {
          totalPaid: record.totalDue,
          totalBalance: 0,
          lastUpdated: Timestamp.fromDate(new Date()),
        });
      } else {
        // Mark as Unpaid — revert ONLY the auto-created "month-toggle" payment(s).
        // Real payments (tutor-recorded or parent-verified) are preserved.
        const payments = await paymentService.getByTuteeId(tuteeId, userId);
        const togglePayments = payments.filter(
          (p: any) => p.month === month && p.source === 'month-toggle'
        );
        for (const p of togglePayments) {
          await paymentService.delete(p.id);
        }

        // Recompute the month's paid total from whatever legitimate payments remain.
        const remainingMonthPayments = payments.filter(
          (p: any) => p.month === month && p.source !== 'month-toggle' && p.status !== 'pending' && p.status !== 'rejected'
        );
        const remainingPaid = remainingMonthPayments.reduce((sum, p: any) => sum + p.amount, 0);
        const newTotalPaid = Math.min(record.totalDue, remainingPaid);
        const newTotalBalance = record.totalDue - newTotalPaid;

        await updateDoc(docRef, {
          totalPaid: newTotalPaid,
          totalBalance: newTotalBalance,
          lastUpdated: Timestamp.fromDate(new Date()),
        });
      }

      // Sync the overall totals
      await this.syncTuteeTotals(tuteeId, userId);

      // Retrieve updated record to return
      const updatedSnap = await getDoc(docRef);
      return {
        id: recordId,
        ...updatedSnap.data(),
        lastUpdated: new Date().toISOString(),
      } as PaymentRecord;
    } catch (error) {
      console.error('Error toggling month payment status:', error);
      throw error;
    }
  }

  async verifyPendingPayment(payment: Payment, coverageType?: 'full' | 'partial'): Promise<void> {
    try {
      const userId = this.getUserId();
      const recordId = `${payment.tuteeId}_${payment.month}`;
      const recordDocRef = doc(db, 'users', userId, 'paymentRecords', recordId);
      const recordSnap = await getDoc(recordDocRef);

      let totalDue = 300;
      if (recordSnap.exists()) {
        const recordData = recordSnap.data();
        totalDue = recordData.totalDue || 300;
        const totalPaid = (recordData.totalPaid || 0) + payment.amount;
        const totalBalance = totalDue - totalPaid;

        await updateDoc(recordDocRef, {
          totalPaid,
          totalBalance,
          lastUpdated: Timestamp.fromDate(new Date()),
        });
      }

      // Update payment status to verified in payments collection
      const paymentDocRef = doc(db, 'users', userId, 'payments', payment.id);
      await updateDoc(paymentDocRef, {
        status: 'verified',
        coverageType: coverageType || (payment.amount >= totalDue ? 'full' : 'partial'),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Create transaction record in the subcollection for backward compatibility and real-time syncing
      const transRef = collection(db, 'users', userId, 'paymentTransactions');
      await addDoc(transRef, {
        tuteeId: payment.tuteeId,
        tuteeName: payment.tuteeName,
        paymentDate: payment.paymentDate || new Date().toISOString().split('T')[0],
        daysPaid: [],
        totalAmount: payment.amount,
        paymentMethod: payment.paymentMethod,
        month: payment.month,
        notes: payment.notes || `Verified parent payment proof`,
        schoolYear: payment.schoolYear || (payment.month ? getSchoolYearFromMonth(payment.month) : undefined),
        paymentId: payment.id,
        createdAt: Timestamp.fromDate(new Date()),
      });

      // Sync overall student totals
      await this.syncTuteeTotals(payment.tuteeId, userId);

      // Notify the submitting parent that their payment was accepted.
      try {
        const tutee = await tuteeService.getById(payment.tuteeId);
        const parentId =
          (recordSnap.exists() ? recordSnap.data().parentId : null) || tutee?.parentId;
        if (parentId) {
          sendPaymentStatusNotification(parentId, 'accepted', payment.tuteeName, payment.amount)
            .catch((err) => console.warn('Failed to send payment accepted push:', err));
        }
      } catch (error) {
        console.warn('Failed to notify parent about accepted payment:', error);
      }
    } catch (error) {
      console.error('Error verifying pending payment:', error);
      throw error;
    }
  }

  async rejectPendingPayment(paymentId: string, rejectionReason?: string): Promise<void> {
    try {
      const userId = this.getUserId();
      const paymentDocRef = doc(db, 'users', userId, 'payments', paymentId);
      const paymentSnap = await getDoc(paymentDocRef);

      let newNotes = rejectionReason ? `Rejected: ${rejectionReason}` : 'Rejected by tutor';
      if (paymentSnap.exists()) {
        const currentNotes = paymentSnap.data().notes || '';
        if (currentNotes) {
          newNotes = `${currentNotes} | Rejected: ${rejectionReason || 'No reason specified'}`;
        }
      }

      await updateDoc(paymentDocRef, {
        status: 'rejected',
        notes: newNotes,
        rejectionReason: rejectionReason || 'No reason specified',
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Notify the submitting parent that their payment was rejected.
      try {
        if (paymentSnap.exists()) {
          const paymentData = paymentSnap.data();
          const tutee = await tuteeService.getById(paymentData.tuteeId);
          const parentId = tutee?.parentId;
          if (parentId) {
            sendPaymentStatusNotification(
              parentId,
              'rejected',
              paymentData.tuteeName,
              paymentData.amount,
              rejectionReason || 'No reason specified'
            ).catch((err) => console.warn('Failed to send payment rejected push:', err));
          }
        }
      } catch (error) {
        console.warn('Failed to notify parent about rejected payment:', error);
      }
    } catch (error) {
      console.error('Error rejecting pending payment:', error);
      throw error;
    }
  }
}

export const dayPaymentService = new DayPaymentService();
