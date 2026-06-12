import { Tutee } from '@/features/tutees/types/tutee';
import { Payment } from '@/features/payments/types/payment';

export const calculateTotalDue = (sessions: number, ratePerSession: number): number => {
  return sessions * ratePerSession;
};

export const calculateBalance = (totalDue: number, totalPaid: number): number => {
  return totalDue - totalPaid;
};

export const calculateTuteeBalance = (tutee: Tutee): number => {
  const totalDue = calculateTotalDue(tutee.totalSessions, tutee.ratePerSession);
  return calculateBalance(totalDue, tutee.totalPaid);
};

export const updateTuteeAfterPayment = (
  tutee: Tutee,
  payment: Payment
): Tutee => {
  const newTotalPaid = tutee.totalPaid + payment.amount;
  const newTotalSessions = tutee.totalSessions + payment.sessionsCovered;
  const totalDue = calculateTotalDue(newTotalSessions, tutee.ratePerSession);
  const newBalance = calculateBalance(totalDue, newTotalPaid);

  return {
    ...tutee,
    totalSessions: newTotalSessions,
    totalPaid: newTotalPaid,
    balance: newBalance,
    lastPaymentDate: payment.paymentDate,
    updatedAt: new Date().toISOString(),
  };
};

export const getTotalEarnings = (payments: Payment[]): number => {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
};

export const getTotalSessions = (tutees: Tutee[]): number => {
  return tutees.reduce((sum, tutee) => sum + tutee.totalSessions, 0);
};

export const getTotalPendingBalance = (tutees: Tutee[]): number => {
  return tutees.reduce((sum, tutee) => sum + tutee.balance, 0);
};
