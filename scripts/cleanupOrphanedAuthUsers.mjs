/**
 * One-time cleanup for the two kinds of orphan account removal leaves behind.
 *
 * 1. Orphaned Auth users — older versions of the app deleted only the
 *    `users/{uid}` Firestore document, so those accounts could still sign in even
 *    though the app no longer knew them. This direction deletes any Auth user
 *    whose `users/{uid}` document no longer exists.
 *
 * 2. Orphaned Firestore subcollections — Firestore never cascades, so deleting
 *    `users/{uid}` leaves anything nested beneath it behind. A removed parent
 *    therefore keeps owning live push tokens at `users/{uid}/pushTokens/*`. This
 *    direction deletes subcollections whose parent document is already gone.
 *
 * Client code cannot enumerate Firebase Auth users, so this has to run
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
 * firebaseauth.users.delete, plus Firestore read on `users` and permission to
 * delete its subcollections.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Strip surrounding quotes: copying the value out of the service-account JSON
// often brings them along, and a quoted key breaks RSA signing while leaving
// verifyIdToken working, which is deeply confusing to debug.
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ?.trim()
  .replace(/^"([\s\S]*)"$/, '$1')
  .replace(/\\n/g, '\n')
  .trim();

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

/**
 * Finds `users/{uid}` references that no longer exist as documents but still
 * own subcollections.
 *
 * `listDocuments()` returns a reference for a deleted document that retains
 * subcollections, so dangling ones stay visible here even though a plain `get()`
 * on the parent would report nothing at all.
 *
 * @returns {Promise<Array<{uid: string, collections: Array<{name: string, count: number}>}>>}
 */
async function findOrphanedSubcollections() {
  const refs = await db.collection('users').listDocuments();
  const orphans = [];

  for (const ref of refs) {
    const snap = await ref.get();
    if (snap.exists) continue;

    const collections = await ref.listCollections();
    if (collections.length === 0) continue;

    const detail = [];
    for (const col of collections) {
      detail.push({ name: col.id, count: (await col.get()).size });
    }
    orphans.push({ uid: ref.id, collections: detail });
  }

  return orphans;
}

const orphans = await findOrphanedUids();
const dangling = await findOrphanedSubcollections();

if (orphans.length === 0 && dangling.length === 0) {
  console.log('No orphaned Auth accounts or dangling subcollections found. Nothing to do.');
  process.exit(0);
}

if (orphans.length > 0) {
  console.log(`\nFound ${orphans.length} orphaned Auth account(s):\n`);
  for (const { uid, email, createdAt } of orphans) {
    console.log(`  ${uid}  ${email ?? '(no email)'}  created ${createdAt}`);
  }
}

if (dangling.length > 0) {
  console.log(`\nFound ${dangling.length} profile(s) deleted with subcollections still attached:\n`);
  for (const { uid, collections } of dangling) {
    const summary = collections.map((c) => `${c.name} (${c.count})`).join(', ');
    console.log(`  ${uid}  ->  ${summary}`);
  }
}

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to delete these records.');
  process.exit(0);
}

let deleted = 0;
if (orphans.length > 0) {
  console.log('\nDeleting orphaned Auth accounts...');
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
}

if (dangling.length > 0) {
  console.log('\nDeleting dangling Firestore subcollections...');
  for (const { uid, collections } of dangling) {
    try {
      // Safe to target the document itself: the profile is already gone, so this
      // only clears what remains nested beneath it.
      await db.recursiveDelete(db.doc(`users/${uid}`));

      const remaining = await db.doc(`users/${uid}`).listCollections();
      if (remaining.length > 0) {
        console.error(`  FAILED (still attached: ${remaining.map((c) => c.id).join(', ')}): ${uid}`);
      } else {
        deleted += 1;
        console.log(`  deleted ${collections.map((c) => c.name).join(', ')} under ${uid}`);
      }
    } catch (err) {
      console.error(`  FAILED: ${uid} -> ${err.message}`);
    }
  }
}

console.log(`\nDeleted ${deleted} orphaned record group(s).`);
