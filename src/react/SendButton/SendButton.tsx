'use client';

import { Icon } from '@lobehub/ui';
import { Button, Dropdown } from 'antd';
import { ChevronDownIcon } from 'lucide-react';
import { memo } from 'react';

import SendIcon from './components/SendIcon';
import { useStyles } from './style';
import type { SendButtonProps } from './type';

const SendButton = memo<SendButtonProps>(
  ({ type = 'primary', menu, className, style, loading, size = 32, shape, ...rest }) => {
    const { cx, styles } = useStyles(size);

    if (!menu)
      return (
        <Button
          className={cx(styles.button, className)}
          icon={<SendIcon />}
          loading={loading}
          shape={shape}
          style={style}
          type={loading ? 'default' : type}
          {...rest}
        />
      );

    return (
      <Dropdown.Button
        className={cx(
          styles.dropdownButton,
          shape === 'round' && styles.dropdownButtonRound,
          className,
        )}
        icon={<Icon icon={ChevronDownIcon} />}
        loading={loading}
        menu={menu}
        placement={'topRight'}
        style={style}
        type={loading ? 'default' : type}
        {...rest}
      >
        {!loading && <SendIcon />}
      </Dropdown.Button>
    );
  },
);

SendButton.displayName = 'SendButton';

export default SendButton;
