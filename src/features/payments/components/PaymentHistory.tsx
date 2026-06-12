import { Payment } from '@/features/payments/types/payment';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDate } from '@/shared/utils/formatDate';
import { PaymentMethodBadge } from '@/features/payments/components/PaymentMethodBadge';
import { Trash2 } from 'lucide-react';

interface PaymentHistoryProps {
  payments: Payment[];
  onDelete?: (id: string) => void;
  showTuteeName?: boolean;
}

export const PaymentHistory = ({ payments, onDelete, showTuteeName = true }: PaymentHistoryProps) => {
  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No payment records found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <div key={payment.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div>
              {showTuteeName && (
                <p className="font-medium">{payment.tuteeName}</p>
              )}
              <p className="text-sm text-gray-600">{formatDate(payment.paymentDate)}</p>
            </div>
            <div className="text-right flex items-start gap-3">
              <div>
                <p className="text-lg font-semibold">{formatCurrency(payment.amount)}</p>
                <p className="text-sm text-gray-600">{payment.sessionsCovered} month(s)</p>
              </div>
              {onDelete && (
                <button
                  onClick={() => onDelete(payment.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Delete payment"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PaymentMethodBadge method={payment.paymentMethod} />
            {payment.notes && (
              <span className="text-sm text-gray-600">• {payment.notes}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
