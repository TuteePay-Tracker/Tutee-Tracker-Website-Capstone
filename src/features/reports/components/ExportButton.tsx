import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, BookOpen, Calendar, DollarSign } from 'lucide-react';
import { ReportData } from '@/features/reports/types/report';
import { exportAcademicReport, exportAttendanceReport, exportPaymentsReport } from '@/shared/utils/exportPdf';

interface ExportButtonProps {
  reportData: ReportData;
}

export const ExportButton = ({ reportData }: ExportButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportAcademic = () => {
    const filename = `academic-report-${new Date().toISOString().split('T')[0]}.csv`;
    exportAcademicReport(reportData, filename);
    setIsOpen(false);
  };

  const handleExportAttendance = () => {
    const filename = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
    exportAttendanceReport(reportData, filename);
    setIsOpen(false);
  };

  const handleExportPayments = () => {
    const filename = `payments-report-${new Date().toISOString().split('T')[0]}.csv`;
    exportPaymentsReport(reportData, filename);
    setIsOpen(false);
  };

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors font-medium shadow-sm"
      >
        <Download size={18} />
        <span>Export Report</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-150 py-1.5 z-50 animate-in fade-in duration-100 slide-in-from-top-1">
          <button
            onClick={handleExportAcademic}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors text-left font-medium"
          >
            <BookOpen size={16} className="text-gray-400" />
            <span>Academic Performance</span>
          </button>
          <button
            onClick={handleExportAttendance}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors text-left font-medium"
          >
            <Calendar size={16} className="text-gray-400" />
            <span>Attendance Records</span>
          </button>
          <button
            onClick={handleExportPayments}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors text-left font-medium"
          >
            <DollarSign size={16} className="text-gray-400" />
            <span>Payments & Earnings</span>
          </button>
        </div>
      )}
    </div>
  );
};
