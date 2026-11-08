export const StatusBadge = ({ status }: { status?: string }) => {
  const normalized = (status || 'active').toLowerCase();
  const styles =
    normalized === 'active'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalized === 'suspended'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-gray-200 bg-gray-100 text-gray-600';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${styles}`}
    >
      {normalized}
    </span>
  );
};
