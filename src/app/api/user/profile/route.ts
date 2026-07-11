import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

type VerifiedUser = {
  uid: string;
};

async function verifyUser(request: NextRequest): Promise<VerifiedUser> {
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
  const user = Array.isArray(body.users) ? body.users[0] : undefined;

  if (!response.ok || !user?.localId) {
    throw new Error('Unauthorized request.');
  }

  return { uid: String(user.localId) };
}

const userProfileSchema = z.object({
  name: z.string().min(2).optional(),
  photoURL: z.string().url().optional(),
  country: z.string().max(80).optional(),
  languages: z.array(z.string().min(1).max(40)).max(20).optional(),
  expertise: z.array(z.string().min(1).max(80)).max(30).optional(),
}).refine((data) => (
  data.name !== undefined ||
  data.photoURL !== undefined ||
  data.country !== undefined ||
  data.languages !== undefined ||
  data.expertise !== undefined
), {
  message: 'At least one field is required.',
});

export async function PATCH(request: NextRequest) {
  try {
    const verifiedUser = await verifyUser(request);

    const parsedBody = userProfileSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json({ success: false, message: 'Invalid profile payload.' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (parsedBody.data.name !== undefined) {
      updates.name = parsedBody.data.name;
    }
    if (parsedBody.data.photoURL !== undefined) {
      updates.photoURL = parsedBody.data.photoURL;
    }
    if (parsedBody.data.country !== undefined) {
      updates.country = parsedBody.data.country.trim();
    }
    if (parsedBody.data.languages !== undefined) {
      updates.languages = parsedBody.data.languages.map((item) => item.trim()).filter(Boolean);
    }
    if (parsedBody.data.expertise !== undefined) {
      updates.expertise = parsedBody.data.expertise.map((item) => item.trim()).filter(Boolean);
    }

    await adminDb.collection('users').doc(verifiedUser.uid).set(updates, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
