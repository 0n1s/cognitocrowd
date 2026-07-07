import { App, applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function normalizeBucketName(bucketName?: string) {
  if (!bucketName) return '';
  return bucketName.replace(/^gs:\/\//, '').replace(/\/$/, '').trim();
}

function resolveStorageBucketName() {
  const fromEnv = normalizeBucketName(
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  );
  if (fromEnv) {
    return fromEnv;
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    '';

  if (!projectId) {
    return undefined;
  }

  return `${projectId}.appspot.com`;
}

function getServiceAccount() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  let privateKey = rawPrivateKey?.trim();
  if (privateKey?.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  if (privateKey?.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

let cachedAdminApp: App | null = null;

function getAdminApp(): App {
  if (cachedAdminApp) {
    return cachedAdminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedAdminApp = existingApps[0];
    return cachedAdminApp;
  }

  const serviceAccount = getServiceAccount();
  const storageBucket = resolveStorageBucketName();

  if (serviceAccount) {
    cachedAdminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
      storageBucket,
    });
    return cachedAdminApp;
  }

  cachedAdminApp = initializeApp({
    credential: applicationDefault(),
    storageBucket,
  });
  return cachedAdminApp;
}

function createLazyAdminProxy<T extends Record<string, unknown>>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const resolved = factory();
      const value = resolved[prop as keyof T];
      if (typeof value === 'function') {
        return (value as Function).bind(resolved);
      }
      return value;
    },
  });
}

export const adminApp = () => getAdminApp();
export const adminAuth = createLazyAdminProxy(() => getAuth(getAdminApp()));
export const adminDb = createLazyAdminProxy(() => getFirestore(getAdminApp()));
export const adminStorage = createLazyAdminProxy(() => getStorage(getAdminApp()));
