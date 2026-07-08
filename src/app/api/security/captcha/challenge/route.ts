import { NextResponse } from 'next/server';
import { createHmac, randomUUID } from 'crypto';

export const runtime = 'nodejs';

function getLocalCaptchaSecret() {
  const secret = String(process.env.LOCAL_CAPTCHA_SECRET || process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) {
    throw new Error('Captcha is not configured.');
  }
  return secret;
}

export async function GET() {
  try {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 2;
    const op = Math.random() < 0.5 ? '+' : '-';
    const left = op === '-' && a < b ? b : a;
    const right = op === '-' && a < b ? a : b;
    const exp = Date.now() + 5 * 60 * 1000;
    const nonce = randomUUID();

    const raw = `${left}:${right}:${op}:${exp}:${nonce}`;
    const sig = createHmac('sha256', getLocalCaptchaSecret()).update(raw).digest('hex');
    const tokenPayload = {
      a: left,
      b: right,
      op,
      exp,
      nonce,
      sig,
    };

    const token = Buffer.from(JSON.stringify(tokenPayload), 'utf8').toString('base64url');

    return NextResponse.json(
      {
        success: true,
        question: `${left} ${op} ${right}`,
        token,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create captcha challenge.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
