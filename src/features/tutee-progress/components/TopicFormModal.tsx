import { useState, useEffect } from 'react';
import { X, Check, BookOpen, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Topic } from '@/features/tutee-progress/types/topic';

interface TopicFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  editingTopic?: Topic | null;
  existingTopics: Topic[];
  onSave: (name: string, description?: string) => Promise<void>;
}

export function TopicFormModal({
  isOpen,
  onClose,
  subject,
  editingTopic,
  existingTopics,
  onSave,
}: TopicFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(editingTopic);

  useEffect(() => {
    if (isOpen) {
      setName(editingTopic?.name ?? '');
      setDescription(editingTopic?.description ?? '');
    }
  }, [isOpen, editingTopic]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Please enter a topic name');
      return;
    }

    // Check duplicate
    const isDuplicate = existingTopics.some((t) => {
      if (isEditing && t.id === editingTopic?.id) return false;
      return t.name.trim().toLowerCase() === trimmedName.toLowerCase();
    });

    if (isDuplicate) {
      toast.error(`A topic named "${trimmedName}" already exists in ${subject}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(trimmedName, description.trim() || undefined);
      toast.success(isEditing ? 'Topic updated' : `Topic "${trimmedName}" added to ${subject}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save topic');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-700 text-white flex items-center justify-center shadow-md shadow-green-700/20">
              {isEditing ? <BookOpen size={20} /> : <Plus size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                  {subject}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mt-0.5">
                {isEditing ? 'Edit Topic' : 'Add New Topic'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Topic / Learning Area Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g., Reading Comprehension, Fractions, Cell Biology"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:bg-white focus:border-transparent outline-none font-medium text-gray-900 placeholder:text-gray-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Specify the exact topic, unit, or skill you teach in {subject}.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Description / Learning Objective (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g., Identifying main ideas and supporting details in passages..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:bg-white focus:border-transparent outline-none text-gray-700 placeholder:text-gray-400"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Topic'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

