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
import { formatDateTime } from '@/shared/utils/formatDate';
import { SuperAdminPagination } from './SuperAdminPagination';
import type { ActivityLogEntry } from '../types/superAdmin';

interface ActivityTableProps {
  logs: ActivityLogEntry[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  showTutor?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  showPagination?: boolean;
}

export const ActivityTable = ({
  logs,
  isLoading = false,
  error = null,
  onRefresh,
  showTutor = true,
  emptyMessage = 'No activity has been recorded yet.',
  pageSize = 5,
  showPagination = true,
}: ActivityTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedLogs = useMemo(() => {
    if (!showPagination) return logs;
    const start = (activePage - 1) * pageSize;
    return logs.slice(start, start + pageSize);
  }, [logs, activePage, pageSize, showPagination]);

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading activity…</div>;
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

  if (logs.length === 0) {
    return <div className="p-6 text-sm text-gray-500">{emptyMessage}</div>;
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">Date / Time</TableHead>
            {showTutor && <TableHead className="px-4">Tutor</TableHead>}
            <TableHead className="px-4">User</TableHead>
            <TableHead className="px-4">Activity</TableHead>
            <TableHead className="px-4">Module</TableHead>
            <TableHead className="px-4">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedLogs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="px-4 py-3 text-xs text-gray-600">
                {log.timestamp ? formatDateTime(log.timestamp) : '—'}
              </TableCell>
              {showTutor && (
                <TableCell className="px-4 py-3">
                  <div className="font-medium text-gray-900">{log.tutorName}</div>
                  <div className="text-xs text-gray-500">{log.tutorId}</div>
                </TableCell>
              )}
              <TableCell className="px-4 py-3">
                <div className="font-medium text-gray-900">{log.userName || '—'}</div>
                <div className="text-xs capitalize text-gray-500">{log.userRole || '—'}</div>
              </TableCell>
              <TableCell className="px-4 py-3">
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {log.actionType}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3 text-xs text-gray-600">
                {log.module || '—'}
              </TableCell>
              <TableCell className="max-w-[360px] whitespace-normal px-4 py-3 text-xs text-gray-600">
                {log.description || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {showPagination && (
        <SuperAdminPagination
          currentPage={activePage}
          totalItems={logs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemLabel="activities"
        />
      )}
    </div>
  );
};
