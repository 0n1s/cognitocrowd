import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { UserNotificationType } from '@/lib/types';
import { sendEmail } from '@/lib/email';

type CreateUserNotificationInput = {
  userId: string;
  type?: UserNotificationType;
  title: string;
  message: string;
  href?: string;
  metadata?: Record<string, unknown>;
  /** If true, also sends an email via Zeptomail for this notification */
  sendEmail?: boolean;
};

async function sendPushNotification(userId: string, title: string, message: string, href?: string) {
  try {
    // Dynamically import firebase-admin messaging to avoid issues if not configured
    const { getMessaging } = await import('firebase-admin/messaging');
    const messaging = getMessaging();

    // Get the user's FCM tokens
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const fcmTokens = userDoc.data()?.fcmTokens as string[] | undefined;

    if (!fcmTokens || fcmTokens.length === 0) return;

    const payload = {
      notification: {
        title: title.slice(0, 100),
        body: message.slice(0, 200),
      },
      data: {
        href: href || '/dashboard',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      tokens: fcmTokens,
    };

    const response = await messaging.sendEachForMulticast(payload);
    
    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(fcmTokens[idx]);
        }
      });

      if (invalidTokens.length > 0) {
        // Remove invalid tokens from the user's document
        await adminDb.collection('users').doc(userId).update({
          fcmTokens: adminDb.FieldValue.arrayRemove(...invalidTokens),
        });
      }
    }
  } catch (error) {
    // FCM may not be configured (no Firebase project, no messaging enabled, etc.)
    // Silently ignore — the in-app notification still works
    console.warn('FCM push notification failed (this is fine if not configured):', error);
  }
}

export async function createUserNotification(input: CreateUserNotificationInput) {
  const title = input.title.trim().slice(0, 120);
  const message = input.message.trim().slice(0, 500);
  const userId = input.userId.trim();

  if (!userId || !title || !message) {
    return null;
  }

  const ref = (adminDb as any).collection('user_notifications').doc();
  const now = Timestamp.now();

  await ref.set({
    userId,
    type: input.type || 'system',
    title,
    message,
    href: input.href || '',
    metadata: input.metadata || {},
    readAt: null,
    createdAt: now,
  });

  // Send push notification in the background (don't await — non-blocking)
  sendPushNotification(userId, title, message, input.href).catch(() => {});

  // Send email for important notifications (only if email notifications are enabled)
  if (input.sendEmail) {
    sendEmailNotification(userId, title, message).catch(() => {});
  }

  return ref.id;
}

async function sendEmailNotification(userId: string, title: string, message: string) {
  try {
    // Check if email notifications are enabled globally
    const settingsDoc = await adminDb.collection('settings').doc('main').get();
    if (settingsDoc.exists && settingsDoc.data()?.emailNotificationsEnabled === false) {
      return;
    }

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const user = userDoc.data();
    const email = user?.email as string | undefined;
    const name = (user?.name as string) || 'User';

    if (!email) return;

    await sendEmail({
      to: { address: email, name },
      subject: title,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">TrainlyLabs</h1>
          </div>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 24px;">
            <h2 style="color: #1a1a2e; font-size: 18px; margin: 0 0 12px;">${title}</h2>
            <p style="color: #4a4a6a; font-size: 14px; line-height: 1.6; margin: 0;">${message}</p>
          </div>
          <div style="text-align: center; margin-top: 24px; color: #9a9ab0; font-size: 12px;">
            <p>You received this email because you have a TrainlyLabs account.</p>
            <p>© ${new Date().getFullYear()} TrainlyLabs. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Email notification failed:', error);
  }
}
