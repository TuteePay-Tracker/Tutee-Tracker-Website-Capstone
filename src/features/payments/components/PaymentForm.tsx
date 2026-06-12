import { useState } from 'react';
import { PaymentFormData, PaymentMethod } from '@/features/payments/types/payment';
import { Tutee } from '@/features/tutees/types/tutee';

interface PaymentFormProps {
  tutees: Tutee[];
  onSubmit: (payment: Omit<PaymentFormData, 'tuteeName'> & { tuteeName: string }) => void;
  onCancel: () => void;
}

export const PaymentForm = ({ tutees, onSubmit, onCancel }: PaymentFormProps) => {
  const [formData, setFormData] = useState<PaymentFormData>({
    tuteeId: '',
    amount: 0,
    sessionsCovered: 0,
    paymentMethod: 'Cash',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedTutee = tutees.find(t => t.id === formData.tuteeId);
    if (!selectedTutee) return;

    onSubmit({
      ...formData,
      tuteeName: `${selectedTutee.firstName} ${selectedTutee.surname}`,
    });
  };

  const selectedTutee = tutees.find(t => t.id === formData.tuteeId);
  const suggestedAmount = selectedTutee
    ? formData.sessionsCovered * selectedTutee.ratePerSession
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm mb-2">Student</label>
        <select
          value={formData.tuteeId}
          onChange={(e) => setFormData({ ...formData, tuteeId: e.target.value })}
          className="w-full p-2 border rounded-lg"
          required
        >
          <option value="">Select a student</option>
          {tutees.map((tutee) => (
            <option key={tutee.id} value={tutee.id}>
              {tutee.firstName} {tutee.surname} - {tutee.subject}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm mb-2">Months Covered</label>
        <input
          type="number"
          min="1"
          value={formData.sessionsCovered || ''}
          onChange={(e) => setFormData({ ...formData, sessionsCovered: parseInt(e.target.value) || 0 })}
          className="w-full p-2 border rounded-lg"
          required
        />
      </div>

      {selectedTutee && formData.sessionsCovered > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            Suggested amount: ₱{suggestedAmount.toFixed(2)}
            <span className="text-xs ml-2">
              ({formData.sessionsCovered} month(s) × ₱{selectedTutee.ratePerSession}/month)
            </span>
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm mb-2">Amount Paid</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={formData.amount || ''}
          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
          className="w-full p-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-2">Payment Method</label>
        <select
          value={formData.paymentMethod}
          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
          className="w-full p-2 border rounded-lg"
        >
          <option value="Cash">Cash</option>
          <option value="GCash">GCash</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="PayMaya">PayMaya</option>
        </select>
      </div>

      <div>
        <label className="block text-sm mb-2">Payment Date</label>
        <input
          type="date"
          value={formData.paymentDate}
          onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
          className="w-full p-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-2">Notes (Optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full p-2 border rounded-lg"
          rows={3}
          placeholder="Add any additional notes..."
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
        >
          Add Payment
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
