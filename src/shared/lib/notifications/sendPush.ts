import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '@/shared/lib/firebase/config';
import { formatCurrency } from '@/shared/utils/formatCurrency';

const PUSH_RELAY_URL =
  (import.meta.env.VITE_PUSH_RELAY_URL as string | undefined) ?? 'http://localhost:4000';

export type PushData = Record<string, string | number | boolean>;

interface PushMessageOptions {
  recipientId?: string;
  tokens: string[];
  title: string;
  body: string;
  data?: PushData;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
}

export async function getUserTokens(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const tokensRef = collection(db, 'users', userId, 'pushTokens');
    const snapshot = await getDocs(tokensRef);
    return snapshot.docs
      .map((docSnap) => docSnap.data().token)
      .filter((token): token is string => typeof token === 'string' && token.length > 0);
  } catch (error) {
    console.warn('Failed to fetch push tokens:', error);
    return [];
  }
}

export async function getLinkedParents(tutorId: string): Promise<string[]> {
  if (!tutorId) return [];
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('createdByTutorId', '==', tutorId),
      where('role', '==', 'parent')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.id);
  } catch (error) {
    console.warn('Failed to fetch linked parents:', error);
    return [];
  }
}

export async function sendPushMessage({
  recipientId,
  tokens,
  title,
  body,
  data,
  sound = 'default',
  priority = 'high',
}: PushMessageOptions): Promise<void> {
  const uniqueTokens = [...new Set(tokens)].filter((t) => typeof t === 'string' && t.length > 0);
  if (uniqueTokens.length === 0) return;

  const targetUserId = recipientId || auth.currentUser?.uid;

  const expoTokens = uniqueTokens.filter(
    (t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')
  );
  const fcmTokens = uniqueTokens.filter(
    (t) => !t.startsWith('ExponentPushToken[') && !t.startsWith('ExpoPushToken[')
  );

  // 1. Send Expo mobile tokens via Relay Server
  if (expoTokens.length > 0) {
    for (let i = 0; i < expoTokens.length; i += 100) {
      const chunk = expoTokens.slice(i, i + 100);

      try {
        const response = await fetch(`${PUSH_RELAY_URL}/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ tokens: chunk, title, body, data, sound, priority }),
        });

        if (!response.ok) {
          console.warn('Expo Push relay error:', response.status, await response.text());
          continue;
        }

        const result = await response.json();
        const tickets = result?.tickets as
          | Array<{ status?: string; details?: { error?: string }; message?: string }>
          | undefined;
        if (Array.isArray(tickets)) {
          tickets.forEach((ticket, index) => {
            if (ticket?.status === 'error') {
              const detail = ticket.details?.error;
              if (detail === 'DeviceNotRegistered' && targetUserId) {
                deleteStaleToken(targetUserId, chunk[index]);
              }
            }
          });
        }
      } catch (error) {
        console.warn('Failed to send Expo push:', error);
      }
    }
  }

  // 2. Send Web FCM tokens
  if (fcmTokens.length > 0) {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const sendPushCall = httpsCallable(functions, 'sendExpoPush');
      await sendPushCall({ tokens: fcmTokens, title, body, data });
      console.log('Successfully called Cloud Function to send FCM push to web tokens:', fcmTokens.length);
    } catch (error) {
      console.warn('Cloud Function unavailable (Spark Plan). Web notification delivered via real-time listener & service worker:', error);
    }
  }
}

async function deleteStaleToken(userId: string, token: string): Promise<void> {
  try {
    const docId = encodeURIComponent(token);
    await deleteDoc(doc(db, 'users', userId, 'pushTokens', docId));
  } catch (error) {
    console.warn('Failed to remove stale push token:', error);
  }
}

export async function sendChatNotification(
  recipientId: string,
  senderName: string,
  messageText: string,
  chatId: string
): Promise<void> {
  if (!recipientId) return;
  const tokens = await getUserTokens(recipientId);
  if (tokens.length === 0) return;

  const preview =
    messageText.length > 120 ? `${messageText.slice(0, 120)}…` : messageText;

  await sendPushMessage({
    recipientId,
    tokens,
    title: senderName || 'New message',
    body: preview,
    data: { type: 'chat', chatId },
  });
}

export async function sendAnnouncementNotification(
  tutorId: string,
  announcementId: string,
  title: string,
  content: string
): Promise<void> {
  const parentIds = await getLinkedParents(tutorId);
  if (parentIds.length === 0) return;

  const preview = content.length > 120 ? `${content.slice(0, 120)}…` : content;
  const body = title ? `${title}: ${preview}` : preview;

  for (const parentId of parentIds) {
    const tokens = await getUserTokens(parentId);
    if (tokens.length === 0) continue;
    await sendPushMessage({
      recipientId: parentId,
      tokens,
      title: 'New Announcement',
      body,
      data: { type: 'announcement', announcementId },
    });
  }
}

export async function sendPaymentStatusNotification(
  parentId: string,
  status: 'accepted' | 'rejected',
  tuteeName: string,
  amount: number,
  reason?: string
): Promise<void> {
  if (!parentId) return;
  const tokens = await getUserTokens(parentId);
  if (tokens.length === 0) return;

  const amountLabel = formatCurrency(amount);
  const title = status === 'accepted' ? 'Payment Accepted' : 'Payment Rejected';
  const body =
    status === 'accepted'
      ? `Your payment of ${amountLabel} for ${tuteeName} was verified.`
      : `Your payment of ${amountLabel} for ${tuteeName} was rejected${reason ? `: ${reason}` : ''}.`;

  await sendPushMessage({
    recipientId: parentId,
    tokens,
    title,
    body,
    data: { type: 'payment' },
  });
}
