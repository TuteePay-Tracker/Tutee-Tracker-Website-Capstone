import { useState } from 'react';
import { X, UserPlus, Check, Copy, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  createTutorAccount,
  type CreatedTutorCredentials,
} from '../services/tutorManagementService';

interface CreateTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTutorModal = ({
  isOpen,
  onClose,
  onSuccess,
}: CreateTutorModalProps) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [credentials, setCredentials] = useState<CreatedTutorCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isLoading) return;
    setName('');
    setEmail('');
    setContactNumber('');
    setCredentials(null);
    setCopied(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Please enter the tutor name and email.');
      return;
    }

    if (!user) {
      toast.error('You must be signed in as Super Admin.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await createTutorAccount({
        name: name.trim(),
        email: email.trim(),
        contactNumber: contactNumber.trim() || undefined,
        adminId: user.id,
        adminName: user.name,
      });

      setCredentials(res);
      toast.success('Tutor account created successfully!');
      onSuccess();
    } catch (err: any) {
      console.error('Error creating tutor account:', err);
      let msg = err?.message || 'Failed to create tutor account.';
      if (err?.code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists.';
      } else if (err?.code === 'auth/invalid-email') {
        msg = 'The email address is invalid.';
      } else if (err?.code === 'auth/weak-password') {
        msg = 'The temporary password generated is too weak.';
      }
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!credentials) return;
    const text = `Tutor Track Login Credentials\nName: ${credentials.name}\nEmail: ${credentials.email}\nTemporary Password: ${credentials.tempPassword}\n\nNote: You will be required to change this temporary password upon your first login.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Credentials copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {credentials ? 'Tutor Credentials Created' : 'Create Tutor Account'}
              </h3>
              <p className="text-xs text-gray-500">
                {credentials
                  ? 'Credentials will be shown only once'
                  : 'Provision a new tutor with temporary credentials'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {credentials ? (
            /* Single-view Confirmation Modal */
            <div className="space-y-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-3">
                <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Save these credentials now</span>
                  This temporary password will <strong className="font-semibold">not</strong> be displayed again or stored in plain text. Provide it securely to the tutor.
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 text-sm">
                <div className="flex items-center justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500 text-xs uppercase font-medium">Tutor Name</span>
                  <span className="font-semibold text-gray-900">{credentials.name}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500 text-xs uppercase font-medium">Email</span>
                  <span className="font-semibold text-gray-900">{credentials.email}</span>
                </div>
                {credentials.contactNumber && (
                  <div className="flex items-center justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500 text-xs uppercase font-medium">Contact Number</span>
                    <span className="font-semibold text-gray-900">{credentials.contactNumber}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-gray-500 text-xs uppercase font-medium">Temporary Password</span>
                  <code className="rounded-md bg-blue-50 px-2.5 py-1 text-sm font-bold text-blue-700 tracking-wider border border-blue-200">
                    {credentials.tempPassword}
                  </code>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800">
                <ShieldCheck size={16} className="shrink-0 text-blue-600" />
                <span>The tutor must change this password on their first login before accessing their dashboard.</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied to Clipboard' : 'Copy Credentials'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Tutor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tutor@example.com"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be the tutor's login username.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Contact Number (Optional)
                </label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. 09171234567"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900">
                <span className="font-semibold block mb-0.5">Automatic Password Generation</span>
                A secure temporary password will be automatically generated. The tutor will be required to change it on their first login.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating Tutor...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Create Tutor Account
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

