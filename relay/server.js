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
      return res
        .status(502)
        .json({ error: 'Failed to reach Expo push API', cause: error.cause?.code ?? error.message });
    }

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: 'Expo push API error', status: response.status, body: await response.text() });
    }

    let parsed;
    try {
      const rawText = await response.text();
      console.log(`[push] ${new Date().toISOString()} raw Expo response: ${rawText.slice(0, 500)}`);
      parsed = JSON.parse(rawText);
    } catch {
      return res
        .status(502)
        .json({ error: 'Invalid JSON from Expo push API', body: await response.text().catch(() => '') });
    }

    // Expo normally returns an array of tickets, but defend against a single
    // ticket object or an error payload so a weird body can't crash the relay.
    const batchTickets = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.tickets)
        ? parsed.tickets
        : [parsed].filter((t) => t !== null && t !== undefined);

    tickets.push(...batchTickets);
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
