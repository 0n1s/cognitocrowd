"use client";

import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAppSettings } from "@/lib/database";
import { useSessionCurrency } from "@/hooks/use-session-currency";

export function SessionCurrencyPicker() {
  const { currency, supportedCurrencies, setCurrency, applyCurrencyConfig } = useSessionCurrency();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [settings, geoResponse] = await Promise.all([
          getAppSettings(),
          fetch('/api/geo/currency', { cache: 'no-store' }).catch(() => null),
        ]);
        if (!active) return;
        applyCurrencyConfig(settings.defaultCurrency, settings.supportedCurrencies);

        const geoPayload = geoResponse && geoResponse.ok
          ? await geoResponse.json().catch(() => null)
          : null;
        if (geoPayload?.currency) {
          setCurrency(String(geoPayload.currency));
        }
      } catch {
        // Keep current session fallback values when settings are unavailable.
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [applyCurrencyConfig, setCurrency]);

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <Label htmlFor="session-currency" className="text-xs text-muted-foreground">Currency</Label>
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger id="session-currency" className="h-8 w-[96px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {supportedCurrencies.map((currencyCode) => (
            <SelectItem key={currencyCode} value={currencyCode}>{currencyCode}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
