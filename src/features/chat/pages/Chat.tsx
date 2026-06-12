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
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';

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
  const [tutorName, setTutorName] = useState<string>('Tutor');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListenerRef = useRef<(() => void) | null>(null);

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
        const mapping: Record<string, string> = {};
        snap.docs.forEach(docSnap => {
          mapping[docSnap.id] = docSnap.data().name || 'Parent';
        });
        setParentNames(mapping);
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
        const tutorSnap = await getDoc(doc(db, 'users', user.createdByTutorId));
        if (tutorSnap.exists()) {
          setTutorName(tutorSnap.data().name || 'Tutor');
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
        toast.error('Failed to load chat conversations');
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

    // Mark active thread's messages as read
    const otherUserId = user?.role === 'tutor' ? activeThread.parentId : activeThread.tutorId;
    if (user?.id) {
      chatService.markAsRead(activeThread.id, user.id, otherUserId);
    }

    // Subscribe to new messages
    const unsubscribe = chatService.subscribeToMessages(activeThread.id, (msgs) => {
      setMessages(msgs);
      // Auto scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

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
      await chatService.sendMessage(
        activeThread.id,
        user.id,
        user.name,
        textToSend,
        recipientId
      );
      // Scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      toast.error('Failed to send message');
      setInputText(textToSend); // Restore text on failure
    } finally {
      setIsSending(false);
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
                  <div className="w-11 h-11 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center shrink-0 shadow-inner uppercase text-sm">
                    {item.studentName.slice(0, 2)}
                  </div>
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
                <div className="w-10 h-10 rounded-full bg-green-700 text-white font-bold flex items-center justify-center shrink-0 uppercase text-xs">
                  {(user?.role === 'tutor' ? activeThread.parentName : activeThread.tutorName).slice(0, 2)}
                </div>
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

                  return (
                    <React.Fragment key={msg.id || index}>
                      {showDateHeader && (
                        <div className="flex justify-center my-4">
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-200/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {formatDateHeader(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        <div className="max-w-[75%] sm:max-w-[65%]">
                          {/* Sender name for other users in thread */}
                          {!isMe && (
                            <span className="block text-[10px] font-bold text-gray-400 ml-2 mb-0.5 uppercase tracking-wide">
                              {msg.senderName}
                            </span>
                          )}
                          
                          <div className={`p-3.5 rounded-2xl shadow-sm leading-relaxed text-sm ${
                            isMe 
                              ? 'bg-green-700 text-white rounded-tr-none' 
                              : 'bg-white text-gray-800 border border-gray-150 rounded-tl-none'
                          }`}>
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          </div>

                          {/* Timestamp and seen state */}
                          <div className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] text-gray-400 font-medium ${
                            isMe ? 'justify-end' : 'justify-start'
                          }`}>
                            <Clock size={10} />
                            <span>{formatTime(msg.timestamp)}</span>
                            {isMe && (
                              <span className="flex items-center">
                                {msg.status === 'seen' ? (
                                  <CheckCheck size={12} className="text-blue-500" title="Seen" />
                                ) : (
                                  <Check size={12} title="Sent" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input typing panel */}
            <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 flex gap-2 items-center">
              <input
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
