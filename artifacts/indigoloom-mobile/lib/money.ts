import type { Currency } from '@workspace/api-client-react';

// The currencies a maker can pick in Settings, with the names shown there.
export const currencies: Array<{ value: Currency; label: string }> = [
  { value: 'USD', label: 'US dollar' },
  { value: 'CAD', label: 'Canadian dollar' },
  { value: 'GBP', label: 'British pound' },
  { value: 'EUR', label: 'Euro' },
  { value: 'AUD', label: 'Australian dollar' },
  { value: 'NZD', label: 'New Zealand dollar' },
  { value: 'ZAR', label: 'South African rand' },
  { value: 'MWK', label: 'Malawian kwacha' },
  { value: 'ZMW', label: 'Zambian kwacha' },
  { value: 'KES', label: 'Kenyan shilling' },
  { value: 'NGN', label: 'Nigerian naira' },
  { value: 'INR', label: 'Indian rupee' },
  { value: 'JPY', label: 'Japanese yen' },
];

// Spend is saved in hundredths whatever the currency, so 4250 is 42.50.
export function formatSpend(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
  }
}

// Reads what the maker typed: "42.5", "1,200" or "" (clears it).
export function parseSpend(text: string): { ok: true; cents: number | null } | { ok: false } {
  const cleaned = text.replace(/[\s,]/g, '');
  if (cleaned === '') return { ok: true, cents: null };
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return { ok: false };
  const cents = Math.round(Number(cleaned) * 100);
  return cents <= 100_000_000 ? { ok: true, cents } : { ok: false };
}

export function spendDraft(cents: number | null): string {
  if (cents === null) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
