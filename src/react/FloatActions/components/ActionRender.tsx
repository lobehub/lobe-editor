import { ActionIcon } from '@lobehub/ui';
import { Divider } from 'antd';
import { type FC, isValidElement } from 'react';

import { styles } from '../style';
import type { ActionItem, FloatActionsItem, FloatActionsProps } from '../type';

interface ActionRenderProps {
  disabled?: boolean;
  item: FloatActionsItem;
  onActionClick: FloatActionsProps['onActionClick'];
}

const ActionRender: FC<ActionRenderProps> = ({ item, onActionClick, disabled }) => {
  if (item.type === 'divider') {
    return <Divider className={styles.divider} orientation={'vertical'} />;
  }

  const { wrapper, icon, key, label, onClick, danger, loading, active, tooltipProps, ...itemRest } =
    item as ActionItem;

  if (item.children && isValidElement(item.children)) {
    if (!wrapper) return item.children;
    return wrapper(item.children);
  }

  const action = (
    <ActionIcon
      active={active}
      danger={danger}
      disabled={disabled || loading || itemRest?.disabled}
      icon={icon}
      loading={loading}
      onClick={(e) => {
        onActionClick?.({
          domEvent: e,
          key: String(key),
          keyPath: [String(key)],
        });
        onClick?.(e as any);
      }}
      size={{
        blockSize: 36,
        size: 20,
      }}
      title={label}
      tooltipProps={{
        placement: 'top',
        ...tooltipProps,
      }}
    />
  );

  if (!wrapper) return action;
  return wrapper(action);
};

export default ActionRender;
