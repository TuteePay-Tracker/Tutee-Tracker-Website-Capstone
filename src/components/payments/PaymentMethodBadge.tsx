import { PaymentMethod } from '../../types/payment';

interface PaymentMethodBadgeProps {
  method: PaymentMethod;
}

export const PaymentMethodBadge = ({ method }: PaymentMethodBadgeProps) => {
  const getColor = () => {
    switch (method) {
      case 'Cash':
        return 'bg-green-100 text-green-800';
      case 'GCash':
        return 'bg-blue-100 text-blue-800';
      case 'Bank Transfer':
        return 'bg-purple-100 text-purple-800';
      case 'PayMaya':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${getColor()}`}>
      {method}
    </span>
  );
};
