import { NextResponse } from 'next/server';
import { fetchOpenExchangeRates, getStoredExchangeRates } from '@/lib/exchange-rates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stored = await getStoredExchangeRates();
    if (stored) {
      return NextResponse.json(
        {
          success: true,
          base: stored.base,
          rates: stored.rates,
          fetchedAtIso: stored.fetchedAtIso || null,
          source: 'stored',
        },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        },
      );
    }

    const live = await fetchOpenExchangeRates();

    return NextResponse.json(
      {
        success: true,
        base: live.base,
        rates: live.rates,
        fetchedAtIso: live.fetchedAtIso || null,
        source: 'live',
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Could not load rates.',
      },
      { status: 500 },
    );
  }
}
