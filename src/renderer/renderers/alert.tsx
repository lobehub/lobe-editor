import { createElement, type ReactNode } from 'react';

import locale from '@/locale';
import { normalizeAlertType } from '@/plugins/alert/node/AlertNode';
import { ALERT_ICONS } from '@/plugins/alert/react/icons';
import { styles } from '@/plugins/alert/react/style';

export function renderAlert(
  node: Record<string, any>,
  key: string,
  children: ReactNode[] | null,
): ReactNode {
  const alertType = normalizeAlertType(node.alertType);
  return (
    <div className={`editor_alert ${styles.alert}`} data-alert-type={alertType} key={key}>
      <div data-alert-header="true">
        <span className={styles.header}>
          {createElement(ALERT_ICONS[alertType], { size: 16 })}
          <span>{locale.alert[alertType]}</span>
        </span>
      </div>
      <div data-alert-content="true">{children}</div>
    </div>
  );
}
