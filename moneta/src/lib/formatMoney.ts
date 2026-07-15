export function formatMoney(
  amount: number,
  currency = 'USD',
  opts?: { showSign?: boolean },
): string {
  const abs = Math.abs(amount);
  try {
    const formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
    if (opts?.showSign) {
      if (amount > 0) return `+${formatted}`;
      if (amount < 0) return `-${formatted}`;
    } else if (amount < 0) {
      return `-${formatted}`;
    }
    return formatted;
  } catch {
    const fallback = `$${abs.toFixed(2)}`;
    if (opts?.showSign && amount > 0) return `+${fallback}`;
    if (amount < 0) return `-${fallback}`;
    return fallback;
  }
}

export const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'MXN', 'JPY'] as const;
