"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_CURRENCY, normalizeCurrencyCode, SUPPORTED_CURRENCIES } from "@/lib/currency";

type SessionCurrencyContextValue = {
  currency: string;
  supportedCurrencies: string[];
  setCurrency: (nextCurrency: string) => void;
  applyCurrencyConfig: (defaultCurrency?: string, supportedCurrencyList?: string[]) => void;
};

export const SESSION_CURRENCY_STORAGE_KEY = "trainly.session.currency";

const SessionCurrencyContext = createContext<SessionCurrencyContextValue | null>(null);

function readStoredCurrency() {
  if (typeof window === "undefined") return null;

  const fromSession = window.sessionStorage.getItem(SESSION_CURRENCY_STORAGE_KEY);
  if (fromSession) return fromSession;

  const fromLegacyLocal = window.localStorage.getItem(SESSION_CURRENCY_STORAGE_KEY);
  if (fromLegacyLocal) {
    window.sessionStorage.setItem(SESSION_CURRENCY_STORAGE_KEY, fromLegacyLocal);
    window.localStorage.removeItem(SESSION_CURRENCY_STORAGE_KEY);
    return fromLegacyLocal;
  }

  return null;
}

function writeStoredCurrency(currencyCode: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_CURRENCY_STORAGE_KEY, currencyCode);
}

function getBrowserKnownCurrencies() {
  if (typeof Intl === "undefined" || typeof (Intl as any).supportedValuesOf !== "function") {
    return [...SUPPORTED_CURRENCIES];
  }

  const values = (Intl as any).supportedValuesOf("currency") as string[];
  if (!Array.isArray(values) || values.length === 0) {
    return [...SUPPORTED_CURRENCIES];
  }

  return values.map((item) => normalizeCurrencyCode(item, DEFAULT_CURRENCY));
}

function normalizeSupportedCurrencies(input?: string[]) {
  const configured = Array.isArray(input) ? input : [];
  const seed = [...configured, ...getBrowserKnownCurrencies()];
  const normalized = seed
    .map((item) => normalizeCurrencyCode(item, DEFAULT_CURRENCY))
    .filter((item, index, arr) => arr.indexOf(item) === index);

  return normalized.length > 0 ? normalized : [DEFAULT_CURRENCY];
}

export function SessionCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([...SUPPORTED_CURRENCIES]);

  useEffect(() => {
    const stored = readStoredCurrency();
    if (!stored) return;
    setCurrencyState(normalizeCurrencyCode(stored, DEFAULT_CURRENCY));
  }, []);

  const setCurrency = useCallback((nextCurrency: string) => {
    const normalized = normalizeCurrencyCode(nextCurrency, DEFAULT_CURRENCY);
    setCurrencyState(normalized);
    writeStoredCurrency(normalized);
  }, []);

  const applyCurrencyConfig = useCallback((defaultCurrency?: string, supportedCurrencyList?: string[]) => {
    const normalizedSupported = normalizeSupportedCurrencies(supportedCurrencyList);
    setSupportedCurrencies(normalizedSupported);

    const normalizedDefault = normalizeCurrencyCode(defaultCurrency || DEFAULT_CURRENCY, DEFAULT_CURRENCY);
    setCurrencyState((current) => {
      const stored = readStoredCurrency();
      const candidate = normalizeCurrencyCode(stored || current || normalizedDefault, normalizedDefault);
      const finalCurrency = normalizedSupported.includes(candidate)
        ? candidate
        : normalizedSupported.includes(normalizedDefault)
          ? normalizedDefault
          : normalizedSupported[0] || DEFAULT_CURRENCY;

      writeStoredCurrency(finalCurrency);

      return finalCurrency;
    });
  }, []);

  const value = useMemo(
    () => ({
      currency,
      supportedCurrencies,
      setCurrency,
      applyCurrencyConfig,
    }),
    [currency, supportedCurrencies, setCurrency, applyCurrencyConfig],
  );

  return <SessionCurrencyContext.Provider value={value}>{children}</SessionCurrencyContext.Provider>;
}

export function useSessionCurrency() {
  const context = useContext(SessionCurrencyContext);
  if (!context) {
    throw new Error("useSessionCurrency must be used within SessionCurrencyProvider");
  }
  return context;
}
