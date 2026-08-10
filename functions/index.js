const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Relays push messages to the Expo push service.
 *
 * The Expo push API does not allow cross-origin requests from browsers, so it
 * must be called from a server. The website (and any client) calls this
 * function to send pushes to Expo push tokens.
 */
exports.sendExpoPush = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to send push notifications.');
  }

  const { tokens, title, body, data } = request.data || {};
  const uniqueTokens = Array.isArray(tokens)
    ? [...new Set(tokens)].filter((t) => typeof t === 'string' && t.length > 0)
    : [];

  if (uniqueTokens.length === 0) {
    return { ok: true, sent: 0 };
  }

  const messages = uniqueTokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: 'high',
    data: data ?? undefined,
  }));

  const response = await fetch(EXPO_PUSH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const tickets = await response.json();

  if (!response.ok) {
    throw new HttpsError('internal', `Expo push API error (${response.status})`, tickets);
  }

  return { ok: true, sent: uniqueTokens.length, tickets };
});
