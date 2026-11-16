import { cx } from '@lobehub/ui';
import {
  type FC,
  type InputHTMLAttributes,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { styles } from './style';

export interface CommitInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> {
  isValid?: (value: string) => boolean;
  onCommit: (value: string) => void;
  value: string;
}

const CommitInput: FC<CommitInputProps> = ({
  className,
  isValid,
  onCommit,
  onKeyDown,
  value,
  ...props
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!invalid) return;
    const timer = setTimeout(() => setInvalid(false), 600);
    return () => clearTimeout(timer);
  }, [invalid]);

  const commit = () => {
    const next = draft;
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (next === null || next === value) return;
    if (isValid && !isValid(next)) {
      setInvalid(true);
      return;
    }
    onCommit(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      cancelled.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(styles.input, invalid && styles.inputInvalid, className)}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setDraft(value)}
      onKeyDown={handleKeyDown}
      value={draft ?? value}
    />
  );
};

export default CommitInput;
