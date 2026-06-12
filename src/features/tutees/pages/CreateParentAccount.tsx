import { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, Copy, CheckCircle, X, Search, Printer, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '@/shared/lib/firebase/config';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface CreatedAccount {
  name: string;
  contactNumber: string;
  tempPassword: string;
  linkedStudents: string[];
}

const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = 'TuteePay@';
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export const CreateParentAccount = () => {
  const { tutees } = useTutees();
  const { user } = useAuth();

  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [modalAccount, setModalAccount] = useState<CreatedAccount | null>(null);
  const [existingParents, setExistingParents] = useState<any[]>([]);
  const [loadingParents, setLoadingParents] = useState(true);

  useEffect(() => {
    loadParents();
  }, []);

  const loadParents = async () => {
    setLoadingParents(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'parent'));
      const snap = await getDocs(q);
      setExistingParents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      // silent
    } finally {
      setLoadingParents(false);
    }
  };

  const filteredStudents = tutees.filter(t =>
    `${t.firstName} ${t.surname}`.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const getStudentName = (id: string) => {
    const t = tutees.find(t => t.id === id);
    return t ? `${t.firstName} ${t.surname}` : id;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !parentPhone.trim()) {
      toast.error('Please fill in parent name and phone number');
      return;
    }
    const sanitizedPhone = parentPhone.replace(/\D/g, '');
    if (sanitizedPhone.length < 10 || sanitizedPhone.length > 11) {
      toast.error('Please enter a valid phone number (10-11 digits)');
      return;
    }
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one student to link');
      return;
    }

    setIsCreating(true);
    const tempPassword = generateTempPassword();
    const parentEmail = `${sanitizedPhone}@tuteepay.local`;

    // Use a secondary Firebase app so the tutor's session is not affected
    const secondaryAppName = `secondary-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, parentEmail, tempPassword);
      await updateProfile(credential.user, { displayName: parentName });

      // Save parent Firestore doc
      await setDoc(doc(db, 'users', credential.user.uid), {
        name: parentName,
        email: parentEmail,
        contactNumber: parentPhone,
        role: 'parent',
        mustChangePassword: true,
        linkedStudentIds: selectedStudentIds,
        createdAt: new Date().toISOString(),
        createdByTutorId: user?.id || '',
      });

      // Link each student to this parent
      if (!user?.id) throw new Error('Tutor not authenticated');
      for (const studentId of selectedStudentIds) {
        await updateDoc(doc(db, 'users', user.id, 'tutees', studentId), {
          parentId: credential.user.uid,
        });
      }

      setModalAccount({
        name: parentName,
        contactNumber: parentPhone,
        tempPassword,
        linkedStudents: selectedStudentIds.map(getStudentName),
      });

      setParentName('');
      setParentPhone('');
      setSelectedStudentIds([]);
      setStudentSearch('');
      await loadParents();
      toast.success('Parent account created successfully!');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('A parent account with this phone number already exists');
      } else {
        toast.error(error.message || 'Failed to create parent account');
      }
    } finally {
      // Always clean up the secondary app
      await deleteApp(secondaryApp).catch(() => {});
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  const handleCloseModal = () => setModalAccount(null);

  return (
    <div className="space-y-6">
      {/* One-time credentials modal */}
      {modalAccount && (
        <ParentCredentialsModal
          account={modalAccount}
          onClose={handleCloseModal}
        />
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Parent Account</h1>
        <p className="text-gray-600 mt-1">
          Create parent portal accounts and link them to their child's records. Parents will be required to change their password on first login.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Form */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center">
              <UserPlus size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">New Parent Account</h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Full Name *</label>
              <input
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700"
                placeholder="e.g., Maria Santos"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Phone Number (Login Username) *</label>
              <input
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700"
                placeholder="e.g., 09918633208"
                required
              />
              <p className="text-xs text-gray-500 mt-1">This will be their login username (phone number only)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link Student(s) *
                {selectedStudentIds.length > 0 && (
                  <span className="ml-2 text-xs text-green-700 font-normal">{selectedStudentIds.length} selected</span>
                )}
              </label>

              {selectedStudentIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedStudentIds.map(id => (
                    <span key={id} className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      {getStudentName(id)}
                      <button type="button" onClick={() => toggleStudent(id)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                  placeholder="Search students..."
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y">
                {filteredStudents.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-4">No students found</p>
                ) : (
                  filteredStudents.map(tutee => (
                    <label
                      key={tutee.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                        selectedStudentIds.includes(tutee.id) ? 'bg-green-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(tutee.id)}
                        onChange={() => toggleStudent(tutee.id)}
                        className="w-4 h-4 text-green-700 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{tutee.firstName} {tutee.surname}</p>
                        <p className="text-xs text-gray-500">{tutee.gradeLevel} • {tutee.subject}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
              A secure temporary password will be auto-generated. The parent will be required to change it on first login.
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full bg-green-700 text-white py-3 rounded-xl hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Create Parent Account
                </>
              )}
            </button>
          </form>
        </div>

        {/* Existing Parents */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Existing Parent Accounts</h2>
          </div>

          {loadingParents ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : existingParents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users size={40} className="mx-auto mb-3 text-gray-300" />
              <p>No parent accounts yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {existingParents.map((parent) => (
                <div key={parent.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border">
                  <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-green-700 font-semibold text-sm">
                      {parent.name?.charAt(0)?.toUpperCase() || 'P'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{parent.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {parent.contactNumber || (parent.email?.endsWith('@tuteepay.local') ? parent.email.split('@')[0] : parent.email)}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(parent.linkedStudentIds || []).map((sid: string) => (
                        <span key={sid} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                          {getStudentName(sid)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {parent.mustChangePassword && (
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full shrink-0 whitespace-nowrap">
                      Pending login
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── One-time credentials modal ─────────────────────────────────────── */
interface ModalProps {
  account: CreatedAccount;
  onClose: () => void;
}

const ParentCredentialsModal = ({ account, onClose }: ModalProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const copyAllCredentials = () => {
    const text = [
      `Parent Account Credentials`,
      `──────────────────────────`,
      `Parent Name:        ${account.name}`,
      `Username (Phone):   ${account.contactNumber}`,
      `Temporary Password: ${account.tempPassword}`,
      `Linked Students:    ${account.linkedStudents.join(', ')}`,
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
        <h1>✓ Parent Login Credentials</h1>
        <p class="subtitle">Tutorial Service Management System — Confidential</p>
        <hr/>
        <div class="row"><div class="label">Parent Name</div><div class="value">${account.name}</div></div>
        <div class="row"><div class="label">Username (Phone Number)</div><div class="value mono">${account.contactNumber}</div></div>
        <div class="row"><div class="label">Temporary Password</div><div class="value mono">${account.tempPassword}</div></div>
        <div class="row"><div class="label">Linked Students</div><div class="value">${account.linkedStudents.join(', ')}</div></div>
        <div class="notice"><strong>Security Notice:</strong> This is a one-time credential sheet. The parent must change their password upon first login. Destroy this document after sharing.</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" ref={printRef}>
        {/* Header */}
        <div className="bg-gradient-to-br from-green-600 to-green-800 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
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
          {/* Parent Name */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mb-0.5">Parent Name</p>
              <p className="font-semibold text-gray-900">{account.name}</p>
            </div>
          </div>

          {/* Username */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mb-0.5">Username (Phone Number)</p>
              <p className="font-mono font-bold text-gray-900 text-sm tracking-wide">{account.contactNumber}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(account.contactNumber); toast.success('Username copied!'); }}
              className="text-gray-400 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
              title="Copy username"
            >
              <Copy size={16} />
            </button>
          </div>

          {/* Temporary Password */}
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-amber-600 font-medium mb-0.5">Temporary Password</p>
              <p className="font-mono font-bold text-gray-900 text-xl tracking-widest">{account.tempPassword}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(account.tempPassword); toast.success('Password copied!'); }}
              className="text-gray-400 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
              title="Copy password"
            >
              <Copy size={16} />
            </button>
          </div>

          {/* Linked Students */}
          {account.linkedStudents.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-blue-500 font-medium mb-1.5">Linked Student(s)</p>
              <div className="flex flex-wrap gap-1.5">
                {account.linkedStudents.map((s, i) => (
                  <span key={i} className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Security notice */}
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <ShieldCheck size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 leading-relaxed">
              <strong>One-time display.</strong> The temporary password is shown <strong>only once</strong> and will not be accessible after closing this modal. Provide these credentials to the parent immediately.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={copyAllCredentials}
            className="flex-1 flex items-center justify-center gap-2 bg-green-700 text-white py-2.5 rounded-xl hover:bg-green-800 font-medium text-sm transition-colors"
          >
            <Copy size={16} />
            Copy Credentials
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-200 font-medium text-sm transition-colors"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 border border-gray-300 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            <X size={16} />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
