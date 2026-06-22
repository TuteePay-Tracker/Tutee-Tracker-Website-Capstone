import { useMemo, useState } from 'react';
import { StudentPerformanceReport, AttendanceSummary } from '@/features/reports/types/report';
import { Trophy, Medal, ArrowUpDown } from 'lucide-react';

interface StudentComparisonTabProps {
  studentPerformance: StudentPerformanceReport[];
  attendanceSummaries: AttendanceSummary[];
}

type SortField = 'overall' | 'score' | 'attendance';

export const StudentComparisonTab = ({
  studentPerformance,
  attendanceSummaries,
}: StudentComparisonTabProps) => {
  const [sortBy, setSortBy] = useState<SortField>('overall');

  const attendanceMap = useMemo(
    () => new Map(attendanceSummaries.map((a) => [a.tuteeId, a])),
    [attendanceSummaries]
  );

  const rankedStudents = useMemo(() => {
    const combined = studentPerformance.map((sp) => {
      const att = attendanceMap.get(sp.tuteeId);
      const attendanceRate = att?.attendanceRate ?? 0;
      // Composite score: 60% academic + 40% attendance
      const overallScore = Math.round(sp.averageScore * 0.6 + attendanceRate * 0.4);

      return {
        tuteeId: sp.tuteeId,
        tuteeName: sp.tuteeName,
        averageScore: sp.averageScore,
        totalAssessments: sp.totalAssessments,
        attendanceRate,
        overallScore,
        status: sp.status,
        trend: sp.trend,
      };
    });

    if (sortBy === 'score') {
      combined.sort((a, b) => b.averageScore - a.averageScore);
    } else if (sortBy === 'attendance') {
      combined.sort((a, b) => b.attendanceRate - a.attendanceRate);
    } else {
      combined.sort((a, b) => b.overallScore - a.overallScore);
    }

    return combined;
  }, [studentPerformance, attendanceMap, sortBy]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy size={18} className="text-yellow-500" />;
    if (index === 1) return <Medal size={18} className="text-gray-400" />;
    if (index === 2) return <Medal size={18} className="text-amber-600" />;
    return (
      <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-gray-500">
        {index + 1}
      </span>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-700 bg-green-50';
    if (score >= 75) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

  return (
    <div className="space-y-6">
      {/* Sort Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-600 font-medium">Sort by:</span>
        {(['overall', 'score', 'attendance'] as SortField[]).map((field) => (
          <button
            key={field}
            onClick={() => setSortBy(field)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === field
                ? 'bg-green-700 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ArrowUpDown size={12} className="inline mr-1" />
            {field === 'overall'
              ? 'Overall Ranking'
              : field === 'score'
              ? 'Academic Score'
              : 'Attendance Rate'}
          </button>
        ))}
      </div>

      {/* Ranking Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Student Comparison Rankings</h3>
        {rankedStudents.length === 0 ? (
          <div className="text-center py-12">
            <Trophy size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No student data available for comparison</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase w-16">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                    Student
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                    Overall Score
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                    Academic Avg
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                    Attendance
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                    Assessments
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankedStudents.map((student, index) => (
                  <tr
                    key={student.tuteeId}
                    className={`border-b hover:bg-gray-50 transition-colors ${
                      index < 3 ? 'bg-green-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center">
                        {getRankIcon(index)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-sm">{student.tuteeName}</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(
                          student.overallScore
                        )}`}
                      >
                        {student.overallScore}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm font-medium">
                        {student.totalAssessments > 0 ? `${student.averageScore}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              student.attendanceRate >= 85
                                ? 'bg-green-500'
                                : student.attendanceRate >= 70
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${student.attendanceRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{student.attendanceRate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-600">
                      {student.totalAssessments}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          student.status === 'most-improved'
                            ? 'bg-green-100 text-green-700'
                            : student.status === 'needs-improvement'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {student.status === 'most-improved'
                          ? '🟢 Improving'
                          : student.status === 'needs-improvement'
                          ? '🔴 At Risk'
                          : '🟡 Stable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Note about scoring */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>How Overall Score is calculated:</strong> 60% Academic Performance + 40% Attendance Rate.
          This composite score provides a balanced view of each student's engagement and achievement.
        </p>
      </div>
    </div>
  );
};
