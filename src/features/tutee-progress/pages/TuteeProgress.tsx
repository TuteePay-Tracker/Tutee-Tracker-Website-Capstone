import { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Star,
  BookOpen,
  Plus,
  ChevronUp,
  ChevronDown,
  Activity,
  BarChart2,
  Clock,
  Edit2,
  Trash2,
  Award,
  FileText,
  CheckCircle2,
  Settings2,
  Search,
  Filter,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAssessments } from '@/features/tutee-progress/hooks/useAssessments';
import { useSubjects } from '@/features/tutees/hooks/useSubjects';
import { useTopics } from '@/features/tutee-progress/hooks/useTopics';
import { useTopicProgress } from '@/features/tutee-progress/hooks/useTopicProgress';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { assessmentService } from '@/features/tutee-progress/services/assessmentService';
import { logActivity } from '@/shared/utils/auditLogger';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import {
  Assessment,
  scoreToRemarks,
  StudentPerformance,
  SubjectSummary,
} from '@/features/tutee-progress/types/assessment';
import {
  Topic,
  StudentTopicProgress,
  getPerformanceLevelConfig,
  scoreToPerformanceLevel,
  TopicProgressFormData,
} from '@/features/tutee-progress/types/topic';
import { TopicManagementModal } from '@/features/tutee-progress/components/TopicManagementModal';
import { TopicFormModal } from '@/features/tutee-progress/components/TopicFormModal';
import { TopicProgressModal } from '@/features/tutee-progress/components/TopicProgressModal';
import { ProgressReportModal } from '@/features/tutee-progress/components/ProgressReportModal';
import { Tutee } from '@/features/tutees/types/tutee';
import { useSchoolYear } from '@/shared/contexts/SchoolYearContext';

// ─── Analytics helpers ───────────────────────────────────────────────────────

function calcAverage(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/** Linear slope (simple linear regression) over an array of numbers */
function calcSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = calcAverage(values);
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  return den === 0 ? 0 : Math.round((num / den) * 10) / 10;
}

function buildStudentPerformances(
  assessments: Assessment[],
  subjectFilter?: string
): StudentPerformance[] {
  const byStudent: Record<string, Assessment[]> = {};

  assessments.forEach((a) => {
    if (subjectFilter && a.subject !== subjectFilter) return;
    if (!byStudent[a.tuteeId]) byStudent[a.tuteeId] = [];
    byStudent[a.tuteeId].push(a);
  });

  return Object.entries(byStudent).map(([tuteeId, items]) => {
    const sorted = [...items].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const scores = sorted.map((a) => a.score);
    const avg = calcAverage(scores);
    const trend = calcSlope(scores);
    const improvement =
      scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0;

    return {
      tuteeId,
      tuteeName: items[0].tuteeName,
      assessments: sorted,
      averageScore: avg,
      trend,
      improvement,
      latestScore: scores.length ? scores[scores.length - 1] : null,
    };
  });
}

function buildSubjectSummaries(assessments: Assessment[]): SubjectSummary[] {
  const bySubject: Record<string, number[]> = {};
  assessments.forEach((a) => {
    if (!bySubject[a.subject]) bySubject[a.subject] = [];
    bySubject[a.subject].push(a.score);
  });

  return Object.entries(bySubject).map(([subject, scores]) => ({
    subject,
    averageScore: calcAverage(scores),
    count: scores.length,
  }));
}

function buildMonthlyTrend(
  assessments: Assessment[]
): { month: string; average: number }[] {
  const byMonth: Record<string, number[]> = {};
  assessments.forEach((a) => {
    const m = a.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(a.score);
  });

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => ({
      month: new Date(month + '-01').toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      }),
      average: calcAverage(scores),
    }));
}

// ─── Small UI Tooltips & Badges ──────────────────────────────────────────────

const ProgressTrendTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.month}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Class Average:</span>
          <span className="font-bold text-green-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const SubjectPerformanceTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.subject}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Class Average:</span>
          <span className="font-bold text-green-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const MiniScoreTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-2.5 rounded-lg shadow-lg text-[10px] font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-0.5 mb-0.5">
          {new Date(data.date).toLocaleDateString()}
        </p>
        <div className="flex items-center justify-between gap-4 mt-0.5">
          <span className="text-slate-400">Score:</span>
          <span className="font-bold text-green-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? 'bg-green-100 text-green-800'
      : score >= 75
      ? 'bg-blue-100 text-blue-700'
      : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${color}`}>
      {score}%
    </span>
  );
}

function TrendIcon({ slope }: { slope: number }) {
  if (slope > 1) return <TrendingUp size={16} className="text-green-700" />;
  if (slope < -1) return <TrendingDown size={16} className="text-red-500" />;
  return <Minus size={16} className="text-gray-400" />;
}

function RemarksBadge({ remarks }: { remarks: Assessment['remarks'] }) {
  const map: Record<Assessment['remarks'], string> = {
    Excellent: 'bg-green-50 text-green-700 border-green-200',
    Good: 'bg-blue-50 text-blue-700 border-blue-200',
    'Needs Improvement': 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${map[remarks]}`}
    >
      {remarks}
    </span>
  );
}

