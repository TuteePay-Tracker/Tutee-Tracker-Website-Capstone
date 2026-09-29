/**
 * Firebase Admin SDK bootstrap + request authorization helpers.
 *
 * The project runs on the Spark plan, so Cloud Functions cannot be deployed.
 * Privileged Auth operations (deleteUser / updateUser) are therefore served by
 * this relay, which is deployed to Vercel.
 *
 * Every privileged route authenticates the caller with their Firebase ID token
 * and then authorizes them against Firestore, so possession of a UID is never
 * on its own sufficient to delete or modify an account.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/** Error carrying an HTTP status so route handlers can `throw` and be caught centrally. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

let adminApp = null;

/**
 * Reads FIREBASE_PRIVATE_KEY and normalises the ways a pasted PEM can arrive.
 *
 * Copying the value straight out of the service-account JSON often drags the
 * surrounding double quotes along with it. A quoted key is accepted by `cert()`
 * without complaint and only fails much later, deep inside gRPC, as an opaque
 * "16 UNAUTHENTICATED" from Firestore — while `verifyIdToken` keeps working,
 * because it validates signatures against Google's public certs and never signs
 * anything itself. Stripping the quotes here turns that silent, deeply
 * misreported failure into a non-event.
 */
function readPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return undefined;

  return raw
    .trim()
    .replace(/^"([\s\S]*)"$/, '$1')
    // A multi-line PEM may be stored as literal "\n" sequences on a single line.
    .replace(/\\n/g, '\n')
    .trim();
}

/**
 * Lazily initializes the Admin SDK. Credentials come from Vercel env vars;
 * locally they can come from `gcloud auth application-default login`.
 */
export function getAdminApp() {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = readPrivateKey();

  const options = { projectId };
  if (clientEmail && privateKey) {
    options.credential = cert({ projectId, clientEmail, privateKey });
  } else {
    console.warn(
      '[admin] FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set; falling back to Application Default Credentials.'
    );
  }

  adminApp = getApps()[0] ?? initializeApp(options);
  return adminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

/**
 * Verifies the caller's Firebase ID token from the `Authorization` header.
 * Throws 401 when absent, malformed, expired, or revoked.
 */
export async function requireIdToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError(401, 'Missing or malformed Authorization bearer token.');
  }

  // Prove the service-account credential works before relying on it. A relay with
  // bad credentials is a configuration fault, not a caller fault, so it must not
  // be reported to the browser as though the request were unauthorized.
  try {
    await ensureAdminCredential();
  } catch (err) {
    console.error('[admin] service account credential is unusable:', err);
    throw new HttpError(503, credentialHint(err));
  }

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch (err) {
    console.warn(`[admin] ID token rejected: ${err.code || err.message}`);
    throw new HttpError(401, 'Invalid or expired ID token. Please sign in again.');
  }
}

/**
 * Confirms the caller may administer the given parent account.
 *
 * Authorization requires all of the following, checked server-side against
 * Firestore so a client cannot spoof any of it:
 *   - the caller is a tutor
 *   - the target is a parent
 *   - the caller is the tutor who created that parent
 *   - the target is not the caller
 *
 * @returns the target parent's Firestore data.
 */
export async function assertCanManageParent(callerUid, targetUid) {
  if (typeof targetUid !== 'string' || targetUid.length === 0) {
    throw new HttpError(400, 'A target uid is required.');
  }
  if (targetUid === callerUid) {
    throw new HttpError(403, 'You cannot manage your own account through this endpoint.');
  }

  const db = getAdminDb();

  const callerSnap = await db.doc(`users/${callerUid}`).get();
  if (!callerSnap.exists) {
    throw new HttpError(403, 'Caller profile not found.');
  }
  if (callerSnap.data()?.role !== 'tutor') {
    throw new HttpError(403, 'Only tutors can manage parent accounts.');
  }

  const targetSnap = await db.doc(`users/${targetUid}`).get();
  if (!targetSnap.exists) {
    throw new HttpError(404, 'Target user document not found.');
  }

  const target = targetSnap.data();
  if (target.role !== 'parent') {
    throw new HttpError(403, 'Target user is not a parent account.');
  }
  if (target.createdByTutorId !== callerUid) {
    throw new HttpError(403, 'You did not create this parent account.');
  }

  return target;
}

