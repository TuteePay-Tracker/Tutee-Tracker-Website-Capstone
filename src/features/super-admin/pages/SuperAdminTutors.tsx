import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, UserPlus } from 'lucide-react';
import { superAdminService } from '../services/superAdminService';
import type { SuperAdminTutorSummary } from '../types/superAdmin';
import { TutorTable } from '../components/TutorTable';
import { CreateTutorModal } from '../components/CreateTutorModal';

export const SuperAdminTutors = () => {
  const [tutors, setTutors] = useState<SuperAdminTutorSummary[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tutor Monitoring</h1>
            <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
              Super Admin
            </span>
          </div>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Review tutor activity, deactivate or reactivate accounts, and permanently
            delete tutor data.
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 sm:flex-none text-center bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <UserPlus size={16} />
            Create Tutor Account
          </button>
          <button
            type="button"
            onClick={loadTutors}
            disabled={isLoading}
            className="flex-1 sm:flex-none text-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
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
          onTutorChanged={loadTutors}
          emptyMessage={
            search.trim()
              ? 'No tutors match your search.'
              : 'No tutor accounts have been registered yet.'
          }
        />
      </section>

      <CreateTutorModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadTutors}
      />
    </div>
  );
};
