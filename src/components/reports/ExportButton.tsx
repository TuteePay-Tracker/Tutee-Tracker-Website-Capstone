import { Download } from 'lucide-react';
import { ReportData } from '../../types/report';
import { exportReportToCSV } from '../../utils/exportPdf';

interface ExportButtonProps {
  reportData: ReportData;
}

export const ExportButton = ({ reportData }: ExportButtonProps) => {
  const handleExport = () => {
    const filename = `tuteepay-report-${new Date().toISOString().split('T')[0]}.csv`;
    exportReportToCSV(reportData, filename);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
    >
      <Download size={18} />
      Export Report
    </button>
  );
};