function tuteeEnrolledInSubject(tutee: Tutee, subject: string): boolean {
  const list =
    tutee.subjects && tutee.subjects.length > 0
      ? tutee.subjects
      : tutee.subject
      ? [tutee.subject]
      : [];
  return list.some((s) => s.trim().toLowerCase() === subject.trim().toLowerCase());
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

function DashboardSection({
  assessments,
  isTutor,
}: {
  assessments: Assessment[];
  isTutor: boolean;
}) {
  const monthlyTrend = useMemo(() => buildMonthlyTrend(assessments), [assessments]);
  const subjectSummaries = useMemo(() => buildSubjectSummaries(assessments), [assessments]);
  const allStudents = useMemo(() => buildStudentPerformances(assessments), [assessments]);

  const [improvedPage, setImprovedPage] = useState(0);
  const [recentPage, setRecentPage] = useState(0);
  const PAGE_SIZE = 3;

  const mostImproved = useMemo(
    () =>
      [...allStudents]
        .filter((s) => s.assessments.length >= 2)
        .sort((a, b) => b.improvement - a.improvement)
        .slice(0, 5),
    [allStudents]
  );

  const needsIntervention = useMemo(
    () =>
      allStudents.filter((s) => {
        const last3 = s.assessments.slice(-3).map((a) => a.score);
        const allLow = last3.length >= 2 && last3.every((sc) => sc < 75);
        const declining = s.trend < -2;
        return allLow || declining;
      }),
    [allStudents]
  );

  const allRecentAssessments = useMemo(
    () =>
      [...assessments]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10),
    [assessments]
  );

  const recentAssessments = allRecentAssessments.slice(
    recentPage * PAGE_SIZE,
    (recentPage + 1) * PAGE_SIZE
  );
  const recentTotalPages = Math.ceil(allRecentAssessments.length / PAGE_SIZE);

  const improvedVisible = mostImproved.slice(
    improvedPage * PAGE_SIZE,
    (improvedPage + 1) * PAGE_SIZE
  );
  const improvedTotalPages = Math.ceil(mostImproved.length / PAGE_SIZE);

  const overallAvg = useMemo(
    () => calcAverage(assessments.map((a) => a.score)),
    [assessments]
  );

  if (assessments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mb-5">
          <BookOpen size={36} className="text-green-700" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">No Assessments Yet</h3>
        <p className="text-gray-500 text-sm max-w-xs">
          {isTutor
            ? 'Start by adding assessment records in the Subject Performance section below.'
            : "Your tutor hasn't recorded any assessments yet. Check back later."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Overall Avg Score',
            value: `${overallAvg}%`,
            icon: Activity,
            bgCircle: 'bg-green-50',
            iconBg: 'bg-green-50 text-green-700',
            sub: `${assessments.length} total records`,
          },
          {
            label: 'Students Tracked',
            value: allStudents.length,
            icon: BookOpen,
            bgCircle: 'bg-blue-50',
            iconBg: 'bg-blue-50 text-blue-700',
            sub: `Across ${subjectSummaries.length} subjects`,
          },
          {
            label: 'Most Improved',
            value: mostImproved[0]?.tuteeName?.split(' ')[0] ?? '—',
            icon: Star,
            bgCircle: 'bg-green-50',
            iconBg: 'bg-green-50 text-green-700',
            sub: mostImproved[0] ? `+${mostImproved[0].improvement} pts` : 'No data yet',
          },
          {
            label: 'Need Attention',
            value: needsIntervention.length,
            icon: AlertTriangle,
            bgCircle: needsIntervention.length > 0 ? 'bg-red-50' : 'bg-gray-50',
            iconBg:
              needsIntervention.length > 0
                ? 'bg-red-50 text-red-700'
                : 'bg-gray-50 text-gray-500',
            sub: needsIntervention.length > 0 ? 'Students flagged' : 'All on track',
          },
        ].map((card) => {
          const Icon = card.icon;
          const statusClass =
            card.label === 'Overall Avg Score'
              ? 'stat-primary'
              : card.label === 'Students Tracked'
              ? 'stat-primary'
              : card.label === 'Most Improved'
              ? 'stat-success'
              : card.label === 'Need Attention' && needsIntervention.length > 0
              ? 'stat-danger'
              : 'stat-muted';

          return (
            <div
              key={card.label}
              className={`glass-panel stat-card-premium ${statusClass} p-5 flex items-center gap-4 relative overflow-hidden group`}
            >
              <div
                className={`absolute top-0 right-0 w-24 h-24 ${card.bgCircle} dark:opacity-10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300`}
              />
              <div
                className={`w-12 h-12 rounded-xl ${card.iconBg} dark:bg-opacity-10 flex items-center justify-center relative shrink-0`}
              >
                <Icon size={22} />
              </div>
              <div className="relative flex-1">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-[1.625rem] font-bold text-gray-900 dark:text-white mt-0.5">
                  {card.value}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-slate-455 mt-1 font-medium">
                  {card.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Performance Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-700" />
            <h2 className="font-semibold text-gray-900">Overall Performance Trend</h2>
          </div>
          {monthlyTrend.length < 2 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Not enough data for trend analysis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="tuteeProgressTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#15803d" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#15803d" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip content={<ProgressTrendTooltip />} />
                <ReferenceLine
                  y={75}
                  stroke="#f59e0b"
                  strokeDasharray="4 2"
                  label={{ value: '75', fontSize: 10, fill: '#f59e0b', position: 'insideBottomLeft' }}
                />
                <Area
                  type="monotone"
                  dataKey="average"
                  stroke="#15803d"
                  strokeWidth={3}
                  fill="url(#tuteeProgressTrendGrad)"
                  name="Avg Score"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subject Performance Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={18} className="text-green-700" />
            <h2 className="font-semibold text-gray-900">Subject Performance Summary</h2>
          </div>
          {subjectSummaries.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No subject data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={subjectSummaries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="subject" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip content={<SubjectPerformanceTooltip />} />
                <Bar dataKey="averageScore" radius={[6, 6, 0, 0]} barSize={28}>
                  {subjectSummaries.map((_, index) => {
                    const colors = ['#15803d', '#1d4ed8', '#f59e0b', '#7c3aed', '#db2777'];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Most Improved + Needs Intervention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Improved */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Star size={18} className="text-amber-500" />
            <h2 className="font-semibold text-gray-900">Most Improved Students</h2>
          </div>
          {mostImproved.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">
              Need ≥ 2 assessments per student to rank improvement
            </p>
          ) : (
            <div className="space-y-3">
              {improvedVisible.map((s, i) => (
                <div
                  key={s.tuteeId}
                  className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100"
                >
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {improvedPage * PAGE_SIZE + i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{s.tuteeName}</p>
                    <p className="text-xs text-gray-500">
                      {s.assessments.length} assessments · avg {s.averageScore}%
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-green-700 font-bold text-sm">
                    <ChevronUp size={16} />
                    +{s.improvement} pts
                  </div>
                </div>
              ))}
              {improvedTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setImprovedPage((p) => Math.max(0, p - 1))}
                    disabled={improvedPage === 0}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-gray-400 font-medium">
                    {improvedPage + 1} / {improvedTotalPages}
                  </span>
                  <button
                    onClick={() => setImprovedPage((p) => Math.min(improvedTotalPages - 1, p + 1))}
                    disabled={improvedPage === improvedTotalPages - 1}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Needs Intervention */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="font-semibold text-gray-900">Students Requiring Intervention</h2>
          </div>
          {needsIntervention.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={22} className="text-green-700" />
              </div>
              <p className="text-green-700 font-semibold text-sm">All students on track!</p>
              <p className="text-gray-400 text-xs mt-1">No intervention needed currently</p>
            </div>
          ) : (
            <div className="space-y-3">
              {needsIntervention.map((s) => (
                <div
                  key={s.tuteeId}
                  className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-100"
                >
                  <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{s.tuteeName}</p>
                    <p className="text-xs text-gray-500">
                      avg {s.averageScore}% · trend {s.trend > 0 ? '+' : ''}
                      {s.trend}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-red-500 text-xs font-bold">
                    <ChevronDown size={14} />
                    Low/declining
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Assessments */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900">Recent Assessments</h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            Showing {Math.min(recentPage * PAGE_SIZE + 1, allRecentAssessments.length)}–
            {Math.min((recentPage + 1) * PAGE_SIZE, allRecentAssessments.length)} of{' '}
            {allRecentAssessments.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Student</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Subject</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Date</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Score</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {recentAssessments.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-gray-900">{a.tuteeName}</td>
                  <td className="py-2.5 px-3 text-gray-600">{a.subject}</td>
                  <td className="py-2.5 px-3 text-gray-500 text-xs">
                    {new Date(a.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-2.5 px-3">
                    <ScoreBadge score={a.score} />
                  </td>
                  <td className="py-2.5 px-3">
                    <RemarksBadge remarks={a.remarks} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recentTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => setRecentPage((p) => Math.max(0, p - 1))}
              disabled={recentPage === 0}
              className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-400 font-semibold">
              Page {recentPage + 1} of {recentTotalPages}
            </span>
            <button
              onClick={() => setRecentPage((p) => Math.min(recentTotalPages - 1, p + 1))}
              disabled={recentPage === recentTotalPages - 1}
              className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subject Performance & Topic Monitoring Section ──────────────────────────

interface SubjectSectionProps {
  assessments: Assessment[];
  tutorId: string | undefined;
  isTutor: boolean;
  subjects: string[];
  tutees: Tutee[];
  topics: Topic[];
  progressMap: Map<string, StudentTopicProgress>;
  onAddTopic: (subject: string, name: string, description?: string, gradeLevel?: string) => Promise<string>;
  onUpdateTopic: (topicId: string, name: string, description?: string, subject?: string, gradeLevel?: string) => Promise<void>;
  onDeleteTopic: (topicId: string, topicName: string, subject?: string) => Promise<void>;
  onSaveTopicProgress: (data: TopicProgressFormData) => Promise<void>;
  computeStudentSummary: (studentId: string, subject: string, topicIds: string[]) => any;
}

function SubjectSection({
  assessments,
  tutorId,
  isTutor,
  subjects,
  tutees,
  topics,
  progressMap,
  onAddTopic,
  onUpdateTopic,
  onDeleteTopic,
  onSaveTopicProgress,
  computeStudentSummary,
}: SubjectSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedYear } = useSchoolYear();

  const [activeSubject, setActiveSubject] = useState<string>(subjects[0] ?? '');
  const [subView, setSubView] = useState<'topics' | 'reports' | 'assessments'>('topics');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'mastered' | 'needs-attention'>('all');

  // Modals state
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [topicFormModalState, setTopicFormModalState] = useState<{
    isOpen: boolean;
    editingTopic?: Topic | null;
  }>({ isOpen: false, editingTopic: null });

  const handleOpenAddTopic = () => {
    setTopicFormModalState({ isOpen: true, editingTopic: null });
  };

  const handleOpenEditTopic = (topic: Topic) => {
    setTopicFormModalState({ isOpen: true, editingTopic: topic });
  };

  const handleSaveTopic = async (name: string, description?: string, gradeLevel?: string) => {
    if (topicFormModalState.editingTopic) {
      await onUpdateTopic(
        topicFormModalState.editingTopic.id,
        name,
        description,
        activeSubject,
        gradeLevel
      );
    } else {
      await onAddTopic(activeSubject, name, description, gradeLevel);
    }
  };

  const [progressModalData, setProgressModalData] = useState<{
    studentId: string;
    studentName: string;
    subject: string;
    topicId: string;
    topicName: string;
    currentProgress?: StudentTopicProgress;
  } | null>(null);
  const [reportModalData, setReportModalData] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);

  // Sync activeSubject when subjects list loads or changes
  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(activeSubject)) {
      setActiveSubject(subjects[0]);
    }
  }, [subjects]);

  // Assessment view state (pagination and expanded row)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [studentPage, setStudentPage] = useState(0);
  const STUDENT_PAGE_SIZE = 3;

  useEffect(() => {
    setStudentPage(0);
  }, [activeSubject, subView]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Filter assessments for active subject
  const filteredAssessments = useMemo(
    () => assessments.filter((a) => a.subject === activeSubject),
    [assessments, activeSubject]
  );

  // Filter topics for active subject
  const currentSubjectTopics = useMemo(
    () =>
      topics.filter(
        (t) => t.subject.trim().toLowerCase() === activeSubject.trim().toLowerCase()
      ),
    [topics, activeSubject]
  );

  // Students list for this subject
  const subjectStudents = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    tutees.forEach((t) => {
      if (tuteeEnrolledInSubject(t, activeSubject)) {
        map.set(t.id, { id: t.id, name: `${t.firstName} ${t.surname}` });
      }
    });

    filteredAssessments.forEach((a) => {
      if (!map.has(a.tuteeId)) {
        map.set(a.tuteeId, { id: a.tuteeId, name: a.tuteeName });
      }
    });

    if (!isTutor && user?.linkedStudentIds && user.linkedStudentIds.length > 0) {
      const allowed = new Set(user.linkedStudentIds);
      return Array.from(map.values()).filter((s) => allowed.has(s.id));
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tutees, filteredAssessments, activeSubject, isTutor, user]);

  // Filtered students by search & status
  const filteredStudents = useMemo(() => {
    const topicIds = currentSubjectTopics.map((t) => t.id);

    return subjectStudents.filter((student) => {
      if (
        searchQuery &&
        !student.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      if (statusFilter !== 'all' && topicIds.length > 0) {
        const summary = computeStudentSummary(student.id, activeSubject, topicIds);
        if (statusFilter === 'mastered') {
          return summary.masteredCount > 0;
        }
        if (statusFilter === 'needs-attention') {
          return summary.needsImprovementCount > 0;
        }
      }

      return true;
    });
  }, [subjectStudents, searchQuery, statusFilter, currentSubjectTopics, activeSubject, computeStudentSummary]);

  const assessmentStudents = useMemo(
    () => buildStudentPerformances(filteredAssessments),
    [filteredAssessments]
  );
  const studentTotalPages = Math.ceil(assessmentStudents.length / STUDENT_PAGE_SIZE);
  const visibleAssessmentStudents = assessmentStudents.slice(
    studentPage * STUDENT_PAGE_SIZE,
    (studentPage + 1) * STUDENT_PAGE_SIZE
  );

  const handleDeleteAssessment = async (a: Assessment) => {
    if (!tutorId) return;
    if (!window.confirm(`Delete this assessment for ${a.tuteeName}?`)) return;
    try {
      await assessmentService.delete(tutorId, a.id);
      toast.success('Assessment deleted');
      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Assessment Deleted',
          'Tutee Progress',
          `Deleted assessment for student ${a.tuteeName} in ${a.subject}`
        );
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      {/* Subject Tab Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {subjects.length === 0 ? (
          <div className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            No subjects configured yet. Go to <strong>Settings</strong> to add custom subjects first.
          </div>
        ) : (
          subjects.map((s) => {
            const count = assessments.filter((a) => a.subject === s).length;
            const topicCount = topics.filter(
              (t) => t.subject.trim().toLowerCase() === s.trim().toLowerCase()
            ).length;

            return (
              <button
                key={s}
                onClick={() => setActiveSubject(s)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  activeSubject === s
                    ? 'bg-green-700 text-white border-green-700 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:text-green-700'
                }`}
              >
                <span>{s}</span>
                {topicCount > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeSubject === s ? 'bg-white/20 text-white' : 'bg-green-50 text-green-700 border border-green-200'
                    }`}
                    title={`${topicCount} topics configured`}
                  >
                    {topicCount} {topicCount === 1 ? 'topic' : 'topics'}
                  </span>
                )}
                {count > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeSubject === s ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                    title={`${count} assessment records`}
                  >
                    {count} records
                  </span>
                )}
              </button>
            );
          })
        )}

        {/* Action Controls for Tutor */}
        {isTutor && tutorId && (
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button
              onClick={() =>
                navigate('/tutee-progress/assessment/new', {
                  state: { subject: activeSubject || undefined },
                })
              }
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-green-700 hover:bg-green-800 text-white transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>Add Assessment</span>
            </button>
          </div>
        )}
      </div>

      {/* Tutor Topics Quick Strip */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-green-700 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              {activeSubject} Topics & Learning Areas
            </h3>
            <span className="text-[11px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
              {currentSubjectTopics.length} defined
            </span>
          </div>
          {isTutor && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenAddTopic}
                className="text-xs font-semibold text-green-700 hover:text-green-800 hover:underline flex items-center gap-1"
              >
                <Plus size={13} />
                <span>Add Topic</span>
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => setIsManageModalOpen(true)}
                className="text-xs font-semibold text-gray-600 hover:text-gray-800 hover:underline flex items-center gap-1"
              >
                <Settings2 size={13} />
                <span>Manage</span>
              </button>
            </div>
          )}
        </div>

        {currentSubjectTopics.length === 0 ? (
          <div className="py-4 px-3.5 bg-green-50/50 border border-green-200 rounded-xl text-xs text-green-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <p>
              No topics created for <strong>{activeSubject}</strong> yet. Tutors have full control to break down this subject into custom topics (e.g. Reading Comprehension, Grammar, etc.).
            </p>
            {isTutor && (
              <button
                onClick={handleOpenAddTopic}
                className="px-3.5 py-1.5 bg-green-700 text-white font-semibold rounded-lg text-xs hover:bg-green-800 shrink-0 shadow-sm transition-colors"
              >
                Create First Topic
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {currentSubjectTopics.map((topic, idx) => (
              <div
                key={topic.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 group hover:border-green-300 hover:bg-green-50/30 transition-colors"
                title={topic.description || topic.name}
              >
                <span className="w-4 h-4 rounded-full bg-green-100 text-green-800 text-[10px] font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-semibold text-gray-800">{topic.name}</span>
                {topic.gradeLevel && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {topic.gradeLevel}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-view switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setSubView('topics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subView === 'topics'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Layers size={14} className={subView === 'topics' ? 'text-green-700' : ''} />
            <span>Topic Mastery & Progress</span>
          </button>
          <button
            onClick={() => setSubView('reports')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subView === 'reports'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText size={14} className={subView === 'reports' ? 'text-green-700' : ''} />
            <span>Progress Reports</span>
          </button>
          <button
            onClick={() => setSubView('assessments')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subView === 'assessments'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Clock size={14} className={subView === 'assessments' ? 'text-green-700' : ''} />
            <span>Assessment Records ({filteredAssessments.length})</span>
          </button>
        </div>

        {/* Search & Filter for Topics & Reports Views */}
        {subView !== 'assessments' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 w-44 font-medium"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="mastered">Has Mastered Topics</option>
              <option value="needs-attention">Needs Attention</option>
            </select>
          </div>
        )}
      </div>

      {/* ── SUB-VIEW 1: Topic Mastery & Detailed Progress ── */}
      {subView === 'topics' && (
        <div className="space-y-5">
          {currentSubjectTopics.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <BookOpen size={44} className="mx-auto text-green-700/40 mb-3" />
              <h3 className="text-base font-bold text-gray-900">
                No Topics Configured for {activeSubject}
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Break down {activeSubject} into individual topics or learning areas that you actually teach. Once added, you can track student performance per topic with measurable percentages and performance levels.
              </p>
              {isTutor && (
                <button
                  onClick={handleOpenAddTopic}
                  className="mt-4 px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Add Topics to {activeSubject}</span>
                </button>
              )}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              <p className="text-sm font-semibold text-gray-600">No students found matching your criteria</p>
              <p className="text-xs text-gray-400 mt-1">
                Make sure students are enrolled in {activeSubject} or adjust your filters.
              </p>
            </div>
          ) : (
            filteredStudents.map((student) => {
              const topicIds = currentSubjectTopics.map((t) => t.id);
              const summary = computeStudentSummary(student.id, activeSubject, topicIds);

              return (
                <div
                  key={student.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:border-gray-300"
                >
                  {/* Student Header */}
                  <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-gray-50/70 to-white">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-green-700 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                        {student.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 text-base">{student.name}</h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {activeSubject}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {summary.masteredCount} of {currentSubjectTopics.length} topics mastered
                          {summary.averageScore > 0 && ` • Avg Score: ${summary.averageScore}%`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
                      {/* Mastery Pill */}
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        <Award size={15} className="text-green-700" />
                        <span className="text-xs font-bold text-green-800">
                          {summary.masteryRate}% Mastery Rate
                        </span>
                      </div>

                      {/* View Report Button */}
                      <button
                        onClick={() =>
                          setReportModalData({
                            studentId: student.id,
                            studentName: student.name,
                          })
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-green-300 hover:text-green-700 transition-colors shadow-sm"
                      >
                        <FileText size={14} className="text-green-700" />
                        <span>View Progress Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Topics Grid for this student */}
                  <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {currentSubjectTopics.map((topic) => {
                        const progress = progressMap.get(`${student.id}_${topic.id}`);
                        const score = progress?.score ?? 0;
                        const level =
                          progress?.performanceLevel ??
                          (score > 0 ? scoreToPerformanceLevel(score) : 'not-started');
                        const config = getPerformanceLevelConfig(level);

                        return (
                          <div
                            key={topic.id}
                            className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/40 hover:bg-white hover:shadow-sm hover:border-gray-300 transition-all flex flex-col justify-between space-y-3"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="font-bold text-xs text-gray-900 leading-snug line-clamp-1">
                                  {topic.name}
                                </h5>
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border shrink-0 ${config.badgeClass}`}
                                >
                                  {config.label}
                                </span>
                              </div>
                              {topic.description && (
                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                                  {topic.description}
                                </p>
                              )}
                            </div>

                            {/* Measurable Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className="text-gray-500">Proficiency</span>
                                <span className={config.textClass}>{score}%</span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${config.bgClass}`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                            </div>

                            {/* Strengths & Weaknesses quick tags */}
                            {(progress?.strengths || progress?.areasForImprovement) && (
                              <div className="space-y-1 pt-1 text-[10px]">
                                {progress.strengths && (
                                  <p className="text-green-800 line-clamp-1">
                                    <strong>Strength:</strong> {progress.strengths}
                                  </p>
                                )}
                                {progress.areasForImprovement && (
                                  <p className="text-amber-800 line-clamp-1">
                                    <strong>Focus:</strong> {progress.areasForImprovement}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Tutor Update Action */}
                            {isTutor && (
                              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">
                                  {progress?.lastUpdated
                                    ? `Updated ${new Date(progress.lastUpdated).toLocaleDateString()}`
                                    : 'Not evaluated'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProgressModalData({
                                      studentId: student.id,
                                      studentName: student.name,
                                      subject: activeSubject,
                                      topicId: topic.id,
                                      topicName: topic.name,
                                      currentProgress: progress,
                                    })
                                  }
                                  className="text-xs font-semibold text-green-700 hover:text-green-800 hover:underline flex items-center gap-1"
                                >
                                  <Edit2 size={11} />
                                  <span>Update</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── SUB-VIEW 2: Progress Reports Overview ── */}
      {subView === 'reports' && (
        <div className="space-y-4">
          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              <p className="text-sm font-semibold text-gray-600">No student reports available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredStudents.map((student) => {
                const topicIds = currentSubjectTopics.map((t) => t.id);
                const summary = computeStudentSummary(student.id, activeSubject, topicIds);

                const strengths: string[] = [];
                const improvements: string[] = [];

                currentSubjectTopics.forEach((t) => {
                  const p = progressMap.get(`${student.id}_${t.id}`);
                  if (p?.strengths) {
                    strengths.push(`${t.name}: ${p.strengths}`);
                  } else if (p?.performanceLevel === 'mastered') {
                    strengths.push(`${t.name} (Mastered)`);
                  }

                  if (p?.areasForImprovement) {
                    improvements.push(`${t.name}: ${p.areasForImprovement}`);
                  } else if (p?.performanceLevel === 'needs-improvement') {
                    improvements.push(`${t.name} (Needs practice)`);
                  }
                });

                return (
                  <div
                    key={student.id}
                    className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-gray-300 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                            {activeSubject}
                          </span>
                          <h4 className="font-bold text-gray-900 text-base mt-1">{student.name}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-gray-900">{summary.masteryRate}%</span>
                          <p className="text-[10px] text-gray-400 font-semibold uppercase">Mastery</p>
                        </div>
                      </div>

                      {/* Strengths */}
                      <div className="mt-3.5 p-3 rounded-xl bg-green-50/60 border border-green-200">
                        <p className="text-[11px] font-bold text-green-900 flex items-center gap-1.5 mb-1">
                          <CheckCircle2 size={13} className="text-green-700" />
                          Key Strengths:
                        </p>
                        {strengths.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic">No specific strengths logged</p>
                        ) : (
                          <ul className="text-xs text-green-800 space-y-0.5 list-disc list-inside">
                            {strengths.slice(0, 2).map((s, idx) => (
                              <li key={idx} className="line-clamp-1">
                                {s}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Areas for Improvement */}
                      <div className="mt-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                        <p className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                          <AlertTriangle size={13} className="text-amber-600" />
                          Areas for Improvement:
                        </p>
                        {improvements.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic">
                            Student on track across all topics
                          </p>
                        ) : (
                          <ul className="text-xs text-amber-800 space-y-0.5 list-disc list-inside">
                            {improvements.slice(0, 2).map((imp, idx) => (
                              <li key={idx} className="line-clamp-1">
                                {imp}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium">
                        {summary.masteredCount} of {currentSubjectTopics.length} topics mastered
                      </span>
                      <button
                        onClick={() =>
                          setReportModalData({
                            studentId: student.id,
                            studentName: student.name,
                          })
                        }
                        className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800"
                      >
                        <span>Full Report & Download</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-VIEW 3: Classic Assessment Records (Preserved) ── */}
      {subView === 'assessments' && (
        <div>
          {assessmentStudents.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
              <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                No assessments recorded for {activeSubject}
              </p>
              {isTutor && (
                <p className="text-gray-400 text-sm mt-1">
                  Click "Add Assessment" to record the first entry.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {visibleAssessmentStudents.map((student) => {
                const chartData = student.assessments.map((a) => ({
                  date: new Date(a.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  }),
                  score: a.score,
                }));

                return (
                  <div
                    key={student.tuteeId}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Student Header */}
                    <div className="flex items-center justify-between p-5 border-b border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {student.tuteeName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{student.tuteeName}</p>
                          <p className="text-xs text-gray-500">
                            {student.assessments.length} assessments · avg{' '}
                            <span className="font-semibold text-gray-700">
                              {student.averageScore}%
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <TrendIcon slope={student.trend} />
                          <span
                            className={`text-xs font-semibold ${
                              student.trend > 1
                                ? 'text-green-700'
                                : student.trend < -1
                                ? 'text-red-500'
                                : 'text-gray-400'
                            }`}
                          >
                            {student.trend > 0 ? '+' : ''}
                            {student.trend} slope
                          </span>
                        </div>
                        <ScoreBadge score={student.latestScore ?? 0} />
                      </div>
                    </div>

                    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Mini trend chart */}
                      {chartData.length >= 2 ? (
                        <div>
                          <p className="text-xs font-bold uppercase text-gray-400 mb-2">Score Trend</p>
                          <ResponsiveContainer width="100%" height={120}>
                            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <defs>
                                <linearGradient
                                  id={`miniScoreGrad-${student.tuteeId}`}
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop offset="0%" stopColor="#15803d" stopOpacity={0.3} />
                                  <stop offset="100%" stopColor="#15803d" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                              <Tooltip content={<MiniScoreTooltip />} />
                              <Area
                                type="monotone"
                                dataKey="score"
                                stroke="#15803d"
                                strokeWidth={2.5}
                                fill={`url(#miniScoreGrad-${student.tuteeId})`}
                                dot={{ r: 3, fill: '#15803d', stroke: '#fff', strokeWidth: 1 }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center bg-gray-50 rounded-xl h-28 text-xs text-gray-400">
                          Need ≥ 2 records for trend
                        </div>
                      )}

                      {/* Assessment Records Table */}
                      <div>
                        <p className="text-xs font-bold uppercase text-gray-400 mb-2">
                          Assessment Records
                        </p>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {[...student.assessments].reverse().map((a) => (
                            <div
                              key={a.id}
                              className="border border-gray-100 rounded-xl bg-gray-50/50 overflow-hidden shadow-sm"
                            >
                              <button
                                type="button"
                                onClick={() => toggleExpand(a.id)}
                                className="w-full flex items-center justify-between text-xs px-3 py-2.5 hover:bg-gray-100/70 transition-colors text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-550 font-medium text-gray-500">
                                    {new Date(a.date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </span>
                                  {a.topic && (
                                    <span className="font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[10px] truncate max-w-[120px]">
                                      {a.topic}
                                    </span>
                                  )}
                                  <ScoreBadge score={a.score} />
                                  <RemarksBadge remarks={a.remarks} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400">
                                    {expandedId === a.id ? (
                                      <ChevronUp size={14} />
                                    ) : (
                                      <ChevronDown size={14} />
                                    )}
                                  </span>
                                  {isTutor && tutorId && (
                                    <div
                                      className="flex gap-1 ml-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          navigate(`/tutee-progress/assessment/${a.id}`)
                                        }
                                        className="p-1 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                        title="Edit assessment"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteAssessment(a)}
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete assessment"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </button>

                              {expandedId === a.id && (
                                <div className="px-4 pb-3.5 pt-2 border-t border-gray-100 bg-white space-y-3 text-xs text-gray-700">
                                  {a.assessmentScores && a.assessmentScores.length > 0 && (
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block">
                                          Scores Breakdown:
                                        </span>
                                        {a.totalScore !== undefined && a.totalScore > 0 && (
                                          <span className="font-bold text-[10px] text-gray-500">
                                            Total:{' '}
                                            {a.assessmentScores.reduce(
                                              (sum, s) => sum + s.score,
                                              0
                                            )}{' '}
                                            / {a.totalScore} pts ({a.score}%)
                                          </span>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {a.assessmentScores.map((s, idx) => {
                                          const rowPct =
                                            s.totalScore > 0
                                              ? Math.round((s.score / s.totalScore) * 100)
                                              : 0;
                                          return (
                                            <div
                                              key={idx}
                                              className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 flex justify-between items-center"
                                            >
                                              <span className="font-semibold text-gray-650 truncate">
                                                {s.name || `Score ${idx + 1}`}
                                              </span>
                                              <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                                                {s.score} / {s.totalScore} pts ({rowPct}%)
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {a.topicsCovered && a.topicsCovered !== a.topic && (
                                    <div>
                                      <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block text-gray-500">
                                        Topics Covered:
                                      </span>
                                      <p className="mt-0.5 font-medium whitespace-pre-line bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        {a.topicsCovered}
                                      </p>
                                    </div>
                                  )}
                                  {a.notes && (
                                    <div>
                                      <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block text-gray-500">
                                        Tutor Notes & Observations:
                                      </span>
                                      <p className="mt-0.5 font-medium whitespace-pre-line bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        {a.notes}
                                      </p>
                                    </div>
                                  )}
                                  {a.recommendations && (
                                    <div>
                                      <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block text-gray-500">
                                        Recommendations:
                                      </span>
                                      <p className="mt-0.5 font-medium whitespace-pre-line bg-blue-50/50 text-blue-900 p-2 rounded-lg border border-blue-100">
                                        {a.recommendations}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {studentTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 pb-2">
                  <button
                    onClick={() => setStudentPage((p) => Math.max(0, p - 1))}
                    disabled={studentPage === 0}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-gray-500 font-medium">
                    Showing {studentPage * STUDENT_PAGE_SIZE + 1}–
                    {Math.min((studentPage + 1) * STUDENT_PAGE_SIZE, assessmentStudents.length)} of{' '}
                    {assessmentStudents.length} students
                  </span>
                  <button
                    onClick={() =>
                      setStudentPage((p) => Math.min(studentTotalPages - 1, p + 1))
                    }
                    disabled={studentPage === studentTotalPages - 1}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Topic Management Modal ── */}
      <TopicManagementModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        subject={activeSubject}
        topics={currentSubjectTopics}
        onOpenAddTopic={handleOpenAddTopic}
        onOpenEditTopic={handleOpenEditTopic}
        onDeleteTopic={onDeleteTopic}
      />

      {/* ── Add / Edit Topic Modal (Separated) ── */}
      <TopicFormModal
        isOpen={topicFormModalState.isOpen}
        onClose={() => setTopicFormModalState({ isOpen: false, editingTopic: null })}
        subject={activeSubject}
        editingTopic={topicFormModalState.editingTopic}
        existingTopics={currentSubjectTopics}
        onSave={handleSaveTopic}
      />

      {/* ── Topic Progress Modal ── */}
      {progressModalData && (
        <TopicProgressModal
          isOpen={true}
          onClose={() => setProgressModalData(null)}
          studentId={progressModalData.studentId}
          studentName={progressModalData.studentName}
          subject={progressModalData.subject}
          topicId={progressModalData.topicId}
          topicName={progressModalData.topicName}
          currentProgress={progressModalData.currentProgress}
          onSaveProgress={onSaveTopicProgress}
        />
      )}

      {/* ── Full Progress Report Modal ── */}
      {reportModalData && (
        <ProgressReportModal
          isOpen={true}
          onClose={() => setReportModalData(null)}
          studentId={reportModalData.studentId}
          studentName={reportModalData.studentName}
          subject={activeSubject}
          topics={currentSubjectTopics}
          progressMap={progressMap}
          assessments={assessments}
          schoolYear={selectedYear}
          tutorName={user?.role === 'tutor' ? user.name : undefined}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TuteeProgress() {
  const { user } = useAuth();
  const { assessments, isLoading, tutorId } = useAssessments();
  const { tutees, isLoading: tuteesLoading } = useTutees();
  const { subjects: rawSubjects, isLoading: subjectsLoading } = useSubjects();
  const {
    topics,
    isLoading: topicsLoading,
    addTopic,
    updateTopic,
    deleteTopic,
    getTopicsForSubject,
  } = useTopics();
  const {
    progressList,
    progressMap,
    isLoading: progressLoading,
    saveProgress,
    deleteProgress,
    computeStudentSummary,
  } = useTopicProgress();

  const isTutor = user?.role === 'tutor';

  const subjectNames = useMemo(() => {
    if (isTutor) {
      return rawSubjects.map((s) => s.name);
    }
    const set = new Set<string>();
    assessments.forEach((a) => {
      if (a.subject) set.add(a.subject);
    });
    topics.forEach((t) => {
      if (t.subject) set.add(t.subject);
    });
    return Array.from(set);
  }, [isTutor, rawSubjects, assessments, topics]);

  if (isLoading || (isTutor && subjectsLoading) || topicsLoading || progressLoading) {
    return <LoadingScreen message="Loading progress..." />;
  }

  return (
    <div className="space-y-10 max-w-7xl">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tutee Progress</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Track student performance, specific subject topics, and academic growth
          </p>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
            <BookOpen size={16} className="text-green-700" />
            <span className="text-sm font-semibold text-green-800">
              {topics.length} total topics
            </span>
          </div>
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
            <Activity size={16} className="text-green-700" />
            <span className="text-sm font-semibold text-green-800">
              {assessments.length} assessments
            </span>
          </div>
        </div>
      </div>

      {/* ── Dashboard Section ── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-6 bg-green-700 rounded-full" />
          <h2 className="text-xl font-bold text-gray-900">Dashboard Overview</h2>
        </div>
        <DashboardSection assessments={assessments} isTutor={isTutor} />
      </section>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 px-4 text-sm text-gray-500 font-medium">
            Subject & Topic Performance
          </span>
        </div>
      </div>

      {/* ── Subject Performance Section ── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-6 bg-green-700 rounded-full" />
          <h2 className="text-xl font-bold text-gray-900">Subject Performance & Topic Monitoring</h2>
          {!isTutor && (
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-medium">
              View only
            </span>
          )}
        </div>
        <SubjectSection
          assessments={assessments}
          tutorId={tutorId || undefined}
          isTutor={isTutor}
          subjects={subjectNames}
          tutees={tutees}
          topics={topics}
          progressMap={progressMap}
          onAddTopic={addTopic}
          onUpdateTopic={updateTopic}
          onDeleteTopic={deleteTopic}
          onSaveTopicProgress={saveProgress}
          computeStudentSummary={computeStudentSummary}
        />
      </section>
    </div>
  );
}
