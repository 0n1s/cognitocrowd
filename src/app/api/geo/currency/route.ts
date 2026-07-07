import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { detectCurrencyFromCountryCode } from '@/lib/geo-currency';

export const dynamic = 'force-dynamic';

export async function GET() {
  const requestHeaders = await headers();

  const countryCode =
    requestHeaders.get('x-vercel-ip-country') ||
    requestHeaders.get('cf-ipcountry') ||
    requestHeaders.get('x-country-code') ||
    '';

  const currency = detectCurrencyFromCountryCode(countryCode);

  return NextResponse.json(
    {
      success: true,
      countryCode: String(countryCode || '').toUpperCase() || null,
      currency,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
