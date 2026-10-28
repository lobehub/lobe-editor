import type { ChartValueFormat } from './spec';

const PREFIX_UNITS = new Set(['$', '€', '£', '¥', '₹', '₩']);
const ATTACHED_UNITS = new Set(['%', '‰', '°']);

export function createChartValueFormatter(
  format: ChartValueFormat = {},
  locale?: string,
): (value: number) => string {
  const { compact, decimals, signed, unit } = format;
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: decimals ?? (compact ? 1 : 2),
    minimumFractionDigits: decimals ?? 0,
    notation: compact ? 'compact' : 'standard',
    signDisplay: signed ? 'exceptZero' : 'auto',
  });

  return (value: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return String(value ?? '');
    const text = formatter.format(value);
    if (!unit) return text;
    if (PREFIX_UNITS.has(unit)) {
      const sign = /^[+\-−]/.exec(text)?.[0] ?? '';
      return `${sign}${unit}${text.slice(sign.length)}`;
    }
    if (ATTACHED_UNITS.has(unit)) return `${text}${unit}`;
    return `${text} ${unit}`;
  };
}
