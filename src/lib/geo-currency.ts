import { DEFAULT_CURRENCY, normalizeCurrencyCode } from '@/lib/currency';

const EURO_COUNTRIES = new Set([
  'AD', 'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MC', 'ME', 'MT', 'NL', 'PT', 'SI', 'SK', 'SM', 'VA',
]);

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  AE: 'AED', AF: 'AFN', AL: 'ALL', AM: 'AMD', AO: 'AOA', AR: 'ARS', AU: 'AUD', AZ: 'AZN',
  BA: 'BAM', BD: 'BDT', BG: 'BGN', BH: 'BHD', BI: 'BIF', BN: 'BND', BO: 'BOB', BR: 'BRL',
  BW: 'BWP', BY: 'BYN', BZ: 'BZD', CA: 'CAD', CD: 'CDF', CH: 'CHF', CL: 'CLP', CN: 'CNY',
  CO: 'COP', CR: 'CRC', CZ: 'CZK', DJ: 'DJF', DK: 'DKK', DO: 'DOP', DZ: 'DZD', EG: 'EGP',
  ET: 'ETB', FJ: 'FJD', GB: 'GBP', GE: 'GEL', GH: 'GHS', GM: 'GMD', GN: 'GNF', GT: 'GTQ',
  GY: 'GYD', HK: 'HKD', HN: 'HNL', HU: 'HUF', ID: 'IDR', IL: 'ILS', IN: 'INR', IQ: 'IQD',
  IR: 'IRR', IS: 'ISK', JM: 'JMD', JO: 'JOD', JP: 'JPY', KE: 'KES', KG: 'KGS', KH: 'KHR',
  KR: 'KRW', KW: 'KWD', KZ: 'KZT', LA: 'LAK', LB: 'LBP', LK: 'LKR', LR: 'LRD', LS: 'LSL',
  LY: 'LYD', MA: 'MAD', MD: 'MDL', MG: 'MGA', MK: 'MKD', MM: 'MMK', MN: 'MNT', MR: 'MRU',
  MU: 'MUR', MV: 'MVR', MW: 'MWK', MX: 'MXN', MY: 'MYR', MZ: 'MZN', NA: 'NAD', NG: 'NGN',
  NI: 'NIO', NO: 'NOK', NP: 'NPR', NZ: 'NZD', OM: 'OMR', PA: 'PAB', PE: 'PEN', PG: 'PGK',
  PH: 'PHP', PK: 'PKR', PL: 'PLN', PY: 'PYG', QA: 'QAR', RO: 'RON', RS: 'RSD', RU: 'RUB',
  RW: 'RWF', SA: 'SAR', SC: 'SCR', SD: 'SDG', SE: 'SEK', SG: 'SGD', SI: 'EUR', SK: 'EUR',
  SL: 'SLE', SN: 'XOF', SO: 'SOS', SR: 'SRD', SZ: 'SZL', TH: 'THB', TJ: 'TJS', TN: 'TND',
  TR: 'TRY', TT: 'TTD', TW: 'TWD', TZ: 'TZS', UA: 'UAH', UG: 'UGX', US: 'USD', UY: 'UYU',
  UZ: 'UZS', VE: 'VES', VN: 'VND', YE: 'YER', ZA: 'ZAR', ZM: 'ZMW', ZW: 'USD',
};

export function detectCurrencyFromCountryCode(countryCode: string | null | undefined) {
  const normalizedCountryCode = String(countryCode || '').trim().toUpperCase();
  if (!normalizedCountryCode || normalizedCountryCode.length !== 2) {
    return DEFAULT_CURRENCY;
  }

  if (EURO_COUNTRIES.has(normalizedCountryCode)) {
    return 'EUR';
  }

  const mapped = COUNTRY_TO_CURRENCY[normalizedCountryCode] || DEFAULT_CURRENCY;
  return normalizeCurrencyCode(mapped, DEFAULT_CURRENCY);
}
