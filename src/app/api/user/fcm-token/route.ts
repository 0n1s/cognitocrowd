import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
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
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
    }

    const { token } = (await request.json()) as { token?: string };
    if (!token) {
      return NextResponse.json({ success: false, message: 'Token is required.' }, { status: 400 });
    }

    // Store the FCM token in the user's document
    await adminDb.collection('users').doc(uid).update({
      fcmTokens: adminDb.FieldValue.arrayUnion(token),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}