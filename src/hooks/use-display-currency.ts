"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CURRENCY, normalizeCurrencyCode } from "@/lib/currency";
import { useSessionCurrency } from "@/hooks/use-session-currency";

type RatesPayload = {
  base: string;
  rates: Record<string, number>;
};

function convertAmountWithRates(amount: number, fromCurrency: string, toCurrency: string, ratesPayload: RatesPayload) {
  const source = normalizeCurrencyCode(fromCurrency, DEFAULT_CURRENCY);
  const target = normalizeCurrencyCode(toCurrency, DEFAULT_CURRENCY);
  if (source === target) return amount;

  const base = normalizeCurrencyCode(ratesPayload.base, DEFAULT_CURRENCY);
  const rates = { ...ratesPayload.rates, [base]: 1 };

  const fromRate = Number(rates[source]);
  const toRate = Number(rates[target]);
  if (!Number.isFinite(fromRate) || fromRate <= 0) return amount;
  if (!Number.isFinite(toRate) || toRate <= 0) return amount;

  const inBase = amount / fromRate;
  return Number((inBase * toRate).toFixed(6));
}

export function useDisplayCurrency() {
  const { currency } = useSessionCurrency();
  const [ratesPayload, setRatesPayload] = useState<RatesPayload | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch('/api/exchange-rates/current', { cache: 'no-store' });
        if (!response.ok) return;

        const payload = await response.json().catch(() => null);
        if (!active || !payload?.base || typeof payload?.rates !== 'object') return;

        setRatesPayload({
          base: String(payload.base),
          rates: payload.rates as Record<string, number>,
        });
      } catch {
        // Keep fallback formatting when rates are unavailable.
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const formatAmount = useMemo(() => {
    return (amount: number, sourceCurrency: string = DEFAULT_CURRENCY) => {
      const normalizedTarget = normalizeCurrencyCode(currency, DEFAULT_CURRENCY);
      const normalizedSource = normalizeCurrencyCode(sourceCurrency, DEFAULT_CURRENCY);
      const numeric = Number(amount || 0);
      const safeAmount = Number.isFinite(numeric) ? numeric : 0;

      const converted = ratesPayload
        ? convertAmountWithRates(safeAmount, normalizedSource, normalizedTarget, ratesPayload)
        : safeAmount;

      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: normalizedTarget,
          currencyDisplay: 'symbol',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(converted);
      } catch {
        return `${normalizedTarget} ${converted.toFixed(2)}`;
      }
    };
  }, [currency, ratesPayload]);

  return {
    currency,
    formatAmount,
  };
}
