import { auth } from '@/shared/lib/firebase/config';

/**
 * Base URL of the relay server (deployed to Vercel).
 *
 * The relay hosts the privileged Firebase Admin operations (deleting a parent
 * account, resetting a parent password) because this project is on the Spark
 * plan and cannot deploy Cloud Functions.
 */
export const RELAY_URL =
  (import.meta.env.VITE_PUSH_RELAY_URL as string | undefined) ?? 'http://localhost:4000';

export class RelayError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'RelayError';
    this.status = status;
  }
}

/**
 * POSTs to a relay endpoint as the currently signed-in user.
 *
 * Attaches a fresh Firebase ID token so the relay can verify who is calling and
 * authorize the request server-side. Non-2xx responses reject with the error
 * message reported by the relay, rather than being swallowed, so callers can
 * decide not to treat the operation as successful.
 */
export async function relayRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new RelayError('You must be signed in to perform this action.', 401);
  }

  const idToken = await currentUser.getIdToken();

  let response: Response;
  try {
    response = await fetch(`${RELAY_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RelayError(
      'Could not reach the account server. Check your connection and try again.',
      0
    );
  }

  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const detail = typeof payload.error === 'string' ? payload.error : null;
    throw new RelayError(
      detail || `The account server rejected this request (HTTP ${response.status}).`,
      response.status
    );
  }

  return payload as T;
}
