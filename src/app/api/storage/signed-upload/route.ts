import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';

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

const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function getFileExtension(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'jpg';
}

function normalizeBucketName(bucketName?: string) {
  if (!bucketName) return '';
  return bucketName.replace(/^gs:\/\//, '').replace(/\/$/, '').trim();
}

function resolveBucketCandidates() {
  const configuredBucket = normalizeBucketName(
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  );

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    '';

  const candidates: string[] = [];

  if (configuredBucket) {
    candidates.push(configuredBucket);
  }

  if (projectId) {
    const appspotBucket = `${projectId}.appspot.com`;
    const storageAppBucket = `${projectId}.firebasestorage.app`;

    if (!candidates.includes(storageAppBucket)) {
      candidates.push(storageAppBucket);
    }
    if (!candidates.includes(appspotBucket)) {
      candidates.push(appspotBucket);
    }
  }

  return candidates;
}

export async function POST(request: NextRequest) {
  try {
    const verifiedUser = await verifyUser(request);

    const body = (await request.json()) as {
      purpose?: 'profile-picture' | 'deposit-receipt';
      contentType?: string;
    };

    if (!body.purpose || !['profile-picture', 'deposit-receipt'].includes(body.purpose)) {
      return NextResponse.json({ success: false, message: 'Unsupported upload purpose.' }, { status: 400 });
    }

    const contentType = body.contentType || 'image/png';
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ success: false, message: 'Unsupported file type.' }, { status: 400 });
    }

    const extension = getFileExtension(contentType);
    const objectPath = body.purpose === 'deposit-receipt'
      ? `deposit-receipts/${verifiedUser.uid}-${randomUUID()}.${extension}`
      : `profile-pictures/${verifiedUser.uid}-${randomUUID()}.${extension}`;
    const bucketCandidates = resolveBucketCandidates();

    if (bucketCandidates.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.' },
        { status: 500 }
      );
    }

    let uploadUrl: string | null = null;
    let downloadUrl: string | null = null;
    let selectedBucketName: string | null = null;
    let lastErrorMessage = '';
    const downloadToken = randomUUID();

    for (const bucketName of bucketCandidates) {
      try {
        const bucket = adminStorage.bucket(bucketName);
        const file = bucket.file(objectPath);

        const [signedUploadUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'write',
          expires: Date.now() + 10 * 60 * 1000,
          contentType,
          extensionHeaders: {
            'x-goog-meta-firebaseStorageDownloadTokens': downloadToken,
          },
        });

        selectedBucketName = bucket.name;
        uploadUrl = signedUploadUrl;
        downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
        break;
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : 'Unknown bucket error.';
      }
    }

    if (!uploadUrl || !downloadUrl || !selectedBucketName) {
      return NextResponse.json(
        {
          success: false,
          message: `No valid storage bucket found for signed upload. Last error: ${lastErrorMessage}`,
          triedBuckets: bucketCandidates,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      uploadUrl,
      objectPath,
      downloadUrl,
      bucket: selectedBucketName,
      headers: {
        'Content-Type': contentType,
        'x-goog-meta-firebaseStorageDownloadTokens': downloadToken,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
