import { useState, useEffect } from 'react';
import { PaymentRecord, ReceiptData } from '@/features/attendance/types/dayPayment';
import { dayPaymentService } from '@/features/attendance/services/dayPaymentService';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { format, parseISO } from 'date-fns';
import { Receipt } from '@/features/payments/components/Receipt';
import { Calendar, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DayPaymentTrackerProps {
  tuteeId: string;
  tuteeName: string;
  onClose: () => void;
}

export const DayPaymentTracker = ({ tuteeId, tuteeName, onClose }: DayPaymentTrackerProps) => {
  const [allRecords, setAllRecords] = useState<PaymentRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [monthToAdd, setMonthToAdd] = useState(format(new Date(), 'yyyy-MM'));
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  // Subscribe to real-time updates for all records of this tutee
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    setIsLoading(true);

    unsubscribe = dayPaymentService.subscribeToRecordsByTutee(tuteeId, (records) => {
      setAllRecords(records);
      
      const currentMonthStr = format(new Date(), 'yyyy-MM');
      const hasCurrentMonth = records.some(r => r.month === currentMonthStr);
      
      if (records.length === 0 || !hasCurrentMonth) {
        // Auto-create current month record if it doesn't exist
        dayPaymentService.getMonthlyRecord(tuteeId, currentMonthStr)
          .catch(err => console.error("Error auto-creating month:", err));
      }
      setIsLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tuteeId]);

  // Sync the form pre-fill and selected month validity when records update
  useEffect(() => {
    if (allRecords.length > 0) {
      const activeRecord = allRecords.find(r => r.month === selectedMonth) || allRecords[0];
      if (activeRecord && activeRecord.month !== selectedMonth) {
        setSelectedMonth(activeRecord.month);
      }
      if (activeRecord) {
        setPaymentAmount(activeRecord.totalBalance.toString());
      }
    }
  }, [selectedMonth, allRecords]);

  const toggleMonthPayment = async (month: string) => {
    try {
      await dayPaymentService.toggleMonthPaymentStatus(tuteeId, month);
      toast.success('Payment status updated');
    } catch (error) {
      console.error('Error toggling month payment status:', error);
      toast.error('Failed to update payment status');
    }
  };

  const handleAddMonth = async () => {
    try {
      setIsLoading(true);
      await dayPaymentService.getMonthlyRecord(tuteeId, monthToAdd);
      setSelectedMonth(monthToAdd);
      toast.success(`Billing for ${format(parseISO(monthToAdd + '-01'), 'MMMM yyyy')} initialized`);
      setIsLoading(false);
    } catch (error) {
      console.error('Error adding month billing:', error);
      toast.error('Failed to initialize billing month');
      setIsLoading(false);
    }
  };

  const handleRemoveMonth = async (monthRecord: PaymentRecord) => {
    const monthLabel = format(parseISO(monthRecord.month + '-01'), 'MMMM yyyy');
    const confirmed = window.confirm(
      `Remove billing for ${monthLabel}? This will delete the monthly record and related payments for this month.`
    );

    if (!confirmed) return;

    try {
      setIsLoading(true);
      await dayPaymentService.removeMonthlyRecord(tuteeId, monthRecord.month);
      setSelectedMonth(format(new Date(), 'yyyy-MM'));
      toast.success(`Billing for ${monthLabel} removed`);
    } catch (error) {
      console.error('Error removing month billing:', error);
      toast.error('Failed to remove billing month');
    } finally {
      setIsLoading(false);
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
        selectedMonth,
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
      setNotes('');
      toast.success('Payment recorded successfully!');
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const record = allRecords.find(r => r.month === selectedMonth) || allRecords[0] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-green-700" size={28} />
            Payment Tracker - {tuteeName}
          </h2>
          {record && (
            <p className="text-gray-500 mt-1">
              Active Month: {format(parseISO(record.month + '-01'), 'MMMM yyyy')}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl font-light"
        >
          ×
        </button>
      </div>

      {/* Month Selector / Generator */}
      <div className="flex items-center gap-3 bg-gray-50 p-4 border border-gray-200 rounded-xl">
        <div className="flex-1">
          <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
            Initialize New Month Billing
          </label>
          <div className="flex gap-2">
            <input
              type="month"
              value={monthToAdd}
              onChange={(e) => setMonthToAdd(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-semibold flex-1"
            />
            <button
              onClick={handleAddMonth}
              className="bg-green-700 text-white px-4 py-2 rounded-xl hover:bg-green-800 transition-colors text-sm font-bold shadow-sm"
            >
              + Add Month
            </button>
          </div>
        </div>
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

      {/* Months Checklist */}
      {allRecords.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {allRecords.map(monthRecord => {
            const isSelected = monthRecord.month === selectedMonth;
            const isPaid = monthRecord.totalPaid > 0 && monthRecord.totalBalance <= 0;
            const isPartial = monthRecord.totalPaid > 0 && monthRecord.totalBalance > 0;
            
            let colorClass = 'bg-white border-gray-200';
            let textColorClass = 'text-gray-600';
            let statusLabel = 'Unpaid';
            let icon = <AlertCircle size={18} className="text-gray-400" />;

            if (isPaid) {
              colorClass = 'bg-green-50 border-green-200';
              textColorClass = 'text-green-700';
              statusLabel = 'Fully Paid';
              icon = <CheckCircle2 size={18} className="text-green-600" />;
            } else if (isPartial) {
              colorClass = 'bg-orange-50 border-orange-200';
              textColorClass = 'text-orange-700';
              statusLabel = 'Partial Payment';
              icon = <AlertCircle size={18} className="text-orange-600" />;
            }

            if (isSelected) {
              colorClass = `${colorClass.split(' ')[0]} border-green-600 ring-2 ring-green-600/20`;
            }

            return (
              <div
                key={monthRecord.id}
                onClick={() => setSelectedMonth(monthRecord.month)}
                className={`border-2 rounded-xl p-4 transition-all cursor-pointer hover:shadow-sm ${colorClass}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleMonthPayment(monthRecord.month);
                      }}
                      className="w-5 h-5 text-green-700 rounded focus:ring-green-500 cursor-pointer animate-none"
                    />
                    <div>
                      <p className="font-bold text-gray-900 text-base">
                        {format(parseISO(monthRecord.month + '-01'), 'MMMM yyyy')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {icon}
                        <span className={`text-sm font-semibold ${textColorClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <p className="text-xs text-gray-400 font-medium">Remaining Balance</p>
                    <p className="font-bold text-gray-800 text-lg">{formatCurrency(monthRecord.totalBalance)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMonth(monthRecord);
                    }}
                    className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    title="Remove month"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Form */}
      {record && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-lg text-gray-900">
            Record Payment for {format(parseISO(record.month + '-01'), 'MMMM yyyy')}
          </h3>

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
