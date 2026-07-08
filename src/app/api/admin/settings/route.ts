import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function sanitizeSettingsPayload(payload: Record<string, unknown>) {
  // Drop client-injected document id overrides if present.
  const { id: _ignoredId, ...safePayload } = payload;
  return safePayload;
}

function projectPublicSettings(payload: Record<string, unknown>) {
  const copy = { ...payload };
  delete copy.plisioApiKey;
  delete copy.openAiCompatibleApiKey;

  if (Array.isArray(copy.aiProviders)) {
    copy.aiProviders = copy.aiProviders.map((provider: any) => ({
      ...provider,
      apiKey: '',
    }));
  }

  if (Array.isArray(copy.depositMethods)) {
    copy.depositMethods = copy.depositMethods.map((method: any) => ({
      ...method,
      credentials: {},
    }));
  }

  return copy;
}

async function verifyAdminFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized request.');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  const decoded = await adminAuth.verifyIdToken(idToken);

  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  const role = userDoc.data()?.role;
  if (role !== 'super_user_alpha_7') {
    throw new Error('Forbidden.');
  }
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdminFromRequest(request);
    const snapshot = await adminDb.collection('settings').doc('main').get();
    const settings = (snapshot.data() || {}) as Record<string, unknown>;
    await adminDb.collection('settings').doc('public').set(projectPublicSettings(settings), { merge: true });
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    const status = message === 'Unauthorized request.' ? 401 : message === 'Forbidden.' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await verifyAdminFromRequest(request);

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: 'Invalid settings payload.' }, { status: 400 });
    }

    const safePayload = sanitizeSettingsPayload(body as Record<string, unknown>);
    const publicPayload = projectPublicSettings(safePayload);
    await adminDb.collection('settings').doc('main').set(safePayload, { merge: true });
    await adminDb.collection('settings').doc('public').set(publicPayload, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    const status = message === 'Unauthorized request.' ? 401 : message === 'Forbidden.' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
