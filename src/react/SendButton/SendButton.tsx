'use client';

import { Button, Icon } from '@lobehub/ui';
import { Dropdown } from 'antd';
import { ChevronDownIcon } from 'lucide-react';
import { memo } from 'react';

import SendIcon from './components/SendIcon';
import StopIcon from './components/StopIcon';
import { useStyles } from './style';
import type { SendButtonProps } from './type';

const SendButton = memo<SendButtonProps>(
  ({
    type = 'primary',
    menu,
    className,
    style,
    loading,
    generating,
    size = 32,
    shape,
    ...rest
  }) => {
    const { cx, styles } = useStyles(size);

    if (generating)
      return (
        <Button
          className={cx(styles.loadingButton, className)}
          shape={shape}
          style={{
            ...style,
            width: menu ? size * 2 : size,
          }}
          {...rest}
        >
          <StopIcon size={size * 0.75} />
        </Button>
      );

    if (loading)
      return (
        <Button
          className={cx(styles.loadingButton, className)}
          disabled
          loading={loading}
          shape={shape}
          style={{
            ...style,
            width: menu ? size * 2 : size,
          }}
          type={type}
          {...rest}
        />
      );

    if (!menu)
      return (
        <Button
          className={cx(styles.button, className)}
          icon={<SendIcon />}
          shape={shape}
          style={style}
          type={type}
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
        menu={menu}
        placement={'topRight'}
        style={style}
        type={type}
        {...rest}
      >
        {!loading && <SendIcon />}
      </Dropdown.Button>
    );
  },
);

SendButton.displayName = 'SendButton';

export default SendButton;
