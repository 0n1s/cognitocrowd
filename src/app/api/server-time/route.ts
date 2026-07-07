import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  const settingsSnap = await adminDb.collection('settings').doc('main').get();
  const processingTimeZone = String(settingsSnap.data()?.processingTimeZone || 'UTC').trim() || 'UTC';

  return NextResponse.json({
    serverTimeIso: new Date().toISOString(),
    processingTimeZone,
  });
}
