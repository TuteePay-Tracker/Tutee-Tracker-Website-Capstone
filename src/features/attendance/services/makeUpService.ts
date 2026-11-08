import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  Timestamp,
  where,
} from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { db, auth } from '@/shared/lib/firebase/config';
import { getDayAttendance, isMakeUpDay, type DayPayment, type PaymentRecord } from '@/features/attendance/types/dayPayment';
import {
  makeUpCreditId,
  type MakeUpCredit,
  type MakeUpCreditInput,
  type ScheduleMakeUpInput,
} from '@/features/attendance/types/makeUpCredit';
import {
  getTuteeScheduleForYear,
  isTuteeArchivedForYear,
  isTuteeInSchoolYear,
  normalizeScheduleItems,
} from '@/features/tutees/types/tutee';
import {
  areTuteesInSameRegularGroup,
  rangesOverlap,
  toMinutes,
} from '@/features/schedule/utils/scheduleConflicts';
import { getSchoolYearFromDate, getSchoolYearFromMonth } from '@/shared/utils/schoolYear';

type CreditData = Omit<MakeUpCredit, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const stripUndefined = <T extends Record<string, any>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

class MakeUpService {
  private getUserId(providedId?: string): string {
    const userId = providedId || auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');
    return userId;
  }

  private getCreditsRef(tutorId?: string) {
    return collection(db, 'users', this.getUserId(tutorId), 'makeUpCredits');
  }

  private getRecordsRef(tutorId?: string) {
    return collection(db, 'users', this.getUserId(tutorId), 'paymentRecords');
  }

  private mapCredit(id: string, data: Record<string, any>): MakeUpCredit {
    return {
      id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    } as MakeUpCredit;
  }

  subscribeByTutee(
    tuteeId: string,
    callback: (credits: MakeUpCredit[]) => void,
    tutorId?: string
  ): () => void {
    const creditsRef = this.getCreditsRef(tutorId);
    const q = query(creditsRef, where('tuteeId', '==', tuteeId));

    return onSnapshot(
      q,
      (snapshot) => {
        const credits = snapshot.docs.map((docSnap) => this.mapCredit(docSnap.id, docSnap.data()));
        credits.sort((a, b) => b.sourceDate.localeCompare(a.sourceDate));
        callback(credits);
      },
      (error) => {
        console.error('Error subscribing to make-up credits:', error);
      }
    );
  }

  subscribeAll(callback: (credits: MakeUpCredit[]) => void, tutorId?: string): () => void {
    return onSnapshot(
      this.getCreditsRef(tutorId),
      (snapshot) => {
        const credits = snapshot.docs.map((docSnap) => this.mapCredit(docSnap.id, docSnap.data()));
        credits.sort((a, b) => b.sourceDate.localeCompare(a.sourceDate));
        callback(credits);
      },
      (error) => {
        console.error('Error subscribing to make-up credits:', error);
      }
    );
  }

  async getByTutee(tuteeId: string, tutorId?: string): Promise<MakeUpCredit[]> {
    const q = query(this.getCreditsRef(tutorId), where('tuteeId', '==', tuteeId));
    const snapshot = await getDocs(q);
    const credits = snapshot.docs.map((docSnap) => this.mapCredit(docSnap.id, docSnap.data()));
    credits.sort((a, b) => b.sourceDate.localeCompare(a.sourceDate));
    return credits;
  }

