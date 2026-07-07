import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function sanitizeSettingsPayload(payload: Record<string, unknown>) {
  // Drop client-injected document id overrides if present.
  const { id: _ignoredId, ...safePayload } = payload;
  return safePayload;
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Unauthorized request.' }, { status: 401 });
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);

    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const role = userDoc.data()?.role;

    if (role !== 'super_user_alpha_7') {
      return NextResponse.json({ success: false, message: 'Forbidden.' }, { status: 403 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: 'Invalid settings payload.' }, { status: 400 });
    }

    const safePayload = sanitizeSettingsPayload(body as Record<string, unknown>);
    await adminDb.collection('settings').doc('main').set(safePayload, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
