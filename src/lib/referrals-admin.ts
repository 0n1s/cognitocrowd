import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

type DepositRecord = { userId?: string; amount?: number; status?: string };

export async function awardReferralBonusForDeposit(depositId: string) {
  const depositRef = adminDb.collection('deposits').doc(depositId);
  const logRef = adminDb.collection('referral_transactions').doc(depositId);

  return adminDb.runTransaction(async (transaction) => {
    const [depositSnap, existingLog] = await Promise.all([
      transaction.get(depositRef),
      transaction.get(logRef),
    ]);
    if (!depositSnap.exists || existingLog.exists) return null;

    const deposit = depositSnap.data() as DepositRecord;
    if (deposit.status !== 'completed') return null;
    const referredUserId = String(deposit.userId || '');
    const depositAmount = Number(deposit.amount || 0);
    if (!referredUserId || depositAmount <= 0) return null;

    const referredUserRef = adminDb.collection('users').doc(referredUserId);
    const referredUserSnap = await transaction.get(referredUserRef);
    if (!referredUserSnap.exists) return null;
    const referredUser = referredUserSnap.data() || {};
    const referrerId = String(referredUser.referredBy || '');
    if (!referrerId || referrerId === referredUserId) return null;

    const referrerRef = adminDb.collection('users').doc(referrerId);
    const referrerSnap = await transaction.get(referrerRef);
    if (!referrerSnap.exists) return null;
    const referrer = referrerSnap.data() || {};
    if (referrer.referralEligible === false || !referrer.packageId) return null;

    const packageRef = adminDb.collection('packages').doc(String(referrer.packageId));
    const packageSnap = await transaction.get(packageRef);
    if (!packageSnap.exists) return null;
    const plan = packageSnap.data() || {};
    const firstDepositOnly = plan.referralBonusFirstDepositOnly !== false;

    if (firstDepositOnly && referredUser.referralFirstDepositRewardedAt) return null;

    const minimumDeposit = Math.max(0, Number(plan.referralBonusMinimumDeposit || 0));
    const fixedBonus = Math.max(0, Number(plan.referralBonusFixed || 0));
    const percentageRate = Math.max(0, Number(plan.referralBonusPercentage || 0));
    const percentageBonus = depositAmount * percentageRate / 100;
    const maximumBonus = Math.max(0, Number(plan.referralBonusMaximum || 0));
    const calculatedBonus = fixedBonus + percentageBonus;
    const totalBonus = depositAmount >= minimumDeposit
      ? (maximumBonus > 0 ? Math.min(calculatedBonus, maximumBonus) : calculatedBonus)
      : 0;
    const roundedBonus = Math.round(totalBonus * 100) / 100;
    const now = Timestamp.now();

    if (firstDepositOnly) {
      transaction.update(referredUserRef, {
        referralFirstDepositRewardedAt: now,
        referralFirstDepositId: depositId,
      });
    }

    const status = roundedBonus > 0 ? 'credited' : 'cancelled';
    if (roundedBonus > 0) {
      transaction.update(referrerRef, {
        earningsBalance: Number(referrer.earningsBalance || 0) + roundedBonus,
        referralBalance: Number(referrer.referralBalance || 0) + roundedBonus,
        referralEarningsTotal: Number(referrer.referralEarningsTotal || 0) + roundedBonus,
      });
    }

    transaction.set(logRef, {
      referrerUserId: referrerId,
      referredUserId,
      depositId,
      depositAmount,
      referrerPackageId: String(referrer.packageId),
      fixedBonusAmount: fixedBonus,
      percentageRate,
      percentageBonusAmount: Math.round(percentageBonus * 100) / 100,
      totalBonus: roundedBonus,
      status,
      reason: roundedBonus > 0 ? null : `Minimum deposit of $${minimumDeposit.toFixed(2)} not met`,
      createdAt: now,
      creditedAt: roundedBonus > 0 ? now : null,
    });
    transaction.update(depositRef, { referralBonusStatus: status, referralTransactionId: logRef.id });
    return { status, totalBonus: roundedBonus };
  });
}

export async function reverseReferralBonusForDeposit(depositId: string) {
  const logRef = adminDb.collection('referral_transactions').doc(depositId);
  return adminDb.runTransaction(async (transaction) => {
    const logSnap = await transaction.get(logRef);
    if (!logSnap.exists) return;
    const log = logSnap.data() || {};
    if (log.status !== 'credited') return;

    const referrerRef = adminDb.collection('users').doc(String(log.referrerUserId));
    const referrerSnap = await transaction.get(referrerRef);
    if (!referrerSnap.exists) return;
    const referrer = referrerSnap.data() || {};
    const bonus = Number(log.totalBonus || 0);
    transaction.update(referrerRef, {
      earningsBalance: Number(referrer.earningsBalance || 0) - bonus,
      referralBalance: Math.max(0, Number(referrer.referralBalance || 0) - bonus),
      referralEarningsTotal: Math.max(0, Number(referrer.referralEarningsTotal || 0) - bonus),
    });
    transaction.update(logRef, { status: 'reversed', reversedAt: Timestamp.now() });
  });
}
