import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    const nowMs = Date.now();
    const windowStartMs = nowMs - (nowMs % RATE_LIMIT_WINDOW_MS);
    const key = `check-user:${ip}:${windowStartMs}`;
    const limitRef = (adminDb as any).collection('api_rate_limits').doc(key);

    const result = await (adminDb as any).runTransaction(async (transaction: any) => {
      const snap = await transaction.get(limitRef);
      const currentCount = Number(snap.data()?.count || 0);
      if (currentCount >= MAX_REQUESTS_PER_WINDOW) {
        return false;
      }
      transaction.set(limitRef, {
        scope: 'check-user',
        ip,
        windowStartMs,
        count: currentCount + 1,
        updatedAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(windowStartMs + RATE_LIMIT_WINDOW_MS * 2),
      }, { merge: true });
      return true;
    });

    return result !== false;
  } catch {
    // If rate limiter itself fails, allow the request to proceed
    return true;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ success: false, message: 'uid is required.' }, { status: 400 });
    }

    const userDoc = await (adminDb as any).collection('users').doc(uid).get();
    return NextResponse.json({ success: true, exists: userDoc.exists });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
