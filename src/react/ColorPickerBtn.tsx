import { ActionIcon } from '@lobehub/ui';
import { ColorPicker } from 'antd';
import { $getPreviousSelection, $getSelection, $isRangeSelection } from 'lexical';
import { ChevronDownIcon } from 'lucide-react';
import { type CSSProperties, type FC, type MouseEvent, useCallback } from 'react';

import type { IEditor } from '@/types';

const DEFAULT_COLOR = '#000000';

let lastUsedColor: string | null = null;

const PRESETS = [
  {
    colors: [
      DEFAULT_COLOR,
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
  icon?: any;
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
  const displayColor = value || lastUsedColor || DEFAULT_COLOR;

  const handleChange = (_: any, css: string) => {
    lastUsedColor = css;
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

  // Background color: keep ActionIcon inside ColorPicker
  if (Icon) {
    return (
      <ColorPicker
        format={'hex'}
        getPopupContainer={() => document.body}
        onChange={handleChange}
        presets={PRESETS}
        styles={{ popupOverlayInner: { zIndex: 10_000 } }}
        value={displayColor}
      >
        <div onMouseDown={handleMouseDown} style={{ position: 'relative' }}>
          <ActionIcon
            active={active}
            icon={Icon}
            size={{ blockSize: 36, size: 20 }}
            title={label}
          />
          <div
            style={{
              backgroundColor: displayColor,
              borderRadius: 1,
              bottom: 3,
              height: 3,
              left: '50%',
              position: 'absolute',
              transform: 'translateX(-50%)',
              width: 14,
            }}
          />
        </div>
      </ColorPicker>
    );
  }

  // Text color: split button — left A applies color, right chevron opens picker
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        height: 36,
      }}
    >
      {/* Left: A letter + color underline — click to apply current color */}
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
        <span style={{ color: '#374151', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>A</span>
        <div
          style={{
            backgroundColor: displayColor,
            borderRadius: 1,
            height: 2.5,
            marginTop: 1,
            width: 16,
          }}
        />
      </div>

      {/* Right: chevron — opens ColorPicker */}
      <ColorPicker
        format={'hex'}
        getPopupContainer={() => document.body}
        onChange={handleChange}
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
