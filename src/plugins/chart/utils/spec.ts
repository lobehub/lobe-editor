export const CHART_TYPES = ['bar', 'line', 'area', 'pie'] as const;

export type ChartType = (typeof CHART_TYPES)[number];

export type ChartDatum = Record<string, string | number>;

export interface ChartSeries {
  key: string;
  label?: string;
}

export interface ChartValueFormat {
  compact?: boolean;
  decimals?: number;
  signed?: boolean;
  unit?: string;
}

export interface ChartReference {
  label?: string;
  y: number;
}

export interface ChartSpec {
  data: ChartDatum[];
  donut?: boolean;
  format?: ChartValueFormat;
  highlight?: string;
  note?: string;
  refs?: ChartReference[];
  series: ChartSeries[];
  source?: string;
  stacked?: boolean;
  subtitle?: string;
  title?: string;
  type: ChartType;
  version: 1;
  x: string;
  xLabel?: string;
  y?: { max?: number; min?: number };
}

export type ChartSpecResult = { ok: true; spec: ChartSpec } | { error: string; ok: false };

const MAX_DECIMALS = 10;

const SPEC_KEY_ORDER: Array<keyof ChartSpec> = [
  'version',
  'type',
  'title',
  'subtitle',
  'x',
  'xLabel',
  'series',
  'highlight',
  'stacked',
  'donut',
  'format',
  'y',
  'refs',
  'note',
  'source',
  'data',
];

class SpecError extends Error {}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function fail(message: string): never {
  throw new SpecError(message);
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail(`"${path}" must be a string`);
  return value;
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') fail(`"${path}" must be a boolean`);
  return value;
}

function optionalNumber(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  if (!isFiniteNumber(value)) fail(`"${path}" must be a finite number`);
  return value;
}

function readSeries(value: unknown): ChartSeries[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail('"series" must be a non-empty array');
  }
  const seen = new Set<string>();
  return value.map((item, index) => {
    const raw = typeof item === 'string' ? { key: item } : item;
    if (!isPlainObject(raw)) fail(`"series[${index}]" must be an object with a "key"`);
    const key = raw.key;
    if (typeof key !== 'string' || !key.trim()) {
      fail(`"series[${index}].key" must be a non-empty string`);
    }
    if (seen.has(key)) fail(`Duplicate series key "${key}"`);
    seen.add(key);
    const label = optionalString(raw.label, `series[${index}].label`);
    return label === undefined ? { key } : { key, label };
  });
}

function readData(value: unknown, x: string, series: ChartSeries[]): ChartDatum[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail('"data" must be a non-empty array of rows');
  }
  const seriesKeys = new Set(series.map((item) => item.key));
  return value.map((row, index) => {
    if (!isPlainObject(row)) fail(`"data[${index}]" must be an object`);
    const datum: ChartDatum = {};
    for (const [field, cell] of Object.entries(row)) {
      if (seriesKeys.has(field)) {
        if (!isFiniteNumber(cell)) fail(`"data[${index}].${field}" must be a number`);
      } else if (typeof cell !== 'string' && !isFiniteNumber(cell)) {
        fail(`"data[${index}].${field}" must be a string or a number`);
      }
      datum[field] = cell as string | number;
    }
    if (datum[x] === undefined) fail(`"data[${index}]" is missing the x field "${x}"`);
    return datum;
  });
}

function readFormat(value: unknown): ChartValueFormat | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) fail('"format" must be an object');
  const decimals = optionalNumber(value.decimals, 'format.decimals');
  if (
    decimals !== undefined &&
    (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS)
  ) {
    fail(`"format.decimals" must be an integer between 0 and ${MAX_DECIMALS}`);
  }
  return compact({
    compact: optionalBoolean(value.compact, 'format.compact'),
    decimals,
    signed: optionalBoolean(value.signed, 'format.signed'),
    unit: optionalString(value.unit, 'format.unit'),
  });
}

function readAxis(value: unknown): ChartSpec['y'] {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) fail('"y" must be an object');
  const min = optionalNumber(value.min, 'y.min');
  const max = optionalNumber(value.max, 'y.max');
  if (min !== undefined && max !== undefined && min >= max) {
    fail('"y.min" must be less than "y.max"');
  }
  return compact({ max, min });
}

function readRefs(value: unknown): ChartReference[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail('"refs" must be an array');
  return value.map((item, index) => {
    if (!isPlainObject(item)) fail(`"refs[${index}]" must be an object with a "y"`);
    const y = optionalNumber(item.y, `refs[${index}].y`);
    if (y === undefined) fail(`"refs[${index}].y" is required`);
    const label = optionalString(item.label, `refs[${index}].label`);
    return label === undefined ? { y } : { label, y };
  });
}

function compact<T extends Record<string, unknown>>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

function readSpec(input: Record<string, unknown>): ChartSpec {
  if (input.version !== undefined && input.version !== 1) {
    fail(`Unsupported chart spec version ${JSON.stringify(input.version)}, expected 1`);
  }

  const type = input.type;
  if (typeof type !== 'string' || !CHART_TYPES.includes(type as ChartType)) {
    fail(`"type" must be one of ${CHART_TYPES.join(', ')}`);
  }

  const x = input.x;
  if (typeof x !== 'string' || !x.trim()) fail('"x" must name the category field');

  const series = readSeries(input.series);
  if (series.some((item) => item.key === x)) fail(`Series key "${x}" is also the x field`);

  const data = readData(input.data, x, series);

  const highlight = optionalString(input.highlight, 'highlight');
  if (highlight !== undefined && !series.some((item) => item.key === highlight)) {
    fail(`"highlight" must be one of the series keys`);
  }

  if (type === 'pie') {
    const valueKey = series[0].key;
    data.forEach((row, index) => {
      const value = row[valueKey];
      if (typeof value === 'number' && value < 0) {
        fail(`"data[${index}].${valueKey}" must not be negative in a pie chart`);
      }
    });
  }

  const spec: ChartSpec = {
    data,
    donut: optionalBoolean(input.donut, 'donut'),
    format: readFormat(input.format),
    highlight,
    note: optionalString(input.note, 'note'),
    refs: readRefs(input.refs),
    series,
    source: optionalString(input.source, 'source'),
    stacked: optionalBoolean(input.stacked, 'stacked'),
    subtitle: optionalString(input.subtitle, 'subtitle'),
    title: optionalString(input.title, 'title'),
    type: type as ChartType,
    version: 1,
    x,
    xLabel: optionalString(input.xLabel, 'xLabel'),
    y: readAxis(input.y),
  };

  return Object.fromEntries(
    SPEC_KEY_ORDER.filter((key) => spec[key] !== undefined).map((key) => [key, spec[key]]),
  ) as unknown as ChartSpec;
}

export function parseChartSpec(input: unknown): ChartSpecResult {
  let value = input;
  if (typeof input === 'string') {
    if (!input.trim()) return { error: 'Chart spec is empty', ok: false };
    try {
      value = JSON.parse(input);
    } catch (error) {
      return { error: `Invalid JSON: ${(error as Error).message}`, ok: false };
    }
  }

  if (!isPlainObject(value)) return { error: 'Chart spec must be a JSON object', ok: false };

  try {
    return { ok: true, spec: readSpec(value) };
  } catch (error) {
    if (error instanceof SpecError) return { error: error.message, ok: false };
    return { error: String(error), ok: false };
  }
}

export function stringifyChartSpec(spec: ChartSpec, space: number = 2): string {
  return JSON.stringify(spec, null, space);
}
