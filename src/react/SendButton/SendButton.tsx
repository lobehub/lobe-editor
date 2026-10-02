'use client';

import { Button, SplitButton } from '@lobehub/ui/base-ui';
import { cx } from 'antd-style';
import { type FC, type MouseEvent, useMemo } from 'react';

import SendIcon from './components/SendIcon';
import StopIcon from './components/StopIcon';
import { styles } from './style';
import type { SendButtonProps } from './type';

const SendButton: FC<SendButtonProps> = ({
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
  placement = 'topRight',
  trigger,
  title,
}) => {
  const cssVariables = useMemo<Record<string, string>>(
    () => ({
      '--send-button-size': `${size}px`,
    }),
    [size],
  );

  const handleSend = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onSend?.(e);
    onClick?.(e);
  };

  if (generating)
    return (
      <Button
        className={cx(styles.loadingButton, className)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onStop?.(e);
          onClick?.(e);
        }}
        shape={shape}
        style={{
          ...cssVariables,
          ...style,
          width: menu ? size * 2 : size,
        }}
        title={title}
        type={'fill'}
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
          ...cssVariables,
          ...style,
          width: menu ? size * 2 : size,
        }}
        title={title}
        type={type}
      />
    );

  if (!menu)
    return (
      <Button
        className={cx(styles.button, disabled && styles.disabled, className)}
        disabled={disabled}
        icon={<SendIcon />}
        onClick={handleSend}
        shape={shape}
        style={{
          ...cssVariables,
          ...style,
        }}
        title={title}
        type={type}
      />
    );

  return (
    <SplitButton
      className={cx(
        styles.splitButton,
        disabled && styles.splitButtonDisabled,
        shape === 'round' && styles.splitButtonRound,
        className,
      )}
      disabled={disabled}
      style={{
        ...cssVariables,
        ...style,
      }}
      type={type}
    >
      <SplitButton.Main icon={<SendIcon />} onClick={handleSend} title={title} />
      <SplitButton.Menu items={menu.items} placement={placement} trigger={trigger} />
    </SplitButton>
  );
};

SendButton.displayName = 'SendButton';

export default SendButton;
