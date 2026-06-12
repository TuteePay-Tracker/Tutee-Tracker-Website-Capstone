import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  increment,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '@/shared/lib/firebase/config';
import { ChatThread, Message } from '@/features/chat/types/chat';

class ChatService {
  /**
   * Subscribe to chat threads for the current user
   */
  subscribeToThreads(
    userId: string, 
    role: 'tutor' | 'parent', 
    callback: (threads: ChatThread[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const q = query(
      collection(db, 'chats'),
      where(role === 'tutor' ? 'tutorId' : 'parentId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      const threads: ChatThread[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          tuteeId: data.tuteeId,
          tuteeName: data.tuteeName,
          tutorId: data.tutorId,
          tutorName: data.tutorName,
          parentId: data.parentId,
          parentName: data.parentName,
          lastMessageText: data.lastMessageText,
          lastMessageSenderId: data.lastMessageSenderId,
          lastMessageTimestamp: data.lastMessageTimestamp,
          unreadCount: data.unreadCount || {},
          updatedAt: data.updatedAt
        } as ChatThread;
      });

      // Sort in-memory to avoid composite index requirements
      threads.sort((a, b) => {
        const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt || 0).getTime();
        const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt || 0).getTime();
        return timeB - timeA;
      });

      callback(threads);
    }, (error) => {
      console.error('Error subscribing to threads:', error);
      if (onError) onError(error);
    });
  }

  /**
   * Subscribe to messages in a specific chat thread
   */
  subscribeToMessages(
    chatId: string, 
    callback: (messages: Message[]) => void
  ): () => void {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages: Message[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          senderId: data.senderId,
          senderName: data.senderName,
          text: data.text,
          timestamp: data.timestamp,
          status: data.status || 'sent'
        } as Message;
      });
      callback(messages);
    }, (error) => {
      console.error('Error subscribing to messages:', error);
    });
  }

  /**
   * Send a message in a chat thread
   */
  async sendMessage(
    chatId: string, 
    senderId: string, 
    senderName: string, 
    text: string, 
    recipientId: string
  ): Promise<void> {
    try {
      // Add message to subcollection
      const msgRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(msgRef, {
        senderId,
        senderName,
        text,
        timestamp: serverTimestamp(),
        status: 'sent'
      });

      // Update parent thread document with last message info and increment unread count
      const threadRef = doc(db, 'chats', chatId);
      await updateDoc(threadRef, {
        lastMessageText: text,
        lastMessageSenderId: senderId,
        lastMessageTimestamp: serverTimestamp(),
        [`unreadCount.${recipientId}`]: increment(1),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Mark all unread messages from a sender as read
   */
  async markAsRead(chatId: string, readerId: string, writerId: string): Promise<void> {
    try {
      // 1. Reset reader's unread count
      const threadRef = doc(db, 'chats', chatId);
      await updateDoc(threadRef, {
        [`unreadCount.${readerId}`]: 0
      });

      // 2. Update status of unread messages to 'seen'
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        where('senderId', '==', writerId),
        where('status', '==', 'sent')
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => {
          batch.update(docSnap.ref, { status: 'seen' });
        });
        await batch.commit();
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  /**
   * Get or create a chat thread for a tutee
   */
  async getOrCreateThread(
    tutee: { id: string; firstName: string; surname: string; parentId?: string },
    parentId: string,
    tutorId: string
  ): Promise<ChatThread> {
    try {
      const threadRef = doc(db, 'chats', tutee.id);
      const docSnap = await getDoc(threadRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          tuteeId: data.tuteeId,
          tuteeName: data.tuteeName,
          tutorId: data.tutorId,
          tutorName: data.tutorName,
          parentId: data.parentId,
          parentName: data.parentName,
          unreadCount: data.unreadCount || {},
          updatedAt: data.updatedAt
        } as ChatThread;
      }

      // Thread doesn't exist, fetch tutor and parent details to build thread
      const parentDoc = await getDoc(doc(db, 'users', parentId));
      const tutorDoc = await getDoc(doc(db, 'users', tutorId));

      const parentName = parentDoc.exists() ? parentDoc.data().name : 'Parent';
      const tutorName = tutorDoc.exists() ? tutorDoc.data().name : 'Tutor';
      const studentName = `${tutee.firstName} ${tutee.surname}`;

      const initialThreadData: Omit<ChatThread, 'id'> = {
        tuteeId: tutee.id,
        tuteeName: studentName,
        tutorId,
        tutorName,
        parentId,
        parentName,
        unreadCount: {
          [tutorId]: 0,
          [parentId]: 0
        },
        updatedAt: serverTimestamp() as any
      };

      await setDoc(threadRef, initialThreadData);

      return {
        id: tutee.id,
        ...initialThreadData
      } as ChatThread;
    } catch (error) {
      console.error('Error getting or creating thread:', error);
      throw error;
    }
  }
}

export const chatService = new ChatService();
