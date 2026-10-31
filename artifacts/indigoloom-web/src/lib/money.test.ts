import { describe, expect, it } from 'vitest';
import { parseSpend, spendDraft } from './money';

describe('spend amounts', () => {
  it('reads what the maker typed', () => {
    expect(parseSpend('42.5')).toEqual({ ok: true, cents: 4250 });
    expect(parseSpend(' 1,200 ')).toEqual({ ok: true, cents: 120000 });
    expect(parseSpend('0.07')).toEqual({ ok: true, cents: 7 });
    expect(parseSpend('')).toEqual({ ok: true, cents: null });
    expect(parseSpend('12.345')).toEqual({ ok: false });
    expect(parseSpend('-3')).toEqual({ ok: false });
    expect(parseSpend('abc')).toEqual({ ok: false });
    expect(parseSpend('2000000')).toEqual({ ok: false });
  });

  it('puts a saved amount back in the box', () => {
    expect(spendDraft(4250)).toBe('42.50');
    expect(spendDraft(1200)).toBe('12');
    expect(spendDraft(null)).toBe('');
  });
});
