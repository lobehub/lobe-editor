import { type FC, useState } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import type { ChartSpec } from '../../../utils/spec';
import DataTab from './DataTab';
import Segmented from './Segmented';
import SetupTab from './SetupTab';
import { styles } from './style';
import StyleTab from './StyleTab';

export interface ChartTabProps {
  onChange: (spec: ChartSpec) => void;
  spec: ChartSpec;
}

export interface ChartConfigPanelProps extends ChartTabProps {}

type ConfigTab = 'data' | 'setup' | 'style';

const TABS = { data: DataTab, setup: SetupTab, style: StyleTab } as const;

const ChartConfigPanel: FC<ChartConfigPanelProps> = ({ onChange, spec }) => {
  const t = useTranslation();
  const [tab, setTab] = useState<ConfigTab>('setup');
  const Tab = TABS[tab];

  return (
    <div className={styles.panel}>
      <Segmented
        onChange={setTab}
        options={(['setup', 'data', 'style'] as const).map((value) => ({
          label: t(`chart.form.tabs.${value}`),
          name: t(`chart.form.tabs.${value}`),
          value,
        }))}
        value={tab}
      />
      <div className={styles.tabBody}>
        <Tab onChange={onChange} spec={spec} />
      </div>
    </div>
  );
};

export default ChartConfigPanel;
