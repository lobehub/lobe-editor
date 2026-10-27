'use client';

import type { ReactNode } from 'react';

import ChartView from '@/plugins/chart/react/components/ChartView';
import { resolveChartNodeState } from '@/plugins/chart/utils/serialize';
import { parseChartSpec } from '@/plugins/chart/utils/spec';

export function renderChart(node: Record<string, any>, key: string): ReactNode {
  const { raw, spec } = resolveChartNodeState(node);
  const result = spec ? null : parseChartSpec(raw);
  const error = result && !result.ok ? result.error : undefined;

  return <ChartView error={error} key={key} raw={raw} spec={spec} />;
}
