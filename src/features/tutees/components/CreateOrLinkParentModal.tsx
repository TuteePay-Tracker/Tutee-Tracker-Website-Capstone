import { useState } from 'react';
import { Users, UserPlus, Search, X, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { 
  linkExistingParent, 
  createNewParentAccount, 
  CreatedParentCredentials 
} from '@/features/tutees/services/parentManagementService';
import { normalizePhoneNumber, isValidPHPhoneNumber } from '@/shared/utils/phoneUtils';

interface ParentSearchResult {
  id: string;
  name: string;
  email: string;
  contactNumber?: string;
  [key: string]: any;
}

interface CreateOrLinkParentModalProps {
  tuteeId: string;
  tuteeName: string;
  onClose: () => void;
  onSuccess: (credentials?: CreatedParentCredentials, newParentId?: string) => void;
}

export const CreateOrLinkParentModal = ({
  tuteeId,
  tuteeName,
  onClose,
  onSuccess,
}: CreateOrLinkParentModalProps) => {
  const { user } = useAuth();

  const [parentStatus, setParentStatus] = useState<'existing' | 'new'>('existing');

  // Existing Parent Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ParentSearchResult[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // New Parent state
  const [newParentName, setNewParentName] = useState('');
  const [newParentPhone, setNewParentPhone] = useState('');

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = async () => {
    const queryStr = searchQuery.trim();
    if (!queryStr) return;

    setIsSearching(true);
    try {
      const parentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'parent'),
        where('createdByTutorId', '==', user?.id ?? '')
      );
      const snap = await getDocs(parentsQuery);
      const qLower = queryStr.toLowerCase();
      const digitsOnly = queryStr.replace(/\D/g, '');

      const filtered = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ParentSearchResult))
        .filter((p) => {
          const nameMatch = p.name?.toLowerCase().includes(qLower);
          const phoneMatch =
            digitsOnly.length >= 3 &&
            p.contactNumber?.replace(/\D/g, '').includes(digitsOnly);
          return nameMatch || phoneMatch;
        });

      setSearchResults(filtered);
      if (filtered.length === 0) {
        toast.error('No parent account found matching your search.');
      }
    } catch (err) {
      console.error('Error searching parents:', err);
      toast.error('Failed to search parent accounts');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setIsSubmitting(true);
    try {
      if (parentStatus === 'existing') {
        if (!selectedParentId) {
          toast.error('Please select an existing parent account from search results');
          setIsSubmitting(false);
          return;
        }

        await linkExistingParent({
          studentId: tuteeId,
          parentId: selectedParentId,
          tutorId: user.id,
          tutorName: user.name,
          tutorRole: user.role,
          studentName: tuteeName,
        });

        toast.success('Parent account linked successfully!');
        onSuccess(undefined, selectedParentId);
      } else {
        if (!newParentName.trim()) {
          toast.error('Please enter parent name');
          setIsSubmitting(false);
          return;
        }
        if (!newParentPhone.trim()) {
          toast.error('Please enter parent contact number');
          setIsSubmitting(false);
          return;
        }

        const normalizedPhone = normalizePhoneNumber(newParentPhone);
        if (!isValidPHPhoneNumber(normalizedPhone)) {
          toast.error('Please enter a valid Philippine contact number (e.g., 09171234567)');
          setIsSubmitting(false);
          return;
        }

        const creds = await createNewParentAccount({
          name: newParentName.trim(),
          contactNumber: newParentPhone.trim(),
          studentId: tuteeId,
          tutorId: user.id,
          tutorName: user.name,
          tutorRole: user.role,
          studentName: tuteeName,
        });

        toast.success('Parent account created and linked successfully!');
        onSuccess(creds, creds.parentId);
      }
    } catch (err: any) {
      console.error('Error linking/creating parent:', err);
      toast.error(err.message || 'Failed to complete parent account operation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-br from-green-700 to-green-900 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <UserPlus size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Create or Link Parent Account</h3>
              <p className="text-green-100 text-xs mt-0.5">Link a parent portal account for {tuteeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="border rounded-xl p-4 bg-gray-50/50 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Parent Account Status
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modalParentStatus"
                    value="existing"
                    checked={parentStatus === 'existing'}
                    onChange={() => {
                      setParentStatus('existing');
                      setNewParentName('');
                      setNewParentPhone('');
                    }}
                    className="w-4 h-4 text-green-700 focus:ring-green-700"
                  />
                  <span className="text-sm font-medium text-gray-900">Existing Parent</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modalParentStatus"
                    value="new"
                    checked={parentStatus === 'new'}
                    onChange={() => {
                      setParentStatus('new');
                      setSelectedParentId(null);
                      setSearchResults([]);
                    }}
                    className="w-4 h-4 text-green-700 focus:ring-green-700"
                  />
                  <span className="text-sm font-medium text-gray-900">New Parent</span>
                </label>
              </div>
            </div>

            {parentStatus === 'existing' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Search Parent by Name or Contact Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!e.target.value.trim()) setSearchResults([]);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearch();
                        }
                      }}
                      className="flex-1 p-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 text-sm placeholder:text-xs bg-white"
                      placeholder="e.g. Maria Santos or 09171234567"
                    />
                    <button
                      type="button"
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                      className="px-4 py-2.5 bg-green-700 text-white rounded-xl hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Search size={16} />
                      {isSearching ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                </div>

                {searchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto divide-y bg-white shadow-sm">
                    {searchResults.map((p) => {
                      const isSelected = selectedParentId === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`flex justify-between items-center p-3 text-sm transition-colors ${
                            isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-gray-900">{p.name}</p>
                            <p className="text-gray-500 text-xs">
                              {p.contactNumber || 'No phone'} • {p.email}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedParentId(isSelected ? null : p.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              isSelected
                                ? 'bg-green-700 border-green-800 text-white hover:bg-green-800'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {parentStatus === 'new' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Parent Name *
                  </label>
                  <input
                    type="text"
                    value={newParentName}
                    onChange={(e) => setNewParentName(e.target.value)}
                    className="w-full p-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 text-sm placeholder:text-xs bg-white"
                    placeholder="e.g., Maria Santos"
                    required={parentStatus === 'new'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contact Number *{' '}
                    <span className="text-gray-500 font-normal">(will be used as username)</span>
                  </label>
                  <input
                    type="tel"
                    value={newParentPhone}
                    onChange={(e) => setNewParentPhone(e.target.value)}
                    className="w-full p-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 text-sm placeholder:text-xs bg-white"
                    placeholder="09171234567"
                    required={parentStatus === 'new'}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2">
                  <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Note:</strong> A temporary password will be auto-generated. The parent
                    will be required to change it on first login.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-green-700 text-white py-3 px-4 rounded-xl hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : parentStatus === 'existing' ? (
                'Link Parent Account'
              ) : (
                'Create & Link Parent Account'
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
