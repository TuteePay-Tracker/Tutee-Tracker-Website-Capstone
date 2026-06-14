export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface DayPayment {
  date: string; // YYYY-MM-DD format
  amountDue: number;
  amountPaid: number;
  status: PaymentStatus;
  tuteeId: string;
  tuteeName: string;
}

export interface PaymentRecord {
  id: string;
  tuteeId: string;
  tuteeName: string;
  parentId?: string | null;
  tutorId?: string;
  month: string; // YYYY-MM format
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
}
