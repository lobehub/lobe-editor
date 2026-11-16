import {
  type ChartDatum,
  type ChartReference,
  type ChartSeries,
  type ChartSpec,
  type ChartType,
  parseChartSpec,
} from './spec';

type StyleKey = 'highlight' | 'note' | 'source' | 'subtitle' | 'title' | 'xLabel';

export type ChartStylePatch = Partial<Pick<ChartSpec, StyleKey | 'format' | 'y'>>;

const STACKABLE: ReadonlySet<ChartType> = new Set(['bar', 'area']);

const isBlank = (value: unknown) =>
  value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value));

function commit(prev: ChartSpec, next: ChartSpec): ChartSpec {
  return parseChartSpec(next).ok ? next : prev;
}

function fieldNames(spec: ChartSpec): Set<string> {
  const names = new Set<string>([spec.x, ...spec.series.map((item) => item.key)]);
  for (const row of spec.data) for (const key of Object.keys(row)) names.add(key);
  return names;
}

function withoutBlank<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, item]) => !isBlank(item));
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

function assignOptional<K extends keyof ChartSpec>(
  spec: ChartSpec,
  key: K,
  value: ChartSpec[K] | undefined,
): ChartSpec {
  const next = { ...spec };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

export function parseCellNumber(raw: string): number | undefined {
  const text = raw.trim().replaceAll(',', '');
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

export function renameField(spec: ChartSpec, from: string, to: string): ChartSpec {
  const name = to.trim();
  if (!name || name === from || fieldNames(spec).has(name)) return spec;
  const swap = (key: string) => (key === from ? name : key);
  const next: ChartSpec = {
    ...spec,
    data: spec.data.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [swap(key), value])),
    ),
    series: spec.series.map((item) => (item.key === from ? { ...item, key: name } : item)),
    x: swap(spec.x),
  };
  if (spec.highlight === from) next.highlight = name;
  return commit(spec, next);
}

export function addSeries(spec: ChartSpec): ChartSpec {
  const names = fieldNames(spec);
  let index = spec.series.length + 1;
  while (names.has(`series_${index}`)) index++;
  const key = `series_${index}`;
  return commit(spec, {
    ...spec,
    data: spec.data.map((row) => ({ ...row, [key]: 0 })),
    series: [...spec.series, { key }],
  });
}

export function removeSeries(spec: ChartSpec, key: string): ChartSpec {
  const next: ChartSpec = {
    ...spec,
    data: spec.data.map((row) => {
      const { [key]: _removed, ...rest } = row;
      return rest;
    }),
    series: spec.series.filter((item) => item.key !== key),
  };
  if (next.highlight === key) delete next.highlight;
  return commit(spec, next);
}

export function updateSeries(
  spec: ChartSpec,
  key: string,
  patch: Partial<Omit<ChartSeries, 'key'>>,
): ChartSpec {
  return commit(spec, {
    ...spec,
    series: spec.series.map((item) =>
      item.key === key ? (withoutBlank({ ...item, ...patch }) as ChartSeries) : item,
    ),
  });
}

export function setX(spec: ChartSpec, x: string): ChartSpec {
  if (x === spec.x) return spec;
  const next: ChartSpec = {
    ...spec,
    data: spec.data.map((row) => (row[x] === undefined ? { ...row, [x]: '' } : row)),
    series: spec.series.filter((item) => item.key !== x),
    x,
  };
  if (next.highlight === x) delete next.highlight;
  return commit(spec, next);
}

export function setType(spec: ChartSpec, type: ChartType): ChartSpec {
  let next: ChartSpec = { ...spec, type };
  if (!STACKABLE.has(type)) next = assignOptional(next, 'stacked', undefined);
  if (type !== 'pie') next = assignOptional(next, 'donut', undefined);
  return commit(spec, next);
}

export function setFlag(spec: ChartSpec, flag: 'donut' | 'stacked', value: boolean): ChartSpec {
  return commit(spec, assignOptional(spec, flag, value || undefined));
}

export function addRow(spec: ChartSpec): ChartSpec {
  const row: ChartDatum = { [spec.x]: '' };
  for (const item of spec.series) row[item.key] = 0;
  return commit(spec, { ...spec, data: [...spec.data, row] });
}

export function removeRow(spec: ChartSpec, index: number): ChartSpec {
  return commit(spec, { ...spec, data: spec.data.filter((_, i) => i !== index) });
}

export function setCell(spec: ChartSpec, index: number, key: string, raw: string): ChartSpec {
  let value: number | string;
  if (key === spec.x) {
    value = raw;
  } else {
    const parsed = parseCellNumber(raw);
    if (parsed === undefined) return spec;
    value = parsed;
  }
  return commit(spec, {
    ...spec,
    data: spec.data.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
  });
}

export function setStyle(spec: ChartSpec, patch: ChartStylePatch): ChartSpec {
  let next = spec;
  for (const [key, value] of Object.entries(patch) as Array<[keyof ChartStylePatch, unknown]>) {
    const normalized =
      key === 'format' || key === 'y'
        ? withoutBlank((value ?? {}) as object)
        : isBlank(value)
          ? undefined
          : value;
    next = assignOptional(next, key, normalized as never);
  }
  return commit(spec, next);
}

function setRefs(spec: ChartSpec, refs: ChartReference[]): ChartSpec {
  return commit(spec, assignOptional(spec, 'refs', refs.length > 0 ? refs : undefined));
}

export function addRef(spec: ChartSpec): ChartSpec {
  return setRefs(spec, [...(spec.refs ?? []), { y: 0 }]);
}

export function updateRef(
  spec: ChartSpec,
  index: number,
  patch: Partial<ChartReference>,
): ChartSpec {
  return setRefs(
    spec,
    (spec.refs ?? []).map((ref, i) =>
      i === index ? (withoutBlank({ ...ref, ...patch }) as ChartReference) : ref,
    ),
  );
}

export function removeRef(spec: ChartSpec, index: number): ChartSpec {
  return setRefs(
    spec,
    (spec.refs ?? []).filter((_, i) => i !== index),
  );
}
