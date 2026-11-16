'use client';

import { AreaChart, BarChart, DonutChart, LineChart } from '@lobehub/charts';
import { cssVar } from '@lobehub/ui';
import { type FC, useMemo } from 'react';

import { createChartValueFormatter } from '../../utils/format';
import type { ChartSpec } from '../../utils/spec';

export interface ChartCanvasProps {
  height: number;
  spec: ChartSpec;
}

const ChartCanvas: FC<ChartCanvasProps> = ({ height, spec }) => {
  const valueFormatter = useMemo(() => createChartValueFormatter(spec.format), [spec.format]);

  const categories = useMemo(() => spec.series.map((item) => item.key), [spec.series]);

  const customCategories = useMemo(
    () =>
      Object.fromEntries(
        spec.series.flatMap((item) => (item.label ? [[item.key, item.label]] : [])),
      ) as Record<string, string>,
    [spec.series],
  );

  const colors = useMemo(() => {
    if (!spec.highlight) return undefined;
    return spec.series.map((item) =>
      item.key === spec.highlight ? cssVar.colorPrimary : cssVar.colorTextQuaternary,
    );
  }, [spec.highlight, spec.series]);

  if (spec.type === 'pie') {
    return (
      <DonutChart
        category={spec.series[0].key}
        customCategories={customCategories}
        data={spec.data}
        index={spec.x}
        style={{ height }}
        valueFormatter={valueFormatter}
        variant={spec.donut ? 'donut' : 'pie'}
      />
    );
  }

  const common = {
    categories,
    colors,
    customCategories,
    data: spec.data,
    height,
    index: spec.x,
    maxValue: spec.y?.max,
    minValue: spec.y?.min,
    valueFormatter,
    xAxisLabel: spec.xLabel,
  };

  switch (spec.type) {
    case 'line': {
      return <LineChart {...common} />;
    }
    case 'area': {
      return <AreaChart {...common} stack={spec.stacked} />;
    }
    default: {
      return <BarChart {...common} stack={spec.stacked} />;
    }
  }
};

ChartCanvas.displayName = 'ChartCanvas';

export default ChartCanvas;
