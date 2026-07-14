import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import type { BrandAssets } from '@/lib/types';

export const runtime = 'nodejs';

const fields: Record<string, keyof BrandAssets> = {
  logoLight: 'logoLightUrl', logoDark: 'logoDarkUrl', logoMark: 'logoMarkUrl',
  favicon: 'faviconUrl', appleTouchIcon: 'appleTouchIconUrl', socialImage: 'socialImageUrl', emailLogo: 'emailLogoUrl',
};
const allowed = new Map([['image/png', 'png'], ['image/webp', 'webp'], ['image/jpeg', 'jpg'], ['image/svg+xml', 'svg'], ['image/x-icon', 'ico'], ['image/vnd.microsoft.icon', 'ico']]);
const typeByExtension = new Map([['png', 'image/png'], ['webp', 'image/webp'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['svg', 'image/svg+xml'], ['ico', 'image/x-icon']]);

function normalizeBucketName(bucketName?: string) {
  return String(bucketName || '').replace(/^gs:\/\//, '').replace(/\/$/, '').trim();
}

function resolveBucketCandidates() {
  const configured = normalizeBucketName(process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  return [configured, projectId && `${projectId}.firebasestorage.app`, projectId && `${projectId}.appspot.com`]
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}

async function verifyAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !apiKey) throw new Error('Unauthorized request.');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }), cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  const uid = body?.users?.[0]?.localId;
  if (!response.ok || !uid) throw new Error('Unauthorized request.');
  const user = await adminDb.collection('users').doc(uid).get();
  if (user.data()?.role !== 'super_user_alpha_7') throw new Error('Forbidden.');
}

export async function POST(request: NextRequest) {
  try {
    await verifyAdmin(request);
    const data = await request.formData();
    const asset = String(data.get('asset') || '');
    const file = data.get('file');
    if (!(file instanceof File) || !fields[asset]) throw new Error('Invalid brand asset upload.');
    const filenameExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const contentType = allowed.has(file.type) ? file.type : typeByExtension.get(filenameExtension) || '';
    const extension = allowed.get(contentType);
    if (!extension) throw new Error('Use SVG, PNG, WebP, JPEG, or ICO files.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Brand assets must be 5 MB or smaller.');
    const bytes = Buffer.from(await file.arrayBuffer());
    if (contentType === 'image/svg+xml') {
      const svg = bytes.toString('utf8');
      const normalizedSvg = svg.replace(/^\uFEFF/, '').replace(/^\s*<\?xml[\s\S]*?\?>/i, '').replace(/^\s*<!--?[\s\S]*?-->/, '').trimStart();
      if (!/^<svg[\s>]/i.test(normalizedSvg) || /<script|on\w+\s*=|javascript:|<foreignObject/i.test(normalizedSvg)) throw new Error('The SVG contains unsupported or unsafe content.');
    }
    const objectPath = `brand-assets/${asset}-${Date.now()}.${extension}`;
    const downloadToken = randomUUID();
    const bucketCandidates = resolveBucketCandidates();
    if (bucketCandidates.length === 0) throw new Error('Storage bucket is not configured.');

    let url = '';
    let lastStorageError = '';
    for (const bucketName of bucketCandidates) {
      try {
        const bucket = adminStorage.bucket(bucketName);
        const storedFile = bucket.file(objectPath);
        await storedFile.save(bytes, {
          resumable: false,
          metadata: {
            contentType,
            cacheControl: 'public, max-age=31536000, immutable',
            metadata: { firebaseStorageDownloadTokens: downloadToken },
          },
        });
        url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
        break;
      } catch (storageError) {
        lastStorageError = storageError instanceof Error ? storageError.message : 'Unknown storage error.';
      }
    }
    if (!url) throw new Error(`No valid Firebase Storage bucket found. ${lastStorageError}`.trim());
    const currentMain = await adminDb.collection('settings').doc('main').get();
    const currentAssets = (currentMain.data()?.brandAssets || {}) as BrandAssets;
    const nextAssets = { ...currentAssets, [fields[asset]]: url };
    await Promise.all([
      adminDb.collection('settings').doc('main').set({ brandAssets: nextAssets }, { merge: true }),
      adminDb.collection('settings').doc('public').set({ brandAssets: nextAssets }, { merge: true }),
    ]);
    return NextResponse.json({ success: true, url, field: fields[asset] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    console.error('Brand asset upload failed:', error);
    const status = message === 'Unauthorized request.' ? 401 : message === 'Forbidden.' ? 403 : message.includes('Storage') || message.includes('bucket') ? 500 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
