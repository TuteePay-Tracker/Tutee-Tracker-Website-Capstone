import { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { formatDate, formatDateTime } from '@/shared/utils/formatDate';
import { StatusBadge } from './StatusBadge';
import { SuperAdminPagination } from './SuperAdminPagination';
import { TutorAccountActions } from './TutorAccountActions';
import type { SuperAdminTutorSummary } from '../types/superAdmin';

interface TutorTableProps {
  tutors: SuperAdminTutorSummary[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onTutorChanged?: () => void;
  emptyMessage?: string;
  pageSize?: number;
  showPagination?: boolean;
}

export const TutorTable = ({
  tutors,
  isLoading = false,
  error = null,
  onRefresh,
  onTutorChanged,
  emptyMessage = 'No tutor accounts have been registered yet.',
  pageSize = 5,
  showPagination = true,
}: TutorTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const handleTutorChanged = onTutorChanged ?? onRefresh;

  // If tutors array changes or search reduces length, adjust page
  const totalPages = Math.max(1, Math.ceil(tutors.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedTutors = useMemo(() => {
    if (!showPagination) return tutors;
    const start = (activePage - 1) * pageSize;
    return tutors.slice(start, start + pageSize);
  }, [tutors, activePage, pageSize, showPagination]);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-gray-500">Loading tutor accounts…</div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 p-6 text-sm text-red-600">
        <span>{error}</span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw size={14} /> Retry
          </button>
        )}
      </div>
    );
  }

  if (tutors.length === 0) {
    return <div className="p-6 text-sm text-gray-500">{emptyMessage}</div>;
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">Tutor</TableHead>
            <TableHead className="px-4">Registration</TableHead>
            <TableHead className="px-4">Status</TableHead>
            <TableHead className="px-4 text-center">Tutees</TableHead>
            <TableHead className="px-4 text-center">Parents</TableHead>
            <TableHead className="px-4">Recent Activity</TableHead>
            <TableHead className="px-4 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTutors.map((tutor) => (
            <TableRow key={tutor.id}>
              <TableCell className="px-4 py-3">
                <div className="font-semibold text-gray-900">{tutor.name}</div>
                <div className="text-xs text-gray-500">{tutor.email}</div>
              </TableCell>
              <TableCell className="px-4 py-3 text-gray-600">
                {tutor.createdAt ? formatDate(tutor.createdAt) : '—'}
              </TableCell>
              <TableCell className="px-4 py-3">
                <StatusBadge status={tutor.status} />
              </TableCell>
              <TableCell className="px-4 py-3 text-center font-semibold text-gray-900">
                {tutor.totalTutees}
              </TableCell>
              <TableCell className="px-4 py-3 text-center font-semibold text-gray-900">
                {tutor.totalParents}
              </TableCell>
              <TableCell className="max-w-[280px] px-4 py-3 text-gray-600">
                {tutor.lastActivityAt ? (
                  <div>
                    <div className="text-xs font-medium text-gray-800">
                      {tutor.lastActivityAction || 'Activity recorded'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDateTime(tutor.lastActivityAt)}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">No activity yet</span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3">
                <TutorAccountActions
                  tutor={tutor}
                  onChanged={handleTutorChanged}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {showPagination && (
        <SuperAdminPagination
          currentPage={activePage}
          totalItems={tutors.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemLabel="tutors"
        />
      )}
    </div>
  );
};
