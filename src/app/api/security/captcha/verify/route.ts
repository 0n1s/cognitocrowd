import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  'error-codes'?: string[];
};

export const runtime = 'nodejs';

function getCaptchaProvider() {
  const provider = String(process.env.CAPTCHA_PROVIDER || 'local').trim().toLowerCase();
  return provider === 'turnstile' ? 'turnstile' : 'local';
}

function getLocalCaptchaSecret() {
  const secret = String(process.env.LOCAL_CAPTCHA_SECRET || process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) {
    throw new Error('Captcha is not configured.');
  }
  return secret;
}

function parseLocalChallengeToken(token: string) {
  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  const payload = JSON.parse(decoded) as {
    a: number;
    b: number;
    op: '+' | '-';
    exp: number;
    nonce: string;
    sig: string;
  };
  return payload;
}

function verifyLocalChallenge(input: { token: string; answer: string }) {
  const secret = getLocalCaptchaSecret();
  const payload = parseLocalChallengeToken(input.token);

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid captcha token.');
  }

  if (Date.now() > Number(payload.exp || 0)) {
    throw new Error('Captcha expired. Please retry.');
  }

  const raw = `${payload.a}:${payload.b}:${payload.op}:${payload.exp}:${payload.nonce}`;
  const expectedSig = createHmac('sha256', secret).update(raw).digest('hex');
  if (payload.sig !== expectedSig) {
    throw new Error('Invalid captcha signature.');
  }

  const expectedAnswer = payload.op === '+' ? payload.a + payload.b : payload.a - payload.b;
  const providedAnswer = Number(String(input.answer || '').trim());
  if (!Number.isFinite(providedAnswer) || providedAnswer !== expectedAnswer) {
    throw new Error('Captcha answer is incorrect.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      token?: string;
      action?: string;
      answer?: string;
    };
    const token = String(body.token || '').trim();
    const expectedAction = String(body.action || '').trim();

    if (!token) {
      return NextResponse.json({ success: false, message: 'Captcha token is required.' }, { status: 400 });
    }

    const provider = getCaptchaProvider();

    if (provider === 'local') {
      verifyLocalChallenge({ token, answer: String(body.answer || '') });
      return NextResponse.json({ success: true });
    }

    const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
    if (!secret) {
      return NextResponse.json({ success: false, message: 'Captcha is not configured.' }, { status: 500 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const payload = new URLSearchParams({
      secret,
      response: token,
    });
    if (ip) payload.set('remoteip', ip);

    const verificationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
      cache: 'no-store',
    });

    const result = (await verificationResponse.json().catch(() => ({}))) as TurnstileResponse;
    if (!verificationResponse.ok || !result.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Captcha verification failed.',
          errors: result['error-codes'] || [],
        },
        { status: 400 },
      );
    }

    if (expectedAction && result.action && result.action !== expectedAction) {
      return NextResponse.json({ success: false, message: 'Captcha action mismatch.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected captcha verification error.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
