import { XIcon } from 'lucide-react';
import type { FC } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { addRow, parseCellNumber, removeRow, renameField, setCell } from '../../../utils/spec-edit';
import type { ChartTabProps } from './ChartConfigPanel';
import CommitInput from './CommitInput';
import { styles } from './style';

const isNumber = (value: string) => parseCellNumber(value) !== undefined;

const DataTab: FC<ChartTabProps> = ({ onChange, spec }) => {
  const t = useTranslation();
  const columns = [spec.x, ...spec.series.map((item) => item.key)];
  const labels = new Map(spec.series.map((item) => [item.key, item.label]));

  return (
    <>
      <div className={styles.gridScroll}>
        <table className={styles.grid}>
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key}>
                  <CommitInput
                    aria-label={`${t('chart.form.fieldName')} ${key}`}
                    onCommit={(name) => onChange(renameField(spec, key, name))}
                    value={key}
                  />
                  {labels.get(key) && labels.get(key) !== key && (
                    <span className={styles.headerLabel}>{labels.get(key)}</span>
                  )}
                </th>
              ))}
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {spec.data.map((row, index) => (
              <tr key={index}>
                {columns.map((key) => (
                  <td key={key}>
                    <CommitInput
                      aria-label={`${key} ${index + 1}`}
                      inputMode={key === spec.x ? undefined : 'decimal'}
                      isValid={key === spec.x ? undefined : isNumber}
                      onCommit={(value) => onChange(setCell(spec, index, key, value))}
                      value={String(row[key] ?? '')}
                    />
                  </td>
                ))}
                <td>
                  <button
                    aria-label={`${t('chart.form.removeRow')} ${index + 1}`}
                    className={styles.iconButton}
                    disabled={spec.data.length <= 1}
                    onClick={() => onChange(removeRow(spec, index))}
                    type="button"
                  >
                    <XIcon size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        aria-label={t('chart.form.addRow')}
        className={styles.addButton}
        onClick={() => onChange(addRow(spec))}
        type="button"
      >
        {t('chart.form.addRow')}
      </button>
    </>
  );
};

export default DataTab;
