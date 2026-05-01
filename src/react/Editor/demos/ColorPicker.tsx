import { ColorPicker } from 'antd';
import { type FC, type MouseEvent, useCallback } from 'react';

import type { IEditor } from '@/types';

const PRESETS = [
  {
    colors: [
      '#000000',
      '#ffffff',
      '#dc2626',
      '#ea580c',
      '#d97706',
      '#65a30d',
      '#059669',
      '#0891b2',
      '#2563eb',
      '#7c3aed',
      '#db2777',
      '#6b7280',
    ],
    label: 'Default',
  },
];

interface ColorPickerBtnProps {
  active?: boolean;
  editor?: IEditor;
  icon: any;
  label?: string;
  onChange?: (color: string) => void;
  value?: string;
}

const ColorPickerBtn: FC<ColorPickerBtnProps> = ({
  active,
  editor,
  icon: Icon,
  label,
  onChange,
  value,
}) => {
  const handleChange = (_: any, css: string) => {
    onChange?.(css);
  };

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // Prevent browser from clearing the native DOM Selection when clicking
      // outside the contentEditable editor. Without this, the visual selection
      // highlight disappears even though Lexical retains the selection internally.
      e.preventDefault();
      const lexicalEditor = editor?.getLexicalEditor();
      if (lexicalEditor) {
        lexicalEditor.getRootElement()?.focus({ preventScroll: true });
      }
    },
    [editor],
  );

  return (
    <ColorPicker
      allowClear
      format={'hex'}
      getPopupContainer={() => document.body}
      onChange={handleChange}
      presets={PRESETS}
      styles={{ popupOverlayInner: { zIndex: 10_000 } }}
      value={value || undefined}
    >
      <div
        onMouseDown={handleMouseDown}
        style={{
          alignItems: 'center',
          background: active ? 'var(--color-fill-secondary)' : undefined,
          borderRadius: 6,
          cursor: 'pointer',
          display: 'flex',
          height: 36,
          justifyContent: 'center',
          width: 36,
        }}
        title={label}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            position: 'relative',
          }}
        >
          <Icon size={20} strokeWidth={1.5} />
          {value && (
            <div
              style={{
                backgroundColor: value,
                borderRadius: 1,
                height: 3,
                width: 14,
              }}
            />
          )}
        </div>
      </div>
    </ColorPicker>
  );
};

export default ColorPickerBtn;
