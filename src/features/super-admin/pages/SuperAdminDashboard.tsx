import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  BarChart3,
  GraduationCap,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { superAdminService } from '../services/superAdminService';
import type {
  ActivityLogEntry,
  PlatformStats,
  SuperAdminTutorSummary,
} from '../types/superAdmin';
import { StatCard } from '../components/StatCard';
import { TutorTable } from '../components/TutorTable';
import { ActivityTable } from '../components/ActivityTable';
import { CreateTutorModal } from '../components/CreateTutorModal';

export const SuperAdminDashboard = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tutors, setTutors] = useState<SuperAdminTutorSummary[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextStats, nextTutors, nextActivities] = await Promise.all([
        superAdminService.getPlatformStats(),
        superAdminService.getTutorSummaries(),
        superAdminService.getActivityLogs({ limit: 50 }),
      ]);

      setStats(nextStats);
      setTutors(nextTutors);
      setActivities(nextActivities);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load platform data.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const averageTutees =
    stats && stats.totalTutors > 0
      ? (stats.totalTutees / stats.totalTutors).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Platform Overview</h1>
            <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
              Super Admin
            </span>
          </div>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Monitor and manage tutors, tutees, and parents across the platform
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
            onClick={loadData}
            disabled={isLoading}
            className="flex-1 sm:flex-none text-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Registered Tutors"
          value={stats?.totalTutors ?? '—'}
          icon={Users}
          accent="blue"
        />
        <StatCard
          label="Active Tutors"
          value={stats?.activeTutors ?? '—'}
          icon={UserCheck}
          accent="emerald"
        />
        <StatCard
          label="Total Tutees"
          value={stats?.totalTutees ?? '—'}
          icon={GraduationCap}
          accent="violet"
        />
        <StatCard
          label="Registered Parents"
          value={stats?.totalParents ?? '—'}
          icon={UsersRound}
          accent="amber"
        />
        <StatCard
          label="System Activities"
          value={stats?.totalActivities ?? '—'}
          icon={Activity}
          accent="rose"
        />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Tutor Monitoring
            </h3>
            <p className="text-xs text-gray-500">
              Account status, tutee counts, and latest recorded activity.
            </p>
          </div>
          <Link
            to="/super-admin/tutors"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View all tutors →
          </Link>
        </div>
        <TutorTable
          tutors={tutors}
          isLoading={isLoading}
          error={error}
          onRefresh={loadData}
          onTutorChanged={loadData}
          pageSize={5}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Recent Platform Activity
              </h3>
              <p className="text-xs text-gray-500">
                Latest actions recorded across all tutor accounts.
              </p>
            </div>
            <Link
              to="/super-admin/activities"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              View all activity →
            </Link>
          </div>
          <ActivityTable
            logs={activities}
            isLoading={isLoading}
            error={error}
            onRefresh={loadData}
            pageSize={5}
          />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Report Summary
              </h3>
              <p className="text-xs text-gray-500">Platform-wide totals</p>
            </div>
          </div>

          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <dt className="text-sm text-gray-500">Average tutees / tutor</dt>
              <dd className="text-sm font-bold text-gray-900">{averageTutees}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <dt className="text-sm text-gray-500">Parent accounts</dt>
              <dd className="text-sm font-bold text-gray-900">
                {stats?.totalParents ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <dt className="text-sm text-gray-500">Recorded activities</dt>
              <dd className="text-sm font-bold text-gray-900">
                {stats?.totalActivities ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-500">Tutor accounts</dt>
              <dd className="text-sm font-bold text-gray-900">
                {stats?.totalTutors ?? '—'}
              </dd>
            </div>
          </dl>

          <Link
            to="/super-admin/reports"
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Open reports
          </Link>
        </section>
      </div>

      <CreateTutorModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
