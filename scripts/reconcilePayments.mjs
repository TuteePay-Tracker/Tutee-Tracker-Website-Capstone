#!/usr/bin/env node
/**
 * One-time payment data reconciliation / repair script.
 *
 * Background: older builds of the app had a few inconsistencies:
 *   - `recordMonthlyPayment` wrote TWO `paymentTransactions` rows per recorded payment
 *     (one from `paymentService.create` with a `paymentId`, plus a manually added duplicate).
 *   - Toggling a month's "paid" checkbox OFF deleted ALL payments for that month.
 *   - `paymentService.create` incremented `tutee.totalPaid` using possibly-stale
 *     `totalSessions`, while other paths recomputed balances from the payments ledger.
 *
 * This script reconciles every tutor's data to a single canonical model:
 *   - tutee.totalSessions  = number of distinct billed months (paymentRecords ∪ payments months)
 *   - tutee.totalPaid      = sum of non-pending, non-rejected payments
 *   - tutee.balance        = totalSessions * ratePerSession - totalPaid
 *   - paymentRecord.totalPaid / totalBalance recomputed from that month's confirmed payments
 *   - duplicate (orphan) paymentTransactions removed
 *
 * Usage:
 *   Set credentials via one of:
 *     - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *     - FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
 *     - FIREBASE_SERVICE_ACCOUNT='{...json...}'
 *
 *   node scripts/reconcilePayments.mjs            # dry-run only (prints a report)
 *   node scripts/reconcilePayments.mjs --apply    # actually write changes
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APPLY = process.argv.includes('--apply');
const summary = { users: 0, tutees: 0, duplicateTransactionsDeleted: 0, recordsUpdated: 0, tuteesUpdated: 0 };

function initApp() {
  let serviceAccount;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    serviceAccount = JSON.parse(readFileSync(resolve(path), 'utf8'));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  const opts = {};
  if (serviceAccount) {
    opts.credential = cert(serviceAccount);
    opts.projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID;
  } else if (process.env.FIREBASE_PROJECT_ID) {
    opts.projectId = process.env.FIREBASE_PROJECT_ID;
  } else {
    console.error(
      'No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_PATH, or FIREBASE_SERVICE_ACCOUNT.'
    );
    process.exit(1);
  }
  return initializeApp(opts);
}

const db = getFirestore(initApp());

async function fetchAll(ref) {
  const snap = await ref.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const isConfirmed = (p) => p.status !== 'pending' && p.status !== 'rejected';
const asNumber = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const round2 = (v) => Math.round(v * 100) / 100;

async function reconcileTutee(userId, tuteeDoc) {
  summary.tutees += 1;
  const tuteeId = tuteeDoc.id;
  const rate = asNumber(tuteeDoc.ratePerSession);

  // ── 1. Delete duplicate paymentTransactions ─────────────────────────────
  const transactions = await fetchAll(db.collection('users').doc(userId).collection('paymentTransactions')
    .where('tuteeId', '==', tuteeId));
  const payments = await fetchAll(db.collection('users').doc(userId).collection('payments')
    .where('tuteeId', '==', tuteeId));

  // Fingerprint of the "official" transaction that paymentService.create writes (has paymentId).
  const legitKeys = new Set();
  for (const t of transactions) {
    if (!t.paymentId) continue;
    legitKeys.add(`${t.tuteeId}|${t.month || ''}|${asNumber(t.totalAmount)}|${t.paymentMethod || ''}|${t.paymentDate || ''}`);
  }

  const duplicates = transactions.filter(
    (t) =>
      !t.paymentId &&
      Array.isArray(t.daysPaid) &&
      t.daysPaid.length === 0 &&
      legitKeys.has(`${t.tuteeId}|${t.month || ''}|${asNumber(t.totalAmount)}|${t.paymentMethod || ''}|${t.paymentDate || ''}`)
  );

  if (duplicates.length > 0) {
    console.log(`  [transactions] deleting ${duplicates.length} duplicate paymentTransactions for tutee ${tuteeId}`);
    summary.duplicateTransactionsDeleted += duplicates.length;
    if (APPLY) {
      for (const d of duplicates) await db.collection('users').doc(userId).collection('paymentTransactions').doc(d.id).delete();
    }
  }

  // ── 2. Rebuild monthly paymentRecords ────────────────────────────────────
  const records = await fetchAll(db.collection('users').doc(userId).collection('paymentRecords')
    .where('tuteeId', '==', tuteeId));

  const confirmed = payments.filter(isConfirmed);
  const confirmedByMonth = new Map();
  for (const p of confirmed) {
    if (!p.month) continue;
    const arr = confirmedByMonth.get(p.month) || [];
    arr.push(p);
    confirmedByMonth.set(p.month, arr);
  }

  for (const record of records) {
    const monthPayments = confirmedByMonth.get(record.month) || [];
    const totalPaid = round2(monthPayments.reduce((s, p) => s + asNumber(p.amount), 0));
    const totalDue = asNumber(record.totalDue) || rate || 0;
    const totalBalance = round2(totalDue - totalPaid);

    const changed =
      asNumber(record.totalPaid) !== totalPaid || asNumber(record.totalBalance) !== totalBalance || !record.totalDue;

    if (changed) {
      console.log(
        `  [record] ${tuteeId} ${record.month}: totalPaid ${asNumber(record.totalPaid)} -> ${totalPaid}, ` +
        `totalBalance ${asNumber(record.totalBalance)} -> ${totalBalance}`
      );
      summary.recordsUpdated += 1;
      if (APPLY) {
        await db.collection('users').doc(userId).collection('paymentRecords').doc(record.id).update({
          totalPaid,
          totalBalance,
          lastUpdated: new Date(),
        });
      }
    }
  }

  // ── 3. Rebuild tutee totals ───────────────────────────────────────────────
  const billedMonths = new Set();
  records.forEach((r) => r.month && billedMonths.add(r.month));
  confirmed.forEach((p) => p.month && billedMonths.add(p.month));

  const totalSessions = billedMonths.size;
  const totalPaid = round2(confirmed.reduce((s, p) => s + asNumber(p.amount), 0));
  const totalDue = totalSessions * rate;
  const balance = round2(totalDue - totalPaid);

  let lastPaymentDate;
  if (confirmed.length > 0) {
    lastPaymentDate = [...confirmed].sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''))[0].paymentDate;
  }

  const changedTutee =
    asNumber(tuteeDoc.totalSessions) !== totalSessions ||
    asNumber(tuteeDoc.totalPaid) !== totalPaid ||
    asNumber(tuteeDoc.balance) !== balance;

  if (changedTutee) {
    console.log(
      `  [tutee] ${tuteeId}: sessions ${asNumber(tuteeDoc.totalSessions)} -> ${totalSessions}, ` +
      `paid ${asNumber(tuteeDoc.totalPaid)} -> ${totalPaid}, balance ${asNumber(tuteeDoc.balance)} -> ${balance}`
    );
    summary.tuteesUpdated += 1;
    if (APPLY) {
      await db.collection('users').doc(userId).collection('tutees').doc(tuteeId).update({
        totalSessions,
        totalPaid,
        balance,
        lastPaymentDate: lastPaymentDate ?? null,
        updatedAt: new Date(),
      });
    }
  }
}

async function main() {
  console.log(`Reconcile mode: ${APPLY ? 'APPLY (writes changes)' : 'DRY-RUN (no writes)'}`);
  const usersSnap = await db.collection('users').get();

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const tuteesSnap = await db.collection('users').doc(userId).collection('tutees').get();
    if (tuteesSnap.empty) continue;

    summary.users += 1;
    const tutorName = userDoc.get('name') || userDoc.get('email') || userId;
    console.log(`\n=== Tutor: ${tutorName} (${userId}) ===`);
    console.log(`    Found ${tuteesSnap.size} tutee(s).`);

    const batches = [];
    for (const tuteeDoc of tuteesSnap.docs) batches.push(reconcileTutee(userId, tuteeDoc));
    // Careful with parallel writes on same user; run sequentially per tutor to stay within write limits.
    for (const b of batches) {
      await b;
    }
  }

  console.log('\n========================================');
  console.log('Reconcile complete. Summary:');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Run with --apply to persist these changes.`);
}

main().catch((err) => {
  console.error('Reconcile failed:', err);
  process.exit(1);
});