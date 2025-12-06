'use client';

import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';
import useMergeState from 'use-merge-value';

import ActionItem from './components/ActionItem';
import { useStyles } from './style';
import type { FloatActionsProps } from './type';

const FloatActions = memo<FloatActionsProps>(
  ({
    gap = 2,
    disabled,
    items = [],
    onActionClick,
    className,
    defaultGroupCollapse = false,
    onGroupCollapseChange,
    groupCollapse,
    ...rest
  }) => {
    const { cx, styles } = useStyles();
    const [groupCollapsed, setGroupCollapsed] = useMergeState(defaultGroupCollapse, {
      defaultValue: defaultGroupCollapse,
      onChange: onGroupCollapseChange,
      value: groupCollapse,
    });

    return (
      <Flexbox
        align={'center'}
        className={cx(styles.container, className)}
        flex={1}
        gap={gap}
        horizontal
        {...rest}
      >
        {items.map((item: any, index) => (
          <ActionItem
            disabled={disabled}
            gap={gap}
            groupCollapsed={groupCollapsed}
            item={item}
            key={item.key || index}
            onActionClick={onActionClick}
            setGroupCollapsed={setGroupCollapsed}
          />
        ))}
      </Flexbox>
    );
  },
);

FloatActions.displayName = 'FloatActions';

export default FloatActions;