  /**
   * Manually grants a make-up credit for a source date that is marked absent.
   * Absences never create credits automatically.
   */
  async grantCredit(input: MakeUpCreditInput): Promise<MakeUpCredit> {
    const userId = this.getUserId();
    const sourceMonth = input.sourceDate.slice(0, 7);
    const creditId = makeUpCreditId(input.tuteeId, input.sourceDate);
    const sourceRecordRef = doc(
      db,
      'users',
      userId,
      'paymentRecords',
      `${input.tuteeId}_${sourceMonth}`
    );
    const creditRef = doc(db, 'users', userId, 'makeUpCredits', creditId);
    const now = Timestamp.fromDate(new Date());

    let result: MakeUpCredit | undefined;

    await runTransaction(db, async (transaction) => {
      const sourceSnap = await transaction.get(sourceRecordRef);
      if (!sourceSnap.exists()) {
        throw new Error('The billing month for this date has not been initialized.');
      }

      const sourceRecord = sourceSnap.data() as PaymentRecord;
      const sourceDay = (sourceRecord.dayPayments || []).find(
        (day) => day.date === input.sourceDate && !isMakeUpDay(day)
      );
      if (!sourceDay || getDayAttendance(sourceDay) !== 'absent') {
        throw new Error('A make-up credit can only be granted for a date marked Absent.');
      }

      const creditSnap = await transaction.get(creditRef);
      if (creditSnap.exists()) {
        const existing = creditSnap.data() as CreditData;
        if (existing.status === 'pending' || existing.status === 'scheduled') {
          throw new Error('A make-up credit already exists for this absence.');
        }
        if (existing.status === 'completed') {
          throw new Error('This make-up credit has already been used.');
        }
      }

      const schoolYear = input.schoolYear || getSchoolYearFromDate(input.sourceDate) || '';
      const creditData: CreditData = {
        tuteeId: input.tuteeId,
        tuteeName: input.tuteeName || sourceRecord.tuteeName || '',
        sourceDate: input.sourceDate,
        sourceMonth,
        durationMinutes: Math.max(1, input.durationMinutes || 60),
        status: 'pending',
        schoolYear: schoolYear || undefined,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(creditRef, stripUndefined(creditData));
      result = this.mapCredit(creditId, creditData);
    });

    return result as MakeUpCredit;
  }

  /**
   * Schedules (or reschedules) a credit into a billing month that already exists.
   * Adds a zero-charge make-up day to that month's payment record.
   */
  async scheduleCredit(input: ScheduleMakeUpInput): Promise<MakeUpCredit> {
    const userId = this.getUserId();
    const targetMonth = input.scheduledDate.slice(0, 7);
    const creditRef = doc(db, 'users', userId, 'makeUpCredits', input.creditId);
    const now = Timestamp.fromDate(new Date());

    const creditSnap = await getDoc(creditRef);
    if (!creditSnap.exists()) throw new Error('Make-up credit not found.');
    const creditData = creditSnap.data() as CreditData;
    if (creditData.status === 'completed') throw new Error('This make-up credit was already used.');
    if (creditData.status === 'reversed') throw new Error('This make-up credit was reversed.');

    const targetRecordId = `${creditData.tuteeId}_${targetMonth}`;
    const targetRecordRef = doc(db, 'users', userId, 'paymentRecords', targetRecordId);

    await this.assertNoScheduleConflict(
      userId,
      input.creditId,
      creditData.tuteeId,
      targetMonth,
      input.scheduledDate,
      input.startTime,
      input.endTime,
      creditData.schoolYear
    );

    const durationMinutes =
      input.durationMinutes || creditData.durationMinutes || 60;

    let result: MakeUpCredit | undefined;

    await runTransaction(db, async (transaction) => {
      const freshCreditSnap = await transaction.get(creditRef);
      if (!freshCreditSnap.exists()) throw new Error('Make-up credit not found.');
      const freshCredit = freshCreditSnap.data() as CreditData;
      if (freshCredit.status === 'completed') throw new Error('This make-up credit was already used.');
      if (freshCredit.status === 'reversed') throw new Error('This make-up credit was reversed.');

      const targetSnap = await transaction.get(targetRecordRef);
      if (!targetSnap.exists()) {
        throw new Error(
          `Billing for ${targetMonth} has not been initialized. Add the month first.`
        );
      }

      const targetData = targetSnap.data() as PaymentRecord;
      const oldRecordId =
        freshCredit.attendanceRecordId ||
        (freshCredit.targetMonth
          ? `${freshCredit.tuteeId}_${freshCredit.targetMonth}`
          : undefined);

      let oldRecordRef: ReturnType<typeof doc> | undefined;
      let oldRecordSnap: any;
      if (oldRecordId && oldRecordId !== targetRecordId) {
        oldRecordRef = doc(db, 'users', userId, 'paymentRecords', oldRecordId);
        oldRecordSnap = await transaction.get(oldRecordRef);
      }

      if (oldRecordRef && oldRecordSnap?.exists()) {
        const oldData = oldRecordSnap.data() as PaymentRecord;
        const nextOldDays = (oldData.dayPayments || []).filter(
          (day) => day.makeUpCreditId !== input.creditId
        );
        transaction.update(oldRecordRef, {
          dayPayments: nextOldDays,
          lastUpdated: now,
        });
      }

      const makeUpDay: DayPayment = {
        date: input.scheduledDate,
        amountDue: 0,
        amountPaid: 0,
        status: 'unpaid',
        tuteeId: freshCredit.tuteeId,
        tuteeName: freshCredit.tuteeName,
        sessionType: 'make-up',
        makeUpCreditId: input.creditId,
        durationMinutes,
        startTime: input.startTime,
        endTime: input.endTime,
      };

      const nextTargetDays = [
        ...(targetData.dayPayments || []).filter(
          (day) => day.makeUpCreditId !== input.creditId
        ),
        makeUpDay,
      ].sort((a, b) => a.date.localeCompare(b.date));

      transaction.update(targetRecordRef, {
        dayPayments: nextTargetDays,
        lastUpdated: now,
      });

      const creditUpdate: Partial<CreditData> = {
        status: 'scheduled',
        targetMonth,
        scheduledDate: input.scheduledDate,
        startTime: input.startTime,
        endTime: input.endTime,
        attendanceRecordId: targetRecordId,
        durationMinutes,
        notes: input.notes ?? freshCredit.notes,
        updatedAt: now,
      };

      transaction.update(creditRef, stripUndefined(creditUpdate));
      result = this.mapCredit(input.creditId, {
        ...freshCredit,
        ...creditUpdate,
      });
    });

    return result as MakeUpCredit;
  }

  /** Cancels a scheduled make-up and returns the credit to the available pool. */
  async cancelScheduledCredit(creditId: string): Promise<void> {
    const userId = this.getUserId();
    const creditRef = doc(db, 'users', userId, 'makeUpCredits', creditId);
    const now = Timestamp.fromDate(new Date());

    await runTransaction(db, async (transaction) => {
      const creditSnap = await transaction.get(creditRef);
      if (!creditSnap.exists()) return;
      const credit = creditSnap.data() as CreditData;
      if (credit.status === 'completed') {
        throw new Error('A completed make-up class cannot be cancelled.');
      }
      if (credit.status !== 'scheduled') return;

      const recordId =
        credit.attendanceRecordId ||
        (credit.targetMonth ? `${credit.tuteeId}_${credit.targetMonth}` : undefined);
      if (recordId) {
        const recordRef = doc(db, 'users', userId, 'paymentRecords', recordId);
        const recordSnap = await transaction.get(recordRef);
        if (recordSnap.exists()) {
          const record = recordSnap.data() as PaymentRecord;
          transaction.update(recordRef, {
            dayPayments: (record.dayPayments || []).filter(
              (day) => day.makeUpCreditId !== creditId
            ),
            lastUpdated: now,
          });
        }
      }

      transaction.update(creditRef, {
        status: 'pending',
        targetMonth: deleteField(),
        scheduledDate: deleteField(),
        startTime: deleteField(),
        endTime: deleteField(),
        attendanceRecordId: deleteField(),
        updatedAt: now,
      });
    });
  }

  /** Marks a credit as consumed. The make-up day is left intact for history. */
  async completeCredit(creditId: string): Promise<void> {
    const userId = this.getUserId();
    const creditRef = doc(db, 'users', userId, 'makeUpCredits', creditId);
    const now = Timestamp.fromDate(new Date());

    await runTransaction(db, async (transaction) => {
      const creditSnap = await transaction.get(creditRef);
      if (!creditSnap.exists()) return;
      const credit = creditSnap.data() as CreditData;
      if (credit.status === 'completed' || credit.status === 'reversed') return;
      transaction.update(creditRef, {
        status: 'completed',
        completedAt: now.toDate().toISOString(),
        updatedAt: now,
      });
    });
  }

  /**
   * Reverses an unused credit when its source absence is no longer marked absent.
   * Completed make-up sessions are preserved.
   */
  async reverseCreditForSourceDate(tuteeId: string, sourceDate: string): Promise<void> {
    const userId = this.getUserId();
    const creditId = makeUpCreditId(tuteeId, sourceDate);
    const creditRef = doc(db, 'users', userId, 'makeUpCredits', creditId);
    const now = Timestamp.fromDate(new Date());

    await runTransaction(db, async (transaction) => {
      const creditSnap = await transaction.get(creditRef);
      if (!creditSnap.exists()) return;
      const credit = creditSnap.data() as CreditData;
      if (credit.status === 'completed' || credit.status === 'reversed') return;

      if (credit.status === 'scheduled') {
        const recordId =
          credit.attendanceRecordId ||
          (credit.targetMonth ? `${credit.tuteeId}_${credit.targetMonth}` : undefined);
        if (recordId) {
          const recordRef = doc(db, 'users', userId, 'paymentRecords', recordId);
          const recordSnap = await transaction.get(recordRef);
          if (recordSnap.exists()) {
            const record = recordSnap.data() as PaymentRecord;
            transaction.update(recordRef, {
              dayPayments: (record.dayPayments || []).filter(
                (day) => day.makeUpCreditId !== creditId
              ),
              lastUpdated: now,
            });
          }
        }
      }

      transaction.update(creditRef, {
        status: 'reversed',
        targetMonth: deleteField(),
        scheduledDate: deleteField(),
        startTime: deleteField(),
        endTime: deleteField(),
        attendanceRecordId: deleteField(),
        updatedAt: now,
      });
    });
  }

  private async assertNoScheduleConflict(
    userId: string,
    creditId: string,
    tuteeId: string,
    targetMonth: string,
    scheduledDate: string,
    startTime: string,
    endTime: string,
    creditSchoolYear?: string
  ): Promise<void> {
    if (!startTime || !endTime) {
      throw new Error('Please provide both start and end times.');
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      throw new Error('The make-up class end time must be after the start time.');
    }

    const schoolYear =
      creditSchoolYear ||
      getSchoolYearFromDate(scheduledDate) ||
      getSchoolYearFromMonth(targetMonth) ||
      '';
    const weekday = format(parseISO(scheduledDate), 'EEEE');

    const tuteeSnap = await getDoc(doc(db, 'users', userId, 'tutees', tuteeId));
    const currentTutee = tuteeSnap.exists() ? (tuteeSnap.data() as any) : undefined;
    if (currentTutee) {
      const slots = normalizeScheduleItems(
        getTuteeScheduleForYear(currentTutee, schoolYear)
      ).filter((slot) => slot.day === weekday);

      const overlaps = slots.some((slot) =>
        rangesOverlap(startTime, endTime, slot.startTime, slot.endTime)
      );
      if (overlaps) {
        throw new Error(
          'This make-up time overlaps the student\'s regular class schedule on that day.'
        );
      }
    }

    // A tutor cannot run two classes at once, so also check every other active
    // tutee's regular timetable for the same weekday.
    const tuteesSnap = await getDocs(collection(db, 'users', userId, 'tutees'));
    const tuteesById = new Map<string, any>();
    tuteesSnap.forEach((tuteeDoc) => tuteesById.set(tuteeDoc.id, tuteeDoc.data()));

    for (const tuteeDoc of tuteesSnap.docs) {
      if (tuteeDoc.id === tuteeId) continue;
      const otherTutee = tuteeDoc.data();
      if (!isTuteeInSchoolYear(otherTutee as any, schoolYear)) continue;
      if (isTuteeArchivedForYear(otherTutee as any, schoolYear)) continue;

      const otherSlots = normalizeScheduleItems(
        getTuteeScheduleForYear(otherTutee as any, schoolYear)
      ).filter((slot) => slot.day === weekday);

      const overlaps = otherSlots.some((slot) =>
        rangesOverlap(startTime, endTime, slot.startTime, slot.endTime)
      );
      if (overlaps) {
        const name =
          `${otherTutee.firstName || ''} ${otherTutee.surname || ''}`.trim() ||
          'another tutee';
        throw new Error(`This make-up time overlaps ${name}'s regular class schedule.`);
      }
    }

    const monthSnap = await getDocs(
      query(this.getRecordsRef(userId), where('month', '==', targetMonth))
    );

    for (const recordDoc of monthSnap.docs) {
      const record = recordDoc.data() as PaymentRecord;
      for (const day of record.dayPayments || []) {
        if (day.makeUpCreditId === creditId) continue;
        if (day.date !== scheduledDate) continue;
        if (day.status === 'no-class' || day.attendance === 'no-class') continue;
        if (!day.startTime || !day.endTime) continue;
        if (!rangesOverlap(startTime, endTime, day.startTime, day.endTime)) continue;

        const otherTuteeId = day.tuteeId || record.tuteeId;
        if (otherTuteeId !== tuteeId) {
          const otherTutee = tuteesById.get(otherTuteeId);
          const isGroupMate =
            !!currentTutee &&
            !!otherTutee &&
            areTuteesInSameRegularGroup(currentTutee, otherTutee, schoolYear);
          const isExactSameTime =
            toMinutes(day.startTime) === toMinutes(startTime) &&
            toMinutes(day.endTime) === toMinutes(endTime);

          // Groupmates may share the same make-up class on the same day and hour.
          if (isGroupMate && isExactSameTime) continue;
        }

        throw new Error('This time overlaps another scheduled make-up class.');
      }
    }
  }
}

export const makeUpService = new MakeUpService();
