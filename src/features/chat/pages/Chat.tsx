import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { chatService } from '@/features/chat/services/chatService';
import { ChatThread, Message } from '@/features/chat/types/chat';
import { Tutee } from '@/features/tutees/types/tutee';
import { 
  Send, 
  Search, 
  MessageSquare, 
  ArrowLeft, 
  Check, 
  CheckCheck, 
  User, 
  GraduationCap,
  Clock,
  Trash2,
  Reply,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { shouldShowFirestoreError } from '@/shared/utils/firestoreErrors';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { logActivity } from '@/shared/utils/auditLogger';

export const Chat = () => {
  const { user } = useAuth();
  const { tutees, isLoading: loadingTutees } = useTutees();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  const [parentPhotos, setParentPhotos] = useState<Record<string, string>>({});
  const [tutorName, setTutorName] = useState<string>('Tutor');
  const [tutorPhoto, setTutorPhoto] = useState<string>('');
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageListenerRef = useRef<(() => void) | null>(null);
  const isFirstLoadRef = useRef(true);

  // Load parent user profiles to map parentId -> parentName
  useEffect(() => {
    if (!user || user.role !== 'tutor') return;

    const loadParents = async () => {
      try {
        const q = query(
          collection(db, 'users'), 
          where('role', '==', 'parent'), 
          where('createdByTutorId', '==', user.id)
        );
        const snap = await getDocs(q);
        const nameMapping: Record<string, string> = {};
        const photoMapping: Record<string, string> = {};
        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          nameMapping[docSnap.id] = data.name || 'Parent';
          photoMapping[docSnap.id] = data.photoUrl || '';
        });
        setParentNames(nameMapping);
        setParentPhotos(photoMapping);
      } catch (err) {
        console.error('Error loading parents list:', err);
      }
    };

    loadParents();
  }, [user]);

  // Load tutor user profile to map tutorId -> tutorName
  useEffect(() => {
    if (!user || user.role !== 'parent' || !user.createdByTutorId) return;

    const loadTutor = async () => {
      try {
        const tutorSnap = await getDoc(doc(db, 'users', user.createdByTutorId as string));
        if (tutorSnap.exists()) {
          const data = tutorSnap.data();
          setTutorName(data.name || 'Tutor');
          setTutorPhoto(data.photoUrl || '');
        }
      } catch (err) {
        console.error('Error loading tutor details:', err);
      }
    };

    loadTutor();
  }, [user]);

  // Subscribe to threads in real-time
  useEffect(() => {
    if (!user?.id) return;

    setLoadingThreads(true);
    const unsubscribe = chatService.subscribeToThreads(
      user.id,
      user.role,
      (updatedThreads) => {
        setThreads(updatedThreads);
        setLoadingThreads(false);

        // Keep active thread data fresh if it is updated in the background
        setActiveThread(prevActive => {
          if (!prevActive) return null;
          const freshActive = updatedThreads.find(t => t.id === prevActive.id);
          return freshActive || prevActive;
        });
      },
      (error) => {
        console.error('Error loading chat threads:', error);
        setLoadingThreads(false);
        if (shouldShowFirestoreError(error)) {
          toast.error('Failed to load chat conversations');
        }
      }
    );

    return () => unsubscribe();
  }, [user?.id, user?.role]);

  // Subscribe to messages when active thread changes
  useEffect(() => {
    // Clean up previous message listener
    if (messageListenerRef.current) {
      messageListenerRef.current();
      messageListenerRef.current = null;
    }

    if (!activeThread) {
      setMessages([]);
      return;
    }

    // Reset first-load flag whenever we switch to a new thread
    isFirstLoadRef.current = true;
    setReplyingTo(null);

    // Mark active thread's messages as read
    const otherUserId = user?.role === 'tutor' ? activeThread.parentId : activeThread.tutorId;
    if (user?.id) {
      chatService.markAsRead(activeThread.id, user.id, otherUserId);
    }

    // Subscribe to new messages
    const unsubscribe = chatService.subscribeToMessages(activeThread.id, (msgs) => {
      setMessages(msgs);

      // On first load: jump instantly to bottom so user sees latest message
      // On subsequent updates (new incoming message): scroll smoothly
      const behavior = isFirstLoadRef.current ? 'instant' : 'smooth';
      isFirstLoadRef.current = false;

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
      }, 50);

      // Reset read count when new messages arrive while viewing
      if (user?.id && msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== user.id) {
          chatService.markAsRead(activeThread.id, user.id, otherUserId);
        }
      }
    });

    messageListenerRef.current = unsubscribe;

    return () => {
      if (messageListenerRef.current) {
        messageListenerRef.current();
      }
    };
  }, [activeThread?.id, user?.id]);

  // Send message handler
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeThread || !user) return;

    setIsSending(true);
    const textToSend = inputText.trim();
    setInputText(''); // Clear input immediately for better UX

    try {
      const recipientId = user.role === 'tutor' ? activeThread.parentId : activeThread.tutorId;
      const replyToParam = replyingTo
        ? { id: replyingTo.id, text: replyingTo.text, senderName: replyingTo.senderName }
        : undefined;
      setReplyingTo(null);
      await chatService.sendMessage(
        activeThread.id,
        user.id,
        user.name,
        textToSend,
        recipientId,
        replyToParam
      );
      // Scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

      await logActivity(
        user.id,
        user.name,
        user.role,
        'Message Sent',
        'Messaging',
        `Sent a message in conversation for student ${activeThread.tuteeName}`
      );
    } catch (error) {
      toast.error('Failed to send message');
      setInputText(textToSend); // Restore text on failure
    } finally {
      setIsSending(false);
    }
  };

  // Delete a message with confirmation
  const handleDeleteMessage = async (msgId: string) => {
    if (!activeThread) return;
    try {
      await chatService.deleteMessage(activeThread.id, msgId);
      setDeletingMsgId(null);
    } catch {
      toast.error('Failed to delete message');
    }
  };

  // Open or create a thread for a specific tutee
  const handleSelectTutee = async (tutee: Tutee) => {
    if (!user) return;
    try {
      let threadId = tutee.id;
      let parentId = tutee.parentId;
      let tutorId = user.role === 'tutor' ? user.id : user.createdByTutorId;

      if (!parentId && user.role === 'parent') {
        parentId = user.id;
      }

      if (!parentId) {
        toast.error('This student is not linked to a parent account yet');
        return;
      }

      if (!tutorId) {
        toast.error('Tutor information is missing');
        return;
      }

      // Show temporary loading indicator
      const tempThread = await chatService.getOrCreateThread(tutee, parentId, tutorId);
      setActiveThread(tempThread);
      setShowMobileChat(true);
    } catch (err) {
      toast.error('Failed to open conversation');
    }
  };

  // Format message timestamp
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format date header for message grouping
  const formatDateHeader = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    }
  };

  const getTuteePhoto = (tuteeId: string) => {
    const found = tutees.find(t => t.id === tuteeId);
    return found?.photoUrl || null;
  };

  const getChatPartnerPhoto = () => {
    if (!activeThread) return null;
    if (user?.role === 'tutor') {
      return parentPhotos[activeThread.parentId] || null;
    } else {
      return tutorPhoto || null;
    }
  };

  // Filter threads and listable contacts
  const getFilteredList = () => {
    const list: Array<{
      type: 'thread' | 'contact';
      id: string;
      title: string;
      subtitle: string;
      studentName: string;
      lastMessage?: string;
      timestamp?: any;
      unreadCount?: number;
      threadData?: ChatThread;
      tuteeData?: Tutee;
    }> = [];

    // 1. Add active threads
    threads.forEach(thread => {
      const isSearchMatch = 
        thread.tuteeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.tutorName.toLowerCase().includes(searchQuery.toLowerCase());

      if (isSearchMatch) {
        const title = user?.role === 'tutor' ? thread.parentName : thread.tutorName;
        const subtitle = `re: ${thread.tuteeName}`;
        list.push({
          type: 'thread',
          id: thread.id,
          title,
          subtitle,
          studentName: thread.tuteeName,
          lastMessage: thread.lastMessageText,
          timestamp: thread.lastMessageTimestamp,
          unreadCount: thread.unreadCount[user?.id || ''] || 0,
          threadData: thread
        });
      }
    });

    // 2. Add tutees without active threads as "contacts" to initiate new chats
    tutees.forEach(tutee => {
      const hasThread = threads.some(t => t.tuteeId === tutee.id);
      if (!hasThread) {
        const isSearchMatch = 
          `${tutee.firstName} ${tutee.surname}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tutee.subject.toLowerCase().includes(searchQuery.toLowerCase());

        if (isSearchMatch) {
          // Tutors only show tutees with a parent linked
          // Parents show all their children
          if (user?.role === 'parent' || (user?.role === 'tutor' && tutee.parentId)) {
            const title = user?.role === 'tutor' 
              ? (parentNames[tutee.parentId || ''] || 'Parent') 
              : (tutorName || 'Tutor');
            list.push({
              type: 'contact',
              id: tutee.id,
              title: title,
              subtitle: `re: ${tutee.firstName} ${tutee.surname} (${tutee.subject})`,
              studentName: `${tutee.firstName} ${tutee.surname}`,
              tuteeData: tutee
            });
          }
        }
      }
    });

    return list;
  };

  const chatList = getFilteredList();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-[calc(100vh-180px)] min-h-[450px] flex">
      
      {/* Sidebar List Pane */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col shrink-0 bg-gray-50/50 ${
        showMobileChat ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Search header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare className="text-green-700" size={22} />
            Messages
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search chat or student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loadingThreads || loadingTutees ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading chats...</div>
          ) : chatList.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <MessageSquare size={36} className="mx-auto mb-2 opacity-50" />
              <p className="font-medium">No messages yet</p>
              <p className="text-xs mt-1 text-gray-400">
                {user?.role === 'tutor' 
                  ? 'Link parent accounts to your tutees to begin chatting.' 
                  : 'Your children accounts will appear here once linked.'}
              </p>
            </div>
          ) : (
            chatList.map(item => {
              const isSelected = activeThread?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.type === 'thread' && item.threadData) {
                      setActiveThread(item.threadData);
                    } else if (item.type === 'contact' && item.tuteeData) {
                      handleSelectTutee(item.tuteeData);
                    }
                    setShowMobileChat(true);
                  }}
                  className={`w-full text-left p-4 transition-colors flex gap-3 items-center ${
                    isSelected ? 'bg-green-50/70 border-l-4 border-green-700 pl-3' : 'hover:bg-gray-100 bg-white'
                  }`}
                >
                  {getTuteePhoto(item.threadData?.tuteeId || item.tuteeData?.id || '') ? (
                    <img
                      src={getTuteePhoto(item.threadData?.tuteeId || item.tuteeData?.id || '')!}
                      alt={item.studentName}
                      className="w-11 h-11 rounded-full object-cover shrink-0 border border-gray-250 shadow-sm"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center shrink-0 shadow-inner uppercase text-sm">
                      {item.studentName.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-semibold text-gray-900 text-sm truncate">{item.title}</span>
                      {item.timestamp && (
                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                          {formatTime(item.timestamp)}
                        </span>
                      )}
                    </div>
                    <span className="block text-[11px] font-semibold text-green-700 mb-1 tracking-wide uppercase">
                      {item.subtitle}
                    </span>
                    <p className="text-xs text-gray-500 truncate">
                      {item.type === 'contact' 
                        ? 'Click to start chat thread' 
                        : item.lastMessage || 'No messages in this thread yet'}
                    </p>
                  </div>
                  {item.unreadCount && item.unreadCount > 0 ? (
                    <div className="bg-green-700 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                      {item.unreadCount}
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Messaging Pane */}
      <div className={`flex-1 flex flex-col bg-gray-50/30 ${
        showMobileChat ? 'flex' : 'hidden md:flex'
      }`}>
        {activeThread ? (
          <>
            {/* Active Thread Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 mr-1 shrink-0"
                >
                  <ArrowLeft size={18} />
                </button>
                {getChatPartnerPhoto() ? (
                  <img
                    src={getChatPartnerPhoto()!}
                    alt={user?.role === 'tutor' ? activeThread.parentName : activeThread.tutorName}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-250 shadow-sm"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-green-700 text-white font-bold flex items-center justify-center shrink-0 uppercase text-xs">
                    {(user?.role === 'tutor' ? activeThread.parentName : activeThread.tutorName).slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
                    {user?.role === 'tutor' ? activeThread.parentName : activeThread.tutorName}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 font-medium">
                    <GraduationCap size={13} className="text-green-700" />
                    <span className="truncate">Student: {activeThread.tuteeName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <MessageSquare size={48} className="text-gray-300 mb-3 animate-bounce" />
                  <p className="text-gray-500 font-medium text-sm">Wave hello! 👋</p>
                  <p className="text-gray-400 text-xs mt-1">Send a message to start this discussion.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderId === user?.id;
                  const showDateHeader = index === 0 || 
                    formatDateHeader(messages[index - 1].timestamp) !== formatDateHeader(msg.timestamp);
                  const isConfirmingDelete = deletingMsgId === msg.id;

                  return (
                    <React.Fragment key={msg.id || index}>
                      {showDateHeader && (
                        <div className="flex justify-center my-4">
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-200/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {formatDateHeader(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in group/msg`}>
                        <div className="max-w-[75%] sm:max-w-[65%]">
                          {/* Sender name for other users in thread */}
                          {!isMe && (
                            <span className="block text-[10px] font-bold text-gray-400 ml-2 mb-0.5 uppercase tracking-wide">
                              {msg.senderName}
                            </span>
                          )}
                          
                          {/* Message bubble + action buttons row */}
                          <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`p-3.5 rounded-2xl shadow-sm leading-relaxed text-sm ${
                              isMe 
                                ? 'bg-green-700 text-white rounded-tr-none' 
                                : 'bg-white text-gray-800 border border-gray-150 rounded-tl-none'
                            }`}>
                              {/* Quoted reply preview */}
                              {msg.replyToText && (
                                <div className={`mb-2 px-2.5 py-1.5 rounded-lg border-l-4 ${
                                  isMe ? 'bg-white/15 border-white/80' : 'bg-gray-50 border-green-700'
                                }`}>
                                  <span className={`block text-[10px] font-bold uppercase tracking-wide ${
                                    isMe ? 'text-green-100' : 'text-green-700'
                                  }`}>
                                    {msg.replyToSenderName === user?.name ? 'You' : msg.replyToSenderName}
                                  </span>
                                  <p className={`text-xs line-clamp-2 break-words ${
                                    isMe ? 'text-green-50/90' : 'text-gray-500'
                                  }`}>
                                    {msg.replyToText}
                                  </p>
                                </div>
                              )}
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            </div>

                            {/* Reply button — all messages, shown on hover */}
                            {!isConfirmingDelete && (
                              <button
                                onClick={() => {
                                  setReplyingTo(msg);
                                  inputRef.current?.focus();
                                }}
                                className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 text-gray-400 hover:text-green-700 rounded-lg shrink-0 mb-1"
                                title="Reply"
                              >
                                <Reply size={13} />
                              </button>
                            )}

                            {/* Delete button — only own messages, shown on hover */}
                            {isMe && msg.id && !isConfirmingDelete && (
                              <button
                                onClick={() => setDeletingMsgId(msg.id!)}
                                className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 rounded-lg shrink-0 mb-1"
                                title="Delete message"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {/* Inline delete confirmation */}
                          {isMe && isConfirmingDelete && (
                            <div className="flex items-center justify-end gap-1.5 mt-1 px-1">
                              <span className="text-[10px] text-gray-500 font-medium">Delete this message?</span>
                              <button
                                onClick={() => handleDeleteMessage(msg.id!)}
                                className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-full transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeletingMsgId(null)}
                                className="text-[10px] font-bold text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          {/* Timestamp and seen state */}
                          {!isConfirmingDelete && (
                            <div className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] text-gray-400 font-medium ${
                              isMe ? 'justify-end' : 'justify-start'
                            }`}>
                              <Clock size={10} />
                              <span>{formatTime(msg.timestamp)}</span>
                              {isMe && (
                                <span className="flex items-center">
                                  {msg.status === 'seen' ? (
                                    <span title="Seen">
                                      <CheckCheck size={12} className="text-blue-500" />
                                    </span>
                                  ) : (
                                    <span title="Sent">
                                      <Check size={12} />
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Replying-to bar */}
            {replyingTo && (
              <div className="px-3 pt-2 bg-white border-t border-gray-200">
                <div className="flex items-center gap-2 bg-green-50 border-l-4 border-green-700 rounded-r-lg px-3 py-1.5">
                  <Reply size={13} className="text-green-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-[10px] font-bold text-green-700 uppercase tracking-wide">
                      Replying to {replyingTo.senderId === user?.id ? 'yourself' : replyingTo.senderName}
                    </span>
                    <p className="text-xs text-gray-500 truncate">{replyingTo.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                    title="Cancel reply"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Input typing panel */}
            <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message here..."
                disabled={isSending}
                className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="bg-green-700 text-white p-3 rounded-xl hover:bg-green-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 shrink-0 flex items-center justify-center shadow-md shadow-green-700/10"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50/30">
            <MessageSquare size={64} className="text-gray-200 mb-4" />
            <h3 className="font-bold text-gray-800 text-base">Select a conversation</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Choose a contact or conversation from the sidebar list to start exchanging real-time messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
