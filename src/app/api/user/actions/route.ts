import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { evaluateQualificationTest } from '@/ai/flows/ai-qualification-test';
import { generateImage } from '@/ai/flows/ai-generate-image';
import { improveImagePrompt as improveImagePromptFlow } from '@/ai/flows/ai-improve-image-prompt';
import { generateMusic } from '@/ai/flows/ai-generate-music';
import { improveMusicLyrics as improveMusicLyricsFlow } from '@/ai/flows/ai-improve-music-lyrics';
import { improveMusicCaption as improveMusicCaptionFlow } from '@/ai/flows/ai-improve-music-caption';
import { improveMusicIdea as improveMusicIdeaFlow } from '@/ai/flows/ai-improve-music-idea';
import { suggestMusicDuration as suggestMusicDurationFlow } from '@/ai/flows/ai-suggest-music-duration';
import { checkImagePromptSafety } from '@/ai/flows/ai-check-image-prompt-safety';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import type { DepositMethod, WithdrawalMethod } from '@/lib/types';
import { logJsonEvent } from '@/lib/json-logger';
import { awardReferralBonusForDeposit } from '@/lib/referrals-admin';

type UserActionPayload = {
  action: string;
  payload?: Record<string, any>;
};

async function verifyUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized request.');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}

function parsePackagePrice(priceText: string): number {
  const normalized = String(priceText || '').trim().toLowerCase();
  if (!normalized || normalized === 'free') return 0;
  if (!normalized.startsWith('$')) return Number.POSITIVE_INFINITY;

  const numeric = Number.parseFloat(normalized.substring(1));
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

function normalizeWeekday(value: string) {
  return value.trim().toLowerCase();
}

function getCurrentWeekday(timeZone?: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: timeZone || undefined,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  }
}

function getAppBaseUrl(request: NextRequest, configuredBaseUrl?: string) {
  const fromSettings = String(configuredBaseUrl || '').trim();
  if (fromSettings) {
    return fromSettings.replace(/\/+$/, '');
  }

  const fromEnv =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (!host) {
    throw new Error('Unable to determine app base URL for Plisio callback.');
  }
  return `${proto}://${host}`;
}

