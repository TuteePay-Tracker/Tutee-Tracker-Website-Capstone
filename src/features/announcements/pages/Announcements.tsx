import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Announcement, AnnouncementFormData } from '@/features/announcements/types/announcement';
import { announcementService } from '@/features/announcements/services/announcementService';
import { Megaphone, Plus, Pencil, Trash2, X, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/shared/utils/auditLogger';

export const Announcements = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnounce, setEditingAnnounce] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementFormData>({
    title: '',
    content: '',
    priority: 'medium'
  });

  const tutorId = user?.role === 'parent' ? user.createdByTutorId : user?.id;

  useEffect(() => {
    if (tutorId) {
      return announcementService.subscribe(tutorId, setAnnouncements);
    }
  }, [tutorId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || user.role !== 'tutor') return;

    try {
      if (editingAnnounce) {
        await announcementService.update(user.id, editingAnnounce.id, form);
        toast.success('Announcement updated');
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Announcement Edited',
          'Announcements',
          `Updated announcement "${form.title}"`
        );
      } else {
        await announcementService.create(user.id, form);
        toast.success('Announcement posted to parents');
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Announcement Posted',
          'Announcements',
          `Posted announcement "${form.title}"`
        );
      }
      setIsModalOpen(false);
      setEditingAnnounce(null);
      setForm({ title: '', content: '', priority: 'medium' });
    } catch (error) {
      toast.error('Failed to save announcement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.id || user.role !== 'tutor') return;
    const announceToDelete = announcements.find(a => a.id === id);
    const announceTitle = announceToDelete ? announceToDelete.title : 'Announcement';
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await announcementService.delete(user.id, id);
      toast.success('Announcement removed');
      await logActivity(
        user.id,
        user.name,
        user.role,
        'Announcement Deleted',
        'Announcements',
        `Deleted announcement "${announceTitle}"`
      );
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const openEdit = (a: Announcement) => {
    setEditingAnnounce(a);
    setForm({
      title: a.title,
      content: a.content,
      priority: a.priority
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Announcements</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            {user?.role === 'tutor' 
              ? 'Broadcast news and updates to parents' 
              : 'Updates and broadcasts from your tutor'}
          </p>
        </div>
        {user?.role === 'tutor' && (
          <button
            onClick={() => {
              setEditingAnnounce(null);
              setForm({ title: '', content: '', priority: 'medium' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-green-700 text-white px-4 py-2.5 rounded-xl hover:bg-green-800 transition-colors font-semibold shadow-sm w-full sm:w-auto justify-center sm:justify-start shrink-0"
          >
            <Plus size={18} />
            Post Announcement
          </button>
        )}
      </div>

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
            <Bell className="mx-auto text-gray-300 mb-4 animate-bounce" size={48} />
            <p className="text-gray-500 text-lg font-medium">No announcements found</p>
            <p className="text-gray-400 text-sm mt-2">
              {user?.role === 'tutor' 
                ? 'Create an announcement to share updates with parents' 
                : 'No announcements from your tutor yet'}
            </p>
          </div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group relative">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-lg text-gray-900">{a.title}</h3>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border tracking-wider ${
                      a.priority === 'high' ? 'bg-red-50 border-red-200 text-red-755' :
                      a.priority === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-755' :
                      'bg-blue-50 border-blue-200 text-blue-755'
                    }`}>
                      {a.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2.5 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                  <p className="text-[10px] text-gray-400 mt-4 font-semibold italic">
                    Posted on {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
                {user?.role === 'tutor' && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(a)}
                      className="p-2 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-xl transition-colors"
                      title="Edit announcement"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Delete announcement"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-green-700 to-green-950 p-5 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingAnnounce ? 'Edit Announcement' : 'Post Announcement'}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-gray-400 tracking-wider mb-1">Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Class Schedule Updates"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-medium"
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold uppercase text-gray-400 tracking-wider mb-1">Priority</label>
                <select
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-semibold"
                  value={form.priority}
                  onChange={e => setForm({...form, priority: e.target.value as any})}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-extrabold uppercase text-gray-400 tracking-wider mb-1">Content</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-medium resize-none leading-relaxed"
                  value={form.content}
                  onChange={e => setForm({...form, content: e.target.value})}
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button type="submit" className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 transition-all shadow-md shadow-green-700/10">
                  {editingAnnounce ? 'Save Changes' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
