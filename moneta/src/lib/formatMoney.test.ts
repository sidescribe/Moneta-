import { describe, expect, it } from 'vitest';
import { formatMoney } from './formatMoney';

describe('formatMoney', () => {
  it('formats positive USD amounts', () => {
    const result = formatMoney(1234.5, 'USD');
    expect(result).toMatch(/1[,.]?234\.50/);
    expect(result).not.toMatch(/^-/);
  });

  it('formats negative USD amounts with a leading minus', () => {
    const result = formatMoney(-42.5, 'USD');
    expect(result.startsWith('-')).toBe(true);
    expect(result).toMatch(/42\.50/);
  });

  it('adds a plus sign when showSign is set', () => {
    expect(formatMoney(10, 'USD', { showSign: true })).toMatch(/^\+/);
  });
});
