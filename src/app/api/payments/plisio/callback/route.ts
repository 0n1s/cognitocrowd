import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { awardReferralBonusForDeposit, reverseReferralBonusForDeposit } from '@/lib/referrals-admin';

type PlisioCallbackPayload = {
  verify_hash?: string;
  txn_id?: string;
  order_number?: string;
  status?: string;
  [key: string]: unknown;
};

function parsePayloadObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function parseCallbackPayload(request: NextRequest): Promise<PlisioCallbackPayload> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => ({}));
    return parsePayloadObject(json) as PlisioCallbackPayload;
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null);
    if (!formData) return {};

    const payload: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      payload[key] = typeof value === 'string' ? value : '';
    }
    return payload as PlisioCallbackPayload;
  }

  const text = await request.text().catch(() => '');
  if (!text) return {};

  try {
    return parsePayloadObject(JSON.parse(text)) as PlisioCallbackPayload;
  } catch {
    return {};
  }
}

function verifyJsonCallback(payload: PlisioCallbackPayload, secretKey: string) {
  const verifyHash = String(payload.verify_hash || '').trim().toLowerCase();
  if (!verifyHash) return false;

  const ordered = { ...payload } as Record<string, unknown>;
  delete ordered.verify_hash;

  const serialized = JSON.stringify(ordered);
  const digest = createHmac('sha1', secretKey).update(serialized).digest('hex').toLowerCase();

  const verifyHashBuffer = Buffer.from(verifyHash);
  const digestBuffer = Buffer.from(digest);
  if (verifyHashBuffer.length !== digestBuffer.length) return false;

  return timingSafeEqual(verifyHashBuffer, digestBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await parseCallbackPayload(request);

    const settingsSnap = await adminDb.collection('settings').doc('main').get();
    const settings = (settingsSnap.data() || {}) as { plisioApiKey?: string };
    const secretKey = String(settings.plisioApiKey || process.env.PLISIO_API_KEY || '').trim();

    if (!secretKey) {
      return NextResponse.json({ success: false, message: 'Plisio key is not configured.' }, { status: 500 });
    }

    if (!verifyJsonCallback(payload, secretKey)) {
      return NextResponse.json({ success: false, message: 'Invalid callback signature.' }, { status: 401 });
    }

    const callbackStatus = String(payload.status || '').toLowerCase().trim();
    const txnId = String(payload.txn_id || '').trim();
    const orderNumber = String(payload.order_number || '').trim();

    if (!txnId && !orderNumber) {
      return NextResponse.json({ success: true, message: 'Ignored callback without identifiers.' });
    }

    let depositDoc: QueryDocumentSnapshot | null = null;

    if (txnId) {
      const byTxn = await adminDb.collection('deposits').where('externalTxnId', '==', txnId).limit(1).get();
      depositDoc = byTxn.empty ? null : byTxn.docs[0];
    }

    if (!depositDoc && orderNumber) {
      const byOrder = await adminDb.collection('deposits').where('externalOrderNumber', '==', orderNumber).limit(1).get();
      depositDoc = byOrder.empty ? null : byOrder.docs[0];
    }

    if (!depositDoc) {
      return NextResponse.json({ success: true, message: 'No matching deposit found. Callback ignored.' });
    }

    await adminDb.runTransaction(async (transaction) => {
      const freshDepositSnap = await transaction.get(depositDoc!.ref);
      if (!freshDepositSnap.exists) return;

      const depositData = freshDepositSnap.data() as {
        userId?: string;
        amount?: number;
        status?: string;
      };

      const currentStatus = String(depositData.status || 'pending').toLowerCase();
      const userId = String(depositData.userId || '').trim();
      const amount = Number(depositData.amount || 0);

      const baseUpdate: Record<string, unknown> = {
        externalCallbackStatus: callbackStatus,
        externalCallbackAt: Timestamp.now(),
        externalTxnId: txnId || freshDepositSnap.get('externalTxnId') || '',
      };

      if (callbackStatus === 'completed') {
        if (currentStatus !== 'completed') {
          if (!userId) {
            throw new Error('Deposit has no userId.');
          }
          const userRef = adminDb.collection('users').doc(userId);
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists) {
            throw new Error('User not found for deposit.');
          }
          const currentDepositBalance = Number(userSnap.data()?.depositBalance || 0);
          transaction.update(userRef, { depositBalance: currentDepositBalance + amount });
        }
        transaction.update(freshDepositSnap.ref, {
          ...baseUpdate,
          status: 'completed',
          processedAt: Timestamp.now(),
        });
        return;
      }

      if (['error', 'cancelled', 'expired'].includes(callbackStatus) && currentStatus === 'pending') {
        transaction.update(freshDepositSnap.ref, {
          ...baseUpdate,
          status: 'failed',
          processedAt: Timestamp.now(),
        });
        return;
      }

      transaction.update(freshDepositSnap.ref, baseUpdate as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
    });

    const finalDepositStatus = String((await depositDoc.ref.get()).data()?.status || 'pending');
    if (finalDepositStatus === 'completed') {
      await awardReferralBonusForDeposit(depositDoc.id);
    } else if (finalDepositStatus === 'failed') {
      await reverseReferralBonusForDeposit(depositDoc.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