async function createPlisioInvoice(params: {
  apiKey: string;
  amountUsd: number;
  orderNumber: string;
  orderName: string;
  callbackUrl: string;
  successUrl: string;
  failUrl: string;
  email?: string;
}) {
  const query = new URLSearchParams({
    source_currency: 'USD',
    source_amount: params.amountUsd.toFixed(2),
    order_number: params.orderNumber,
    order_name: params.orderName,
    callback_url: params.callbackUrl,
    success_invoice_url: params.successUrl,
    fail_invoice_url: params.failUrl,
    api_key: params.apiKey,
    return_existing: '1',
  });
  if (params.email) {
    query.set('email', params.email);
  }

  const response = await fetch(`https://api.plisio.net/api/v1/invoices/new?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const body = await response.json().catch(() => ({})) as {
    status?: string;
    data?: {
      txn_id?: string;
      invoice_url?: string;
      message?: string;
    };
  };

  if (!response.ok || body.status !== 'success' || !body.data?.txn_id || !body.data?.invoice_url) {
    const message = body?.data?.message || 'Failed to create Plisio invoice.';
    throw new Error(message);
  }

  return {
    txnId: body.data.txn_id,
    invoiceUrl: body.data.invoice_url,
  };
}

function extractStorageObjectPathFromUrl(fileUrl: string, bucketName: string): string | null {
  try {
    const parsed = new URL(fileUrl);
    const decodedPath = decodeURIComponent(parsed.pathname || '');

    if (parsed.hostname === 'storage.googleapis.com') {
      const prefix = `/${bucketName}/`;
      if (decodedPath.startsWith(prefix)) {
        return decodedPath.slice(prefix.length);
      }
    }

    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const marker = `/v0/b/${bucketName}/o/`;
      const markerIndex = decodedPath.indexOf(marker);
      if (markerIndex >= 0) {
        return decodedPath.slice(markerIndex + marker.length);
      }
    }

    if (parsed.hostname === `${bucketName}.storage.googleapis.com`) {
      return decodedPath.startsWith('/') ? decodedPath.slice(1) : decodedPath;
    }

    return null;
  } catch {
    return null;
  }
}

async function deleteFileIfExists(bucketName: string, objectPath: string) {
  if (!objectPath) {
    return;
  }

  try {
    await adminStorage.bucket(bucketName).file(objectPath).delete();
  } catch (error: any) {
    const statusCode = Number(error?.code ?? error?.statusCode ?? 0);
    if (statusCode !== 404) {
      throw error;
    }
  }
}

async function verifyMusicGenerationAssist(uid: string) {
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const packageId = userSnap.data()?.packageId;
  if (!userSnap.exists || !packageId) {
    throw new Error('Your current package does not allow music AI assistance.');
  }

  const packageSnap = await adminDb.collection('packages').doc(packageId).get();
  if (!packageSnap.exists || packageSnap.data()?.allowMusicGenerationAssist !== true) {
    throw new Error('Your current package does not allow music AI assistance.');
  }
}

async function verifyMusicStyleProfiles(uid: string) {
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const packageId = userSnap.data()?.packageId;
  if (!userSnap.exists || !packageId) {
    throw new Error('Your current package does not allow reusable music styles.');
  }
  const packageSnap = await adminDb.collection('packages').doc(packageId).get();
  if (!packageSnap.exists || packageSnap.data()?.allowMusicStyleProfiles !== true) {
    throw new Error('Your current package does not allow reusable music styles.');
  }
}

async function handleUserAction(request: NextRequest, uid: string, action: string, payload: Record<string, any>) {
  switch (action) {
    case 'getMusicStyleProfiles': {
      await verifyMusicStyleProfiles(uid);
      const snapshot = await adminDb.collection('music_style_profiles').where('userId', '==', uid).get();
      const profiles = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: uid,
            name: String(data.name || ''),
            caption: String(data.caption || ''),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      return { success: true, profiles };
    }

    case 'saveMusicStyleProfile': {
      await verifyMusicStyleProfiles(uid);
      const name = String(payload.name || '').trim();
      const caption = String(payload.caption || '').trim();
      if (!name || !caption) throw new Error('A style name and music caption are required.');
      if (name.length > 60 || caption.length > 1000) throw new Error('The style profile is too long.');

      const existing = await adminDb.collection('music_style_profiles').where('userId', '==', uid).get();
      const sameName = existing.docs.find((doc) => String(doc.data().name || '').toLowerCase() === name.toLowerCase());
      if (!sameName && existing.size >= 10) throw new Error('You can save up to 10 music style profiles.');

      const now = Timestamp.now();
      const profileRef = sameName?.ref || adminDb.collection('music_style_profiles').doc();
      await profileRef.set({
        userId: uid,
        name,
        caption,
        createdAt: sameName?.data().createdAt || now,
        updatedAt: now,
      });
      return {
        success: true,
        message: sameName ? 'Music style updated.' : 'Music style saved.',
        profile: { id: profileRef.id, userId: uid, name, caption, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() },
      };
    }

    case 'deleteMusicStyleProfile': {
      await verifyMusicStyleProfiles(uid);
      const profileId = String(payload.profileId || '').trim();
      if (!profileId) throw new Error('Style profile ID is required.');
      const profileRef = adminDb.collection('music_style_profiles').doc(profileId);
      const profileSnap = await profileRef.get();
      if (!profileSnap.exists || profileSnap.data()?.userId !== uid) throw new Error('Music style profile not found.');
      await profileRef.delete();
      return { success: true, message: 'Music style deleted.' };
    }

    case 'getUserGeneratedMusic': {
      const snapshot = await adminDb
        .collection('generated_music')
        .where('userId', '==', uid)
        .get();

      const music = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : String(data.createdAt || '');
          return {
            id: doc.id,
            userId: uid,
            prompt: String(data.prompt || ''),
            altPrompt: String(data.altPrompt || ''),
            durationSeconds: Number(data.durationSeconds || 0),
            audioUrl: String(data.audioUrl || ''),
            storagePath: data.storagePath ? String(data.storagePath) : undefined,
            createdAt,
          };
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

      return { success: true, music };
    }

    case 'deleteGeneratedMusic': {
      const musicId = String(payload.musicId || '').trim();
      if (!musicId) throw new Error('Music ID is required.');

      const musicRef = adminDb.collection('generated_music').doc(musicId);
      const musicSnap = await musicRef.get();
      if (!musicSnap.exists) throw new Error('Track not found.');

      const musicData = musicSnap.data() as {
        userId?: string;
        audioUrl?: string;
        storagePath?: string;
      };
      if (musicData.userId !== uid) throw new Error('You are not allowed to delete this track.');

      const configuredBucketName =
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
      const bucket = configuredBucketName ? adminStorage.bucket(configuredBucketName) : adminStorage.bucket();
      const objectPath = musicData.storagePath || (
        musicData.audioUrl ? extractStorageObjectPathFromUrl(musicData.audioUrl, bucket.name) : null
      );

      if (objectPath) await deleteFileIfExists(bucket.name, objectPath);
      await musicRef.delete();
      return { success: true, message: 'Track deleted successfully.' };
    }

    case 'getLeaderboardData': {
      const settingsDoc = await adminDb.collection('settings').doc('main').get();
      const leaderboardEnabled = settingsDoc.data()?.leaderboardEnabled !== false;
      if (!leaderboardEnabled) {
        return {
          success: true,
          leaderboardEnabled: false,
          leaderboard: [],
          message: 'Leaderboard is currently disabled by admin.',
        };
      }

      const snapshot = await adminDb
        .collection('users')
        .orderBy('earningsBalance', 'desc')
        .limit(10)
        .get();

      const leaderboard = snapshot.docs.map((doc, index) => {
        const data = doc.data() as { name?: string; earningsBalance?: number };
        return {
          rank: index + 1,
          user: {
            name: data.name || 'Unknown User',
          },
          points: data.earningsBalance || 0,
        };
      });

      return { success: true, leaderboardEnabled: true, leaderboard };
    }

    case 'deleteGeneratedImage': {
      const imageId = String(payload.imageId || '').trim();
      if (!imageId) {
        throw new Error('Image ID is required.');
      }

      const imageRef = adminDb.collection('generated_images').doc(imageId);
      const imageSnap = await imageRef.get();

      if (!imageSnap.exists) {
        throw new Error('Image not found.');
      }

      const imageData = imageSnap.data() as {
        userId?: string;
        imageUrl?: string;
        thumbnailUrl?: string;
      };

      if (imageData.userId !== uid) {
        throw new Error('You are not allowed to delete this image.');
      }

      const configuredBucketName =
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
      const bucket = configuredBucketName ? adminStorage.bucket(configuredBucketName) : adminStorage.bucket();
      const bucketName = bucket.name;

      const storagePaths = new Set<string>();
      if (imageData.imageUrl) {
        const path = extractStorageObjectPathFromUrl(imageData.imageUrl, bucketName);
        if (path) storagePaths.add(path);
      }
      if (imageData.thumbnailUrl) {
        const path = extractStorageObjectPathFromUrl(imageData.thumbnailUrl, bucketName);
        if (path) storagePaths.add(path);
      }

      for (const objectPath of storagePaths) {
        await deleteFileIfExists(bucketName, objectPath);
      }

      await imageRef.delete();

      return { success: true, message: 'Image deleted successfully.' };
    }

    case 'deleteGeneratedImages': {
      const imageIds = Array.from(new Set(
        (Array.isArray(payload.imageIds) ? payload.imageIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      ));
      if (imageIds.length === 0) throw new Error('At least one image ID is required.');
      if (imageIds.length > 500) throw new Error('You can delete up to 500 images at once.');

      const imageRefs = imageIds.map((id) => adminDb.collection('generated_images').doc(id));
      const snapshots = await adminDb.getAll(...imageRefs);
      const configuredBucketName =
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
      const bucket = configuredBucketName ? adminStorage.bucket(configuredBucketName) : adminStorage.bucket();
      const bucketName = bucket.name;

      const results = await Promise.all(snapshots.map(async (imageSnap) => {
        if (!imageSnap.exists || imageSnap.data()?.userId !== uid) {
          return { id: imageSnap.id, deleted: false, ref: null };
        }

        const data = imageSnap.data() as { imageUrl?: string; thumbnailUrl?: string };
        const storagePaths = new Set<string>();
        for (const url of [data.imageUrl, data.thumbnailUrl]) {
          if (!url) continue;
          const path = extractStorageObjectPathFromUrl(url, bucketName);
          if (path) storagePaths.add(path);
        }

        try {
          await Promise.all(Array.from(storagePaths).map((path) => deleteFileIfExists(bucketName, path)));
          return { id: imageSnap.id, deleted: true, ref: imageSnap.ref };
        } catch {
          return { id: imageSnap.id, deleted: false, ref: null };
        }
      }));

      const deleted = results.filter((result) => result.deleted && result.ref);
      if (deleted.length > 0) {
        const batch = adminDb.batch();
        deleted.forEach((result) => batch.delete(result.ref!));
        await batch.commit();
      }

      const deletedIds = deleted.map((result) => result.id);
      const failedIds = results.filter((result) => !result.deleted).map((result) => result.id);
      return {
        success: deletedIds.length > 0,
        message: failedIds.length === 0
          ? `${deletedIds.length} image${deletedIds.length === 1 ? '' : 's'} deleted successfully.`
          : `${deletedIds.length} deleted; ${failedIds.length} could not be deleted.`,
        deletedIds,
        failedIds,
      };
    }

    case 'generateAndSaveImage': {
      const prompt = String(payload.prompt || '').trim();
      const imageModel = payload.imageModel === 'uncensored' ? 'uncensored' : 'normal';
      if (!prompt) {
        throw new Error('Prompt is required.');
      }

      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        throw new Error('User not found.');
      }

      const userData = userSnap.data() as {
        packageId?: string | null;
        lastImageGenerationReset?: any;
        dailyImageGenerationCount?: number;
        packageImageGenerationCount?: number;
      };

      let userPackage: {
        imageGenerationLimit?: number;
        imageGenerationLimitType?: 'daily' | 'lifetime';
        allowImageNormal?: boolean;
        allowImageUncensored?: boolean;
        allowUncensoredImageGeneration?: boolean;
        allowedModelTypes?: string[];
      } | null = null;

      if (userData.packageId) {
        const packageSnap = await adminDb.collection('packages').doc(userData.packageId).get();
        if (packageSnap.exists) {
          userPackage = packageSnap.data() as {
            imageGenerationLimit?: number;
            imageGenerationLimitType?: 'daily' | 'lifetime';
          };
        }
      }

      const imageLimit = userPackage?.imageGenerationLimit ?? 0;
      if (imageLimit <= 0) {
        throw new Error('Your current package does not allow image generation.');
      }

      const legacyTypes = userPackage?.allowedModelTypes || [];
      const hasLegacyType = (type: string) => legacyTypes.includes(type);
      const legacyFallbackEnabled = legacyTypes.length === 0;
      const allowImageNormal = (userPackage?.allowImageNormal ?? hasLegacyType('image')) || legacyFallbackEnabled;
      const allowImageUncensored = userPackage?.allowImageUncensored ?? userPackage?.allowUncensoredImageGeneration ?? hasLegacyType('uncensored');

      if (imageModel === 'uncensored' && !allowImageUncensored) {
        throw new Error('Your current package does not allow uncensored image generation.');
      }
      if (imageModel === 'normal' && !allowImageNormal) {
        throw new Error('Your current package does not allow normal image generation.');
      }

      if (imageModel === 'normal') {
        const safety = await checkImagePromptSafety({ prompt });
        if (!safety.isSafe) {
          throw new Error(safety.reason || 'This prompt is not safe for work and cannot be generated in normal mode.');
        }
      }

      const genResult = await generateImage({ prompt, imageModel });
      if (!genResult.imageDataUri) {
        throw new Error('AI failed to generate an image.');
      }

      let imageBuffer: Buffer;
      const generated = genResult.imageDataUri;
      if (generated.startsWith('data:')) {
        const base64Data = generated.substring(generated.indexOf(',') + 1);
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        const imageResponse = await fetch(generated, { cache: 'no-store' });
        if (!imageResponse.ok) {
          throw new Error('Generated image URL could not be downloaded.');
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      }

      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
      const bucket = bucketName ? adminStorage.bucket(bucketName) : adminStorage.bucket();
      const objectPath = `generated-images/${uid}/${randomUUID()}.png`;
      const file = bucket.file(objectPath);

      await file.save(imageBuffer, {
        resumable: false,
        contentType: 'image/png',
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      const [downloadURL] = await file.getSignedUrl({
        action: 'read',
        expires: '2100-01-01',
      });

      const imageRef = adminDb.collection('generated_images').doc();
      let createdAtIso = new Date().toISOString();

      await adminDb.runTransaction(async (transaction) => {
        const freshUserSnap = await transaction.get(userRef);
        if (!freshUserSnap.exists) {
          throw new Error('User not found.');
        }

        const freshUser = freshUserSnap.data() as {
          packageId?: string | null;
          lastImageGenerationReset?: any;
          dailyImageGenerationCount?: number;
          packageImageGenerationCount?: number;
        };

        let freshPackage: {
          imageGenerationLimit?: number;
          imageGenerationLimitType?: 'daily' | 'lifetime';
        } | null = null;

        if (freshUser.packageId) {
          const packageRef = adminDb.collection('packages').doc(freshUser.packageId);
          const packageSnap = await transaction.get(packageRef);
          if (packageSnap.exists) {
            freshPackage = packageSnap.data() as {
              imageGenerationLimit?: number;
              imageGenerationLimitType?: 'daily' | 'lifetime';
            };
          }
        }

        const limit = freshPackage?.imageGenerationLimit ?? 0;
        if (limit <= 0) {
          throw new Error('Your current package does not allow image generation.');
        }

        const limitType = freshPackage?.imageGenerationLimitType || 'daily';
        let updates: Record<string, any> = {};

        if (limitType === 'lifetime') {
          const lifetimeCount = freshUser.packageImageGenerationCount || 0;
          if (lifetimeCount >= limit) {
            throw new Error('You have reached your image generation limit for this package.');
          }
          updates = { packageImageGenerationCount: lifetimeCount + 1 };
        } else {
          const lastResetDate = freshUser.lastImageGenerationReset?.toDate
            ? freshUser.lastImageGenerationReset.toDate()
            : new Date(0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dailyCount = lastResetDate < today ? 0 : freshUser.dailyImageGenerationCount || 0;

          if (dailyCount >= limit) {
            throw new Error('You have reached your daily image generation limit for today.');
          }
          updates = {
            dailyImageGenerationCount: dailyCount + 1,
            lastImageGenerationReset: Timestamp.now(),
          };
        }

        const createdAt = Timestamp.now();
        createdAtIso = createdAt.toDate().toISOString();
        transaction.set(imageRef, {
          userId: uid,
          prompt,
          imageUrl: downloadURL,
          thumbnailUrl: downloadURL,
          createdAt,
        });
        transaction.update(userRef, updates);
      });

      return {
        success: true,
        message: 'Image generated successfully.',
        image: {
          id: imageRef.id,
          userId: uid,
          prompt,
          imageUrl: downloadURL,
          thumbnailUrl: downloadURL,
          createdAt: createdAtIso,
        },
      };
    }

    case 'improveImagePrompt': {
      const prompt = String(payload.prompt || '').trim();
      if (!prompt) {
        throw new Error('Prompt is required.');
      }

      const result = await improveImagePromptFlow({ prompt });
      const improvedPrompt = String(result.improvedPrompt || '').trim();
      if (!improvedPrompt) {
        throw new Error('AI did not return an improved prompt.');
      }

      return {
        success: true,
        improvedPrompt,
      };
    }

    case 'generateAndSaveMusic': {
      const prompt = String(payload.prompt || '').trim();
      const altPrompt = String(payload.altPrompt || '').trim();
      const durationSeconds = Math.max(10, Math.min(240, Number(payload.durationSeconds) || 40));

      if (!prompt) {
        throw new Error('Lyrics prompt is required.');
      }

      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        throw new Error('User not found.');
      }

      const userData = userSnap.data() as {
        packageId?: string | null;
      };

      let userPackage: {
        allowMusicGeneration?: boolean;
        musicGenerationLimit?: number;
        musicGenerationLimitType?: 'daily' | 'lifetime';
      } | null = null;

      if (userData.packageId) {
        const packageSnap = await adminDb.collection('packages').doc(userData.packageId).get();
        if (packageSnap.exists) {
          userPackage = packageSnap.data() as {
            allowMusicGeneration?: boolean;
            musicGenerationLimit?: number;
            musicGenerationLimitType?: 'daily' | 'lifetime';
          };
        }
      }

      if (!userPackage?.allowMusicGeneration) {
        throw new Error('Your current package does not allow music generation.');
      }

      const musicLimit = userPackage?.musicGenerationLimit ?? 0;
      if (musicLimit <= 0) {
        throw new Error('Your current package has no music generation quota.');
      }

      const genResult = await generateMusic({
        prompt,
        altPrompt: altPrompt || undefined,
        durationSeconds,
        numInferenceSteps: 100,
        sampleSolver: 'euler',
      });

      if (!genResult.audioUrl) {
        throw new Error('AI failed to generate music.');
      }

      const audioResponse = await fetch(genResult.audioUrl, { cache: 'no-store' });
      if (!audioResponse.ok) {
        throw new Error(`Generated audio could not be downloaded (${audioResponse.status}).`);
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      if (audioBuffer.length === 0) {
        throw new Error('Generated audio download was empty.');
      }

      const sourceContentType = (audioResponse.headers.get('content-type') || 'audio/mpeg').split(';')[0].trim();
      const audioFormats: Record<string, string> = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/flac': 'flac',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
        'audio/aac': 'aac',
      };
      const extension = audioFormats[sourceContentType] || 'mp3';
      const contentType = sourceContentType.startsWith('audio/') ? sourceContentType : 'audio/mpeg';
      const configuredBucketName =
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
      const bucket = configuredBucketName ? adminStorage.bucket(configuredBucketName) : adminStorage.bucket();
      const objectPath = `generated-music/${uid}/${randomUUID()}.${extension}`;
      const audioFile = bucket.file(objectPath);

      await audioFile.save(audioBuffer, {
        resumable: false,
        contentType,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });

      const [storedAudioUrl] = await audioFile.getSignedUrl({
        action: 'read',
        expires: '2100-01-01',
      });

      const musicRef = adminDb.collection('generated_music').doc();
      let createdAtIso = new Date().toISOString();

      try {
        await adminDb.runTransaction(async (transaction) => {
        const freshUserSnap = await transaction.get(userRef);
        if (!freshUserSnap.exists) {
          throw new Error('User not found.');
        }

        const freshUser = freshUserSnap.data() as {
          packageId?: string | null;
          lastMusicGenerationReset?: any;
          dailyMusicGenerationCount?: number;
          packageMusicGenerationCount?: number;
        };

        let freshPackage: {
          allowMusicGeneration?: boolean;
          musicGenerationLimit?: number;
          musicGenerationLimitType?: 'daily' | 'lifetime';
        } | null = null;

        if (freshUser.packageId) {
          const packageRef = adminDb.collection('packages').doc(freshUser.packageId);
          const packageSnap = await transaction.get(packageRef);
          if (packageSnap.exists) {
            freshPackage = packageSnap.data() as {
              allowMusicGeneration?: boolean;
              musicGenerationLimit?: number;
              musicGenerationLimitType?: 'daily' | 'lifetime';
            };
          }
        }

        if (!freshPackage?.allowMusicGeneration) {
          throw new Error('Your current package does not allow music generation.');
        }

        const limit = freshPackage?.musicGenerationLimit ?? 0;
        if (limit <= 0) {
          throw new Error('Your current package has no music generation quota.');
        }

        const limitType = freshPackage?.musicGenerationLimitType || 'daily';
        let updates: Record<string, any> = {};

        if (limitType === 'lifetime') {
          const lifetimeCount = freshUser.packageMusicGenerationCount || 0;
          if (lifetimeCount >= limit) {
            throw new Error('You have reached your music generation limit for this package.');
          }
          updates = { packageMusicGenerationCount: lifetimeCount + 1 };
        } else {
          const lastResetDate = freshUser.lastMusicGenerationReset?.toDate
            ? freshUser.lastMusicGenerationReset.toDate()
            : new Date(0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dailyCount = lastResetDate < today ? 0 : freshUser.dailyMusicGenerationCount || 0;

          if (dailyCount >= limit) {
            throw new Error('You have reached your daily music generation limit for today.');
          }

          updates = {
            dailyMusicGenerationCount: dailyCount + 1,
            lastMusicGenerationReset: Timestamp.now(),
          };
        }

        const createdAt = Timestamp.now();
        createdAtIso = createdAt.toDate().toISOString();
        transaction.set(musicRef, {
          userId: uid,
          prompt,
          altPrompt: altPrompt || '',
          durationSeconds,
          audioUrl: storedAudioUrl,
          storagePath: objectPath,
          createdAt,
        });
        transaction.update(userRef, updates);
        });
      } catch (error) {
        await audioFile.delete().catch(() => undefined);
        throw error;
      }

      return {
        success: true,
        message: 'Music generated successfully.',
        music: {
          id: musicRef.id,
          userId: uid,
          prompt,
          altPrompt: altPrompt || '',
          durationSeconds,
          audioUrl: storedAudioUrl,
          storagePath: objectPath,
          createdAt: createdAtIso,
        },
      };
    }

    case 'improveMusicLyrics': {
      await verifyMusicGenerationAssist(uid);
      const prompt = String(payload.prompt || '').trim();
      if (!prompt) {
        throw new Error('Prompt is required.');
      }

      const result = await improveMusicLyricsFlow({ prompt });
      const improvedPrompt = String(result.improvedPrompt || '').trim();
      if (!improvedPrompt) {
        throw new Error('AI did not return improved lyrics.');
      }

      return { success: true, improvedPrompt };
    }

    case 'improveMusicIdea': {
      await verifyMusicGenerationAssist(uid);
      const prompt = String(payload.prompt || '').trim();
      if (!prompt) throw new Error('Song description is required.');

      const result = await improveMusicIdeaFlow({ prompt });
      const improvedPrompt = String(result.improvedPrompt || '').trim();
      if (!improvedPrompt) throw new Error('AI did not return a song description.');
      return { success: true, improvedPrompt };
    }

    case 'generateRandomMusicIdea': {
      await verifyMusicGenerationAssist(uid);
      const styleCaption = String(payload.styleCaption || '').trim();
      const result = await improveMusicIdeaFlow({
        prompt: styleCaption
          ? `Invent a completely random, original song concept that strictly fits this saved music style: ${styleCaption}. Surprise me with the story and message while preserving the genre, mood, instrumentation, vocal approach, and production identity.`
          : 'Invent a completely random, original song concept. Surprise me with the story, genre, mood, and musical energy.',
      });
      const improvedPrompt = String(result.improvedPrompt || '').trim();
      if (!improvedPrompt) throw new Error('AI did not return a random song description.');
      return { success: true, improvedPrompt };
    }

    case 'improveMusicCaption': {
      await verifyMusicGenerationAssist(uid);
      const prompt = String(payload.prompt || '').trim();
      if (!prompt) {
        throw new Error('Prompt is required.');
      }

      const result = await improveMusicCaptionFlow({ prompt });
      const improvedPrompt = String(result.improvedPrompt || '').trim();
      if (!improvedPrompt) {
        throw new Error('AI did not return an improved caption.');
      }

      return { success: true, improvedPrompt };
    }

    case 'suggestMusicDuration': {
      await verifyMusicGenerationAssist(uid);
      const lyrics = String(payload.lyrics || '').trim();
      const caption = String(payload.caption || '').trim();
      if (!lyrics) throw new Error('Lyrics are required to suggest a duration.');

      const result = await suggestMusicDurationFlow({ lyrics, caption: caption || undefined });
      return { success: true, durationSeconds: result.durationSeconds };
    }

    case 'requestWithdrawal': {
      const amount = Number(payload.amount);
      const methodId = String(payload.methodId || payload.paymentMethod || '').trim();
      const fieldValues = payload.fieldValues && typeof payload.fieldValues === 'object'
        ? (payload.fieldValues as Record<string, string>)
        : {};
      const legacyPaymentDetails = String(payload.paymentDetails || '').trim();

      if (!Number.isFinite(amount) || amount <= 0 || !methodId) {
        throw new Error('Invalid withdrawal payload.');
      }

      await adminDb.runTransaction(async (transaction) => {
        const settingsRef = adminDb.collection('settings').doc('main');
        const userRef = adminDb.collection('users').doc(uid);

        const [settingsSnap, userSnap] = await Promise.all([
          transaction.get(settingsRef),
          transaction.get(userRef),
        ]);

        if (!userSnap.exists) throw new Error('User not found.');

        const settings = (settingsSnap.data() || {}) as {
          processingTimeZone?: string;
          withdrawalDays?: string[];
          withdrawalMinimumAmount?: number;
          withdrawalMaximumAmount?: number;
          withdrawalMethods?: WithdrawalMethod[];
          paymentMethods?: Array<{ id: string; name: string }>;
        };
        const withdrawalDays = settings.withdrawalDays || [];
        const configuredMethods = (settings.withdrawalMethods && settings.withdrawalMethods.length > 0)
          ? settings.withdrawalMethods
          : (settings.paymentMethods || []).map((method) => ({
            id: method.id,
            name: method.name,
            provider: 'custom' as const,
            enabled: true,
            processingMode: 'admin_verified' as const,
            minimumAmount: undefined,
            maximumAmount: undefined,
            description: '',
            customFields: [],
          }));
        const selectedMethod = configuredMethods.find((method) => method.id === methodId || method.name === methodId);
        if (!selectedMethod) {
          throw new Error('Selected withdrawal method is not configured.');
        }
        if (selectedMethod.enabled === false) {
          throw new Error('Selected withdrawal method is disabled.');
        }

        const processingTimeZone = String(settings.processingTimeZone || 'UTC').trim() || 'UTC';
        const today = getCurrentWeekday(processingTimeZone);
        const normalizedToday = normalizeWeekday(today);
        const normalizedAllowedDays = withdrawalDays.map(normalizeWeekday);

        if (withdrawalDays.length > 0 && !normalizedAllowedDays.includes(normalizedToday)) {
          throw new Error(`Withdrawals are only processed on ${withdrawalDays.join(', ')}.`);
        }

        const userData = userSnap.data() as {
          name: string;
          email: string;
          earningsBalance?: number;
          packageId?: string | null;
        };

        const globalMin = Number(settings.withdrawalMinimumAmount || 0);
        const globalMax = Number(settings.withdrawalMaximumAmount || 0);
        const methodMin = Number(selectedMethod.minimumAmount || 0);
        const methodMax = Number(selectedMethod.maximumAmount || 0);

        let packageMin = 0;
        let packageMax = 0;
        if (userData.packageId) {
          const packageRef = adminDb.collection('packages').doc(userData.packageId);
          const packageSnap = await transaction.get(packageRef);
          if (packageSnap.exists) {
            const packageData = packageSnap.data() as {
              allowWithdrawals?: boolean;
              withdrawalMinimumAmount?: number;
              withdrawalMaximumAmount?: number;
            };
            if (packageData.allowWithdrawals === false) {
              throw new Error('Withdrawals are not allowed for your current package.');
            }
            packageMin = Number(packageData.withdrawalMinimumAmount || 0);
            packageMax = Number(packageData.withdrawalMaximumAmount || 0);
          }
        }

        const effectiveMin = Math.max(globalMin > 0 ? globalMin : 0, packageMin > 0 ? packageMin : 0, methodMin > 0 ? methodMin : 0);
        const hasGlobalMax = globalMax > 0;
        const hasPackageMax = packageMax > 0;
        const hasMethodMax = methodMax > 0;
        const maxCandidates = [
          hasGlobalMax ? globalMax : 0,
          hasPackageMax ? packageMax : 0,
          hasMethodMax ? methodMax : 0,
        ].filter((candidate) => candidate > 0);
        const effectiveMax = maxCandidates.length > 0 ? Math.min(...maxCandidates) : 0;

        if (effectiveMax > 0 && effectiveMax < effectiveMin) {
          throw new Error('Withdrawal limits are misconfigured. Please contact support.');
        }

        if (amount < effectiveMin) {
          throw new Error(`Minimum withdrawal amount is $${effectiveMin.toFixed(2)}.`);
        }
        if (effectiveMax > 0 && amount > effectiveMax) {
          throw new Error(`Maximum withdrawal amount is $${effectiveMax.toFixed(2)}.`);
        }

        const currentBalance = userData.earningsBalance || 0;
        if (currentBalance < amount) {
          throw new Error('Insufficient earnings balance.');
        }

        const requiredField = (selectedMethod.customFields || []).find((field) => field.required && !String(fieldValues[field.key] || '').trim());
        if (requiredField) {
          throw new Error(`${requiredField.label} is required.`);
        }

        const paymentDetails = legacyPaymentDetails || (
          (selectedMethod.customFields || []).length > 0
            ? (selectedMethod.customFields || []).map((field) => {
              const raw = String(fieldValues[field.key] || '').trim();
              if (!raw) return null;
              return `${field.label || field.key}: ${raw}`;
            }).filter(Boolean).join('\n')
            : String(fieldValues.details || '').trim()
        );

        if (!paymentDetails) {
          throw new Error('Payment details are required.');
        }

        transaction.update(userRef, { earningsBalance: currentBalance - amount });
        const withdrawalRef = adminDb.collection('withdrawal_requests').doc();
        transaction.set(withdrawalRef, {
          userId: uid,
          userName: userData.name,
          userEmail: userData.email,
          amount,
          withdrawalMethodId: selectedMethod.id,
          paymentMethod: selectedMethod.name,
          paymentDetails,
          fieldValues,
          status: 'pending',
          requestedAt: Timestamp.now(),
        });
      });

      return { success: true, message: 'Withdrawal request submitted.' };
    }

    case 'getUserWithdrawalHistory': {
      const userSnap = await adminDb.collection('users').doc(uid).get();
      if (!userSnap.exists) throw new Error('User not found.');
      const userEmail = String(userSnap.data()?.email || '').trim();
      const normalizedUserEmail = userEmail.toLowerCase();

      const withdrawalsByUidSnap = await adminDb
        .collection('withdrawal_requests')
        .where('userId', '==', uid)
        .get()
        .catch((error) => {
          console.error('Could not query withdrawals by user ID.', error);
          throw new Error('Could not load withdrawal history.');
        });

      const docsById = new Map(withdrawalsByUidSnap.docs.map((doc) => [doc.id, doc]));

      // Older records may have been linked by email instead of the current Firebase UID.
      if (normalizedUserEmail) {
        const exactEmailSnap = await adminDb
          .collection('withdrawal_requests')
          .where('userEmail', '==', userEmail)
          .get();
        exactEmailSnap.docs.forEach((doc) => docsById.set(doc.id, doc));

        if (withdrawalsByUidSnap.empty && exactEmailSnap.empty) {
          const allWithdrawals = await adminDb.collection('withdrawal_requests').get();
          allWithdrawals.docs.forEach((doc) => {
            const recordEmail = String(doc.data()?.userEmail || '').trim().toLowerCase();
            if (recordEmail === normalizedUserEmail) docsById.set(doc.id, doc);
          });
        }
      }

      const toIsoString = (value: any) => {
        if (!value) return null;
        if (typeof value.toDate === 'function') return value.toDate().toISOString();
        if (typeof value === 'string') return value;
        if (typeof value._seconds === 'number') return new Date(value._seconds * 1000).toISOString();
        return null;
      };

      const withdrawals = Array.from(docsById.values())
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: String(data.userId || uid),
            userName: String(data.userName || ''),
            userEmail: String(data.userEmail || userEmail),
            amount: Number(data.amount || 0),
            withdrawalMethodId: data.withdrawalMethodId ? String(data.withdrawalMethodId) : undefined,
            paymentMethod: String(data.paymentMethod || 'Withdrawal method'),
            paymentDetails: String(data.paymentDetails || ''),
            fieldValues: data.fieldValues && typeof data.fieldValues === 'object' ? data.fieldValues : {},
            status: String(data.status || 'pending'),
            requestedAt: toIsoString(data.requestedAt),
            processedAt: toIsoString(data.processedAt),
          };
        })
        .sort((a, b) => {
          const timeA = new Date(a.requestedAt || 0).getTime();
          const timeB = new Date(b.requestedAt || 0).getTime();
          return timeB - timeA;
        });

      return { success: true, withdrawals };
    }

    case 'getReferralDashboard': {
      const userSnap = await adminDb.collection('users').doc(uid).get();
      if (!userSnap.exists) throw new Error('User not found.');
      const userData = userSnap.data() || {};
      const [referredSnap, transactionSnap] = await Promise.all([
        adminDb.collection('users').where('referredBy', '==', uid).get(),
        adminDb.collection('referral_transactions').where('referrerUserId', '==', uid).get(),
      ]);

      const transactions: Array<Record<string, any>> = transactionSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
          creditedAt: data.creditedAt?.toDate?.().toISOString?.() || null,
          reversedAt: data.reversedAt?.toDate?.().toISOString?.() || null,
        };
      });
      const transactionsByUser = new Map(transactions.map((item) => [String(item.referredUserId), item]));

      const referredUsers = await Promise.all(referredSnap.docs.map(async (doc) => {
        const referred = doc.data() || {};
        const [packageSnap, firstDepositSnap] = await Promise.all([
          referred.packageId ? adminDb.collection('packages').doc(String(referred.packageId)).get() : null,
          adminDb.collection('deposits').where('userId', '==', doc.id).get(),
        ]);
        const firstDepositDoc = firstDepositSnap.docs.find((item) => item.data().status === 'completed');
        const firstDeposit = firstDepositDoc?.data() || null;
        const referralTransaction = transactionsByUser.get(doc.id);
        return {
          id: doc.id,
          name: String(referred.name || 'User'),
          email: String(referred.email || ''),
          packageName: packageSnap?.exists ? String(packageSnap.data()?.name || 'Package') : 'No package',
          firstDepositAmount: firstDeposit ? Number(firstDeposit.amount || 0) : null,
          bonusEarned: Number(referralTransaction?.totalBonus || 0),
          status: referralTransaction?.status || 'pending',
          signupDate: referred.createdAt?.toDate?.().toISOString?.() || null,
          creditedAt: referralTransaction?.creditedAt || null,
        };
      }));

      return {
        success: true,
        referralCode: String(userData.referralCode || ''),
        referralBalance: Number(userData.referralBalance || 0),
        totalEarnings: Number(userData.referralEarningsTotal || 0),
        referredUsers,
        transactions,
        hasReferrer: Boolean(userData.referredBy),
        canCompleteReferral: !userData.referredBy && Boolean(userData.createdAt?.toDate?.() && Date.now() - userData.createdAt.toDate().getTime() <= 24 * 60 * 60 * 1000),
      };
    }

    case 'linkRegistrationReferral': {
      const referralCode = String(payload.referralCode || '').trim().toUpperCase();
      if (!referralCode) throw new Error('Referral code is required.');
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) throw new Error('User not found.');
      const userData = userSnap.data() || {};
      if (userData.referredBy) throw new Error('This account is already linked to a referrer.');
      const createdAt = userData.createdAt?.toDate?.() as Date | undefined;
      if (!createdAt || Date.now() - createdAt.getTime() > 24 * 60 * 60 * 1000) throw new Error('The registration referral window has expired.');
      const deposits = await adminDb.collection('deposits').where('userId', '==', uid).get();
      if (deposits.docs.some((doc) => doc.data().status === 'completed')) throw new Error('A referral cannot be linked after a successful deposit.');
      const referrerSnap = await adminDb.collection('users').where('referralCode', '==', referralCode).limit(1).get();
      if (referrerSnap.empty) throw new Error('The referral code is invalid.');
      const referrerId = referrerSnap.docs[0].id;
      if (referrerId === uid) throw new Error('You cannot refer yourself.');
      await userRef.update({ referredBy: referrerId, referralLinkedAt: Timestamp.now() });
      const verified = await userRef.get();
      if (verified.data()?.referredBy !== referrerId) throw new Error('Referral attribution could not be verified.');
      return { success: true, message: 'Referral linked successfully.', referredBy: referrerId };
    }

    case 'getPartnerProgramData': {
      const [userSnap, settingsSnap, applicationSnap, transactionsSnap, packagesSnap] = await Promise.all([
        adminDb.collection('users').doc(uid).get(),
        adminDb.collection('settings').doc('main').get(),
        adminDb.collection('partner_applications').where('userId', '==', uid).get(),
        adminDb.collection('partner_transactions').where('userId', '==', uid).get(),
        adminDb.collection('packages').get(),
      ]);
      if (!userSnap.exists) throw new Error('User not found.');
      const user = userSnap.data() || {};
      const settings = settingsSnap.data() || {};
      const [deposits, withdrawals] = await Promise.all([
        adminDb.collection('deposits').where('userId', '==', uid).get(),
        adminDb.collection('withdrawal_requests').where('userId', '==', uid).get(),
      ]);
      const completedTransactions = deposits.docs.filter((doc) => doc.data().status === 'completed').length + withdrawals.docs.filter((doc) => doc.data().status === 'completed').length;
      const accountAgeDays = user.createdAt?.toDate?.() ? Math.floor((Date.now() - user.createdAt.toDate().getTime()) / 86400000) : 0;
      const authUser = await adminAuth.getUser(uid);
      const minimumPackageId = String(settings.partnerMinimumPackageId || '').trim();
      const minimumPackage = minimumPackageId ? packagesSnap.docs.find((doc) => doc.id === minimumPackageId) : null;
      const requirements = {
        accountAge: accountAgeDays >= Number(settings.partnerMinimumAccountAgeDays || 0),
        walletBalance: Number(user.depositBalance || 0) >= Number(settings.partnerMinimumWalletBalance || 0),
        completedTransactions: completedTransactions >= Number(settings.partnerMinimumCompletedTransactions || 0),
        minimumPackage: !minimumPackageId || String(user.packageId || '') === minimumPackageId,
        verifiedEmail: settings.partnerRequireVerifiedEmail !== true || authUser.emailVerified,
        supportedCountry: !Array.isArray(settings.partnerSupportedCountries) || settings.partnerSupportedCountries.length === 0 || settings.partnerSupportedCountries.includes(user.country),
        kyc: settings.partnerRequireKyc !== true || user.kycVerified === true,
        goodStanding: user.accountStanding !== 'restricted',
      };
      const partnersSnap = await adminDb.collection('countryPartners').get();
      const partners = partnersSnap.docs
        .filter((doc) => doc.data().isActive !== false)
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          isAvailable: doc.data().isAvailable !== false,
          permissions: {
            deposits: doc.data().permissions?.deposits !== false,
            withdrawals: doc.data().permissions?.withdrawals !== false,
            messaging: doc.data().permissions?.messaging !== false,
          },
        }));
      const serialize = (value: any) => value?.toDate?.().toISOString?.() || value || null;
      return {
        success: true,
        settings: {
          enabled: settings.partnerProgramEnabled !== false,
          title: settings.partnerProgramTitle || 'Partner Program',
          description: settings.partnerProgramDescription || '',
          rules: settings.partnerProgramRules || '',
          minimumAccountAgeDays: Number(settings.partnerMinimumAccountAgeDays || 0),
          minimumWalletBalance: Number(settings.partnerMinimumWalletBalance || 0),
          minimumCompletedTransactions: Number(settings.partnerMinimumCompletedTransactions || 0),
          minimumPackageId,
          minimumPackageName: minimumPackage?.data()?.name || '',
          requireVerifiedEmail: settings.partnerRequireVerifiedEmail === true,
          requireKyc: settings.partnerRequireKyc === true,
          supportedCountries: settings.partnerSupportedCountries || [],
        },
        requirements,
        eligible: Object.values(requirements).every(Boolean),
        userCountry: String(user.country || ''),
        application: applicationSnap.empty ? null : { id: applicationSnap.docs[0].id, ...applicationSnap.docs[0].data(), createdAt: serialize(applicationSnap.docs[0].data().createdAt) },
        partners,
        transactions: transactionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: serialize(doc.data().createdAt), updatedAt: serialize(doc.data().updatedAt), completedAt: serialize(doc.data().completedAt), notes: (doc.data().notes || []).map((note: any) => ({ ...note, createdAt: serialize(note.createdAt) })) })),
      };
    }

    case 'updatePartnerPortalConfig': {
      const partnerSnap = await adminDb.collection('countryPartners').where('userId', '==', uid).limit(1).get();
      if (partnerSnap.empty) throw new Error('Partner profile not found.');

      const available = typeof payload.available === 'boolean' ? payload.available : undefined;
      const depositAvailable = typeof payload.depositAvailable === 'boolean' ? payload.depositAvailable : undefined;
      const withdrawalAvailable = typeof payload.withdrawalAvailable === 'boolean' ? payload.withdrawalAvailable : undefined;
      const depositLimit = payload.depositLimit !== undefined ? Number(payload.depositLimit) : undefined;
      const withdrawalLimit = payload.withdrawalLimit !== undefined ? Number(payload.withdrawalLimit) : undefined;
      const paymentMethods = Array.isArray(payload.paymentMethods)
        ? payload.paymentMethods.map(String).map((item) => item.trim()).filter(Boolean)
        : undefined;

      if (depositLimit !== undefined && (!Number.isFinite(depositLimit) || depositLimit < 0)) {
        throw new Error('Deposit limit must be zero or greater.');
      }
      if (withdrawalLimit !== undefined && (!Number.isFinite(withdrawalLimit) || withdrawalLimit < 0)) {
        throw new Error('Withdrawal limit must be zero or greater.');
      }

      const current = partnerSnap.docs[0].data() || {};
      const nextPermissions = {
        deposits: depositAvailable ?? (current.permissions?.deposits !== false),
        withdrawals: withdrawalAvailable ?? (current.permissions?.withdrawals !== false),
        messaging: current.permissions?.messaging !== false,
      };

      const updates: Record<string, any> = {
        permissions: nextPermissions,
        updatedAt: Timestamp.now(),
      };
      if (available !== undefined) updates.isAvailable = available;
      if (depositLimit !== undefined) updates.depositLimit = depositLimit;
      if (withdrawalLimit !== undefined) updates.withdrawalLimit = withdrawalLimit;
      if (paymentMethods !== undefined) updates.paymentMethods = paymentMethods;

      await partnerSnap.docs[0].ref.update(updates);
      return { success: true, message: 'Partner portal configuration updated.' };
    }

    case 'submitPartnerApplication': {
      const [userSnap, settingsSnap, deposits, withdrawals] = await Promise.all([
        adminDb.collection('users').doc(uid).get(), adminDb.collection('settings').doc('main').get(), adminDb.collection('deposits').where('userId', '==', uid).get(), adminDb.collection('withdrawal_requests').where('userId', '==', uid).get(),
      ]);
      if (!userSnap.exists) throw new Error('User not found.');
      const userData = userSnap.data() || {}; const settings = settingsSnap.data() || {}; if (settings.partnerProgramEnabled === false) throw new Error('Partner applications are currently closed.');
      const accountAgeDays = userData.createdAt?.toDate?.() ? Math.floor((Date.now() - userData.createdAt.toDate().getTime()) / 86400000) : 0; const completedCount = deposits.docs.filter((doc) => doc.data().status === 'completed').length + withdrawals.docs.filter((doc) => doc.data().status === 'completed').length; const authUser = await adminAuth.getUser(uid);
      if (accountAgeDays < Number(settings.partnerMinimumAccountAgeDays || 0)) throw new Error('Your account does not meet the minimum age requirement.');
      if (Number(userData.depositBalance || 0) < Number(settings.partnerMinimumWalletBalance || 0)) throw new Error('Your wallet balance is below the partner requirement.');
      if (completedCount < Number(settings.partnerMinimumCompletedTransactions || 0)) throw new Error('You need more completed transactions before applying.');
      if (String(settings.partnerMinimumPackageId || '').trim() && String(userData.packageId || '') !== String(settings.partnerMinimumPackageId || '').trim()) throw new Error('You must be on the required minimum package before applying.');
      if (settings.partnerRequireVerifiedEmail === true && !authUser.emailVerified) throw new Error('Verify your email before applying.');
      if (settings.partnerRequireKyc === true && userData.kycVerified !== true) throw new Error('Complete KYC before applying.');
      if (userData.accountStanding === 'restricted') throw new Error('Restricted accounts cannot apply.');
      const existing = await adminDb.collection('partner_applications').where('userId', '==', uid).get();
      if (existing.docs.some((doc) => ['pending', 'approved'].includes(doc.data().status))) throw new Error('You already have an active partner application.');
      const country = String(payload.country || '').trim();
      const paymentMethods = Array.isArray(payload.paymentMethods) ? payload.paymentMethods.map(String).map((item) => item.trim()).filter(Boolean) : [];
      const reason = String(payload.reason || '').trim();
      const workingDays = Array.isArray(payload.workingDays)
        ? payload.workingDays.map(String).map((item) => item.trim()).filter(Boolean)
        : [];
      const workingHours = String(payload.workingHours || '').trim() || workingDays.join(', ');
      if (!country || paymentMethods.length === 0 || !reason || workingDays.length === 0) throw new Error('Country, payment methods, reason, and working days are required.');
      if (Array.isArray(settings.partnerSupportedCountries) && settings.partnerSupportedCountries.length > 0 && !settings.partnerSupportedCountries.includes(country)) throw new Error('The selected country is not currently supported.');
      const user = userData;
      const applicationRef = adminDb.collection('partner_applications').doc();
      await applicationRef.set({ userId: uid, name: user.name || 'User', email: user.email || '', country, paymentMethods, reason, workingDays, workingHours, extraInformation: String(payload.extraInformation || '').trim(), status: 'pending', createdAt: Timestamp.now() });
      return { success: true, message: 'Partner application submitted for review.', applicationId: applicationRef.id };
    }

    case 'createPartnerTransaction': {
      const type = String(payload.type || '');
      const partnerId = String(payload.partnerId || '');
      const amount = Number(payload.amount);
      const paymentMethod = String(payload.paymentMethod || '').trim();
      if (!['deposit', 'withdrawal'].includes(type) || !partnerId || !Number.isFinite(amount) || amount <= 0 || !paymentMethod) throw new Error('Invalid partner transaction request.');
      const transactionRef = adminDb.collection('partner_transactions').doc();
      await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(uid);
        const partnerRef = adminDb.collection('countryPartners').doc(partnerId);
        const [userSnap, partnerSnap] = await Promise.all([transaction.get(userRef), transaction.get(partnerRef)]);
        if (!userSnap.exists || !partnerSnap.exists) throw new Error('User or partner not found.');
        const user = userSnap.data() || {};
        const partner = partnerSnap.data() || {};
        if (partner.isActive === false || partner.isAvailable === false) throw new Error('This partner is unavailable.');
        if (type === 'deposit' && partner.permissions?.deposits === false) throw new Error('This partner cannot process deposits.');
        if (type === 'withdrawal' && partner.permissions?.withdrawals === false) throw new Error('This partner cannot process withdrawals.');
        if (user.country && partner.country !== user.country) throw new Error('Select a partner assigned to your country.');
        const limit = type === 'deposit' ? Number(partner.depositLimit || 0) : Number(partner.withdrawalLimit || 0);
        if (limit > 0 && amount > limit) throw new Error(`The partner transaction limit is $${limit.toFixed(2)}.`);
        if (type === 'deposit' && Number(partner.partnerWalletBalance || 0) - amount < Number(partner.minimumWalletBalance || 0)) throw new Error('The partner does not have enough available wallet capacity.');
        if (type === 'withdrawal' && Number(user.earningsBalance || 0) < amount) throw new Error('Insufficient earnings balance.');
        if (type === 'withdrawal') transaction.update(userRef, { earningsBalance: Number(user.earningsBalance || 0) - amount });
        transaction.set(transactionRef, { type, userId: uid, userName: user.name || 'User', userEmail: user.email || '', partnerId, partnerUserId: partner.userId, partnerName: partner.name || 'Partner', country: partner.country, amount, paymentMethod, paymentInstructions: String(payload.paymentInstructions || ''), status: type === 'deposit' ? 'awaiting_payment' : 'pending', notes: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      });
      return { success: true, message: 'Partner transaction request created.', transactionId: transactionRef.id };
    }

    case 'getPartnerPortalData': {
      const userSnap = await adminDb.collection('users').doc(uid).get();
      if (!userSnap.exists || userSnap.data()?.role !== 'country_partner') throw new Error('Partner access required.');
      const partnerSnap = await adminDb.collection('countryPartners').where('userId', '==', uid).limit(1).get();
      if (partnerSnap.empty) throw new Error('Partner profile not found.');
      const partnerDoc = partnerSnap.docs[0];
      const [transactionSnap, fundingSnap, partnerWithdrawalSnap, settingsSnap] = await Promise.all([
        adminDb.collection('partner_transactions').where('partnerId', '==', partnerDoc.id).get(),
        adminDb.collection('partner_wallet_funding_requests').where('partnerId', '==', partnerDoc.id).get(),
        adminDb.collection('withdrawal_requests').where('partnerUserId', '==', uid).get(),
        adminDb.collection('settings').doc('main').get(),
      ]);
      const settings = (settingsSnap.data() || {}) as {
        partnerDepositDays?: string[];
        partnerDepositMinimumAmount?: number;
        partnerDepositMaximumAmount?: number;
        partnerWithdrawalDays?: string[];
        partnerWithdrawalMinimumAmount?: number;
        partnerWithdrawalMaximumAmount?: number;
        withdrawalDays?: string[];
        withdrawalScheduleInfo?: string;
        withdrawalMinimumAmount?: number;
        withdrawalMaximumAmount?: number;
        withdrawalMethods?: WithdrawalMethod[];
        paymentMethods?: Array<{ id: string; name: string }>;
      };
      const configuredMethods = (settings.withdrawalMethods && settings.withdrawalMethods.length > 0)
        ? settings.withdrawalMethods
        : (settings.paymentMethods || []).map((method) => ({
          id: method.id,
          name: method.name,
          provider: 'custom' as const,
          enabled: true,
          processingMode: 'admin_verified' as const,
          minimumAmount: undefined,
          maximumAmount: undefined,
          description: '',
          customFields: [],
        }));
      const serialize = (value: any) => value?.toDate?.().toISOString?.() || value || null;
      return {
        success: true,
        partner: { id: partnerDoc.id, ...partnerDoc.data() },
        userBalances: {
          depositBalance: Number(userSnap.data()?.depositBalance || 0),
          earningsBalance: Number(userSnap.data()?.earningsBalance || 0),
        },
        settings: {
          depositDays: settings.partnerDepositDays || [],
          depositMinimumAmount: Number(settings.partnerDepositMinimumAmount || 0),
          depositMaximumAmount: Number(settings.partnerDepositMaximumAmount || 0),
          withdrawalDays: settings.partnerWithdrawalDays || settings.withdrawalDays || [],
          withdrawalScheduleInfo: settings.withdrawalScheduleInfo || '',
          withdrawalMinimumAmount: Number(settings.partnerWithdrawalMinimumAmount || settings.withdrawalMinimumAmount || 0),
          withdrawalMaximumAmount: Number(settings.partnerWithdrawalMaximumAmount || settings.withdrawalMaximumAmount || 0),
          withdrawalMethods: configuredMethods,
        },
        transactions: transactionSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: serialize(doc.data().createdAt), updatedAt: serialize(doc.data().updatedAt), completedAt: serialize(doc.data().completedAt), notes: (doc.data().notes || []).map((note: any) => ({ ...note, createdAt: serialize(note.createdAt) })) })),
        fundingRequests: fundingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: serialize(doc.data().createdAt) })),
        partnerWithdrawals: partnerWithdrawalSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), requestedAt: serialize(doc.data().requestedAt), processedAt: serialize(doc.data().processedAt) })),
      };
    }

    case 'updatePartnerAvailability': {
      const available = Boolean(payload.available);
      const partnerSnap = await adminDb.collection('countryPartners').where('userId', '==', uid).limit(1).get();
      if (partnerSnap.empty) throw new Error('Partner profile not found.');
      await partnerSnap.docs[0].ref.update({ isAvailable: available });
      return { success: true, message: available ? 'You are now available.' : 'You are now unavailable.' };
    }

    case 'requestPartnerWalletFunding': {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.');
      await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(uid);
        const settingsRef = adminDb.collection('settings').doc('main');
        const partnerQuery = await adminDb.collection('countryPartners').where('userId', '==', uid).limit(1).get();
        if (partnerQuery.empty) throw new Error('Partner profile not found.');

        const partnerRef = partnerQuery.docs[0].ref;
        const [userSnap, partnerSnap, settingsSnap] = await Promise.all([transaction.get(userRef), transaction.get(partnerRef), transaction.get(settingsRef)]);
        if (!userSnap.exists || !partnerSnap.exists) throw new Error('Partner profile not found.');

        const settings = (settingsSnap.data() || {}) as {
          processingTimeZone?: string;
          partnerDepositDays?: string[];
          partnerDepositMinimumAmount?: number;
          partnerDepositMaximumAmount?: number;
        };

        const depositDays = settings.partnerDepositDays || [];
        const normalizedToday = normalizeWeekday(getCurrentWeekday(String(settings.processingTimeZone || 'UTC').trim() || 'UTC'));
        const normalizedAllowedDays = depositDays.map(normalizeWeekday);
        if (depositDays.length > 0 && !normalizedAllowedDays.includes(normalizedToday)) {
          throw new Error(`Partner deposits are only available on ${depositDays.join(', ')}.`);
        }

        const minDeposit = Number(settings.partnerDepositMinimumAmount || 0);
        const maxDeposit = Number(settings.partnerDepositMaximumAmount || 0);
        if (minDeposit > 0 && amount < minDeposit) {
          throw new Error(`Minimum partner deposit amount is $${minDeposit.toFixed(2)}.`);
        }
        if (maxDeposit > 0 && amount > maxDeposit) {
          throw new Error(`Maximum partner deposit amount is $${maxDeposit.toFixed(2)}.`);
        }

        const currentDepositBalance = Number(userSnap.data()?.depositBalance || 0);
        if (currentDepositBalance < amount) throw new Error('Insufficient deposit balance.');

        const currentPartnerWallet = Number(partnerSnap.data()?.partnerWalletBalance || 0);
        transaction.update(userRef, { depositBalance: currentDepositBalance - amount });
        transaction.update(partnerRef, { partnerWalletBalance: currentPartnerWallet + amount });
        const logRef = adminDb.collection('partner_wallet_funding_requests').doc();
        transaction.set(logRef, {
          partnerId: partnerRef.id,
          partnerUserId: uid,
          partnerName: partnerSnap.data()?.name || 'Partner',
          amount,
          paymentMethod: 'deposit_balance',
          reference: 'Internal transfer from deposit balance',
          status: 'approved',
          createdAt: Timestamp.now(),
          reviewedAt: Timestamp.now(),
          source: 'deposit_balance',
        });
      });
      return { success: true, message: 'Funds moved from your deposit balance to your partner wallet.' };
    }

    case 'requestPartnerWithdrawal': {
      const amount = Number(payload.amount);
      const methodId = String(payload.methodId || payload.paymentMethod || '').trim();
      const fieldValues = payload.fieldValues && typeof payload.fieldValues === 'object'
        ? (payload.fieldValues as Record<string, string>)
        : {};
      const legacyPaymentDetails = String(payload.paymentDetails || '').trim();

      if (!Number.isFinite(amount) || amount <= 0 || !methodId) {
        throw new Error('Invalid withdrawal payload.');
      }

      await adminDb.runTransaction(async (transaction) => {
        const settingsRef = adminDb.collection('settings').doc('main');
        const partnerQuery = await adminDb.collection('countryPartners').where('userId', '==', uid).limit(1).get();
        if (partnerQuery.empty) throw new Error('Partner profile not found.');
        const partnerRef = partnerQuery.docs[0].ref;

        const [settingsSnap, partnerSnap] = await Promise.all([
          transaction.get(settingsRef),
          transaction.get(partnerRef),
        ]);

        if (!partnerSnap.exists) throw new Error('Partner profile not found.');

        const settings = (settingsSnap.data() || {}) as {
          processingTimeZone?: string;
          partnerWithdrawalDays?: string[];
          partnerWithdrawalMinimumAmount?: number;
          partnerWithdrawalMaximumAmount?: number;
          withdrawalDays?: string[];
          withdrawalMinimumAmount?: number;
          withdrawalMaximumAmount?: number;
          withdrawalMethods?: WithdrawalMethod[];
          paymentMethods?: Array<{ id: string; name: string }>;
        };

        const withdrawalDays = settings.partnerWithdrawalDays || settings.withdrawalDays || [];
        const configuredMethods = (settings.withdrawalMethods && settings.withdrawalMethods.length > 0)
          ? settings.withdrawalMethods
          : (settings.paymentMethods || []).map((method) => ({
            id: method.id,
            name: method.name,
            provider: 'custom' as const,
            enabled: true,
            processingMode: 'admin_verified' as const,
            minimumAmount: undefined,
            maximumAmount: undefined,
            description: '',
            customFields: [],
          }));
        const selectedMethod = configuredMethods.find((method) => method.id === methodId || method.name === methodId);
        if (!selectedMethod) {
          throw new Error('Selected withdrawal method is not configured.');
        }
        if (selectedMethod.enabled === false) {
          throw new Error('Selected withdrawal method is disabled.');
        }

        const processingTimeZone = String(settings.processingTimeZone || 'UTC').trim() || 'UTC';
        const today = getCurrentWeekday(processingTimeZone);
        const normalizedToday = normalizeWeekday(today);
        const normalizedAllowedDays = withdrawalDays.map(normalizeWeekday);

        if (withdrawalDays.length > 0 && !normalizedAllowedDays.includes(normalizedToday)) {
          throw new Error(`Withdrawals are only processed on ${withdrawalDays.join(', ')}.`);
        }

        const globalMin = Number(settings.partnerWithdrawalMinimumAmount || settings.withdrawalMinimumAmount || 0);
        const globalMax = Number(settings.partnerWithdrawalMaximumAmount || settings.withdrawalMaximumAmount || 0);
        const methodMin = Number(selectedMethod.minimumAmount || 0);
        const methodMax = Number(selectedMethod.maximumAmount || 0);
        const effectiveMin = Math.max(globalMin > 0 ? globalMin : 0, methodMin > 0 ? methodMin : 0);
        const maxCandidates = [globalMax, methodMax].filter((candidate) => Number(candidate) > 0).map(Number);
        const effectiveMax = maxCandidates.length > 0 ? Math.min(...maxCandidates) : 0;

        if (effectiveMax > 0 && effectiveMax < effectiveMin) {
          throw new Error('Withdrawal limits are misconfigured. Please contact support.');
        }

        if (amount < effectiveMin) {
          throw new Error(`Minimum withdrawal amount is $${effectiveMin.toFixed(2)}.`);
        }
        if (effectiveMax > 0 && amount > effectiveMax) {
          throw new Error(`Maximum withdrawal amount is $${effectiveMax.toFixed(2)}.`);
        }

        const currentBalance = Number(partnerSnap.data()?.partnerWalletBalance || 0);
        if (currentBalance < amount) {
          throw new Error('Insufficient partner wallet balance.');
        }

        const requiredField = (selectedMethod.customFields || []).find((field) => field.required && !String(fieldValues[field.key] || '').trim());
        if (requiredField) {
          throw new Error(`${requiredField.label} is required.`);
        }

        const paymentDetails = legacyPaymentDetails || (
          (selectedMethod.customFields || []).length > 0
            ? (selectedMethod.customFields || []).map((field) => {
              const raw = String(fieldValues[field.key] || '').trim();
              if (!raw) return null;
              return `${field.label || field.key}: ${raw}`;
            }).filter(Boolean).join('\n')
            : String(fieldValues.details || '').trim()
        );

        if (!paymentDetails) {
          throw new Error('Payment details are required.');
        }

        transaction.update(partnerRef, { partnerWalletBalance: currentBalance - amount });
        const withdrawalRef = adminDb.collection('withdrawal_requests').doc();
        transaction.set(withdrawalRef, {
          userId: uid,
          userName: partnerSnap.data()?.name || 'Partner',
          userEmail: partnerSnap.data()?.email || '',
          amount,
          withdrawalMethodId: selectedMethod.id,
          paymentMethod: selectedMethod.name,
          paymentDetails,
          fieldValues,
          status: 'pending',
          requestedAt: Timestamp.now(),
          source: 'partner_wallet',
          partnerId: partnerRef.id,
          partnerUserId: uid,
        });
      });

      return { success: true, message: 'Partner wallet withdrawal request submitted.' };
    }

    case 'partnerTransactionAction': {
      const transactionId = String(payload.transactionId || '');
      const actionName = String(payload.actionName || '');
      const requestRef = adminDb.collection('partner_transactions').doc(transactionId);
      let completedDepositId: string | null = null;
      await adminDb.runTransaction(async (transaction) => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists) throw new Error('Partner transaction not found.');
        const item = requestSnap.data() || {};
        const actorIsUser = item.userId === uid;
        const actorIsPartner = item.partnerUserId === uid;
        if (!actorIsUser && !actorIsPartner) throw new Error('You cannot update this transaction.');
        const partnerRef = adminDb.collection('countryPartners').doc(String(item.partnerId));
        const partnerSnap = await transaction.get(partnerRef);
        if (!partnerSnap.exists) throw new Error('Partner profile not found.');
        const partner = partnerSnap.data() || {};
        if (actionName === 'user_paid' && actorIsUser && item.type === 'deposit' && item.status === 'awaiting_payment') {
          transaction.update(requestRef, { status: 'paid_by_user', updatedAt: Timestamp.now() }); return;
        }
        if (actionName === 'confirm_deposit' && actorIsPartner && item.type === 'deposit' && item.status === 'paid_by_user') {
          if (Number(partner.partnerWalletBalance || 0) - Number(item.amount) < Number(partner.minimumWalletBalance || 0)) throw new Error('Insufficient available partner wallet balance.');
          const userRef = adminDb.collection('users').doc(String(item.userId));
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists) throw new Error('User not found.');
          const depositRef = adminDb.collection('deposits').doc(`partner_${transactionId}`);
          transaction.update(partnerRef, { partnerWalletBalance: Number(partner.partnerWalletBalance || 0) - Number(item.amount) });
          transaction.update(userRef, { depositBalance: Number(userSnap.data()?.depositBalance || 0) + Number(item.amount) });
          transaction.set(depositRef, { userId: item.userId, amount: Number(item.amount), method: `Partner: ${item.partnerName}`, partnerId: item.partnerId, partnerTransactionId: transactionId, status: 'completed', createdAt: Timestamp.now(), processedAt: Timestamp.now() });
          transaction.update(requestRef, { status: 'completed', completedAt: Timestamp.now(), updatedAt: Timestamp.now() });
          completedDepositId = depositRef.id; return;
        }
        if (actionName === 'mark_withdrawal_paid' && actorIsPartner && item.type === 'withdrawal' && item.status === 'pending') {
          transaction.update(requestRef, { status: 'paid_by_partner', updatedAt: Timestamp.now() }); return;
        }
        if (actionName === 'confirm_withdrawal' && actorIsUser && item.type === 'withdrawal' && item.status === 'paid_by_partner') {
          transaction.update(partnerRef, { partnerWalletBalance: Number(partner.partnerWalletBalance || 0) + Number(item.amount) });
          transaction.update(requestRef, { status: 'completed', completedAt: Timestamp.now(), updatedAt: Timestamp.now() }); return;
        }
        if (actionName === 'cancel' && actorIsUser && ['pending', 'awaiting_payment'].includes(item.status)) {
          if (item.type === 'withdrawal') {
            const userRef = adminDb.collection('users').doc(String(item.userId));
            const userSnap = await transaction.get(userRef);
            if (userSnap.exists) transaction.update(userRef, { earningsBalance: Number(userSnap.data()?.earningsBalance || 0) + Number(item.amount) });
          }
          transaction.update(requestRef, { status: 'cancelled', updatedAt: Timestamp.now() }); return;
        }
        if (actionName === 'dispute' && (actorIsUser || actorIsPartner) && !['completed', 'cancelled'].includes(item.status)) {
          transaction.update(requestRef, { status: 'disputed', updatedAt: Timestamp.now() }); return;
        }
        throw new Error('This action is not valid for the current transaction status.');
      });
      if (completedDepositId) await awardReferralBonusForDeposit(completedDepositId);
      return { success: true, message: 'Partner transaction updated.' };
    }

    case 'addPartnerTransactionNote': {
      const transactionId = String(payload.transactionId || '');
      const message = String(payload.message || '').trim();
      if (!transactionId || !message) throw new Error('Transaction and message are required.');
      const requestRef = adminDb.collection('partner_transactions').doc(transactionId);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) throw new Error('Partner transaction not found.');
      const item = requestSnap.data() || {};
      const senderRole = item.partnerUserId === uid ? 'partner' : item.userId === uid ? 'user' : null;
      if (!senderRole) throw new Error('You cannot message on this transaction.');
      await requestRef.update({ notes: FieldValue.arrayUnion({ senderId: uid, senderRole, message, createdAt: Timestamp.now() }), updatedAt: Timestamp.now() });
      return { success: true, message: 'Note added.' };
    }

    case 'initiateDeposit': {
      const amount = Number(payload.amount);
      const methodId = String(payload.methodId || '');
      const fieldValues = payload.fieldValues && typeof payload.fieldValues === 'object'
        ? (payload.fieldValues as Record<string, string>)
        : {};

      if (!Number.isFinite(amount) || amount <= 0 || !methodId) {
        throw new Error('Invalid deposit payload.');
      }

      const settingsSnap = await adminDb.collection('settings').doc('main').get();
      const settings = (settingsSnap.data() || {}) as {
        depositMethods?: DepositMethod[];
        plisioApiKey?: string;
        plisioPublicBaseUrl?: string;
      };
      const method = (settings.depositMethods || []).find((item) => item.id === methodId);
      if (!method) {
        throw new Error('Selected deposit method is not configured.');
      }
      if (method.enabled === false) {
        throw new Error('Selected deposit method is disabled.');
      }

      const minimumAmount = Number(method.minimumAmount || 0);
      const maximumAmount = Number(method.maximumAmount || 0);
      if (Number.isFinite(minimumAmount) && minimumAmount > 0 && amount < minimumAmount) {
        throw new Error(`The minimum deposit amount for ${method.name} is $${minimumAmount.toFixed(2)}.`);
      }
      if (Number.isFinite(maximumAmount) && maximumAmount > 0 && amount > maximumAmount) {
        throw new Error(`The maximum deposit amount for ${method.name} is $${maximumAmount.toFixed(2)}.`);
      }

      const processingMode = method.processingMode || (method.provider === 'plisio' ? 'automatic' : 'admin_verified');
      const isAdminVerified = processingMode === 'admin_verified';

      if (method.provider === 'plisio') {
        const userSnap = await adminDb.collection('users').doc(uid).get();
        if (!userSnap.exists) {
          throw new Error('User not found.');
        }

        const plisioApiKey = String(method.credentials?.apiKey || settings.plisioApiKey || process.env.PLISIO_API_KEY || '').trim();
        if (!plisioApiKey) {
          throw new Error('Plisio is not configured by admin yet.');
        }

        const baseUrl = getAppBaseUrl(request, method.credentials?.publicBaseUrl || settings.plisioPublicBaseUrl);
        const callbackUrl = `${baseUrl}/api/payments/plisio/callback?json=true`;
        const walletUrl = `${baseUrl}/wallet`;
        const orderNumber = `dep_${uid}_${Date.now()}_${randomUUID().slice(0, 8)}`;
        const userEmail = String(userSnap.data()?.email || '').trim();

        const invoice = await createPlisioInvoice({
          apiKey: plisioApiKey,
          amountUsd: amount,
          orderNumber,
          orderName: `Wallet deposit (${uid})`,
          callbackUrl,
          successUrl: walletUrl,
          failUrl: walletUrl,
          email: userEmail || undefined,
        });

        await adminDb.collection('deposits').add({
          userId: uid,
          amount,
          method: method.name,
          depositMethodId: method.id,
          depositMethodProvider: method.provider,
          status: 'pending',
          externalProvider: 'plisio',
          externalTxnId: invoice.txnId,
          externalOrderNumber: orderNumber,
          externalInvoiceUrl: invoice.invoiceUrl,
          fieldValues,
          createdAt: Timestamp.now(),
        });

        return {
          success: true,
          message: 'Plisio invoice created. Complete payment to credit your wallet.',
          invoiceUrl: invoice.invoiceUrl,
        };
      }

      if (method.provider === 'custom') {
        await adminDb.collection('deposits').add({
          userId: uid,
          amount,
          method: method.name,
          depositMethodId: method.id,
          depositMethodProvider: method.provider,
          status: 'pending',
          fieldValues,
          createdAt: Timestamp.now(),
        });
        return { success: true, message: `${method.name} request submitted. Please follow the method instructions.`, method };
      }

      let completedDepositId: string | null = null;
      await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('users').doc(uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
          throw new Error('User not found.');
        }

        const depositRef = adminDb.collection('deposits').doc();
        completedDepositId = depositRef.id;
        transaction.set(depositRef, {
          userId: uid,
          amount,
          method,
          status: isAdminVerified ? 'pending' : 'completed',
          createdAt: Timestamp.now(),
        });

        if (!isAdminVerified) {
          const currentBalance = (userSnap.data()?.depositBalance || 0) as number;
          transaction.update(userRef, { depositBalance: currentBalance + amount });
        }
      });

      if (!isAdminVerified && completedDepositId) {
        await awardReferralBonusForDeposit(completedDepositId);
      }

      return { success: true, message: isAdminVerified ? 'Deposit request submitted for admin review.' : 'Deposit successful.' };
    }

    case 'purchasePackage': {
      const packageId = String(payload.packageId || '');
      if (!packageId) {
        throw new Error('Package is required.');
      }

      const packageRef = adminDb.collection('packages').doc(packageId);
      const userRef = adminDb.collection('users').doc(uid);

      const packageSnapForName = await packageRef.get();
      if (!packageSnapForName.exists) {
        throw new Error('Package not found.');
      }
      const pkgName = packageSnapForName.data()?.name || 'selected';

      await adminDb.runTransaction(async (transaction) => {
        const [packageSnap, userSnap] = await Promise.all([
          transaction.get(packageRef),
          transaction.get(userRef),
        ]);

        if (!packageSnap.exists) throw new Error('Package not found.');
        if (!userSnap.exists) throw new Error('User not found.');

        const pkg = packageSnap.data() as { price: string; expiryPeriod: string };
        const user = userSnap.data() as { depositBalance?: number; accountExpiresAt?: any; packageId?: string | null };

        if (user.packageId) {
          const currentPackageRef = adminDb.collection('packages').doc(user.packageId);
          const currentPackageSnap = await transaction.get(currentPackageRef);
          if (currentPackageSnap.exists) {
            const currentPackage = currentPackageSnap.data() as { price?: string };
            const currentPrice = parsePackagePrice(String(currentPackage.price || 'free'));
            const selectedPrice = parsePackagePrice(String(pkg.price || 'free'));
            if (selectedPrice < currentPrice) {
              throw new Error('Downgrading to a lower-priced package is not allowed.');
            }
          }
        }

        let price = 0;
        if (pkg.price?.toLowerCase() !== 'free' && pkg.price?.startsWith('$')) {
          price = parseFloat(pkg.price.substring(1));
        }

        const userDepositBalance = user.depositBalance || 0;
        if (userDepositBalance < price) {
          throw new Error('Insufficient deposit balance. Please add funds to your wallet.');
        }

        const currentExpiry = user.accountExpiresAt?.toDate ? user.accountExpiresAt.toDate() : new Date(0);
        const now = new Date();
        const baseDate = currentExpiry > now ? currentExpiry : now;

        const [valueStr, unit] = String(pkg.expiryPeriod || '1 month').split(' ');
        const value = Number.parseInt(valueStr || '1', 10) || 1;
        const newExpiryDate = new Date(baseDate);

        if (unit?.startsWith('week')) newExpiryDate.setDate(newExpiryDate.getDate() + value * 7);
        else if (unit?.startsWith('month')) newExpiryDate.setMonth(newExpiryDate.getMonth() + value);
        else if (unit?.startsWith('day')) newExpiryDate.setDate(newExpiryDate.getDate() + value);
        else if (unit?.startsWith('year')) newExpiryDate.setFullYear(newExpiryDate.getFullYear() + value);

        transaction.update(userRef, {
          packageId,
          accountExpiresAt: Timestamp.fromDate(newExpiryDate),
          depositBalance: userDepositBalance - price,
          packageImageGenerationCount: 0,
          packageVideoGenerationCount: 0,
          packageMusicGenerationCount: 0,
        });
      });

      return { success: true, message: `Successfully subscribed to the ${pkgName} package!` };
    }

    case 'updateUserOnboardingProfile': {
      const country = String(payload.country || '');
      const languages = Array.isArray(payload.languages) ? payload.languages.map(String).filter(Boolean) : [];
      if (!country) {
        throw new Error('Country is required.');
      }

      await adminDb.collection('users').doc(uid).update({ country, languages });
      return { success: true, message: 'Profile information saved.' };
    }

    case 'updateUserExpertise': {
      const expertise = Array.isArray(payload.expertise) ? payload.expertise.map(String).filter(Boolean) : [];
      await adminDb.collection('users').doc(uid).update({ expertise });
      return { success: true, message: 'Expertise information saved.' };
    }

    case 'startUserQualificationTest': {
      const expertise = Array.isArray(payload.expertise) ? payload.expertise.map(String).filter(Boolean) : [];
      if (expertise.length === 0) {
        throw new Error('Expertise is required to start a test.');
      }

      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        throw new Error('User not found.');
      }

      const user = userSnap.data() as { qualificationTestSubmittedAt?: unknown; qualificationQuestions?: unknown[] };
      if (user.qualificationTestSubmittedAt) {
        throw new Error('You have already completed the qualification test.');
      }

      if (Array.isArray(user.qualificationQuestions) && user.qualificationQuestions.length > 0) {
        return { success: true, questions: user.qualificationQuestions };
      }

      const selectedExpertise = expertise[0];
      const testRef = adminDb.collection('qualification_tests').doc(selectedExpertise);
      const testSnap = await testRef.get();
      if (!testSnap.exists) {
        throw new Error(`A qualification test for "${selectedExpertise}" has not been created by an administrator yet. Please try again later or contact support.`);
      }

      const testData = testSnap.data() as { questions?: unknown[] };
      const questions = testData.questions || [];

      await userRef.update({
        qualificationQuestions: questions,
        qualificationTestGeneratedAt: Timestamp.now(),
      });

      return { success: true, questions };
    }

    case 'getQualificationTestSecuritySettings': {
      const settingsSnap = await adminDb.collection('settings').doc('main').get();
      const settings = settingsSnap.data() as {
        qualificationTestAntiCopyEnabled?: boolean;
        qualificationTestCopyAttemptLimit?: number;
      } | undefined;

      const antiCopyEnabled = settings?.qualificationTestAntiCopyEnabled !== false;
      const configuredLimit = Number(settings?.qualificationTestCopyAttemptLimit);
      const copyAttemptLimit = Number.isFinite(configuredLimit)
        ? Math.max(1, Math.floor(configuredLimit))
        : 5;

      return {
        success: true,
        antiCopyEnabled,
        copyAttemptLimit,
      };
    }

    case 'logQualificationCopyAttempt': {
      const attemptCount = Math.max(1, Number(payload.attemptCount || 1));
      const copyAttemptLimit = Math.max(1, Number(payload.copyAttemptLimit || 5));
      const expertise = Array.isArray(payload.expertise) ? payload.expertise.map(String).filter(Boolean) : [];
      const browserFingerprint = String(payload.browserFingerprint || 'unknown');
      const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';

      await logJsonEvent('[qualification-test] copy-attempt', {
        userId: uid,
        ip,
        browserFingerprint,
        attemptCount,
        copyAttemptLimit,
        expertise,
      }, 'warn');

      await adminDb.collection('users').doc(uid).set({
        qualificationCopyAttemptCount: FieldValue.increment(1),
        qualificationLastCopyAttemptAt: Timestamp.now(),
      }, { merge: true });

      return { success: true };
    }

    case 'submitQualificationTest': {
      const questions = Array.isArray(payload.questions) ? payload.questions : [];
      const userAnswers = (payload.userAnswers || {}) as Record<string, string>;
      const expertise = Array.isArray(payload.expertise) ? payload.expertise.map(String).filter(Boolean) : [];
      const browserFingerprint = String(payload.browserFingerprint || 'unknown');
      const forcedFailureReason = String(payload.forcedFailureReason || '').trim();
      const copyAttempts = Number(payload.copyAttempts || 0);

      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) throw new Error('User not found.');

      const user = userSnap.data() as { qualificationTestSubmittedAt?: unknown };
      if (user.qualificationTestSubmittedAt) {
        throw new Error('You have already submitted a qualification test.');
      }

      const submissions = questions.map((q: any, index: number) => ({
        question: q.question,
        userAnswer: userAnswers[String(index)],
        correctAnswer: q.answer,
      }));

      const evaluation = forcedFailureReason
        ? {
            score: 0,
            feedback: `${forcedFailureReason}${copyAttempts > 0 ? ` (Copy attempts: ${copyAttempts})` : ''}`,
            correctCount: 0,
            totalCount: submissions.length,
          }
        : await evaluateQualificationTest({ submissions, expertise });

      const settingsSnap = await adminDb.collection('settings').doc('main').get();
      const settings = settingsSnap.data() as {
        autoApprovalEnabled?: boolean;
        autoApprovalThreshold?: number;
        autoRejectionEnabled?: boolean;
        autoRejectionThreshold?: number;
      } | undefined;

      let onboardingStatus: 'pending' | 'approved' | 'rejected' = 'pending';
      if (forcedFailureReason) {
        onboardingStatus = 'rejected';
      } else if (settings?.autoApprovalEnabled && evaluation.score >= (settings.autoApprovalThreshold ?? 101)) {
        onboardingStatus = 'approved';
      } else if (settings?.autoRejectionEnabled && evaluation.score < (settings.autoRejectionThreshold ?? 0)) {
        onboardingStatus = 'rejected';
      }

      const ip = request.headers.get('x-forwarded-for') ?? 'unknown';

      await userRef.update({
        onboardingStatus,
        qualificationSubmission: submissions,
        qualificationTestSubmittedAt: Timestamp.now(),
        qualificationScore: evaluation.score,
        qualificationFeedback: evaluation.feedback,
        qualificationResults: {
          correctCount: evaluation.correctCount,
          totalCount: evaluation.totalCount,
        },
        ipAddress: ip,
        browserFingerprint,
      });

      return { success: true, message: 'Your test has been submitted for review.' };
    }

    case 'setupNewUser': {
      const name = String(payload.name || '').trim() || 'New User';
      const email = String(payload.email || '').trim();
      const referralCode = payload.referralCode ? String(payload.referralCode).trim().toUpperCase() : undefined;
      const registrationIp = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
      const userAgent = request.headers.get('user-agent') ?? 'unknown';

      const userRef = adminDb.collection('users').doc(uid);
      const existingUser = await userRef.get();
      if (existingUser.exists) {
        const existingData = existingUser.data() || {};
        if (referralCode && !existingData.referredBy) {
          const createdAt = existingData.createdAt?.toDate?.() as Date | undefined;
          const isRecent = createdAt && Date.now() - createdAt.getTime() <= 10 * 60 * 1000;
          const deposits = await adminDb.collection('deposits').where('userId', '==', uid).get();
          if (!isRecent || deposits.docs.some((doc) => doc.data().status === 'completed')) {
            throw new Error('The referral can no longer be changed for this account.');
          }
          const referrerSnap = await adminDb.collection('users').where('referralCode', '==', referralCode).limit(1).get();
          if (referrerSnap.empty) throw new Error('The referral code is invalid.');
          const referrerId = referrerSnap.docs[0].id;
          if (referrerId === uid) throw new Error('You cannot refer yourself.');
          await userRef.update({ referredBy: referrerId, referralLinkedAt: Timestamp.now() });
          const verified = await userRef.get();
          if (verified.data()?.referredBy !== referrerId) throw new Error('Referral attribution could not be verified.');
          return { success: true, message: 'Referral linked successfully.', referredBy: referrerId };
        }
        return { success: true, message: 'User already exists.', referredBy: existingData.referredBy || null };
      }

      const settingsSnap = await adminDb.collection('settings').doc('main').get();
      const settings = settingsSnap.data() as { onboardingCourseEnabled?: boolean } | undefined;

      const freePackageSnap = await adminDb
        .collection('packages')
        .where('price', '==', 'Free')
        .limit(1)
        .get();

      const packageId = freePackageSnap.empty ? null : freePackageSnap.docs[0].id;
      const now = Timestamp.now();
      const twoWeeksInSeconds = 14 * 24 * 60 * 60;
      const expiryTimestamp = new Timestamp(now.seconds + twoWeeksInSeconds, now.nanoseconds);
      const generatedFingerprint = createHash('sha256')
        .update(`${uid}:${registrationIp}:${userAgent}:${randomUUID()}`)
        .digest('hex');
      let generatedReferralCode = '';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
        const existingCode = await adminDb.collection('users').where('referralCode', '==', candidate).limit(1).get();
        if (existingCode.empty) {
          generatedReferralCode = candidate;
          break;
        }
      }
      if (!generatedReferralCode) throw new Error('Could not generate a unique referral code.');

      const newUserDoc: Record<string, any> = {
        name,
        email,
        photoURL: null,
        earningsBalance: 0,
        depositBalance: 0,
        packageId,
        completedTasks: [],
        role: 'user',
        createdAt: now,
        dailyCompletedCount: 0,
        lastCompletionReset: now,
        dailyImageGenerationCount: 0,
        lastImageGenerationReset: now,
        packageImageGenerationCount: 0,
        dailyVideoGenerationCount: 0,
        lastVideoGenerationReset: now,
        packageVideoGenerationCount: 0,
        dailyMusicGenerationCount: 0,
        lastMusicGenerationReset: now,
        packageMusicGenerationCount: 0,
        accountExpiresAt: expiryTimestamp,
        onboardingStatus: settings?.onboardingCourseEnabled ? 'pending' : 'approved',
        referralCode: generatedReferralCode,
        referralEligible: true,
        referralBalance: 0,
        referralEarningsTotal: 0,
        ipAddress: registrationIp,
        registrationIp,
        ipHistory: [registrationIp],
        browserFingerprint: generatedFingerprint,
        registrationFingerprint: generatedFingerprint,
      };

      if (referralCode) {
        const referrerSnap = await adminDb
          .collection('users')
          .where('referralCode', '==', referralCode)
          .limit(1)
          .get();
        if (referrerSnap.empty) throw new Error('The referral code is invalid.');
        if (referrerSnap.docs[0].id === uid) throw new Error('You cannot refer yourself.');
        newUserDoc.referredBy = referrerSnap.docs[0].id;
        newUserDoc.referralLinkedAt = now;
      }

      await userRef.set(newUserDoc);
      const persistedUser = await userRef.get();
      if (referralCode && !persistedUser.data()?.referredBy) throw new Error('Referral attribution could not be verified.');
      return { success: true, message: 'User setup completed.', referredBy: persistedUser.data()?.referredBy || null };
    }

    case 'getInitialChatHistory': {
      const snapshot = await adminDb.collection('chats').where('userId', '==', uid).get();
      if (snapshot.empty) {
        return { success: true, session: null };
      }

      const docs = snapshot.docs;
      docs.sort((a, b) => {
        const aUpdated = a.data().updatedAt;
        const bUpdated = b.data().updatedAt;
        const aMillis = aUpdated?.toMillis ? aUpdated.toMillis() : 0;
        const bMillis = bUpdated?.toMillis ? bUpdated.toMillis() : 0;
        return bMillis - aMillis;
      });

      const doc = docs[0];
      const data = doc.data();
      return {
        success: true,
        session: {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          messages: Array.isArray(data.messages)
            ? data.messages.map((message: any) => ({
                ...message,
                createdAt: message?.createdAt?.toDate ? message.createdAt.toDate().toISOString() : message.createdAt,
              }))
            : [],
        },
      };
    }

    case 'clearUserChats': {
      const snapshot = await adminDb.collection('chats').where('userId', '==', uid).get();
      if (snapshot.empty) return { success: true, message: 'Chat history is already empty.' };

      const batch = adminDb.batch();
      snapshot.docs.forEach((chatDoc) => batch.delete(chatDoc.ref));
      await batch.commit();
      return { success: true, message: 'Chat history cleared.' };
    }

    case 'logChatInteraction': {
      const chatId = payload.chatId ? String(payload.chatId) : null;
      const userQuery = String(payload.userQuery || '').trim();
      const aiResponse = String(payload.aiResponse || '').trim();

      if (!userQuery || !aiResponse) {
        throw new Error('Invalid chat payload.');
      }

      const userMessage = {
        id: randomUUID(),
        text: userQuery,
        sender: 'user',
        createdAt: Timestamp.now(),
      };

      const aiMessage = {
        id: randomUUID(),
        text: aiResponse,
        sender: 'ai',
        createdAt: Timestamp.now(),
      };

      let newChatId = chatId;

      if (chatId) {
        const chatRef = adminDb.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();

        if (chatSnap.exists && chatSnap.data()?.userId === uid) {
          await chatRef.update({
            messages: FieldValue.arrayUnion(userMessage, aiMessage),
            updatedAt: Timestamp.now(),
          });
        } else {
          newChatId = null;
        }
      }

      if (!newChatId) {
        const newChatRef = adminDb.collection('chats').doc();
        await newChatRef.set({
          userId: uid,
          title: userQuery.substring(0, 50),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          messages: [userMessage, aiMessage],
        });
        newChatId = newChatRef.id;
      }

      return { success: true, newChatId };
    }

    default:
      throw new Error(`Unsupported user action: ${action}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await verifyUser(request);

    const body = (await request.json()) as UserActionPayload;
    if (!body?.action) {
      return NextResponse.json({ success: false, message: 'Action is required.' }, { status: 400 });
    }

    const result = await handleUserAction(request, uid, body.action, body.payload || {});
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    const status = message === 'Unauthorized request.' ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
