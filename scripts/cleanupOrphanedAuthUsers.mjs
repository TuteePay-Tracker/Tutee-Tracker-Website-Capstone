/**
 * One-time cleanup for parent accounts that were deleted from Firestore while
 * their Firebase Authentication record survived.
 *
 * Older versions of the app deleted only the `users/{uid}` Firestore document,
 * so those accounts can still sign in even though the app no longer knows them.
 * This script deletes any Auth user whose `users/{uid}` document no longer
 * exists. Client code cannot enumerate Firebase Auth users, so it has to run
 * server-side.
 *
 * Usage:
 *   $env:FIREBASE_PROJECT_ID        = "tutorial-management-capstone"
 *   $env:FIREBASE_CLIENT_EMAIL      = "relay@project.iam.gserviceaccount.com"
 *   $env:FIREBASE_PRIVATE_KEY       = "-----BEGIN PRIVATE KEY-----\n..."
 *   node scripts/cleanupOrphanedAuthUsers.mjs            # dry run, lists only
 *   node scripts/cleanupOrphanedAuthUsers.mjs --apply    # performs deletions
 *
 * The service account needs firebaseauth.users.get, firebaseauth.users.list and
 * firebaseauth.users.delete, plus Firestore read on `users`.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId) {
  console.error('FIREBASE_PROJECT_ID is required.');
  process.exit(1);
}

const options = { projectId };
if (clientEmail && privateKey) {
  options.credential = cert({ projectId, clientEmail, privateKey });
} else {
  console.warn(
    'FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set; using Application Default Credentials.'
  );
}

const app = getApps()[0] ?? initializeApp(options);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * @returns the UIDs of Auth users with no matching `users/{uid}` document.
 */
async function findOrphanedUids() {
  const orphans = [];
  let page = await auth.listUsers(1000);

  while (true) {
    for (const user of page.users) {
      const snap = await db.doc(`users/${user.uid}`).get();
      if (!snap.exists) {
        orphans.push({ uid: user.uid, email: user.email ?? null, createdAt: user.metadata.creationTime });
      }
    }

    if (!page.pageToken) break;
    page = await auth.listUsers(1000, { pageToken: page.pageToken });
  }

  return orphans;
}

const orphans = await findOrphanedUids();

if (orphans.length === 0) {
  console.log('No orphaned Auth accounts found. Nothing to do.');
  process.exit(0);
}

console.log(`\nFound ${orphans.length} orphaned Auth account(s):\n`);
for (const { uid, email, createdAt } of orphans) {
  console.log(`  ${uid}  ${email ?? '(no email)'}  created ${createdAt}`);
}

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to delete these accounts.');
  process.exit(0);
}

console.log('\nDeleting...');
let deleted = 0;
for (const { uid, email } of orphans) {
  try {
    await auth.deleteUser(uid);

    // Verify the record is actually gone before counting it as success.
    let stillPresent = true;
    try {
      await auth.getUser(uid);
    } catch (err) {
      if (err?.code === 'auth/user-not-found') stillPresent = false;
      else throw err;
    }

    if (stillPresent) {
      console.error(`  FAILED (still present after delete): ${uid} ${email ?? ''}`);
    } else {
      deleted += 1;
      console.log(`  deleted ${uid} ${email ?? ''}`);
    }
  } catch (err) {
    console.error(`  FAILED: ${uid} ${email ?? ''} -> ${err.message}`);
  }
}

console.log(`\nDeleted ${deleted} of ${orphans.length} orphaned account(s).`);
