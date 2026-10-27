import { describe, expect, it } from 'vitest';

import {
  addRef,
  addRow,
  addSeries,
  removeRef,
  removeRow,
  removeSeries,
  renameField,
  setCell,
  setFlag,
  setStyle,
  setType,
  setX,
  updateRef,
  updateSeries,
} from '../utils/spec-edit';
import { type ChartSpec, parseChartSpec } from '../utils/spec';

const base: ChartSpec = {
  data: [
    { cloud: 10, devices: 4, q: 'Q1' },
    { cloud: 12, devices: 5, q: 'Q2' },
  ],
  highlight: 'cloud',
  series: [
    { key: 'cloud', label: 'Cloud' },
    { key: 'devices', label: 'Devices' },
  ],
  stacked: true,
  type: 'bar',
  version: 1,
  x: 'q',
};

const expectValid = (spec: ChartSpec) => expect(parseChartSpec(spec).ok).toBe(true);

describe('chart spec-edit', () => {
  it('renames a series field in series, data rows and highlight', () => {
    const next = renameField(base, 'cloud', 'saas');
    expect(next.series[0].key).toBe('saas');
    expect(next.data[0]).toEqual({ devices: 4, q: 'Q1', saas: 10 });
    expect(next.highlight).toBe('saas');
    expectValid(next);
  });

  it('renames the x field', () => {
    const next = renameField(base, 'q', 'quarter');
    expect(next.x).toBe('quarter');
    expect(next.data[1].quarter).toBe('Q2');
    expectValid(next);
  });

  it('ignores a rename to an existing or empty name', () => {
    expect(renameField(base, 'cloud', 'devices')).toBe(base);
    expect(renameField(base, 'cloud', '  ')).toBe(base);
  });

  it('adds a series filled with zeros under a free key', () => {
    const next = addSeries(base);
    expect(next.series.at(-1)?.key).toBe('series_3');
    expect(next.data.map((row) => row.series_3)).toEqual([0, 0]);
    expectValid(next);
  });

  it('removes a series together with its column and clears highlight', () => {
    const next = removeSeries(base, 'cloud');
    expect(next.series.map((item) => item.key)).toEqual(['devices']);
    expect(next.data[0]).toEqual({ devices: 4, q: 'Q1' });
    expect(next.highlight).toBeUndefined();
    expectValid(next);
  });

  it('keeps the last series', () => {
    const single = removeSeries(base, 'cloud');
    expect(removeSeries(single, 'devices')).toBe(single);
  });

  it('updates a series label', () => {
    expect(updateSeries(base, 'devices', { label: 'Hardware' }).series[1].label).toBe('Hardware');
  });

  it('switching x to a series field removes that series', () => {
    const next = setX(base, 'devices');
    expect(next.x).toBe('devices');
    expect(next.series.map((item) => item.key)).toEqual(['cloud']);
    expectValid(next);
  });

  it('switching type drops options that no longer apply', () => {
    const line = setType(base, 'line');
    expect(line.stacked).toBeUndefined();
    const pie = setType(setFlag(base, 'donut', true), 'pie');
    expect(pie.donut).toBe(true);
    expect(setType(pie, 'bar').donut).toBeUndefined();
    expectValid(line);
  });

  it('adds and removes rows but keeps the last one', () => {
    const added = addRow(base);
    expect(added.data.at(-1)).toEqual({ cloud: 0, devices: 0, q: '' });
    expectValid(added);
    const one = removeRow(base, 0);
    expect(one.data).toHaveLength(1);
    expect(removeRow(one, 0)).toBe(one);
  });

  it('coerces numeric cells and rejects invalid numbers', () => {
    expect(setCell(base, 0, 'cloud', '1,200').data[0].cloud).toBe(1200);
    expect(setCell(base, 0, 'cloud', 'abc')).toBe(base);
    expect(setCell(base, 0, 'cloud', '')).toBe(base);
    expect(setCell(base, 1, 'q', 'Q9').data[1].q).toBe('Q9');
  });

  it('sets and clears style fields', () => {
    const titled = setStyle(base, { title: 'Revenue' });
    expect(titled.title).toBe('Revenue');
    expect(setStyle(titled, { title: '' }).title).toBeUndefined();
    expect(setStyle(base, { format: { decimals: 2, unit: '%' } }).format).toEqual({
      decimals: 2,
      unit: '%',
    });
  });

  it('refuses a style edit that would make the spec invalid', () => {
    const bounded = setStyle(base, { y: { max: 10 } });
    expect(setStyle(bounded, { y: { max: 10, min: 20 } })).toBe(bounded);
  });

  it('adds, updates and removes reference lines', () => {
    const one = addRef(base);
    expect(one.refs).toEqual([{ y: 0 }]);
    const updated = updateRef(one, 0, { label: 'Plan', y: 11 });
    expect(updated.refs).toEqual([{ label: 'Plan', y: 11 }]);
    expect(removeRef(updated, 0).refs).toBeUndefined();
    expectValid(updated);
  });
});
