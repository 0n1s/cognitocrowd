import type { Package } from '@/lib/types';

export const DEFAULT_CURRENCY = 'USD';
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'GHS', 'ZAR', 'UGX', 'TZS'] as const;

export function normalizeCurrencyCode(value: unknown, fallback = DEFAULT_CURRENCY): string {
  const code = String(value || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    return code;
  }
  return fallback;
}

export function parseLegacyPrice(priceText: string): { amount: number; currency: string; period: string | null; isFree: boolean } {
  const normalized = String(priceText || '').trim();
  if (!normalized || normalized.toLowerCase() === 'free') {
    return { amount: 0, currency: DEFAULT_CURRENCY, period: null, isFree: true };
  }

  const [rawAmount, rawPeriod] = normalized.split('/');
  const amountText = (rawAmount || '').trim();
  const period = rawPeriod?.trim() || null;

  if (amountText.startsWith('$')) {
    const numeric = Number.parseFloat(amountText.slice(1).replace(/,/g, '').trim());
    return {
      amount: Number.isFinite(numeric) ? numeric : 0,
      currency: 'USD',
      period,
      isFree: !Number.isFinite(numeric) || numeric <= 0,
    };
  }

  const prefixedCurrency = amountText.match(/^([A-Z]{3})\s+([0-9]+(?:\.[0-9]+)?)$/i);
  if (prefixedCurrency) {
    const numeric = Number.parseFloat(prefixedCurrency[2]);
    return {
      amount: Number.isFinite(numeric) ? numeric : 0,
      currency: normalizeCurrencyCode(prefixedCurrency[1]),
      period,
      isFree: !Number.isFinite(numeric) || numeric <= 0,
    };
  }

  const suffixedCurrency = amountText.match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Z]{3})$/i);
  if (suffixedCurrency) {
    const numeric = Number.parseFloat(suffixedCurrency[1]);
    return {
      amount: Number.isFinite(numeric) ? numeric : 0,
      currency: normalizeCurrencyCode(suffixedCurrency[2]),
      period,
      isFree: !Number.isFinite(numeric) || numeric <= 0,
    };
  }

  const numericOnly = Number.parseFloat(amountText.replace(/,/g, ''));
  if (Number.isFinite(numericOnly)) {
    return {
      amount: numericOnly,
      currency: DEFAULT_CURRENCY,
      period,
      isFree: numericOnly <= 0,
    };
  }

  return { amount: 0, currency: DEFAULT_CURRENCY, period, isFree: true };
}

export function getPackageMoney(pkg: Pick<Package, 'price' | 'priceAmount' | 'priceCurrency' | 'priceBillingPeriod'>) {
  const structuredAmount = Number(pkg.priceAmount);
  if (Number.isFinite(structuredAmount) && structuredAmount > 0) {
    return {
      amount: structuredAmount,
      currency: normalizeCurrencyCode(pkg.priceCurrency, DEFAULT_CURRENCY),
      period: pkg.priceBillingPeriod?.trim() || null,
      isFree: false,
    };
  }

  return parseLegacyPrice(String(pkg.price || ''));
}

export function formatMoney(value: number, currency: string, locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizeCurrencyCode(currency),
      currencyDisplay: 'symbol',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    const normalized = normalizeCurrencyCode(currency);
    return `${normalized} ${Number(value || 0).toFixed(2)}`;
  }
}

export function formatPackageLegacyPrice(amount: number, currency: string) {
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return 'Free';
  }

  const normalizedCurrency = normalizeCurrencyCode(currency, DEFAULT_CURRENCY);
  const formattedAmount = Number.isInteger(normalizedAmount)
    ? normalizedAmount.toString()
    : normalizedAmount.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');

  if (normalizedCurrency === 'USD') {
    return `$${formattedAmount}`;
  }

  return `${normalizedCurrency} ${formattedAmount}`;
}
