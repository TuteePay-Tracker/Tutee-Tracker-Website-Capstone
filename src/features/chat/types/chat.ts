export interface ChatThread {
  id: string; // matches the tuteeId
  tuteeId: string;
  tuteeName: string;
  tutorId: string;
  tutorName: string;
  parentId: string;
  parentName: string;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageTimestamp?: any; // Timestamp or date string
  unreadCount: {
    [userId: string]: number;
  };
  updatedAt?: any;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any; // Firestore Timestamp or ISO date string
  status: 'sent' | 'seen';
}