/**
 * Reads an Auth record, distinguishing "absent" from "failed".
 *
 * @returns the decoded user, or null when it genuinely does not exist.
 */
export async function findAuthUser(uid) {
  try {
    return await getAdminAuth().getUser(uid);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') return null;
    throw err;
  }
}

let credentialReady = null;

/**
 * Proves the configured credential can actually mint an OAuth2 access token.
 *
 * `cert()` happily accepts an unusable key, so a misconfigured deployment
 * otherwise shows its first symptom as a gRPC UNAUTHENTICATED raised by whichever
 * Admin call happens to run first — a symptom that points at Firestore rather
 * than at the credentials. Verifying up front turns that into one named failure.
 * The result is memoised per warm instance.
 */
export function ensureAdminCredential() {
  if (!credentialReady) {
    credentialReady = (async () => {
      const credential = getAdminApp().options?.credential;
      if (typeof credential?.getAccessToken === 'function') {
        await credential.getAccessToken();
      }
      return true;
    })().catch((err) => {
      credentialReady = null;
      throw err;
    });
  }

  return credentialReady;
}

/**
 * Turns a credential failure into a message naming the variable that needs
 * fixing, so a misconfiguration is actionable without exposing anything secret.
 */
export function credentialHint(err) {
  const message = String(err?.message ?? err);

  if (/secretOrPrivateKey|asymmetric key|key_parse|invalid.*pem|malformed private key/i.test(message)) {
    return (
      'The relay service account key is unusable. FIREBASE_PRIVATE_KEY must be a bare PEM ' +
      'starting with -----BEGIN PRIVATE KEY----- and must not be wrapped in quotes.'
    );
  }
  if (/client_?email/i.test(message)) {
    return 'FIREBASE_CLIENT_EMAIL is not a valid service account email address.';
  }
  if (/default credentials/i.test(message)) {
    return 'The relay has no Firebase credentials. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel.';
  }

  return 'The relay could not authenticate to Firebase with its configured service account.';
}

/**
 * Upper bound on subcollections removed by a single account deletion.
 *
 * `assertCanManageParent` already guarantees the target document is a parent, so
 * this is defence in depth rather than the primary guard: it bounds the blast
 * radius should a wrong uid ever reach here, since a tutor profile owns far more
 * subcollections (tutees, payments, sessions) than a parent ever does.
 */
const MAX_CASCADE_COLLECTIONS = 25;

/**
 * Deletes every subcollection under `users/{uid}`, leaving the profile document
 * itself in place.
 *
 * Firestore never cascades, so `deleteDoc(users/{uid})` orphans anything nested
 * beneath it — which is exactly how a deleted parent ends up still owning live
 * push tokens. The caller deletes the profile document separately, under Firestore
 * rules; doing it here as well would leave that rule to evaluate against a null
 * `resource` and get denied.
 *
 * @returns the ids of the subcollections that were removed.
 */
export async function deleteUserSubcollections(uid) {
  const db = getAdminDb();
  const collections = await db.doc(`users/${uid}`).listCollections();

  if (collections.length > MAX_CASCADE_COLLECTIONS) {
    throw new HttpError(
      500,
      `Refusing to cascade delete: ${uid} unexpectedly has ${collections.length} subcollections.`
    );
  }

  const deleted = [];
  for (const collection of collections) {
    // recursiveDelete accepts a Query and CollectionReference extends Query, so
    // this clears the whole subcollection without touching `users/{uid}`.
    await db.recursiveDelete(collection);
    deleted.push(collection.id);
  }

  return deleted;
}
