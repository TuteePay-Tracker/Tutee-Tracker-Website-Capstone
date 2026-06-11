import { useRef } from 'react';
import { ReceiptData } from '../../types/dayPayment';
import { formatCurrency } from '../../utils/formatCurrency';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { Download, CheckCircle2 } from 'lucide-react';

interface ReceiptProps {
  receipt: ReceiptData;
  onClose: () => void;
}

export const Receipt = ({ receipt, onClose }: ReceiptProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;

    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `receipt_${receipt.receiptNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating receipt:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="text-green-700" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Payment Receipt</h2>
              <p className="text-sm text-gray-500">Receipt #{receipt.receiptNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light"
          >
            ×
          </button>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-8 bg-white">
          <div className="border-2 border-gray-200 rounded-xl p-8">
            {/* Header */}
            <div className="text-center mb-8 pb-6 border-b-2 border-gray-200">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">TuteePay Tracker</h1>
              <p className="text-gray-600 text-sm">Payment Receipt</p>
              <p className="text-xs text-gray-500 mt-2">Receipt #: {receipt.receiptNumber}</p>
            </div>

            {/* Student & Payment Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Student Name</p>
                <p className="text-lg font-semibold text-gray-900">{receipt.tuteeName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {format(new Date(receipt.paymentDate), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>

            {/* Payment Details */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Payment Details</p>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                {receipt.daysPaid && receipt.daysPaid.length > 0 ? (
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-gray-700 uppercase">Date</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-700 uppercase">Amount Due</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-700 uppercase">Amount Paid</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-700 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {receipt.daysPaid.map((day, index) => (
                        <tr key={index}>
                          <td className="p-3 text-sm font-medium text-gray-900">
                            {format(new Date(day.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="p-3 text-sm text-right text-gray-600">
                            {formatCurrency(day.amountDue)}
                          </td>
                          <td className="p-3 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(day.amountPaid)}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                              day.status === 'paid' ? 'bg-green-100 text-green-700' :
                              day.status === 'partial' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {day.status === 'paid' ? 'Full' : day.status === 'partial' ? 'Partial' : 'Unpaid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-sm text-gray-700 font-medium">
                    Monthly Tuition Payment
                  </div>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="border-t-2 border-gray-200 pt-4 mb-6">
              <div className="flex justify-between items-center">
                <p className="text-lg font-semibold text-gray-900">Total Amount Paid</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(receipt.totalAmount)}</p>
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Method</p>
              <p className="text-sm text-gray-900">{receipt.paymentMethod}</p>
            </div>

            {/* Notes */}
            {receipt.notes && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{receipt.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">Thank you for your payment!</p>
              <p className="text-xs text-gray-400 mt-1">
                Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={downloadReceipt}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-green-700 text-white px-6 py-3 rounded-xl hover:bg-green-800 shadow-lg shadow-green-700/20 transition-all font-medium"
          >
            <Download size={20} />
            Download Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-all font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
