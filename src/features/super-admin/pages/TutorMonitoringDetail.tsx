import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  CalendarCheck,
  GraduationCap,
  RefreshCw,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDate } from '@/shared/utils/formatDate';
import { superAdminService } from '../services/superAdminService';
import type { TutorMonitoringDetail as TutorMonitoringDetailData } from '../types/superAdmin';
import { ActivityTable } from '../components/ActivityTable';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { SuperAdminPagination } from '../components/SuperAdminPagination';
import { TutorAccountActions } from '../components/TutorAccountActions';

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

export const TutorMonitoringDetail = () => {
  const { tutorId } = useParams<{ tutorId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<TutorMonitoringDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tuteesPage, setTuteesPage] = useState(1);
  const [parentsPage, setParentsPage] = useState(1);

  const loadDetail = async () => {
    if (!tutorId) {
      setError('Tutor ID is missing.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setDetail(await superAdminService.getTutorMonitoringDetail(tutorId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load tutor details.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [tutorId]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">
        Loading tutor monitoring data…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link
          to="/super-admin/tutors"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} /> Back to tutors
        </Link>
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <span>{error || 'Tutor not found.'}</span>
          <button
            type="button"
            onClick={loadDetail}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const { tutor, attendance, payments, academic } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Link
            to="/super-admin/tutors"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft size={16} /> Back to tutors
          </Link>
          <h2 className="mt-3 text-2xl font-bold text-gray-900">{tutor.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{tutor.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <StatusBadge status={tutor.status} />
            <span>Registered {tutor.createdAt ? formatDate(tutor.createdAt) : '—'}</span>
            {tutor.contactNumber && <span>· {tutor.contactNumber}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TutorAccountActions
            tutor={tutor}
            onChanged={loadDetail}
            onDeleted={() => navigate('/super-admin/tutors')}
            showViewDetails={false}
          />
          <button
            type="button"
            onClick={loadDetail}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Tutees"
          value={detail.totalTutees}
          icon={GraduationCap}
          accent="violet"
        />
        <StatCard
          label="Parents"
          value={detail.totalParents}
          icon={UsersRound}
          accent="amber"
        />
        <StatCard
          label="Attendance Rate"
          value={formatPercent(attendance.attendanceRate)}
          icon={CalendarCheck}
          accent="emerald"
          hint={`${attendance.present} present / ${attendance.totalDays} days`}
        />
        <StatCard
          label="Collection Rate"
          value={formatPercent(payments.collectionRate)}
          icon={Wallet}
          accent="blue"
          hint={`${formatCurrency(payments.totalPaid)} collected`}
        />
        <StatCard
          label="Average Score"
          value={
            academic.averageScore === null
              ? '—'
              : `${academic.averageScore.toFixed(1)}%`
          }
          icon={Users}
          accent="rose"
          hint={`${academic.totalAssessments} assessments`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-gray-900">
            Attendance Summary
          </h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Total class days</dt>
              <dd className="font-semibold text-gray-900">{attendance.totalDays}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Present</dt>
              <dd className="font-semibold text-emerald-600">{attendance.present}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Absent</dt>
              <dd className="font-semibold text-red-600">{attendance.absent}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">No class</dt>
              <dd className="font-semibold text-gray-700">{attendance.noClass}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Unmarked</dt>
              <dd className="font-semibold text-amber-600">{attendance.unmarked}</dd>
            </div>
          </dl>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min(attendance.attendanceRate, 100)}%` }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-gray-900">Payment Summary</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Total due</dt>
              <dd className="font-semibold text-gray-900">
                {formatCurrency(payments.totalDue)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Total paid</dt>
              <dd className="font-semibold text-emerald-600">
                {formatCurrency(payments.totalPaid)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Outstanding balance</dt>
              <dd className="font-semibold text-red-600">
                {formatCurrency(payments.totalBalance)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Collection rate</dt>
              <dd className="font-semibold text-blue-600">
                {formatPercent(payments.collectionRate)}
              </dd>
            </div>
          </dl>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${Math.min(payments.collectionRate, 100)}%` }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-gray-900">Academic Summary</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Total assessments</dt>
              <dd className="font-semibold text-gray-900">
                {academic.totalAssessments}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Students assessed</dt>
              <dd className="font-semibold text-gray-900">
                {academic.studentsAssessed}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Average score</dt>
              <dd className="font-semibold text-gray-900">
                {academic.averageScore === null
                  ? '—'
                  : `${academic.averageScore.toFixed(1)}%`}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-bold text-gray-900">Tutees</h3>
              <p className="text-xs text-gray-500">
                {detail.totalTutees} tutee{detail.totalTutees === 1 ? '' : 's'} registered
                under this tutor.
              </p>
            </div>
            {detail.tutees.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Name</TableHead>
                    <TableHead className="px-4">Subject</TableHead>
                    <TableHead className="px-4 text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.tutees
                    .slice((tuteesPage - 1) * 5, tuteesPage * 5)
                    .map((tutee) => (
                      <TableRow key={tutee.id}>
                        <TableCell className="px-4 py-3 font-medium text-gray-900">
                          {tutee.name}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-gray-600">
                          {tutee.subject || '—'}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCurrency(tutee.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-gray-500">No tutees registered.</div>
            )}
          </div>
          {detail.tutees.length > 0 && (
            <SuperAdminPagination
              currentPage={tuteesPage}
              totalItems={detail.tutees.length}
              pageSize={5}
              onPageChange={setTuteesPage}
              itemLabel="tutees"
            />
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-bold text-gray-900">Parents</h3>
              <p className="text-xs text-gray-500">
                {detail.totalParents} parent account
                {detail.totalParents === 1 ? '' : 's'} linked to this tutor.
              </p>
            </div>
            {detail.parents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Name</TableHead>
                    <TableHead className="px-4">Email</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4 text-center">Linked Tutees</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.parents
                    .slice((parentsPage - 1) * 5, parentsPage * 5)
                    .map((parent) => (
                      <TableRow key={parent.id}>
                        <TableCell className="px-4 py-3 font-medium text-gray-900">
                          {parent.name}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-gray-600">
                          {parent.email || '—'}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <StatusBadge status={parent.status} />
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center font-semibold text-gray-900">
                          {parent.linkedStudentIds.length}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-sm text-gray-500">No parent accounts linked.</div>
            )}
          </div>
          {detail.parents.length > 0 && (
            <SuperAdminPagination
              currentPage={parentsPage}
              totalItems={detail.parents.length}
              pageSize={5}
              onPageChange={setParentsPage}
              itemLabel="parents"
            />
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">
            Recent Activity
          </h3>
          <p className="text-xs text-gray-500">
            Recorded actions by this tutor or their parents.
          </p>
        </div>
        <ActivityTable
          logs={detail.recentActivities}
          showTutor={false}
          emptyMessage="No activity has been recorded for this tutor yet."
          pageSize={5}
        />
      </section>
    </div>
  );
};
