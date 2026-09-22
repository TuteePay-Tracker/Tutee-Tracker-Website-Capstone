export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'no-class';

export type AttendanceMark = 'present' | 'absent' | 'no-class';

export interface DayPayment {
  date: string; // YYYY-MM-DD format
  amountDue: number;
  amountPaid: number;
  status: PaymentStatus;
  attendance?: AttendanceMark;
  tuteeId: string;
  tuteeName: string;
}

export type AttendanceStatus = AttendanceMark | 'none';

/**
 * Resolve a day's attendance mark.
 *
 * The explicit `attendance` field always wins. For legacy records that only have
 * the payment `status`, we derive a safe value:
 *  - 'paid'      => present (tutor marked present)
 *  - 'no-class'  => no-class
 *  - 'partial' with no payment => absent (an old deliberate absent mark)
 *  - anything else (e.g. a partially PAID day) => none (NOT absent)
 */
export const getDayAttendance = (day: DayPayment): AttendanceStatus => {
  if (day.attendance) return day.attendance;
  if (day.status === 'paid') return 'present';
  if (day.status === 'no-class') return 'no-class';
  if (day.status === 'partial' && (day.amountPaid || 0) <= 0) return 'absent';
  return 'none';
};

export interface PaymentRecord {
  id: string;
  tuteeId: string;
  tuteeName: string;
  parentId?: string | null;
  tutorId?: string;
  month: string; // YYYY-MM format
  /** School year this monthly record belongs to, e.g. "2026-27". */
  schoolYear?: string;
  dayPayments: DayPayment[];
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
  lastUpdated: string;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  tuteeId: string;
  tuteeName: string;
  paymentDate: string;
  daysPaid: {
    date: string;
    amountDue: number;
    amountPaid: number;
    status: PaymentStatus;
  }[];
  totalAmount: number;
  paymentMethod: string;
  month?: string;
  notes?: string;
  coverageType?: 'full' | 'partial';
  /** School year this transaction belongs to, e.g. "2026-27". */
  schoolYear?: string;
  createdAt: string;
}

export interface ReceiptData {
  receiptNumber: string;
  tuteeId: string;
  tuteeName: string;
  paymentDate: string;
  daysPaid: {
    date: string;
    amountDue: number;
    amountPaid: number;
    status: PaymentStatus;
  }[];
  totalAmount: number;
  paymentMethod: string;
  notes?: string;
  coverageType?: 'full' | 'partial';
}
