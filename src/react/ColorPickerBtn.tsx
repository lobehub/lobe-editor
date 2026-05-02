import { ActionIcon } from '@lobehub/ui';
import { ColorPicker } from 'antd';
import { ChevronDownIcon } from 'lucide-react';
import { type FC, type MouseEvent, useCallback, useState } from 'react';

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
  defaultColor?: string;
  editor?: IEditor;
  icon?: any;
  label?: string;
  onChange?: (color: string) => void;
  value?: string;
}

const ColorPickerBtn: FC<ColorPickerBtnProps> = ({
  active,
  defaultColor = '#000000',
  editor,
  icon: Icon,
  label,
  onChange,
  value,
}) => {
  const [lastUsedColor, setLastUsedColor] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const displayColor = value || lastUsedColor || defaultColor;
  // Bg color: show gray placeholder underline when no color set
  const underlineColor = Icon && !value && !lastUsedColor ? '#D1D5DB' : displayColor;

  const handleChange = (_: any, css: string) => {
    setLastUsedColor(css);
    onChange?.(css);
  };

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      editor?.getLexicalEditor()?.getRootElement()?.focus({ preventScroll: true });
    },
    [editor],
  );

  return (
    <ColorPicker
      format={'hex'}
      getPopupContainer={() => document.body}
      onChange={handleChange}
      panelRender={(_, { components: { Picker, Presets } }) => (
        <div>
          <Presets />
          <div
            style={{
              borderTop: '1px solid rgba(5, 5, 5, 0.06)',
              margin: '8px 0',
            }}
          />
          <Picker />
        </div>
      )}
      presets={PRESETS}
      styles={{ popupOverlayInner: { zIndex: 10_000 } }}
      value={displayColor}
    >
      <div
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          alignItems: 'center',
          backgroundColor: hovered ? '#EAEAEA' : 'transparent',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'flex',
          gap: 2,
          height: 36,
          paddingInline: 8,
          transition: 'background-color 100ms',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {Icon ? (
            <ActionIcon
              active={active}
              icon={Icon}
              size={{ blockSize: 28, size: 18 }}
              title={label}
            />
          ) : (
            <span
              style={{
                color: 'rgba(0, 0, 0, 0.45)',
                fontSize: 18,
                fontWeight: 500,
                lineHeight: 1.2,
              }}
            >
              A
            </span>
          )}
          <div
            style={{
              backgroundColor: underlineColor,
              borderRadius: 1,
              height: 2.5,
              marginTop: Icon ? -2 : 1,
              width: 16,
            }}
          />
        </div>
        <ChevronDownIcon color="#9CA3AF" size={12} />
      </div>
    </ColorPicker>
  );
};

export default ColorPickerBtn;
