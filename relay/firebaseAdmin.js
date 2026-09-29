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
 * Lazily initializes the Admin SDK. Credentials come from Vercel env vars;
 * locally they can come from `gcloud auth application-default login`.
 */
export function getAdminApp() {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel stores multi-line PEM values with literal "\n" sequences.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

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
