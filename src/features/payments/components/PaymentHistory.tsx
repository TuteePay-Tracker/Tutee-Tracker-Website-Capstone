import { useState } from 'react';
import { Payment } from '@/features/payments/types/payment';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDate } from '@/shared/utils/formatDate';
import { PaymentMethodBadge } from '@/features/payments/components/PaymentMethodBadge';
import { Trash2, CheckCircle2, AlertCircle, Clock, XCircle, Eye, X } from 'lucide-react';
import { Receipt } from '@/features/payments/components/Receipt';
import { PaymentStatus, ReceiptData } from '@/features/attendance/types/dayPayment';

interface PaymentHistoryProps {
  payments: Payment[];
  onDelete?: (id: string) => void;
  showTuteeName?: boolean;
  tuteeRate?: number;
}

export const PaymentHistory = ({ payments, onDelete, showTuteeName = true, tuteeRate }: PaymentHistoryProps) => {
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No payment records found
      </div>
    );
  }

  const handleViewPayment = (payment: Payment) => {
    // If it has a proofUrl (image) and is pending/rejected, show the image viewer
    if (payment.proofUrl && (payment.status === 'pending' || payment.status === 'rejected')) {
      setViewingProofUrl(payment.proofUrl);
      return;
    }

    const coverage = payment.sessionsCovered > 0
      ? payment.sessionsCovered
      : (tuteeRate && tuteeRate > 0 ? 1 : 0);
    const amountDue = coverage > 0 && tuteeRate
      ? coverage * tuteeRate
      : payment.amount;
    const receiptStatus: PaymentStatus = payment.amount >= amountDue ? 'paid' : 'partial';

    // Otherwise show the official generated receipt
    const receiptData: ReceiptData = {
      receiptNumber: payment.id?.slice(-8).toUpperCase() || 'N/A',
      tuteeId: payment.tuteeId,
      tuteeName: payment.tuteeName,
      paymentDate: payment.paymentDate,
      daysPaid: [{
        date: payment.paymentDate,
        amountDue,
        amountPaid: payment.amount,
        status: receiptStatus,
      }],
      totalAmount: payment.amount,
      paymentMethod: payment.paymentMethod,
      notes: payment.notes,
    };
    setSelectedReceipt(receiptData);
  };

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer group relative active:scale-[0.99]"
          onClick={() => handleViewPayment(payment)}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              {showTuteeName && (
                <p className="font-medium">{payment.tuteeName}</p>
              )}
              <p className="text-sm text-gray-600">{formatDate(payment.paymentDate)}</p>
            </div>
            <div className="text-right flex items-start gap-3">
              <div className="flex flex-col items-end">
                <p className="text-lg font-semibold">{formatCurrency(payment.amount)}</p>
                {(payment.sessionsCovered > 0 || (tuteeRate && tuteeRate > 0)) && (
                  <p className="text-sm text-gray-600">
                    {(() => {
                      const coverage = payment.sessionsCovered > 0
                        ? payment.sessionsCovered
                        : (tuteeRate && tuteeRate > 0 ? payment.amount / tuteeRate : 0);

                      if (coverage === 0) return null;
                      return coverage % 1 === 0
                        ? coverage
                        : Number(coverage).toFixed(2);
                    })()}
                    {' '}month(s)
                  </p>
                )}
              </div>
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent opening receipt when deleting
                    onDelete(payment.id);
                  }}
                  className="text-red-400 hover:text-red-600 p-1 transition-colors"
                  title="Delete payment"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <div className="text-gray-300 group-hover:text-green-600 transition-colors ml-1">
                <Eye size={18} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PaymentMethodBadge method={payment.paymentMethod} />
            {payment.status === 'pending' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200">
                <Clock size={10} /> Pending
              </span>
            )}
            {payment.status === 'rejected' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded-full border border-red-200">
                <XCircle size={10} /> Rejected
              </span>
            )}
            {(payment.status === 'verified' || !payment.status) && (
              (() => {
                const coverage = payment.sessionsCovered > 0
                  ? payment.sessionsCovered
                  : (tuteeRate && tuteeRate > 0 ? payment.amount / tuteeRate : 0);

                if (coverage === 0 && payment.amount > 0) return null;

                return coverage >= 0.99 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-200">
                    <CheckCircle2 size={10} /> Full Payment
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-full border border-orange-200">
                    <AlertCircle size={10} /> Partial Payment
                  </span>
                );
              })()
            )}
            {payment.notes && (
              <span className="text-sm text-gray-600">• {payment.notes}</span>
            )}
          </div>
        </div>
      ))}

      {selectedReceipt && (
        <Receipt
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {viewingProofUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="relative max-w-2xl w-full bg-white rounded-2xl p-2 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setViewingProofUrl(null)}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>
            <div className="max-h-[85vh] overflow-y-auto rounded-xl">
              <img
                src={viewingProofUrl}
                alt="Proof of Payment"
                className="w-full h-auto block"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
