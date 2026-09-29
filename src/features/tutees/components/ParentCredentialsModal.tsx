import { useRef } from 'react';
import { CheckCircle, X, Copy, Printer } from 'lucide-react';
import { toast } from 'sonner';

export interface ParentCredentialsModalProps {
  credentials: {
    name: string;
    contactNumber: string;
    tempPassword: string;
    studentName?: string;
  };
  onClose: () => void;
}

export const ParentCredentialsModal = ({ credentials, onClose }: ParentCredentialsModalProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  const copyAllCredentials = () => {
    const text = [
      `Parent Account Credentials`,
      `──────────────────────────`,
      `Parent Name:       ${credentials.name}`,
      `Student:           ${credentials.studentName || 'Student'}`,
      `Username:          ${credentials.contactNumber}`,
      `Temporary Password: ${credentials.tempPassword}`,
      ``,
      `Note: Please change your password upon first login.`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() =>
      toast.success('All credentials copied to clipboard!')
    );
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Parent Login Credentials</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
          h1 { font-size: 20px; color: #166534; margin-bottom: 4px; }
          .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
          .row { margin-bottom: 16px; }
          .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
          .value { font-size: 16px; font-weight: 600; }
          .value.mono { font-family: monospace; font-size: 18px; background: #f3f4f6; padding: 6px 10px; border-radius: 6px; display: inline-block; }
          .notice { margin-top: 28px; padding: 12px 16px; background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #92400e; }
          hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>✓ Parent Account Credentials</h1>
        <p class="subtitle">Tutorial Service Management System — Confidential</p>
        <hr/>
        <div class="row"><div class="label">Student</div><div class="value">${credentials.studentName || 'Student'}</div></div>
        <div class="row"><div class="label">Parent Name</div><div class="value">${credentials.name}</div></div>
        <div class="row"><div class="label">Username (Contact Number)</div><div class="value mono">${credentials.contactNumber}</div></div>
        <div class="row"><div class="label">Temporary Password</div><div class="value mono">${credentials.tempPassword}</div></div>
        <div class="notice"><strong>Security Notice:</strong> This is a one-time credential sheet. The parent must change their password upon first login. Destroy this document after sharing.</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100" ref={printRef}>
        {/* Header */}
        <div className="bg-gradient-to-br from-green-700 to-green-900 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle size={26} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg leading-tight">Parent Account Created!</h3>
                <p className="text-green-100 text-sm">Share these credentials with the parent</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Credential fields */}
        <div className="p-6 space-y-3">
          {credentials.studentName && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-green-700 font-semibold mb-0.5">Linked Student</p>
              <p className="font-semibold text-green-900 text-sm">{credentials.studentName}</p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Parent Name</p>
            <p className="font-semibold text-gray-900">{credentials.name}</p>
          </div>

          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Username (Contact Number)</p>
              <p className="font-mono font-semibold text-gray-900 text-sm">{credentials.contactNumber}</p>
            </div>
            <button
              onClick={() => copyToClipboard(credentials.contactNumber, 'Username')}
              className="text-gray-400 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
              title="Copy username"
            >
              <Copy size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold mb-0.5">Temporary Password</p>
              <p className="font-mono font-bold text-amber-900 text-base">{credentials.tempPassword}</p>
            </div>
            <button
              onClick={() => copyToClipboard(credentials.tempPassword, 'Temporary password')}
              className="text-amber-600 hover:text-amber-800 p-1.5 rounded-lg hover:bg-amber-100 transition-colors"
              title="Copy password"
            >
              <Copy size={16} />
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center pt-1">
            🔒 The parent must change their password on first login.
          </p>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 pt-2 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={copyAllCredentials}
              className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              <Copy size={16} />
              Copy All
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              title="Print credential sheet"
            >
              <Printer size={16} />
              Print
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full text-center text-xs text-gray-500 hover:text-gray-700 py-1 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
