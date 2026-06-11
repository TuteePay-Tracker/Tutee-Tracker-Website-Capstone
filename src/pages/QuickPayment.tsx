import { QuickPaymentForm } from '../components/payment/QuickPaymentForm';
import { DollarSign, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

export const QuickPayment = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <DollarSign className="text-green-700" size={36} />
            Quick Payment Entry
          </h1>
          <p className="text-gray-500 mt-2">Record student payments quickly and easily</p>
        </div>
      </div>

      <QuickPaymentForm onSuccess={() => {
        // Optional: navigate somewhere after success
      }} />

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Tips:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Auto-calculate will automatically compute payment based on sessions and rate</li>
          <li>• You can manually override the amount if needed (uncheck auto-calculate)</li>
          <li>• Payment date cannot be in the future</li>
          <li>• Student's balance will be updated automatically after recording payment</li>
        </ul>
      </div>
    </div>
  );
};
