import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized request.');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('Unauthorized request.');
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    cache: 'no-store',
  });

  const body = (await response.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string }>;
  };
  const uid = Array.isArray(body.users) ? String(body.users[0]?.localId || '') : '';
  if (!response.ok || !uid) {
    throw new Error('Unauthorized request.');
  }

  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'super_user_alpha_7') {
    throw new Error('Forbidden.');
  }

  return uid;
}

function serializeDoc(doc: any) {
  const data = doc.data() || {};
  const result: Record<string, any> = { id: doc.id };

  for (const key of Object.keys(data)) {
    const value = data[key];
    if (value?.toDate && typeof value.toDate === 'function') {
      result[key] = value.toDate().toISOString();
    } else {
      result[key] = value;
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdmin(request);

    const snapshot = await (adminDb as any)
      .collection('email_logs')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const logs = snapshot.docs.map(serializeDoc);

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Unauthorized request.' ? 401 : message === 'Forbidden.' ? 403 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}