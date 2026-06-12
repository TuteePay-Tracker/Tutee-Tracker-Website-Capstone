import { useState, useEffect } from 'react';
import { usePayments } from '@/features/payments/hooks/usePayments';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { useSearchParams } from 'react-router';
import { PaymentForm } from '@/features/payments/components/PaymentForm';
import { PaymentHistory } from '@/features/payments/components/PaymentHistory';
import { Plus, Filter } from 'lucide-react';
import { PaymentMethod } from '@/features/payments/types/payment';
import { toast } from 'sonner';

export const Payments = () => {
  const { payments, addPayment, deletePayment, isLoading } = usePayments();
  const { tutees, refreshTutees } = useTutees();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [selectedTutee, setSelectedTutee] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | ''>('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowForm(true);
      setSearchParams({});
    }
    const tuteeId = searchParams.get('tuteeId');
    if (tuteeId) {
      setSelectedTutee(tuteeId);
      setShowForm(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const filteredPayments = payments.filter(payment => {
    const matchesTutee = !selectedTutee || payment.tuteeId === selectedTutee;
    const matchesMethod = !selectedMethod || payment.paymentMethod === selectedMethod;
    const matchesDate = !dateFilter || payment.paymentDate.startsWith(dateFilter);
    return matchesTutee && matchesMethod && matchesDate;
  });

  const handleAddPayment = async (paymentData: any) => {
    try {
      await addPayment(paymentData);
      await refreshTutees();
      setShowForm(false);
      toast.success('Payment added successfully');
    } catch (error) {
      toast.error('Failed to add payment');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this payment?')) {
      try {
        await deletePayment(id);
        toast.success('Payment deleted successfully');
      } catch (error) {
        toast.error('Failed to delete payment');
      }
    }
  };

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalSessions = filteredPayments.reduce((sum, p) => sum + p.sessionsCovered, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Records</h1>
          <p className="text-gray-600 mt-1">Track all payments and transactions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          <Plus size={20} />
          Add Payment
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Record New Payment</h2>
          <PaymentForm
            tutees={tutees}
            onSubmit={handleAddPayment}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900">{filteredPayments.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Total Amount</p>
          <p className="text-2xl font-bold text-green-600">₱{totalAmount.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-600">Sessions Covered</p>
          <p className="text-2xl font-bold text-green-700">{totalSessions}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-gray-400" />
          <h3 className="font-medium">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={selectedTutee}
            onChange={(e) => setSelectedTutee(e.target.value)}
            className="p-2 border rounded-lg"
          >
            <option value="">All Students</option>
            {tutees.map(tutee => (
              <option key={tutee.id} value={tutee.id}>{tutee.firstName} {tutee.surname}</option>
            ))}
          </select>

          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as PaymentMethod | '')}
            className="p-2 border rounded-lg"
          >
            <option value="">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="GCash">GCash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="PayMaya">PayMaya</option>
          </select>

          <input
            type="month"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="p-2 border rounded-lg"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Payment History</h2>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading payments...</div>
        ) : (
          <PaymentHistory payments={filteredPayments} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
};
