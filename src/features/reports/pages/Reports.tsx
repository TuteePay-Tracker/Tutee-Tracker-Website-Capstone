import { useState } from 'react';
import { useReports } from '@/features/reports/hooks/useReports';
import { ExportButton } from '@/features/reports/components/ExportButton';
import { OverviewTab } from '@/features/reports/components/OverviewTab';
import { AcademicTab } from '@/features/reports/components/AcademicTab';
import { AttendanceTab } from '@/features/reports/components/AttendanceTab';
import { AtRiskTab } from '@/features/reports/components/AtRiskTab';
import { PaymentBehaviorTab } from '@/features/reports/components/PaymentBehaviorTab';
import { StudentComparisonTab } from '@/features/reports/components/StudentComparisonTab';
import {
  BarChart3,
  BookOpen,
  Calendar,
  ShieldAlert,
  CreditCard,
  Users,
} from 'lucide-react';

type TabId = 'overview' | 'academic' | 'attendance' | 'at-risk' | 'payments' | 'comparison';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const Reports = () => {
  const { reportData, isLoading } = useReports();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  if (isLoading || !reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const tabs: Tab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <BarChart3 size={16} />,
    },
    {
      id: 'academic',
      label: 'Academic',
      icon: <BookOpen size={16} />,
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: <Calendar size={16} />,
    },
    {
      id: 'at-risk',
      label: 'At-Risk',
      icon: <ShieldAlert size={16} />,
      badge: reportData.atRiskStudents.length || undefined,
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: <CreditCard size={16} />,
    },
    {
      id: 'comparison',
      label: 'Comparison',
      icon: <Users size={16} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive insights into your tutoring business</p>
        </div>
        <ExportButton reportData={reportData} />
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-1.5 shadow-sm">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-green-700 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={`ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab data={reportData} />}

        {activeTab === 'academic' && (
          <AcademicTab
            studentPerformance={reportData.studentPerformance}
            subjectReports={reportData.subjectReports}
            monthlyAcademicTrend={reportData.monthlyAcademicTrend}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceTab attendanceSummaries={reportData.attendanceSummaries} />
        )}

        {activeTab === 'at-risk' && (
          <AtRiskTab atRiskStudents={reportData.atRiskStudents} />
        )}

        {activeTab === 'payments' && (
          <PaymentBehaviorTab
            paymentBehavior={reportData.paymentBehavior}
            paymentMethodSummary={reportData.paymentMethodSummary}
            weeklyIncome={reportData.weeklyIncome}
          />
        )}

        {activeTab === 'comparison' && (
          <StudentComparisonTab
            studentPerformance={reportData.studentPerformance}
            attendanceSummaries={reportData.attendanceSummaries}
          />
        )}
      </div>
    </div>
  );
};
