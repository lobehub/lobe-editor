import { type ChartSpec, parseChartSpec, stringifyChartSpec } from './spec';

export interface ChartNodeData {
  raw?: string;
  spec?: ChartSpec | null;
}

export interface ChartNodeState {
  raw: string;
  spec: ChartSpec | null;
}

export function resolveChartNodeState(
  input: ChartNodeData | string | null | undefined,
): ChartNodeState {
  if (typeof input === 'string') return chartStateFromSource(input);
  if (input?.spec) {
    const result = parseChartSpec(input.spec);
    if (result.ok) return { raw: '', spec: result.spec };
    return { raw: safeStringify(input.spec), spec: null };
  }
  return { raw: input?.raw ?? '', spec: null };
}

export function chartStateFromSource(source: string): ChartNodeState {
  const result = parseChartSpec(source);
  return result.ok ? { raw: '', spec: result.spec } : { raw: source, spec: null };
}

export function getChartSource(state: ChartNodeData): string {
  return state.spec ? stringifyChartSpec(state.spec) : (state.raw ?? '');
}

export function toCdata(text: string): string {
  return `<![CDATA[${text.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

export function toMarkdownFence(source: string, lang: string): string {
  const longest = Math.max(2, ...(source.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${lang}\n${source}\n${fence}\n`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '';
  }
}
