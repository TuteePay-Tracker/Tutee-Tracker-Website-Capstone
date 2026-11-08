import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SuperAdminPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export const SuperAdminPagination = ({
  currentPage,
  totalItems,
  pageSize = 5,
  onPageChange,
  itemLabel = 'items',
}: SuperAdminPaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipses
  const pagesToShow = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (page) =>
      page === 1 ||
      page === totalPages ||
      Math.abs(page - currentPage) <= 1
  );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 bg-white px-5 py-3.5">
      <p className="text-xs font-medium text-gray-500">
        Showing <span className="font-semibold text-gray-900">{startItem}</span> to{' '}
        <span className="font-semibold text-gray-900">{endItem}</span> of{' '}
        <span className="font-semibold text-gray-900">{totalItems}</span> {itemLabel}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1 px-1">
            {pagesToShow.map((page, idx, array) => {
              const prev = array[idx - 1];
              return (
                <span key={page} className="flex items-center">
                  {prev && page - prev > 1 && (
                    <span className="px-1 text-xs font-semibold text-gray-400 select-none">
                      …
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onPageChange(page)}
                    className={`min-w-[28px] h-7 rounded-lg px-2 text-xs font-bold transition ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                </span>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

