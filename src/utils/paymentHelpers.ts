/**
 * Payment Helper Functions
 *
 * This file contains utility functions for handling payment-related operations
 * in the TuteePay Tracker application.
 */

import { Payment, PaymentMethod } from '../types/payment';
import { Tutee } from '../types/tutee';
import { paymentService } from '../services/paymentService';
import { tuteeService } from '../services/tuteeService';

/**
 * Calculate the total amount due for a student based on sessions
 */
export const calculateTotalDue = (ratePerSession: number, totalSessions: number): number => {
  return ratePerSession * totalSessions;
};

/**
 * Calculate the remaining balance for a student
 */
export const calculateBalance = (totalDue: number, totalPaid: number): number => {
  return totalDue - totalPaid;
};

/**
 * Check if a student has an outstanding balance
 */
export const hasOutstandingBalance = (tutee: Tutee): boolean => {
  return tutee.balance > 0;
};

/**
 * Format payment amount for display
 */
export const formatPaymentAmount = (amount: number): string => {
  return `₱${amount.toFixed(2)}`;
};

/**
 * Calculate expected payment amount based on number of sessions
 */
export const calculateExpectedPayment = (ratePerSession: number, sessionsCovered: number): number => {
  return ratePerSession * sessionsCovered;
};

/**
 * Validate payment amount
 */
export const validatePaymentAmount = (amount: number, sessionsCovered: number, ratePerSession: number): {
  isValid: boolean;
  message?: string;
} => {
  if (amount <= 0) {
    return { isValid: false, message: 'Payment amount must be greater than zero' };
  }

  const expected = calculateExpectedPayment(ratePerSession, sessionsCovered);

  if (amount > expected) {
    return {
      isValid: false,
      message: `Payment amount (₱${amount.toFixed(2)}) exceeds expected amount (₱${expected.toFixed(2)})`
    };
  }

  return { isValid: true };
};

/**
 * Record a new payment for a student
 */
export const recordPayment = async (
  tuteeId: string,
  tuteeName: string,
  amount: number,
  sessionsCovered: number,
  paymentMethod: PaymentMethod,
  paymentDate: string,
  notes?: string
): Promise<Payment> => {
  return await paymentService.create({
    tuteeId,
    tuteeName,
    amount,
    sessionsCovered,
    paymentMethod,
    paymentDate,
    notes,
  });
};

/**
 * Get all payments for a specific student
 */
export const getStudentPayments = async (tuteeId: string): Promise<Payment[]> => {
  return await paymentService.getByTuteeId(tuteeId);
};

/**
 * Get payment summary for a student
 */
export const getPaymentSummary = async (tuteeId: string) => {
  const tutee = await tuteeService.getById(tuteeId);
  if (!tutee) {
    throw new Error('Student not found');
  }

  const payments = await getStudentPayments(tuteeId);

  return {
    studentName: `${tutee.firstName} ${tutee.surname}`,
    totalSessions: tutee.totalSessions,
    totalPaid: tutee.totalPaid,
    balance: tutee.balance,
    ratePerSession: tutee.ratePerSession,
    totalDue: calculateTotalDue(tutee.ratePerSession, tutee.totalSessions),
    paymentCount: payments.length,
    lastPaymentDate: tutee.lastPaymentDate,
    recentPayments: payments.slice(0, 5), // Get last 5 payments
  };
};

/**
 * Calculate payment statistics for all students
 */
export const calculatePaymentStatistics = (tutees: Tutee[]) => {
  const totalStudents = tutees.length;
  const studentsWithBalance = tutees.filter(hasOutstandingBalance).length;
  const fullyPaidStudents = totalStudents - studentsWithBalance;

  const totalDueAllStudents = tutees.reduce(
    (sum, tutee) => sum + calculateTotalDue(tutee.ratePerSession, tutee.totalSessions),
    0
  );

  const totalPaidAllStudents = tutees.reduce(
    (sum, tutee) => sum + tutee.totalPaid,
    0
  );

  const totalBalanceAllStudents = tutees.reduce(
    (sum, tutee) => sum + tutee.balance,
    0
  );

  return {
    totalStudents,
    studentsWithBalance,
    fullyPaidStudents,
    totalDueAllStudents,
    totalPaidAllStudents,
    totalBalanceAllStudents,
    averageBalance: totalStudents > 0 ? totalBalanceAllStudents / totalStudents : 0,
  };
};

/**
 * Get payment methods list
 */
export const getPaymentMethods = (): PaymentMethod[] => {
  return ['Cash', 'GCash', 'Bank Transfer', 'PayMaya'];
};

/**
 * Validate payment date
 */
export const validatePaymentDate = (dateString: string): {
  isValid: boolean;
  message?: string;
} => {
  const paymentDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (paymentDate > today) {
    return {
      isValid: false,
      message: 'Payment date cannot be in the future'
    };
  }

  return { isValid: true };
};

/**
 * Check if payment is partial
 */
export const isPartialPayment = (amount: number, expectedAmount: number): boolean => {
  return amount < expectedAmount && amount > 0;
};

/**
 * Calculate completion percentage
 */
export const calculatePaymentCompletionPercentage = (totalPaid: number, totalDue: number): number => {
  if (totalDue === 0) return 0;
  return Math.min((totalPaid / totalDue) * 100, 100);
};
