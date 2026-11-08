import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  GraduationCap,
  RefreshCw,
  UserCheck,
  Users,
  UsersRound,
} from 'lucide-react';
import { superAdminService } from '../services/superAdminService';
import type {
  PlatformStats,
  SuperAdminTutorSummary,
} from '../types/superAdmin';
import { StatCard } from '../components/StatCard';
import { TutorTable } from '../components/TutorTable';

const shortName = (name: string) =>
  name.length > 14 ? `${name.slice(0, 13)}…` : name;

export const SuperAdminReports = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tutors, setTutors] = useState<SuperAdminTutorSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextStats, nextTutors] = await Promise.all([
        superAdminService.getPlatformStats(),
        superAdminService.getTutorSummaries(),
      ]);
      setStats(nextStats);
      setTutors(nextTutors);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load platform reports.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const chartData = useMemo(
    () =>
      [...tutors]
        .sort((a, b) => b.totalTutees - a.totalTutees)
        .slice(0, 10)
        .map((tutor) => ({
          name: shortName(tutor.name),
          tutees: tutor.totalTutees,
          parents: tutor.totalParents,
        })),
    [tutors]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Platform Reports</h2>
          <p className="mt-1 text-sm text-gray-500">
            Aggregate usage and engagement summaries from real account data.
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Tutors"
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
          label="Total Parents"
          value={stats?.totalParents ?? '—'}
          icon={UsersRound}
          accent="amber"
        />
        <StatCard
          label="Total Activities"
          value={stats?.totalActivities ?? '—'}
          icon={Activity}
          accent="rose"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-gray-900">
            Tutees per Tutor
          </h3>
          <p className="mb-4 text-xs text-gray-500">
            Top 10 tutors by number of tutees.
          </p>
          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="tutees"
                    name="Tutees"
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No tutor data available.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-gray-900">
            Parents per Tutor
          </h3>
          <p className="mb-4 text-xs text-gray-500">
            Top 10 tutors by number of linked parent accounts.
          </p>
          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="parents"
                    name="Parents"
                    fill="#7c3aed"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No tutor data available.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">
            Tutor Engagement Summary
          </h3>
          <p className="text-xs text-gray-500">
            Attendance, payment, and academic details are available on each
            tutor’s monitoring page.
          </p>
        </div>
        <TutorTable
          tutors={tutors}
          isLoading={isLoading}
          error={error}
          onRefresh={loadData}
        />
      </section>
    </div>
  );
};
