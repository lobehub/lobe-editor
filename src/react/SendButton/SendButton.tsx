'use client';

import { Button, Icon } from '@lobehub/ui';
import { Dropdown, Space } from 'antd';
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
    onSend,
    onStop,
    disabled,
    onClick,
    ...rest
  }) => {
    const { cx, styles } = useStyles(size);

    if (generating)
      return (
        <Button
          className={cx(styles.loadingButton, className)}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onStop) onStop(e);
            if (onClick) onClick(e);
          }}
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
          className={cx(styles.button, disabled && styles.disabled, className)}
          disabled={disabled}
          icon={<SendIcon />}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onSend) onSend(e);
            if (onClick) onClick(e);
          }}
          shape={shape}
          style={style}
          type={type}
          {...rest}
        />
      );

    return (
      <Space.Compact
        className={cx(
          styles.dropdownButton,
          disabled && styles.disabled,
          shape === 'round' && styles.dropdownButtonRound,
          className,
        )}
        style={style}
        {...rest}
      >
        <Button
          className={cx(styles.button, disabled && styles.disabled, className)}
          disabled={disabled}
          icon={<SendIcon />}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onSend) onSend(e);
            if (onClick) onClick(e);
          }}
          shape={shape}
          style={style}
          type={type}
          {...rest}
        />
        <Dropdown menu={menu} placement={'topRight'} {...rest}>
          <Button
            className={cx(styles.button, disabled && styles.disabled, className)}
            disabled={disabled}
            icon={<Icon icon={ChevronDownIcon} />}
            shape={shape}
            style={{ cursor: 'pointer' }}
            type={type}
          />
        </Dropdown>
      </Space.Compact>
    );
  },
);

SendButton.displayName = 'SendButton';

export default SendButton;
