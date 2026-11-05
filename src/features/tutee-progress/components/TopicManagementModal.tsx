import { useState } from 'react';
import { X, Plus, Edit2, Trash2, BookOpen, AlertCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Topic } from '@/features/tutee-progress/types/topic';

interface TopicManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  topics: Topic[];
  onOpenAddTopic: () => void;
  onOpenEditTopic: (topic: Topic) => void;
  onDeleteTopic: (topicId: string, topicName: string, subject?: string) => Promise<void>;
}

export function TopicManagementModal({
  isOpen,
  onClose,
  subject,
  topics,
  onOpenAddTopic,
  onOpenEditTopic,
  onDeleteTopic,
}: TopicManagementModalProps) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredTopics = topics.filter((t) =>
    search ? t.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const handleDelete = async (t: Topic) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${t.name}"? Student progress records for this topic will remain preserved in historical assessments.`
      )
    ) {
      return;
    }

    try {
      await onDeleteTopic(t.id, t.name, subject);
      toast.success(`Deleted topic "${t.name}"`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete topic');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-700 text-white flex items-center justify-center shadow-md shadow-green-700/20">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                  {subject}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500 font-medium">
                  {topics.length} topic{topics.length === 1 ? '' : 's'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mt-0.5">
                Manage Subject Topics
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

        {/* Action & Search Bar */}
        <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium text-gray-800"
            />
          </div>
          <button
            type="button"
            onClick={onOpenAddTopic}
            className="px-3.5 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} />
            <span>Add Topic</span>
          </button>
        </div>

        {/* Topics List Body */}
        <div className="p-6 overflow-y-auto space-y-2.5 flex-1">
          {topics.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
              <AlertCircle size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-700">No topics added for {subject}</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto mb-4">
                Topics allow you to break down this subject into individual units or learning areas based on what you actually teach.
              </p>
              <button
                type="button"
                onClick={onOpenAddTopic}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Add First Topic</span>
              </button>
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No topics match your search query "{search}".
            </div>
          ) : (
            filteredTopics.map((t, idx) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50/10 transition-all group"
              >
                <div className="flex items-start gap-3 min-w-0 pr-3">
                  <span className="w-6 h-6 rounded-lg bg-green-50 text-green-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 border border-green-200">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{t.name}</p>
                    {t.description ? (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400 mt-0.5 italic">No description provided</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenEditTopic(t)}
                    className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                    title="Edit topic"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete topic"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {topics.length} topic{topics.length === 1 ? '' : 's'} managed for {subject}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
