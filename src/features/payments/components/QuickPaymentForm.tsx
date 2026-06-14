import { useState, useEffect } from 'react';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { usePayments } from '@/features/payments/hooks/usePayments';
import { PaymentMethod } from '@/features/payments/types/payment';
import { DollarSign, Calendar, CreditCard, FileText, User } from 'lucide-react';
import { toast } from 'sonner';

interface QuickPaymentFormProps {
  preselectedTuteeId?: string;
  onSuccess?: () => void;
}

export const QuickPaymentForm = ({ preselectedTuteeId, onSuccess }: QuickPaymentFormProps) => {
  const { tutees, refreshTutees } = useTutees();
  const { addPayment } = usePayments();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [selectedTuteeId, setSelectedTuteeId] = useState(preselectedTuteeId || '');
  const [amount, setAmount] = useState('');
  const [sessionsCovered, setSessionsCovered] = useState('1');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');

  // Auto-calculate amount based on sessions
  const [autoCalculate, setAutoCalculate] = useState(true);

  useEffect(() => {
    if (preselectedTuteeId) {
      setSelectedTuteeId(preselectedTuteeId);
    }
  }, [preselectedTuteeId]);

  useEffect(() => {
    if (autoCalculate && selectedTuteeId && sessionsCovered) {
      const tutee = tutees.find(t => t.id === selectedTuteeId);
      if (tutee) {
        const calculatedAmount = tutee.ratePerSession * parseInt(sessionsCovered || '0');
        setAmount(calculatedAmount.toString());
      }
    }
  }, [selectedTuteeId, sessionsCovered, autoCalculate, tutees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!selectedTuteeId) {
      toast.error('Please select a student');
      return;
    }

    const amountValue = parseFloat(amount);
    if (!amountValue || amountValue <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    const sessionsValue = parseInt(sessionsCovered);
    if (!sessionsValue || sessionsValue <= 0) {
      toast.error('Please enter valid number of months');
      return;
    }

    try {
      setIsSubmitting(true);

      const tutee = tutees.find(t => t.id === selectedTuteeId);
      if (!tutee) {
        toast.error('Student not found');
        return;
      }

      await addPayment({
        tuteeId: selectedTuteeId,
        tuteeName: `${tutee.firstName} ${tutee.surname}`,
        amount: amountValue,
        sessionsCovered: sessionsValue,
        paymentMethod,
        paymentDate,
        notes: notes.trim() || undefined,
      });

      // Refresh tutee data to show updated balances
      await refreshTutees();

      toast.success('Payment recorded successfully!');

      // Reset form
      if (!preselectedTuteeId) {
        setSelectedTuteeId('');
      }
      setAmount('');
      setSessionsCovered('1');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('Cash');
      setNotes('');
      setAutoCalculate(true);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTutee = tutees.find(t => t.id === selectedTuteeId);
  const expectedAmount = selectedTutee && sessionsCovered
    ? selectedTutee.ratePerSession * parseInt(sessionsCovered || '0')
    : 0;

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center shadow-lg shadow-green-700/20">
          <DollarSign className="text-white" size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Record Payment</h2>
          <p className="text-sm text-gray-500">Enter payment details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Student Selection */}
        <div>
          <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
            <User size={16} />
            Select Student <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedTuteeId}
            onChange={(e) => setSelectedTuteeId(e.target.value)}
            disabled={!!preselectedTuteeId}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
            required
          >
            <option value="">Choose a student...</option>
            {tutees.map(tutee => (
              <option key={tutee.id} value={tutee.id}>
                {tutee.firstName} {tutee.surname} - {tutee.subject} (₱{tutee.ratePerSession}/month)
              </option>
            ))}
          </select>

          {selectedTutee && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p className="text-blue-900">
                <span className="font-semibold">Current Balance:</span>{' '}
                {selectedTutee.balance > 0 ? (
                  <span className="text-orange-600 font-bold">₱{selectedTutee.balance.toFixed(2)}</span>
                ) : (
                  <span className="text-green-600 font-bold">Fully Paid</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Sessions Covered */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Number of Months <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={sessionsCovered}
            onChange={(e) => setSessionsCovered(e.target.value)}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="Enter number of months"
            required
          />
        </div>

        {/* Payment Amount */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
              <DollarSign size={16} />
              Payment Amount (₱) <span className="text-red-500">*</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={autoCalculate}
                onChange={(e) => setAutoCalculate(e.target.checked)}
                className="w-4 h-4 text-green-700 rounded focus:ring-green-500"
              />
              Auto-calculate
            </label>
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAutoCalculate(false);
            }}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="Enter payment amount"
            required
          />
          {selectedTutee && expectedAmount > 0 && parseFloat(amount || '0') !== expectedAmount && (
            <p className="mt-2 text-sm text-gray-600">
              Expected for {sessionsCovered} month(s): <span className="font-semibold">₱{expectedAmount.toFixed(2)}</span>
            </p>
          )}
        </div>

        {/* Payment Date */}
        <div>
          <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
            <Calendar size={16} />
            Payment Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
            <CreditCard size={16} />
            Payment Method <span className="text-red-500">*</span>
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          >
            <option value="Cash">Cash</option>
            <option value="GCash">GCash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="PayMaya">PayMaya</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="flex text-sm font-semibold text-gray-700 mb-2 items-center gap-2">
            <FileText size={16} />
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
            rows={3}
            placeholder="Add any additional notes about this payment..."
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-green-700 text-white px-6 py-4 rounded-xl hover:bg-green-800 shadow-lg shadow-green-700/20 transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Recording...
            </>
          ) : (
            <>
              <DollarSign size={20} />
              Record Payment
            </>
          )}
        </button>
      </form>
    </div>
  );
};
