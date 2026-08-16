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
async function sendBatchToExpo(messages) {
  const response = await fetch(EXPO_PUSH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const rawText = await response.text();

  if (!response.ok) {
    let parsedError;
    try {
      parsedError = JSON.parse(rawText);
    } catch (_) {}

    const isTooManyExp =
      parsedError?.errors?.some((e) => e.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS') ||
      rawText.includes('PUSH_TOO_MANY_EXPERIENCE_IDS');

    if (isTooManyExp) {
      const details = parsedError?.errors?.[0]?.details;
      return await handleSplitExperienceIds(messages, details);
    }

    throw new HttpsError('internal', `Expo push API error (${response.status})`, rawText);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new HttpsError('internal', 'Invalid JSON from Expo push API', rawText);
  }

  return Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.tickets)
      ? parsed.tickets
      : [parsed].filter((t) => t !== null && t !== undefined);
}

async function handleSplitExperienceIds(messages, details) {
  const tokenToTicketMap = new Map();

  if (details && typeof details === 'object') {
    const tokenToMsgMap = new Map(messages.map((m) => [m.to, m]));

    for (const [expId, tokenList] of Object.entries(details)) {
      if (!Array.isArray(tokenList) || tokenList.length === 0) continue;
      const subMessages = tokenList
        .map((tok) => tokenToMsgMap.get(tok))
        .filter(Boolean);

      if (subMessages.length > 0) {
        try {
          const subTickets = await sendBatchToExpo(subMessages);
          subMessages.forEach((msg, idx) => {
            if (subTickets[idx]) {
              tokenToTicketMap.set(msg.to, subTickets[idx]);
            }
          });
        } catch (err) {
          console.warn(`Failed sub-batch for ${expId}:`, err);
        }
      }
    }
  }

  const unresolvedMessages = messages.filter((m) => !tokenToTicketMap.has(m.to));
  for (const msg of unresolvedMessages) {
    try {
      const response = await fetch(EXPO_PUSH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify([msg]),
      });
      const rawText = await response.text();
      if (response.ok) {
        let parsed;
        try { parsed = JSON.parse(rawText); } catch (_) {}
        const ticket = Array.isArray(parsed) ? parsed[0] : parsed?.tickets?.[0] || parsed;
        if (ticket) tokenToTicketMap.set(msg.to, ticket);
      } else {
        tokenToTicketMap.set(msg.to, { status: 'error', message: rawText });
      }
    } catch (err) {
      tokenToTicketMap.set(msg.to, { status: 'error', message: err.message });
    }
  }

  return messages.map((m) => tokenToTicketMap.get(m.to) || { status: 'error', message: 'Failed to send push' });
}

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

  const tickets = await sendBatchToExpo(messages);

  return { ok: true, sent: uniqueTokens.length, tickets };
});
