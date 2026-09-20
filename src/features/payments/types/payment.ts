export type PaymentMethod = 'Cash' | 'GCash' | 'Bank Transfer' | 'PayMaya' | 'Other';

export interface Payment {
  id: string;
  tuteeId: string;
  tuteeName: string;
  amount: number;
  sessionsCovered: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes?: string;
  createdAt: string;
  month?: string;
  status?: 'pending' | 'verified' | 'rejected';
  proofUrl?: string;
  coverageType?: 'full' | 'partial';
  rejectionReason?: string;
  /** Marker for auto-generated payments (e.g. the "mark month as paid" checkbox) so they can be identified/reverted without touching real payments. */
  source?: string;
}

export interface PaymentFormData {
  tuteeId: string;
  amount: number;
  sessionsCovered: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes?: string;
}
