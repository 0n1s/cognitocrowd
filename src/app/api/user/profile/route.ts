import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const userProfileSchema = z.object({
  name: z.string().min(2).optional(),
  photoURL: z.string().url().optional(),
}).refine((data) => data.name !== undefined || data.photoURL !== undefined, {
  message: 'At least one field is required.',
});

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Unauthorized request.' }, { status: 401 });
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);

    const parsedBody = userProfileSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json({ success: false, message: 'Invalid profile payload.' }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (parsedBody.data.name !== undefined) {
      updates.name = parsedBody.data.name;
    }
    if (parsedBody.data.photoURL !== undefined) {
      updates.photoURL = parsedBody.data.photoURL;
    }

    await adminDb.collection('users').doc(decoded.uid).set(updates, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
