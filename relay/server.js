import express from 'express';
import cors from 'cors';
import {
  HttpError,
  assertCanManageParent,
  findAuthUser,
  getAdminAuth,
  requireIdToken,
} from './firebaseAdmin.js';

const app = express();

// Comma-separated list of browser origins allowed to call this relay.
// CORS is a browser-side convenience only, NOT an access control: the relay is
// reachable directly, so every privileged route below authenticates and
// authorizes via Firebase ID token. Unset means "allow any origin" so the push
// relay keeps working if this is forgotten to configure.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
  console.warn('[relay] ALLOWED_ORIGINS not set; allowing requests from any origin.');
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new HttpError(403, `Origin ${origin} is not allowed.`));
    },
  })
);
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

/**
 * Deletes a parent account from Firebase Authentication by UID.
 *
 * The client MUST NOT treat the account as deleted unless this returns 200 with
 * `ok: true`, and MUST NOT delete the Firestore user document unless it does.
 *
 * Guarantees before responding 200:
 *   - the caller is the tutor who created the parent
 *   - the Auth record for `uid` is the one that belongs to that parent document
 *     (verified by comparing the Auth email to the Firestore `email`)
 *   - a follow-up `getUser` confirms the record is actually gone
 */
app.post('/delete-auth-user', async (req, res, next) => {
  try {
    const { uid, expectedEmail } = req.body || {};
    const caller = await requireIdToken(req);
    const parent = await assertCanManageParent(caller.uid, uid);

    const existing = await findAuthUser(uid);

    if (!existing) {
      // Nothing left to delete. The caller is still authorized, and the desired
      // end state already holds, so this is a success rather than a failure.
      console.log(`[admin] ${caller.uid} requested delete of ${uid}, already absent from Auth`);
      return res.json({ ok: true, uid, email: parent.email ?? null, alreadyDeleted: true });
    }

    // Guard against passing the wrong UID: the Auth record we are about to delete
    // must correspond to this parent document, not some other account.
    if (parent.email && existing.email && existing.email !== parent.email) {
      throw new HttpError(
        409,
        `Refusing to delete: uid ${uid} belongs to ${existing.email} in Firebase Authentication, ` +
          `but the parent record is ${parent.email}.`
      );
    }
    if (expectedEmail && existing.email && existing.email !== expectedEmail) {
      throw new HttpError(
        409,
        `Refusing to delete: uid ${uid} is ${existing.email} in Firebase Authentication, ` +
          `but ${expectedEmail} was expected.`
      );
    }

    await getAdminAuth().deleteUser(uid);

    // Verify the deletion actually took effect before reporting success.
    const after = await findAuthUser(uid);
    if (after) {
      throw new HttpError(500, `Auth record for ${uid} still exists after deletion.`);
    }

    console.log(`[admin] deleted auth user ${uid} (${existing.email}) requested by ${caller.uid}`);
    res.json({ ok: true, uid, email: existing.email ?? null, alreadyDeleted: false });
  } catch (err) {
    next(err);
  }
});

/**
 * Updates a parent account password in Firebase Authentication by UID.
 *
 * Responding 200 means the stored password hash actually changed, so the client
 * can safely record the new password as the parent's temporary password.
 */
app.post('/update-user-password', async (req, res, next) => {
  try {
    const { uid, newPassword } = req.body || {};
    const caller = await requireIdToken(req);
    await assertCanManageParent(caller.uid, uid);

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new HttpError(400, 'newPassword must be a string of at least 6 characters.');
    }

    const auth = getAdminAuth();
    const existing = await findAuthUser(uid);
    if (!existing) {
      throw new HttpError(404, 'Parent account not found in Firebase Authentication.');
    }

    const previousHash = existing.passwordHash ?? null;
    await auth.updateUser(uid, { password: newPassword });

    // A password cannot be read back, so verify via the stored hash instead.
    const after = await findAuthUser(uid);
    if (!after) {
      throw new HttpError(500, `Auth record for ${uid} disappeared during the password update.`);
    }
    if (previousHash && after.passwordHash === previousHash) {
      throw new HttpError(500, `Password for ${uid} was not changed.`);
    }

    console.log(`[admin] updated password for auth user ${uid} (${existing.email}) by ${caller.uid}`);
    res.json({ ok: true, uid, email: existing.email ?? null });
  } catch (err) {
    next(err);
  }
});

// Central error handler: HttpErrors carry a safe, client-facing message.
// Anything else is logged in full but reported generically.
app.use((err, _req, res, _next) => {
  const status = err instanceof HttpError && err.status >= 400 ? err.status : 500;
  if (status >= 500) {
    console.error('[relay] unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
  res.status(status).json({ error: err.message });
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Push relay listening on http://localhost:${PORT}`);
  });
}

export default app;
