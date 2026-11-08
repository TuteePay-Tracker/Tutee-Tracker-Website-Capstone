import { useEffect, useMemo, useState } from 'react';
import { Filter, RefreshCw, X } from 'lucide-react';
import { superAdminService } from '../services/superAdminService';
import type {
  ActivityLogEntry,
  TutorAccount,
} from '../types/superAdmin';
import { ActivityTable } from '../components/ActivityTable';

interface Filters {
  tutorId: string;
  actionType: string;
  dateFrom: string;
  dateTo: string;
}

const emptyFilters: Filters = {
  tutorId: '',
  actionType: '',
  dateFrom: '',
  dateTo: '',
};

export const SuperAdminActivityLogs = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [tutors, setTutors] = useState<TutorAccount[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextLogs, nextTutors] = await Promise.all([
        superAdminService.getActivityLogs({ limit: 500 }),
        superAdminService.getAllTutors(),
      ]);
      setLogs(nextLogs);
      setTutors(nextTutors);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load activity logs.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const actionTypes = useMemo(
    () =>
      Array.from(new Set(logs.map((log) => log.actionType).filter(Boolean))).sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const to = filters.dateTo ? new Date(filters.dateTo) : null;

    if (to) {
      to.setHours(23, 59, 59, 999);
    }

    return logs.filter((log) => {
      if (filters.tutorId && log.tutorId !== filters.tutorId) return false;
      if (filters.actionType && log.actionType !== filters.actionType) {
        return false;
      }
      if (from && (!log.timestamp || log.timestamp < from)) return false;
      if (to && (!log.timestamp || log.timestamp > to)) return false;
      return true;
    });
  }, [filters, logs]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Activity Logs</h2>
          <p className="mt-1 text-sm text-gray-500">
            Audit trail of tutor and parent actions across the platform.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Filter size={16} /> Filters
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700"
            >
              <X size={14} /> Clear filters
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-gray-600">
            Tutor
            <select
              value={filters.tutorId}
              onChange={(event) => updateFilter('tutorId', event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All tutors</option>
              {tutors.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-gray-600">
            Action type
            <select
              value={filters.actionType}
              onChange={(event) =>
                updateFilter('actionType', event.target.value)
              }
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All actions</option>
              {actionTypes.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {actionType}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-gray-600">
            From
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="text-xs font-semibold text-gray-600">
            To
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">
            {filteredLogs.length} activit
            {filteredLogs.length === 1 ? 'y' : 'ies'}
          </h3>
          <p className="text-xs text-gray-500">
            Showing the most recent 500 records. Use filters to narrow the list.
          </p>
        </div>
        <ActivityTable
          logs={filteredLogs}
          isLoading={isLoading}
          error={error}
          onRefresh={loadData}
          emptyMessage={
            hasActiveFilters
              ? 'No activity matches the selected filters.'
              : 'No activity has been recorded yet.'
          }
        />
      </section>
    </div>
  );
};
