import { Switch } from '@lobehub/ui';
import { XIcon } from 'lucide-react';
import type { FC } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { CHART_TYPES } from '../../../utils/spec';
import {
  addSeries,
  removeSeries,
  renameField,
  setFlag,
  setType,
  setX,
  updateSeries,
} from '../../../utils/spec-edit';
import type { ChartTabProps } from './ChartConfigPanel';
import CommitInput from './CommitInput';
import Segmented from './Segmented';
import { styles } from './style';

const dataFields = (spec: ChartTabProps['spec']) => {
  const fields = new Set<string>([spec.x]);
  for (const row of spec.data) for (const key of Object.keys(row)) fields.add(key);
  return [...fields];
};

const SetupTab: FC<ChartTabProps> = ({ onChange, spec }) => {
  const t = useTranslation();
  const isPie = spec.type === 'pie';
  const visibleSeries = isPie ? spec.series.slice(0, 1) : spec.series;

  return (
    <>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t('chart.form.type')}</span>
        <Segmented
          onChange={(type) => onChange(setType(spec, type))}
          options={CHART_TYPES.map((type) => ({
            label: t(`chart.type.${type}`),
            name: t(`chart.type.${type}`),
            value: type,
          }))}
          value={spec.type}
        />
      </div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('chart.form.x')}</span>
        <select
          className={styles.select}
          onChange={(event) => onChange(setX(spec, event.target.value))}
          value={spec.x}
        >
          {dataFields(spec).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t('chart.form.series')}</span>
        {visibleSeries.map((item) => (
          <div className={styles.row} key={item.key}>
            <CommitInput
              aria-label={`${t('chart.form.fieldName')} ${item.key}`}
              onCommit={(name) => onChange(renameField(spec, item.key, name))}
              value={item.key}
            />
            <CommitInput
              aria-label={`${t('chart.form.label')} ${item.key}`}
              onCommit={(label) => onChange(updateSeries(spec, item.key, { label }))}
              placeholder={t('chart.form.label')}
              value={item.label ?? ''}
            />
            <button
              aria-label={`${t('chart.form.removeSeries')} ${item.key}`}
              className={styles.iconButton}
              disabled={spec.series.length <= 1}
              onClick={() => onChange(removeSeries(spec, item.key))}
              type="button"
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}
        {isPie ? (
          <span className={styles.hint}>{t('chart.form.pieFirstSeries')}</span>
        ) : (
          <button
            aria-label={t('chart.form.addSeries')}
            className={styles.addButton}
            onClick={() => onChange(addSeries(spec))}
            type="button"
          >
            {t('chart.form.addSeries')}
          </button>
        )}
      </div>
      {(spec.type === 'bar' || spec.type === 'area') && (
        <label className={styles.switchRow}>
          {t('chart.form.stacked')}
          <Switch
            checked={Boolean(spec.stacked)}
            onChange={(checked) => onChange(setFlag(spec, 'stacked', checked))}
            size="small"
          />
        </label>
      )}
      {isPie && (
        <label className={styles.switchRow}>
          {t('chart.form.donut')}
          <Switch
            checked={Boolean(spec.donut)}
            onChange={(checked) => onChange(setFlag(spec, 'donut', checked))}
            size="small"
          />
        </label>
      )}
    </>
  );
};

export default SetupTab;
