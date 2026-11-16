'use client';

import { Button, Flexbox, TextArea } from '@lobehub/ui';
import { isModifierMatch } from 'lexical';
import { type FC, type KeyboardEvent, useCallback, useEffect, useRef } from 'react';

import { CONTROL_OR_META } from '@/common/sys';

import { styles } from '../style';

const ISOLATED_EVENTS = [
  'beforeinput',
  'compositionend',
  'compositionstart',
  'copy',
  'cut',
  'drop',
  'input',
  'keydown',
  'keyup',
  'paste',
] as const;

export interface ChartSourceEditorProps {
  applyText: string;
  cancelText: string;
  error?: string;
  onApply: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  value: string;
}

const ChartSourceEditor: FC<ChartSourceEditorProps> = ({
  applyText,
  cancelText,
  error,
  onApply,
  onCancel,
  onChange,
  value,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Lexical listens on the root element and skips events already flagged as handled;
    // stopPropagation would also hide them from React's root listener.
    const markHandled = (event: Event) => {
      (event as Event & { _lexicalHandled?: boolean })._lexicalHandled = true;
    };
    for (const name of ISOLATED_EVENTS) container.addEventListener(name, markHandled);
    return () => {
      for (const name of ISOLATED_EVENTS) container.removeEventListener(name, markHandled);
    };
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && isModifierMatch(event.nativeEvent, CONTROL_OR_META)) {
        event.preventDefault();
        onApply();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    },
    [onApply, onCancel],
  );

  return (
    <div className={styles.sourceEditor} ref={containerRef}>
      <TextArea
        autoFocus
        autoSize={{ maxRows: 24, minRows: 6 }}
        className={styles.sourceTextArea}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        value={value}
        variant={'borderless'}
      />
      {error && (
        <div className={styles.errorMessage} role="alert">
          {error}
        </div>
      )}
      <Flexbox gap={8} horizontal justify={'flex-end'}>
        <Button onClick={onCancel} size={'small'}>
          {cancelText}
        </Button>
        <Button onClick={onApply} size={'small'} type={'primary'}>
          {applyText}
        </Button>
      </Flexbox>
    </div>
  );
};

ChartSourceEditor.displayName = 'ChartSourceEditor';

export default ChartSourceEditor;
