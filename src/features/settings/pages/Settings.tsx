import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSubjects } from '@/features/tutees/hooks/useSubjects';
import { User, Bell, Database, Info, BookOpen, Plus, Trash2, Camera, CreditCard, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { ImageUpload } from '@/shared/components/ui/ImageUpload';

export const Settings = () => {
  const { user, updateProfilePhoto, updatePaymentMethods } = useAuth();
  const { subjects, addSubject, deleteSubject, isLoading: subjectsLoading } = useSubjects();
  const [notifications, setNotifications] = useState(true);
  const [emailReminders, setEmailReminders] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  // Payment methods local states
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState({
    gcash: { enabled: false, accountName: '', accountNumber: '', qrUrl: '' },
    maya: { enabled: false, accountName: '', accountNumber: '', qrUrl: '' },
    bank: { enabled: false, accountName: '', accountNumber: '', bankName: '', qrUrl: '' },
    other: { enabled: false, accountName: '', accountNumber: '', bankName: '', instructions: '', qrUrl: '' },
  });

  // Sync state with user data
  useEffect(() => {
    if (user?.paymentMethods) {
      setPaymentMethods({
        gcash: {
          enabled: user.paymentMethods.gcash?.enabled ?? false,
          accountName: user.paymentMethods.gcash?.accountName ?? '',
          accountNumber: user.paymentMethods.gcash?.accountNumber ?? '',
          qrUrl: user.paymentMethods.gcash?.qrUrl ?? '',
        },
        maya: {
          enabled: user.paymentMethods.maya?.enabled ?? false,
          accountName: user.paymentMethods.maya?.accountName ?? '',
          accountNumber: user.paymentMethods.maya?.accountNumber ?? '',
          qrUrl: user.paymentMethods.maya?.qrUrl ?? '',
        },
        bank: {
          enabled: user.paymentMethods.bank?.enabled ?? false,
          accountName: user.paymentMethods.bank?.accountName ?? '',
          accountNumber: user.paymentMethods.bank?.accountNumber ?? '',
          bankName: user.paymentMethods.bank?.bankName ?? '',
          qrUrl: user.paymentMethods.bank?.qrUrl ?? '',
        },
        other: {
          enabled: user.paymentMethods.other?.enabled ?? false,
          accountName: user.paymentMethods.other?.accountName ?? '',
          accountNumber: user.paymentMethods.other?.accountNumber ?? '',
          bankName: user.paymentMethods.other?.bankName ?? '',
          instructions: user.paymentMethods.other?.instructions ?? '',
          qrUrl: user.paymentMethods.other?.qrUrl ?? '',
        },
      });
    }
  }, [user]);

  const handleSavePaymentSettings = async () => {
    setIsSavingPayments(true);
    try {
      await updatePaymentMethods(paymentMethods);
      toast.success('Payment settings saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save payment settings');
    } finally {
      setIsSavingPayments(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      toast.error('Please enter a subject name');
      return;
    }

    // Check for duplicates
    if (subjects.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase())) {
      toast.error('This subject already exists');
      return;
    }

    setIsAddingSubject(true);
    try {
      await addSubject(newSubjectName.trim());
      setNewSubjectName('');
      toast.success('Subject added successfully');
    } catch (error) {
      toast.error('Failed to add subject');
    } finally {
      setIsAddingSubject(false);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This will not affect existing students.`)) {
      try {
        await deleteSubject(id);
        toast.success('Subject deleted successfully');
      } catch (error) {
        toast.error('Failed to delete subject');
      }
    }
  };

  const handleClearData = async () => {
    if (!user) {
      toast.error('You must be logged in to clear data');
      return;
    }

    if (window.confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      setIsClearing(true);
      try {
        // Delete all tutees
        const tuteesRef = collection(db, 'users', user.id, 'tutees');
        const tuteesSnapshot = await getDocs(tuteesRef);
        await Promise.all(tuteesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        // Delete all payments
        const paymentsRef = collection(db, 'users', user.id, 'payments');
        const paymentsSnapshot = await getDocs(paymentsRef);
        await Promise.all(paymentsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        // Delete all sessions
        const sessionsRef = collection(db, 'users', user.id, 'sessions');
        const sessionsSnapshot = await getDocs(sessionsRef);
        await Promise.all(sessionsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        // Delete all payment records
        const recordsRef = collection(db, 'users', user.id, 'paymentRecords');
        const recordsSnapshot = await getDocs(recordsRef);
        await Promise.all(recordsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        // Delete all payment transactions
        const transactionsRef = collection(db, 'users', user.id, 'paymentTransactions');
        const transactionsSnapshot = await getDocs(transactionsRef);
        await Promise.all(transactionsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        toast.success('All data cleared successfully. Please refresh the page.');
      } catch (error) {
        console.error('Error clearing data:', error);
        toast.error('Failed to clear data. Please try again.');
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <User size={24} className="text-gray-600" />
          <h2 className="text-xl font-semibold">Account Information</h2>
        </div>

        {/* Profile Photo Upload */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6 pb-6 border-b border-gray-100">
          <ImageUpload
            currentUrl={user?.photoUrl}
            onUpload={async (url) => {
              try {
                await updateProfilePhoto(url);
              } catch {
                toast.error('Failed to save profile photo');
              }
            }}
            folder="tuteepay/profiles"
            shape="circle"
            size="lg"
            label="Change Photo"
          />
          <div className="flex-1 text-center sm:text-left">
            <p className="font-bold text-gray-900 text-lg">{user?.name}</p>
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1 justify-center sm:justify-start">
              <Camera size={13} className="text-gray-400" />
              Click the photo to upload a new profile picture
            </p>
            <p className="text-xs text-gray-400 mt-1">Accepted: JPG, PNG, WEBP — max 5 MB</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={user?.name || ''}
              className="w-full p-2 border rounded-lg bg-gray-50"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {user?.role === 'parent' ? 'Phone Number' : 'Email'}
            </label>
            <input
              type="text"
              value={
                user?.role === 'parent'
                  ? (user?.contactNumber || (user?.email?.endsWith('@tuteepay.local') ? user.email.split('@')[0] : user?.email) || '')
                  : (user?.email || '')
              }
              className="w-full p-2 border rounded-lg bg-gray-50"
              readOnly
            />
          </div>
          <p className="text-sm text-gray-500">
            Your account is managed through Firebase Authentication.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell size={24} className="text-gray-600" />
          <h2 className="text-xl font-semibold">Notifications</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-gray-600">Receive notifications about payments and sessions</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => {
                  setNotifications(e.target.checked);
                  toast.success(`Notifications ${e.target.checked ? 'enabled' : 'disabled'}`);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-700"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Reminders</p>
              <p className="text-sm text-gray-600">Get email reminders for unpaid balances</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailReminders}
                onChange={(e) => {
                  setEmailReminders(e.target.checked);
                  toast.success(`Email reminders ${e.target.checked ? 'enabled' : 'disabled'}`);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-700"></div>
            </label>
          </div>
        </div>
      </div>

      {user?.role === 'tutor' && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center gap-3 mb-6">
            <CreditCard size={24} className="text-gray-600" />
            <div>
              <h2 className="text-xl font-semibold">Payment Settings</h2>
              <p className="text-sm text-gray-500 mt-0.5">Configure GCash, Maya, or Bank Transfer payment details for parents</p>
            </div>
          </div>

          <div className="space-y-6">
            {(['gcash', 'maya', 'bank', 'other'] as const).map((method) => {
              const config = paymentMethods[method];
              const label = method === 'gcash' ? 'GCash' :
                            method === 'maya' ? 'Maya' :
                            method === 'bank' ? 'Bank Transfer' : 'Other Payment Method';
              
              return (
                <div key={method} className="p-4 border rounded-xl bg-gray-50/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone size={20} className="text-gray-600" />
                      <span className="font-bold text-gray-900">{label}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => setPaymentMethods(prev => ({
                          ...prev,
                          [method]: { ...prev[method], enabled: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-700"></div>
                    </label>
                  </div>

                  {config.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                      <div className="md:col-span-2 space-y-3">
                        {(method === 'bank' || method === 'other') && (
                          <div>
                            <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                              Bank / Provider Name *
                            </label>
                            <input
                              type="text"
                              value={(config as any).bankName || ''}
                              onChange={(e) => setPaymentMethods(prev => ({
                                ...prev,
                                [method]: { ...prev[method], bankName: e.target.value }
                              }))}
                              placeholder={method === 'bank' ? "e.g., BDO, BPI, Metrobank" : "e.g., PayPal, GrabPay"}
                              className="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-semibold"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                            Account Name *
                          </label>
                          <input
                            type="text"
                            value={config.accountName}
                            onChange={(e) => setPaymentMethods(prev => ({
                              ...prev,
                              [method]: { ...prev[method], accountName: e.target.value }
                            }))}
                            placeholder="e.g., Juan Dela Cruz"
                            className="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                            Account Number *
                          </label>
                          <input
                            type="text"
                            value={config.accountNumber}
                            onChange={(e) => setPaymentMethods(prev => ({
                              ...prev,
                              [method]: { ...prev[method], accountNumber: e.target.value }
                            }))}
                            placeholder={method === 'bank' ? "e.g., 1234-5678-9012" : "e.g., 0917-123-4567"}
                            className="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-semibold"
                          />
                        </div>
                        {method === 'other' && (
                          <div>
                            <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                              Custom Instructions / Notes (Optional)
                            </label>
                            <textarea
                              value={(config as any).instructions || ''}
                              onChange={(e) => setPaymentMethods(prev => ({
                                ...prev,
                                [method]: { ...prev[method], instructions: e.target.value }
                              }))}
                              placeholder="Add any extra details or steps for this payment method..."
                              rows={2}
                              className="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-semibold"
                            />
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-1 flex flex-col items-center">
                        <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-2 text-center w-full">
                          QR Code Image
                        </label>
                        <ImageUpload
                          currentUrl={config.qrUrl}
                          onUpload={(url) => setPaymentMethods(prev => ({
                            ...prev,
                            [method]: { ...prev[method], qrUrl: url }
                          }))}
                          folder={`tuteepay/qrs/${user?.id}`}
                          shape="square"
                          size="md"
                          label="Upload QR Code"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={handleSavePaymentSettings}
                disabled={isSavingPayments}
                className="bg-green-700 text-white px-6 py-2.5 rounded-xl hover:bg-green-800 disabled:bg-gray-400 font-bold transition-all text-sm shadow-sm"
              >
                {isSavingPayments ? 'Saving...' : 'Save Payment Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen size={24} className="text-gray-600" />
          <h2 className="text-xl font-semibold">Subject Management</h2>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Manage custom subjects for your tutoring sessions. Only your custom subjects will appear when creating or editing students.
          </p>

          <form onSubmit={handleAddSubject} className="flex gap-2">
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Enter subject name (e.g., Mathematics)"
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
            />
            <button
              type="submit"
              disabled={isAddingSubject || !newSubjectName.trim()}
              className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              Add Subject
            </button>
          </form>

          {subjectsLoading ? (
            <div className="text-center py-4 text-gray-500">Loading subjects...</div>
          ) : subjects.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <BookOpen size={32} className="mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500 text-sm">No custom subjects yet. Add your first subject above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:shadow-sm transition-shadow"
                >
                  <span className="font-medium text-gray-900">{subject.name}</span>
                  <button
                    onClick={() => handleDeleteSubject(subject.id, subject.name)}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Delete subject"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Database size={24} className="text-gray-600" />
          <h2 className="text-xl font-semibold">Data Management</h2>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Your data is stored securely in Firebase Firestore. Clear all data to start fresh.
          </p>
          <button
            onClick={handleClearData}
            disabled={isClearing}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isClearing ? 'Clearing...' : 'Clear All Data'}
          </button>
        </div>
      </div>

      <div className="bg-green-50 rounded-lg border border-green-200 p-6">
        <div className="flex items-start gap-3">
          <Info size={24} className="text-green-700 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-green-900 mb-2">Firebase Connected</h3>
            <p className="text-sm text-green-800">
              Your TuteePay Tracker is connected to Firebase. All your data is securely stored 
              in the cloud with real-time synchronization, user authentication, and automatic backups.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};