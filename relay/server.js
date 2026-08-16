import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const PORT = process.env.PORT || 4000;

/**
 * Local relay for the website (tutor) to send Expo push notifications.
 *
 * Expo's push API rejects cross-origin (browser) requests, so the website
 * POSTs here and this server forwards the request to Expo from a server
 * context where CORS does not apply.
 */
async function sendBatchToExpo(messages) {
  let response;
  try {
    response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    throw { status: 502, error: 'Failed to reach Expo push API', cause: error.cause?.code ?? error.message };
  }

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
      console.warn(`[push] ${new Date().toISOString()} Detected PUSH_TOO_MANY_EXPERIENCE_IDS, splitting tokens...`);
      const details = parsedError?.errors?.[0]?.details;
      return await handleSplitExperienceIds(messages, details);
    }

    throw { status: response.status, error: 'Expo push API error', body: rawText };
  }

  let parsed;
  try {
    console.log(`[push] ${new Date().toISOString()} raw Expo response: ${rawText.slice(0, 500)}`);
    parsed = JSON.parse(rawText);
  } catch {
    throw { status: 502, error: 'Invalid JSON from Expo push API', body: rawText };
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
          console.warn(`[push] Failed sub-batch for ${expId}:`, err);
        }
      }
    }
  }

  // Fallback for any messages that weren't resolved by details grouping
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
 * Local relay for the website (tutor) to send Expo push notifications.
 *
 * Expo's push API rejects cross-origin (browser) requests, so the website
 * POSTs here and this server forwards the request to Expo from a server
 * context where CORS does not apply.
 */
app.post('/send-push', async (req, res) => {
  const { tokens, title, body, data, sound = 'default', priority = 'high' } = req.body || {};
  const uniqueTokens = Array.isArray(tokens)
    ? [...new Set(tokens)].filter((t) => typeof t === 'string' && t.length > 0)
    : [];

  if (uniqueTokens.length === 0) {
    return res.json({ ok: true, sent: 0 });
  }

  console.log(`[push] ${new Date().toISOString()} received tokens=${uniqueTokens.length} title=${title}`);

  const tickets = [];
  // Expo's API accepts up to 100 messages per request.
  for (let i = 0; i < uniqueTokens.length; i += 100) {
    const chunk = uniqueTokens.slice(i, i + 100);
    const messages = chunk.map((to) => ({
      to,
      title,
      body,
      sound,
      priority,
      data: data ?? undefined,
    }));

    try {
      const chunkTickets = await sendBatchToExpo(messages);
      tickets.push(...chunkTickets);
    } catch (err) {
      if (err && typeof err === 'object' && err.status) {
        return res.status(err.status).json(err);
      }
      return res.status(500).json({ error: 'Unexpected error sending push', cause: String(err) });
    }
  }

  console.log(
    `[push] ${new Date().toISOString()} Expo returned ${tickets.length} ticket(s):`,
    tickets.map((t) => t.status).join(',')
  );

  res.json({ ok: true, sent: uniqueTokens.length, tickets });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Push relay listening on http://localhost:${PORT}`);
});
