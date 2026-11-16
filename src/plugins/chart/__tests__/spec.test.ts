import { describe, expect, it } from 'vitest';

import { createChartValueFormatter } from '../utils/format';
import { parseChartSpec, stringifyChartSpec } from '../utils/spec';

const base = {
  data: [
    { month: 'Jan', profit: 20, revenue: 120 },
    { month: 'Feb', profit: 35, revenue: 160 },
  ],
  series: [{ key: 'revenue', label: 'Revenue' }, { key: 'profit' }],
  type: 'bar',
  version: 1,
  x: 'month',
};

const errorOf = (input: unknown) => {
  const result = parseChartSpec(input);
  if (result.ok) throw new Error('expected an invalid spec');
  return result.error;
};

describe('parseChartSpec', () => {
  it('accepts a minimal spec object and a JSON string', () => {
    const fromObject = parseChartSpec(base);
    const fromString = parseChartSpec(JSON.stringify(base));

    expect(fromObject.ok).toBe(true);
    expect(fromString).toEqual(fromObject);
    if (fromObject.ok) {
      expect(fromObject.spec).toMatchObject({ type: 'bar', version: 1, x: 'month' });
      expect(fromObject.spec.series).toEqual([
        { key: 'revenue', label: 'Revenue' },
        { key: 'profit' },
      ]);
    }
  });

  it('keeps every optional field and drops unknown ones', () => {
    const result = parseChartSpec({
      ...base,
      donut: false,
      extra: 'ignored',
      format: { compact: true, decimals: 1, signed: true, unit: '$' },
      highlight: 'profit',
      note: 'Unaudited',
      refs: [{ label: 'Target', y: 150 }, { y: 0 }],
      source: 'Finance team',
      stacked: true,
      subtitle: 'FY2026',
      title: 'Revenue',
      xLabel: 'Month',
      y: { max: 200, min: 0 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec).not.toHaveProperty('extra');
    expect(result.spec).toMatchObject({
      format: { compact: true, decimals: 1, signed: true, unit: '$' },
      highlight: 'profit',
      refs: [{ label: 'Target', y: 150 }, { y: 0 }],
      stacked: true,
      title: 'Revenue',
      y: { max: 200, min: 0 },
    });
    expect(Object.keys(result.spec)[0]).toBe('version');
    expect(Object.keys(result.spec).at(-1)).toBe('data');
  });

  it('defaults a missing version and accepts string series shorthand', () => {
    const { version: _version, ...rest } = base;
    const result = parseChartSpec({ ...rest, series: ['revenue'] });

    expect(result).toMatchObject({ ok: true, spec: { series: [{ key: 'revenue' }], version: 1 } });
  });

  it('round-trips through stringifyChartSpec', () => {
    const first = parseChartSpec(base);
    if (!first.ok) throw new Error('invalid');
    expect(parseChartSpec(stringifyChartSpec(first.spec))).toEqual(first);
  });

  it.each([
    ['', 'Chart spec is empty'],
    ['{not json', 'Invalid JSON'],
    ['[]', 'must be a JSON object'],
    [{ ...base, version: 2 }, 'Unsupported chart spec version 2'],
    [{ ...base, type: 'radar' }, '"type" must be one of bar, line, area, pie'],
    [{ ...base, x: '' }, '"x" must name the category field'],
    [{ ...base, series: [] }, '"series" must be a non-empty array'],
    [{ ...base, series: [{ label: 'x' }] }, '"series[0].key" must be a non-empty string'],
    [{ ...base, series: ['revenue', 'revenue'] }, 'Duplicate series key "revenue"'],
    [{ ...base, series: ['month'] }, 'Series key "month" is also the x field'],
    [{ ...base, data: [] }, '"data" must be a non-empty array'],
    [{ ...base, data: [{ month: 'Jan', revenue: '12' }] }, '"data[0].revenue" must be a number'],
    [{ ...base, data: [{ revenue: 1 }] }, '"data[0]" is missing the x field "month"'],
    [
      { ...base, data: [{ month: 'Jan', tag: null }] },
      '"data[0].tag" must be a string or a number',
    ],
    [{ ...base, highlight: 'cost' }, '"highlight" must be one of the series keys'],
    [{ ...base, format: { decimals: 1.5 } }, '"format.decimals" must be an integer'],
    [{ ...base, format: { unit: 3 } }, '"format.unit" must be a string'],
    [{ ...base, y: { max: 1, min: 2 } }, '"y.min" must be less than "y.max"'],
    [{ ...base, refs: [{ label: 'x' }] }, '"refs[0].y" is required'],
    [{ ...base, stacked: 'yes' }, '"stacked" must be a boolean'],
    [{ ...base, title: 1 }, '"title" must be a string'],
    [
      { ...base, data: [{ month: 'Jan', profit: 1, revenue: -1 }], type: 'pie' },
      'must not be negative in a pie chart',
    ],
  ])('rejects %j', (input, message) => {
    expect(errorOf(input)).toContain(message);
  });

  it('never throws on hostile input', () => {
    for (const input of [null, undefined, 42, true, Symbol('x'), () => {}, 'null', '"text"']) {
      expect(() => parseChartSpec(input)).not.toThrow();
      expect(parseChartSpec(input).ok).toBe(false);
    }
  });
});

describe('createChartValueFormatter', () => {
  it('formats plain numbers', () => {
    expect(createChartValueFormatter({}, 'en-US')(1234.567)).toBe('1,234.57');
  });

  it('applies decimals, compact and signed', () => {
    expect(createChartValueFormatter({ decimals: 1 }, 'en-US')(3)).toBe('3.0');
    expect(createChartValueFormatter({ compact: true }, 'en-US')(1_250_000)).toBe('1.3M');
    expect(createChartValueFormatter({ signed: true }, 'en-US')(5)).toBe('+5');
    expect(createChartValueFormatter({ signed: true }, 'en-US')(0)).toBe('0');
  });

  it('places units', () => {
    expect(createChartValueFormatter({ unit: '%' }, 'en-US')(12)).toBe('12%');
    expect(createChartValueFormatter({ unit: '$' }, 'en-US')(12)).toBe('$12');
    expect(createChartValueFormatter({ signed: true, unit: '$' }, 'en-US')(-12)).toBe('-$12');
    expect(createChartValueFormatter({ unit: 'ms' }, 'en-US')(12)).toBe('12 ms');
  });
});
