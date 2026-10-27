import { Switch } from '@lobehub/ui';
import { XIcon } from 'lucide-react';
import type { FC } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import {
  addRef,
  type ChartStylePatch,
  parseCellNumber,
  removeRef,
  setStyle,
  updateRef,
} from '../../../utils/spec-edit';
import type { ChartTabProps } from './ChartConfigPanel';
import CommitInput from './CommitInput';
import { styles } from './style';

const TEXT_FIELDS = ['title', 'subtitle', 'xLabel', 'note', 'source'] as const;

const isOptionalNumber = (value: string) => !value.trim() || parseCellNumber(value) !== undefined;
const toNumber = (value: string) => parseCellNumber(value);

const StyleTab: FC<ChartTabProps> = ({ onChange, spec }) => {
  const t = useTranslation();
  const patch = (value: ChartStylePatch) => onChange(setStyle(spec, value));
  const format = spec.format ?? {};
  const y = spec.y ?? {};

  return (
    <>
      {TEXT_FIELDS.map((key) => (
        <label className={styles.field} key={key}>
          <span className={styles.fieldLabel}>{t(`chart.form.${key}`)}</span>
          <CommitInput
            aria-label={t(`chart.form.${key}`)}
            onCommit={(value) => patch({ [key]: value })}
            value={spec[key] ?? ''}
          />
        </label>
      ))}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('chart.form.highlight')}</span>
        <select
          className={styles.select}
          onChange={(event) => patch({ highlight: event.target.value })}
          value={spec.highlight ?? ''}
        >
          <option value="">{t('chart.form.none')}</option>
          {spec.series.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label || item.key}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t('chart.form.format')}</span>
        <div className={styles.row}>
          <CommitInput
            aria-label={t('chart.form.unit')}
            onCommit={(unit) => patch({ format: { ...format, unit } })}
            placeholder={t('chart.form.unit')}
            value={format.unit ?? ''}
          />
          <CommitInput
            aria-label={t('chart.form.decimals')}
            inputMode="numeric"
            isValid={isOptionalNumber}
            onCommit={(value) => patch({ format: { ...format, decimals: toNumber(value) } })}
            placeholder={t('chart.form.decimals')}
            value={format.decimals === undefined ? '' : String(format.decimals)}
          />
        </div>
        <label className={styles.switchRow}>
          {t('chart.form.compact')}
          <Switch
            checked={Boolean(format.compact)}
            onChange={(compact) => patch({ format: { ...format, compact: compact || undefined } })}
            size="small"
          />
        </label>
        <label className={styles.switchRow}>
          {t('chart.form.signed')}
          <Switch
            checked={Boolean(format.signed)}
            onChange={(signed) => patch({ format: { ...format, signed: signed || undefined } })}
            size="small"
          />
        </label>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t('chart.form.yAxis')}</span>
        <div className={styles.row}>
          {(['min', 'max'] as const).map((bound) => (
            <CommitInput
              aria-label={t(bound === 'min' ? 'chart.form.yMin' : 'chart.form.yMax')}
              inputMode="decimal"
              isValid={isOptionalNumber}
              key={bound}
              onCommit={(value) => patch({ y: { ...y, [bound]: toNumber(value) } })}
              placeholder={t(bound === 'min' ? 'chart.form.yMin' : 'chart.form.yMax')}
              value={y[bound] === undefined ? '' : String(y[bound])}
            />
          ))}
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t('chart.form.refs')}</span>
        {(spec.refs ?? []).map((ref, index) => (
          <div className={styles.row} key={index}>
            <CommitInput
              aria-label={`${t('chart.form.refValue')} ${index + 1}`}
              inputMode="decimal"
              isValid={(value) => parseCellNumber(value) !== undefined}
              onCommit={(value) => onChange(updateRef(spec, index, { y: toNumber(value) }))}
              value={String(ref.y)}
            />
            <CommitInput
              aria-label={`${t('chart.form.refLabel')} ${index + 1}`}
              onCommit={(label) => onChange(updateRef(spec, index, { label }))}
              placeholder={t('chart.form.refLabel')}
              value={ref.label ?? ''}
            />
            <button
              aria-label={`${t('chart.form.removeRef')} ${index + 1}`}
              className={styles.iconButton}
              onClick={() => onChange(removeRef(spec, index))}
              type="button"
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}
        <button
          aria-label={t('chart.form.addRef')}
          className={styles.addButton}
          onClick={() => onChange(addRef(spec))}
          type="button"
        >
          {t('chart.form.addRef')}
        </button>
      </div>
    </>
  );
};

export default StyleTab;
