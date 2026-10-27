import { ActionIcon, cx, Popover } from '@lobehub/ui';
import { ChartColumnIcon, CodeXmlIcon, SlidersHorizontalIcon } from 'lucide-react';
import type { FC } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import type { ChartSpec } from '../../utils/spec';
import { styles } from '../style';
import ChartConfigPanel from './config/ChartConfigPanel';

interface ChartToolbarProps {
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  onSpecChange: (spec: ChartSpec) => void;
  onToggleSource: () => void;
  showSource: boolean;
  spec?: ChartSpec;
}

const ChartToolbar: FC<ChartToolbarProps> = ({
  formOpen,
  onFormOpenChange,
  onSpecChange,
  onToggleSource,
  showSource,
  spec,
}) => {
  const t = useTranslation();
  const editChart = (
    <button
      aria-expanded={formOpen}
      aria-label={t('chart.editChart')}
      className={styles.toolbarButton}
      onClick={() => onFormOpenChange(!formOpen)}
      type="button"
    >
      <SlidersHorizontalIcon size={14} />
      {t('chart.editChart')}
    </button>
  );

  return (
    <div
      className={cx(styles.toolbar, 'chart-toolbar')}
      contentEditable={false}
      data-open={formOpen || undefined}
    >
      {spec ? (
        <Popover
          arrow={false}
          content={<ChartConfigPanel onChange={onSpecChange} spec={spec} />}
          onOpenChange={onFormOpenChange}
          open={formOpen}
          placement="bottomRight"
          styles={{ content: { padding: 0 } }}
          trigger="click"
        >
          {editChart}
        </Popover>
      ) : (
        editChart
      )}
      <ActionIcon
        aria-label={showSource ? t('chart.showChart') : t('chart.editSource')}
        icon={showSource ? ChartColumnIcon : CodeXmlIcon}
        onClick={onToggleSource}
        size={'small'}
        title={showSource ? t('chart.showChart') : t('chart.editSource')}
      />
    </div>
  );
};

export default ChartToolbar;
