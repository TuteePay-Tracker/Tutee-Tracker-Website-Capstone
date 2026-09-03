import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, getMessagingInstance } from '@/shared/lib/firebase/config';
import { toast } from 'sonner';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Register FCM Web Push and request permission from user
 */
export async function setupWebPushNotifications(userId: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('[FCM] Notifications are not supported in this browser.');
    return null;
  }

  console.log('[FCM] Current notification permission state:', Notification.permission);

  try {
    const permission = await Notification.requestPermission();
    console.log('[FCM] User notification permission result:', permission);

    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission was denied or dismissed by user.');
      return null;
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn('[FCM] Firebase Messaging is not supported in this browser environment.');
      return null;
    }

    // Register service worker if available
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('[FCM] Registered Service Worker for FCM:', serviceWorkerRegistration.scope);
    }

    const fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration
    });

    if (fcmToken) {
      // Store in users/{userId}/pushTokens/{fcmToken}
      const tokenDocRef = doc(db, 'users', userId, 'pushTokens', encodeURIComponent(fcmToken));
      await setDoc(tokenDocRef, {
        token: fcmToken,
        platform: 'web_pwa',
        updatedAt: serverTimestamp(),
        userAgent: navigator.userAgent
      }, { merge: true });

      console.log('[FCM] Web FCM Token successfully registered and stored in Firestore:', fcmToken);
      return fcmToken;
    } else {
      console.warn('[FCM] No registration token available. Request permission to generate one.');
    }
  } catch (error) {
    console.error('[FCM] Error setting up Web Push Notifications:', error);
  }

  return null;
}

/**
 * Fetch existing stored FCM token for user
 */
export async function getStoredFcmToken(userId: string): Promise<string | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  try {
    const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    return await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration
    });
  } catch (err) {
    console.warn('[FCM] Could not get stored token:', err);
    return null;
  }
}

/**
 * Listen for incoming messages while user is active on the website (foreground)
 */
export async function listenForForegroundMessages(
  onMessageReceived?: (payload: MessagePayload) => void
): Promise<(() => void) | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  return onMessage(messaging, (payload: MessagePayload) => {
    console.log('[FCM] Received foreground message:', payload);
    
    const title = payload.notification?.title || payload.data?.title || 'Notification';
    const body = payload.notification?.body || payload.data?.body || '';

    // Show interactive toast
    toast.info(title, {
      description: body,
      duration: 5000,
    });

    if (onMessageReceived) {
      onMessageReceived(payload);
    }
  });
}
