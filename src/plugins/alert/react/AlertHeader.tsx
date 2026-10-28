'use client';

import { DropdownMenu, type DropdownMenuProps, Icon } from '@lobehub/ui';
import type { NodeKey } from 'lexical';
import { ChevronDownIcon } from 'lucide-react';
import { type FC, useMemo } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { UPDATE_ALERT_COMMAND } from '../command';
import { ALERT_TYPES, type AlertType } from '../node/AlertNode';
import { ALERT_ICONS } from './icons';
import { styles } from './style';

interface AlertHeaderProps {
  alertType: AlertType;
  editable: boolean;
  nodeKey: NodeKey;
}

const AlertHeader: FC<AlertHeaderProps> = ({ alertType, editable, nodeKey }) => {
  const [editor] = useLexicalComposerContext();
  const t = useTranslation();

  const items = useMemo<DropdownMenuProps['items']>(
    () =>
      ALERT_TYPES.map((type) => ({
        icon: ALERT_ICONS[type],
        key: type,
        label: t(`alert.${type}`),
        onClick: () => {
          editor.dispatchCommand(UPDATE_ALERT_COMMAND, { alertType: type, nodeKey });
        },
      })),
    [editor, nodeKey, t],
  );

  const label = (
    <>
      <Icon icon={ALERT_ICONS[alertType]} size={16} />
      <span>{t(`alert.${alertType}`)}</span>
    </>
  );

  if (!editable) {
    return <span className={styles.header}>{label}</span>;
  }

  return (
    <DropdownMenu items={items}>
      <button
        aria-label={t('alert.changeType')}
        className={styles.header}
        data-editable="true"
        onMouseDown={(event) => event.preventDefault()}
        type="button"
      >
        {label}
        <Icon icon={ChevronDownIcon} size={12} />
      </button>
    </DropdownMenu>
  );
};

AlertHeader.displayName = 'AlertHeader';

export default AlertHeader;
