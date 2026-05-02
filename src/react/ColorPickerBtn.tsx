import { ActionIcon } from '@lobehub/ui';
import { ColorPicker } from 'antd';
import { $getPreviousSelection, $getSelection, $isRangeSelection } from 'lexical';
import { ChevronDownIcon } from 'lucide-react';
import { type CSSProperties, type FC, type MouseEvent, useCallback, useState } from 'react';

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

  const displayColor = value || lastUsedColor || defaultColor;

  const handleChange = (_: any, css: string) => {
    setLastUsedColor(css);
    onChange?.(css);
  };

  const handleApplyColor = useCallback(() => {
    const lexicalEditor = editor?.getLexicalEditor();
    if (!lexicalEditor) return;

    lexicalEditor.getEditorState().read(() => {
      const sel = $getSelection() || $getPreviousSelection();
      if (!$isRangeSelection(sel) || sel.isCollapsed()) return;
      onChange?.(displayColor);
    });
  }, [editor, onChange, displayColor]);

  const handleLeftMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      handleApplyColor();
      editor?.getLexicalEditor()?.getRootElement()?.focus({ preventScroll: true });
    },
    [handleApplyColor, editor],
  );

  const handleRightMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      editor?.getLexicalEditor()?.getRootElement()?.focus({ preventScroll: true });
    },
    [editor],
  );

  // Split button: left icon + color underline, right chevron opens ColorPicker
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        height: 36,
      }}
    >
      {/* Left: icon + color underline — click to apply current color */}
      <div
        onMouseDown={handleLeftMouseDown}
        style={{
          alignItems: 'center',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          paddingInline: 8,
        }}
      >
        {Icon ? (
          <ActionIcon
            active={active}
            icon={Icon}
            size={{ blockSize: 36, size: 20 }}
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
            backgroundColor: displayColor,
            borderRadius: 1,
            height: 2.5,
            marginTop: Icon ? 0 : 1,
            width: 16,
          }}
        />
      </div>

      {/* Right: chevron — opens ColorPicker */}
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
          onMouseDown={handleRightMouseDown}
          style={
            {
              alignItems: 'center',
              backgroundColor: value ? '#e6e6e6' : '#F5F5F5',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              padding: '4px 6px',
            } as CSSProperties
          }
        >
          <ChevronDownIcon color="#9CA3AF" size={14} />
        </div>
      </ColorPicker>
    </div>
  );
};

export default ColorPickerBtn;
