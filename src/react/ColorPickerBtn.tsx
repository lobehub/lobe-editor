import { ActionIcon } from '@lobehub/ui';
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

export interface ColorPickerBtnProps {
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
      <div onMouseDown={handleMouseDown} style={{ position: 'relative' }}>
        <ActionIcon active={active} icon={Icon} size={{ blockSize: 36, size: 20 }} title={label} />
        {value && (
          <div
            style={{
              backgroundColor: value,
              borderRadius: 1,
              bottom: 3,
              height: 3,
              left: '50%',
              position: 'absolute',
              transform: 'translateX(-50%)',
              width: 14,
            }}
          />
        )}
      </div>
    </ColorPicker>
  );
};

export default ColorPickerBtn;
