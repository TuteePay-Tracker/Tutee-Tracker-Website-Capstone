import { AlertTriangle, CheckCircle, Copy, KeyRound, Printer, X } from 'lucide-react';
import { toast } from 'sonner';

export interface RestoredParentCredential {
  parentId: string;
  name: string;
  contactNumber: string;
  email: string;
  tempPassword: string;
  linkedStudentNames: string[];
  status: 'created' | 'reset';
}

interface RestoredParentCredentialsModalProps {
  credentials: RestoredParentCredential[];
  failures: string[];
  onClose: () => void;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const RestoredParentCredentialsModal = ({
  credentials,
  failures,
  onClose,
}: RestoredParentCredentialsModalProps) => {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  const copyAllCredentials = () => {
    const text = [
      'Restored Parent Account Credentials',
      '-----------------------------------',
      ...credentials.flatMap((credential) => [
        `Parent Name:        ${credential.name}`,
        `Linked Student(s):  ${credential.linkedStudentNames.length > 0 ? credential.linkedStudentNames.join(', ') : '-'}`,
        `Username:           ${credential.contactNumber || credential.email}`,
        `Temporary Password: ${credential.tempPassword}`,
        `Login Status:       ${credential.status === 'created' ? 'Created' : 'Password reset'}`,
        '',
      ]),
      ...(failures.length > 0
        ? [`Could not restore: ${failures.join(', ')}`, '']
        : []),
      'Note: Each parent must change their password on first login.',
    ].join('\n');

    navigator.clipboard.writeText(text).then(() =>
      toast.success('All restored credentials copied to clipboard!')
    );
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = credentials
      .map(
        (credential) => `
          <tr>
            <td>${escapeHtml(credential.name)}</td>
            <td>${escapeHtml(
              credential.linkedStudentNames.length > 0
                ? credential.linkedStudentNames.join(', ')
                : '-'
            )}</td>
            <td>${escapeHtml(credential.contactNumber || credential.email)}</td>
            <td class="mono">${escapeHtml(credential.tempPassword)}</td>
            <td>${credential.status === 'created' ? 'Created' : 'Password reset'}</td>
          </tr>`
      )
      .join('');

    const failureBlock =
      failures.length > 0
        ? `<div class="failure"><strong>Could not restore:</strong> ${escapeHtml(
            failures.join(', ')
          )}. Retry the restore; if it still fails, recreate those parent accounts.</div>`
        : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Restored Parent Credentials</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
          h1 { font-size: 20px; color: #166534; margin-bottom: 4px; }
          .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; padding: 8px 6px; }
          td { font-size: 13px; border-bottom: 1px solid #e5e7eb; padding: 8px 6px; vertical-align: top; }
          td.mono { font-family: monospace; font-weight: bold; }
          .notice { margin-top: 28px; padding: 12px 16px; background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #92400e; }
          .failure { margin-top: 16px; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 12px; color: #991b1b; }
        </style>
      </head>
      <body>
        <h1>Restored Parent Account Credentials</h1>
        <p class="subtitle">Tutorial Service Management System - Confidential</p>
        <table>
          <thead>
            <tr>
              <th>Parent</th>
              <th>Linked Student(s)</th>
              <th>Username</th>
              <th>Temporary Password</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${failureBlock}
        <div class="notice"><strong>Security Notice:</strong> Each parent must change their password on first login. Destroy this document after sharing.</div>
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-br from-green-700 to-green-900 p-6 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle size={26} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg leading-tight">
                  Parent Logins Restored!
                </h3>
                <p className="text-green-100 text-sm">
                  {credentials.length} login(s) ready. Share these temporary passwords.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label="Close restored credentials"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto">
          {credentials.map((credential) => (
            <div
              key={credential.parentId}
              className="border border-gray-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{credential.name}</p>
                  <p className="text-xs text-gray-500">
                    {credential.linkedStudentNames.length > 0
                      ? `Linked to ${credential.linkedStudentNames.join(', ')}`
                      : 'No linked student found in backup'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                    credential.status === 'created'
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200'
                  }`}
                >
                  <KeyRound size={12} />
                  {credential.status === 'created' ? 'Login created' : 'Password reset'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                      Username
                    </p>
                    <p className="font-mono font-semibold text-gray-900 text-sm truncate">
                      {credential.contactNumber || credential.email}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        credential.contactNumber || credential.email,
                        'Username'
                      )
                    }
                    className="text-gray-400 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors shrink-0"
                    title="Copy username"
                  >
                    <Copy size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold mb-0.5">
                      Temporary Password
                    </p>
                    <p className="font-mono font-bold text-amber-900 text-sm truncate">
                      {credential.tempPassword}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(credential.tempPassword, `${credential.name}'s password`)
                    }
                    className="text-amber-600 hover:text-amber-800 p-1.5 rounded-lg hover:bg-amber-100 transition-colors shrink-0"
                    title="Copy temporary password"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {failures.length > 0 && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-semibold">Could not restore {failures.length} login(s)</p>
                <p className="mt-0.5">{failures.join(', ')}</p>
                <p className="mt-1 text-xs text-red-700">
                  Retry the restore; if it still fails, recreate that parent account.
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 text-center pt-1">
            Every parent must change their password on first login. Passwords remain
            available from Show Parent Account &rarr; View Credentials until they do.
          </p>
        </div>

        <div className="px-6 pb-6 pt-2 space-y-2 shrink-0 border-t border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={copyAllCredentials}
              disabled={credentials.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              <Copy size={16} />
              Copy All
            </button>
            <button
              onClick={handlePrint}
              disabled={credentials.length === 0}
              className="flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
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
