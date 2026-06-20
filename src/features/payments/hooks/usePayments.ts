import { useState, useEffect } from 'react';
import { Payment } from '@/features/payments/types/payment';
import { paymentService } from '@/features/payments/services/paymentService';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { logActivity } from '@/shared/utils/auditLogger';

export const usePayments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user === undefined) return;

    if (user?.role === 'parent') {
      // Parents don't bulk-load all tutor payments.
      // They load per-tutee on demand via loadPaymentsForTutee().
      setIsLoading(false);
    } else if (user) {
      setIsLoading(true);
      const unsubscribe = paymentService.subscribeAll((data) => {
        setPayments(data);
        setIsLoading(false);
        setError(null);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      const data = await paymentService.getAll();
      setPayments(data);
      setError(null);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load payments';
      setError(errorMessage);
      console.error(err);
      if (err?.message !== 'User not authenticated') {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load payments for a specific tutee (used by parent portal)
  const loadPaymentsForTutee = (tuteeId: string, tutorId?: string) => {
    setIsLoading(true);
    return paymentService.subscribeByTuteeId(
      tuteeId,
      (data) => {
        setPayments(data);
        setIsLoading(false);
        setError(null);
      },
      tutorId
    );
  };

  const addPayment = async (payment: Omit<Payment, 'id' | 'createdAt'>, tutorId?: string) => {
    try {
      const newPayment = await paymentService.create(payment, tutorId);
      setPayments(prev => [newPayment, ...prev]);
      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Payment Recorded',
          'Billing',
          `Recorded payment of ₱${payment.amount} for student ${payment.tuteeName}`
        );
      }
      return newPayment;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to add payment';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  };

  const updatePayment = async (id: string, updates: Partial<Payment>) => {
    try {
      const updatedPayment = await paymentService.update(id, updates);
      setPayments(prev => prev.map(p => p.id === id ? updatedPayment : p));
      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Payment Updated',
          'Billing',
          `Updated payment status/details for student ${updatedPayment.tuteeName}`
        );
      }
      return updatedPayment;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to update payment';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  };

  const deletePayment = async (id: string) => {
    try {
      await paymentService.delete(id);
      setPayments(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to delete payment';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  };

  const getPaymentsByTuteeId = (tuteeId: string): Payment[] => {
    return payments.filter(p => p.tuteeId === tuteeId);
  };

  return {
    payments,
    isLoading,
    error,
    addPayment,
    updatePayment,
    deletePayment,
    getPaymentsByTuteeId,
    loadPaymentsForTutee,
    refreshPayments: loadPayments,
  };
};