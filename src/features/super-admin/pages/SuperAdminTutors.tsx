import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { superAdminService } from '../services/superAdminService';
import type { SuperAdminTutorSummary } from '../types/superAdmin';
import { TutorTable } from '../components/TutorTable';

export const SuperAdminTutors = () => {
  const [tutors, setTutors] = useState<SuperAdminTutorSummary[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTutors = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setTutors(await superAdminService.getTutorSummaries());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load tutor accounts.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTutors();
  }, []);

  const filteredTutors = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tutors;

    return tutors.filter(
      (tutor) =>
        tutor.name.toLowerCase().includes(term) ||
        tutor.email.toLowerCase().includes(term)
    );
  }, [search, tutors]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tutor Monitoring</h2>
          <p className="mt-1 text-sm text-gray-500">
            Review every tutor account and open a read-only monitoring detail
            page.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTutors}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by tutor name or email"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">
            {filteredTutors.length} tutor
            {filteredTutors.length === 1 ? '' : 's'}
          </h3>
          <p className="text-xs text-gray-500">
            Tutee and parent counts are scoped to each tutor.
          </p>
        </div>
        <TutorTable
          tutors={filteredTutors}
          isLoading={isLoading}
          error={error}
          onRefresh={loadTutors}
          emptyMessage={
            search.trim()
              ? 'No tutors match your search.'
              : 'No tutor accounts have been registered yet.'
          }
        />
      </section>
    </div>
  );
};
