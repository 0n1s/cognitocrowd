import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

type OpenExchangeRatesResponse = {
  disclaimer?: string;
  license?: string;
  timestamp?: number;
  base?: string;
  rates?: Record<string, number>;
};

export type ExchangeRatesSnapshot = {
  provider: 'openexchangerates';
  base: string;
  rates: Record<string, number>;
  fetchedAtUnix: number;
  fetchedAtIso: string;
  symbolsCount: number;
  syncedAt: string;
  sourceUrl: string;
  disclaimer?: string;
  license?: string;
};

export type StoredExchangeRates = {
  base: string;
  rates: Record<string, number>;
  fetchedAtIso?: string;
};

export type NormalizedUsdAmount = {
  amountInCurrency: number;
  amountCurrency: string;
  amountUsd: number;
  fxRateToUsd: number;
  fxBaseCurrency: string;
  fxFetchedAtIso?: string;
};

const OPEN_EXCHANGE_LATEST_URL = 'https://openexchangerates.org/api/latest.json';

function getOpenExchangeApiKey() {
  const key = process.env.OPENXCHANGE_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENXCHANGE_API_KEY is missing.');
  }
  return key;
}

function assertValidRatesPayload(payload: OpenExchangeRatesResponse): asserts payload is Required<Pick<OpenExchangeRatesResponse, 'timestamp' | 'base' | 'rates'>> & OpenExchangeRatesResponse {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid exchange rates payload.');
  }

  if (!payload.timestamp || !payload.base || !payload.rates || typeof payload.rates !== 'object') {
    throw new Error('Exchange rates payload is missing required fields.');
  }
}

export async function fetchOpenExchangeRates(): Promise<ExchangeRatesSnapshot> {
  const appId = getOpenExchangeApiKey();
  const url = `${OPEN_EXCHANGE_LATEST_URL}?app_id=${encodeURIComponent(appId)}&show_alternative=false`;

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Open Exchange Rates request failed (${response.status}): ${errorBody || response.statusText}`);
  }

  const payload = (await response.json().catch(() => null)) as OpenExchangeRatesResponse | null;
  assertValidRatesPayload(payload || {});

  return {
    provider: 'openexchangerates',
    base: payload.base,
    rates: payload.rates,
    fetchedAtUnix: payload.timestamp,
    fetchedAtIso: new Date(payload.timestamp * 1000).toISOString(),
    symbolsCount: Object.keys(payload.rates).length,
    syncedAt: new Date().toISOString(),
    sourceUrl: OPEN_EXCHANGE_LATEST_URL,
    disclaimer: payload.disclaimer,
    license: payload.license,
  };
}

export async function syncExchangeRates() {
  const snapshot = await fetchOpenExchangeRates();

  const now = Timestamp.now();
  await adminDb.collection('system').doc('exchange_rates').set(
    {
      ...snapshot,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    success: true,
    base: snapshot.base,
    symbolsCount: snapshot.symbolsCount,
    fetchedAtIso: snapshot.fetchedAtIso,
    updatedAtIso: now.toDate().toISOString(),
  };
}

export async function getStoredExchangeRates(): Promise<StoredExchangeRates | null> {
  const docSnap = await adminDb.collection('system').doc('exchange_rates').get();
  if (!docSnap.exists) {
    return null;
  }

  const data = docSnap.data() as Partial<ExchangeRatesSnapshot>;
  if (!data.base || !data.rates || typeof data.rates !== 'object') {
    return null;
  }

  return {
    base: String(data.base).toUpperCase(),
    rates: data.rates,
    fetchedAtIso: data.fetchedAtIso,
  };
}

function normalizeRateCurrency(currency: string) {
  return String(currency || '').trim().toUpperCase();
}

export function convertWithRates(input: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  base: string;
  rates: Record<string, number>;
}) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be a finite number for conversion.');
  }

  const base = normalizeRateCurrency(input.base);
  const from = normalizeRateCurrency(input.fromCurrency);
  const to = normalizeRateCurrency(input.toCurrency);

  if (!from || !to || !base) {
    throw new Error('Invalid currency conversion request.');
  }

  if (from === to) {
    return amount;
  }

  const rates = {
    ...input.rates,
    [base]: 1,
  };

  const fromRate = Number(rates[from]);
  const toRate = Number(rates[to]);

  if (!Number.isFinite(fromRate) || fromRate <= 0) {
    throw new Error(`Missing exchange rate for source currency ${from}.`);
  }
  if (!Number.isFinite(toRate) || toRate <= 0) {
    throw new Error(`Missing exchange rate for target currency ${to}.`);
  }

  const amountInBase = amount / fromRate;
  const converted = amountInBase * toRate;
  return Number(converted.toFixed(6));
}

export async function normalizeToUsdAmount(amount: number, currency: string): Promise<NormalizedUsdAmount> {
  const amountInCurrency = Number(amount);

  console.log('noxrmalizeToUsdAmountz called with:', { amount, currency, amountInCurrency });
  
  if (!Number.isFinite(amountInCurrency) || amountInCurrency <= 0) {
    console.error('Invalid amount for normalization:', amountInCurrency);
    throw new Error('Amount must be greater than zero.');
  }

  const amountCurrency = String(currency || '').trim().toUpperCase() || 'USD';
  if (amountCurrency === 'USD') {
    return {
      amountInCurrency,
      amountCurrency,
      amountUsd: Number(amountInCurrency.toFixed(6)),
      fxRateToUsd: 1,
      fxBaseCurrency: 'USD',
    };
  }

  let rates = await getStoredExchangeRates();
  if (!rates) {
    const liveSnapshot = await fetchOpenExchangeRates();
    rates = {
      base: liveSnapshot.base,
      rates: liveSnapshot.rates,
      fetchedAtIso: liveSnapshot.fetchedAtIso,
    };
  }

  const amountUsd = convertWithRates({
    amount: amountInCurrency,
    fromCurrency: amountCurrency,
    toCurrency: 'USD',
    base: rates.base,
    rates: rates.rates,
  });

  const fxRateToUsd = convertWithRates({
    amount: 1,
    fromCurrency: amountCurrency,
    toCurrency: 'USD',
    base: rates.base,
    rates: rates.rates,
  });

  return {
    amountInCurrency,
    amountCurrency,
    amountUsd,
    fxRateToUsd,
    fxBaseCurrency: rates.base,
    fxFetchedAtIso: rates.fetchedAtIso,
  };
}
