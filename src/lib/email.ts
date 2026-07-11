import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const ZEPTOMAIL_API_URL = 'https://api.zeptomail.eu/v1.1/email';

type SendEmailInput = {
  to: { address: string; name?: string };
  subject: string;
  htmlBody: string;
};

export async function sendEmail(input: SendEmailInput) {
  const apiKey = process.env.ZEPTOMAIL_API_KEY;
  if (!apiKey) {
    console.warn('ZEPTOMAIL_API_KEY is not configured — skipping email.');
    return null;
  }

  const startedAt = new Date().toISOString();
  let status = 'sent';
  let responseStatus = 0;
  let responseBody: any = null;

  try {
    const response = await fetch(ZEPTOMAIL_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${apiKey}`,
      },
      body: JSON.stringify({
        from: { address: 'noreply@trainlylabs.com' },
        to: [{ email_address: { address: input.to.address, name: input.to.name || '' } }],
        subject: input.subject,
        htmlbody: input.htmlBody,
      }),
    });

    responseStatus = response.status;
    responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      status = 'failed';
      console.error('Zeptomail send failed:', responseStatus, responseBody);
      return null;
    }

    return responseBody;
  } finally {
    // Log to Firestore (non-blocking fire-and-forget)
    try {
      await (adminDb as any).collection('email_logs').add({
        to: input.to.address,
        name: input.to.name || '',
        subject: input.subject,
        status,
        responseStatus,
        responseBody: responseBody ? JSON.stringify(responseBody).slice(0, 500) : null,
        startedAt,
        completedAt: new Date().toISOString(),
        createdAt: Timestamp.now(),
      });
    } catch {
      // Logging failure is non-critical
    }
  }
}