export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const parseCurrency = (value: string): number => {
  const cleaned = value.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
};
