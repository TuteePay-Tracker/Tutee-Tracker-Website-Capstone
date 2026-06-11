import { useState, useEffect } from 'react';
import { PaymentRecord, DayPayment, ReceiptData } from '../../types/dayPayment';
import { dayPaymentService } from '../../services/dayPaymentService';
import { formatCurrency } from '../../utils/formatCurrency';
import { format, parseISO } from 'date-fns';
import { Receipt } from '../receipt/Receipt';
import { Calendar, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface DayPaymentTrackerProps {
  tuteeId: string;
  tuteeName: string;
  onClose: () => void;
}

export const DayPaymentTracker = ({ tuteeId, tuteeName, onClose }: DayPaymentTrackerProps) => {
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [record, setRecord] = useState<PaymentRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadMonthlyRecord();
  }, [tuteeId, currentMonth]);

  const loadMonthlyRecord = async () => {
    try {
      setIsLoading(true);
      const data = await dayPaymentService.getMonthlyRecord(tuteeId, currentMonth);
      setRecord(data);
      setPaymentAmount(data.totalBalance.toString());
    } catch (error) {
      console.error('Error loading record:', error);
      toast.error('Failed to load payment record');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDay = async (date: string) => {
    try {
      const updated = await dayPaymentService.toggleDayStatus(tuteeId, currentMonth, date);
      setRecord(updated);
      toast.success('Attendance status updated');
    } catch (error) {
      console.error('Error toggling attendance status:', error);
      toast.error('Failed to update attendance');
    }
  };

  const handlePayment = async () => {
    const amountVal = parseFloat(paymentAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    try {
      const result = await dayPaymentService.recordMonthlyPayment(
        tuteeId,
        currentMonth,
        amountVal,
        paymentMethod,
        notes
      );

      // Generate receipt
      const receipt: ReceiptData = {
        receiptNumber: result.transaction.id.substring(0, 8).toUpperCase(),
        tuteeId,
        tuteeName,
        paymentDate: new Date().toISOString().split('T')[0],
        daysPaid: [], // Flat rate doesn't use daysPaid
        totalAmount: result.transaction.totalAmount,
        paymentMethod,
        notes,
      };

      setReceiptData(receipt);
      setShowReceipt(true);
      setRecord(result.updatedRecord);
      setPaymentAmount(result.updatedRecord.totalBalance.toString());
      setNotes('');
      toast.success('Payment recorded successfully!');
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    }
  };

  const getDayStatus = (day: DayPayment) => {
    if (day.status === 'paid') {
      return {
        icon: <CheckCircle2 size={18} className="text-green-600" />,
        label: 'Completed',
        color: 'bg-green-50 border-green-200',
        textColor: 'text-green-700',
      };
    } else {
      return {
        icon: <Calendar size={18} className="text-gray-400" />,
        label: 'Scheduled',
        color: 'bg-white border-gray-200',
        textColor: 'text-gray-600',
      };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-green-700" size={28} />
            Payment Tracker - {tuteeName}
          </h2>
          <p className="text-gray-500 mt-1">
            {format(parseISO(currentMonth + '-01'), 'MMMM yyyy')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl font-light"
        >
          ×
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex gap-3">
        <input
          type="month"
          value={currentMonth}
          onChange={(e) => setCurrentMonth(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Summary */}
      {record && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Total Due</p>
            <p className="text-2xl font-bold text-blue-900">{formatCurrency(record.totalDue)}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-700 uppercase mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-green-900">{formatCurrency(record.totalPaid)}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Balance</p>
            <p className="text-2xl font-bold text-orange-900">{formatCurrency(record.totalBalance)}</p>
          </div>
        </div>
      )}

      {/* Days Grid */}
      {record && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {record.dayPayments.map(day => {
            const status = getDayStatus(day);

            return (
              <div
                key={day.date}
                className={`border-2 rounded-xl p-4 transition-all ${status.color}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={day.status === 'paid'}
                      onChange={() => toggleDay(day.date)}
                      className="w-5 h-5 text-green-700 rounded focus:ring-green-500 cursor-pointer"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">
                        {format(parseISO(day.date), 'EEE, MMM dd')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {status.icon}
                        <span className={`text-sm font-medium ${status.textColor}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Form */}
      {record && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-lg text-gray-900">Record Payment</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount (₱)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter amount"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="PayMaya">PayMaya</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={2}
              placeholder="Add any notes about this payment..."
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-green-200">
            <div>
              <p className="text-sm text-gray-600">Remaining Balance</p>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(record.totalBalance)}</p>
            </div>
            <button
              onClick={handlePayment}
              className="bg-green-700 text-white px-8 py-3 rounded-xl hover:bg-green-800 shadow-lg shadow-green-700/20 transition-all font-semibold"
            >
              Record Payment
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <Receipt
          receipt={receiptData}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
};
