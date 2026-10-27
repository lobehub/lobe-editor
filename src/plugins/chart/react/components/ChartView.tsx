'use client';

import { cx } from '@lobehub/ui';
import { type FC, lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import defaultLocale from '@/locale';

import { createChartValueFormatter } from '../../utils/format';
import type { ChartSpec } from '../../utils/spec';
import { styles } from '../style';

const ChartCanvas = lazy(() => import('./ChartCanvas'));

type ChartLocale = typeof defaultLocale.chart;
type ChartTextKey = {
  [K in keyof ChartLocale]: ChartLocale[K] extends string ? K : never;
}[keyof ChartLocale];

export type ChartViewLabels = Pick<ChartLocale, ChartTextKey>;

export interface ChartViewProps {
  className?: string;
  error?: string;
  height?: number;
  labels?: Partial<ChartViewLabels>;
  raw?: string;
  spec: ChartSpec | null;
}

export const ChartErrorCard: FC<{
  error?: string;
  labels: ChartViewLabels;
  raw?: string;
}> = ({ error, labels, raw }) => (
  <div className={styles.error} data-chart-status="error" role="alert">
    <div className={styles.errorTitle}>{labels.invalid}</div>
    {error && <div className={styles.errorMessage}>{error}</div>}
    {raw && <pre className={styles.errorRaw}>{raw}</pre>}
  </div>
);

ChartErrorCard.displayName = 'ChartErrorCard';

const ChartView: FC<ChartViewProps> = ({ className, error, height = 280, labels, raw, spec }) => {
  const { form: _form, type: _type, ...defaults } = defaultLocale.chart;
  const text: ChartViewLabels = { ...defaults, ...labels };

  if (!spec) {
    return (
      <div className={className}>
        <ChartErrorCard error={error} labels={text} raw={raw} />
      </div>
    );
  }

  const formatValue = createChartValueFormatter(spec.format);
  const placeholder = (
    <div className={styles.canvasPlaceholder} style={{ height }}>
      {text.loading}
    </div>
  );
  const hasFooter = Boolean(spec.refs?.length || spec.note || spec.source);

  return (
    <figure
      className={cx(styles.view, className)}
      data-chart-type={spec.type}
      style={{ margin: 0 }}
    >
      {(spec.title || spec.subtitle) && (
        <figcaption className={styles.header}>
          {spec.title && <div className={styles.title}>{spec.title}</div>}
          {spec.subtitle && <div className={styles.subtitle}>{spec.subtitle}</div>}
        </figcaption>
      )}
      <ErrorBoundary
        fallbackRender={({ error: renderError }) => (
          <ChartErrorCard error={(renderError as Error)?.message} labels={text} />
        )}
        resetKeys={[spec]}
      >
        <Suspense fallback={placeholder}>
          <ChartCanvas height={height} spec={spec} />
        </Suspense>
      </ErrorBoundary>
      {hasFooter && (
        <div className={styles.footer}>
          {spec.refs?.map((reference, index) => (
            <div data-chart-ref key={index}>
              {text.reference}: {reference.label ? `${reference.label} ` : ''}
              {formatValue(reference.y)}
            </div>
          ))}
          {spec.note && <div>{spec.note}</div>}
          {spec.source && (
            <div>
              {text.source}: {spec.source}
            </div>
          )}
        </div>
      )}
    </figure>
  );
};

ChartView.displayName = 'ChartView';

export default ChartView;
