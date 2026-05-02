import { ActionIcon } from '@lobehub/ui';
import { ColorPicker } from 'antd';
import { $getPreviousSelection, $getSelection, $isRangeSelection } from 'lexical';
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

// Module-level storage shared across all ColorPickerBtn instances.
// Keyed by icon presence to separate text color ("A") from bg color (HighlighterIcon).
const lastUsedColors: Record<string, string | null> = {};

const ColorPickerBtn: FC<ColorPickerBtnProps> = ({
  active,
  defaultColor = '#000000',
  editor,
  icon: Icon,
  label,
  onChange,
  value,
}) => {
  const storageKey = Icon ? 'bg' : 'text';
  const [hovered, setHovered] = useState(false);

  const displayColor = value || lastUsedColors[storageKey] || defaultColor;
  // Color that left-click A applies (last picked, not the text's current color)
  const appliedColor = lastUsedColors[storageKey] || defaultColor;
  // Bg color: show gray placeholder underline when no color set
  const underlineColor = Icon && !lastUsedColors[storageKey] && !value ? '#D1D5DB' : appliedColor;

  const handleChange = (_: any, css: string) => {
    lastUsedColors[storageKey] = css;
    onChange?.(css);
  };

  const handleApplyColor = useCallback(() => {
    const lexicalEditor = editor?.getLexicalEditor();
    if (!lexicalEditor) return;

    lexicalEditor.getEditorState().read(() => {
      const sel = $getSelection() || $getPreviousSelection();
      if (!$isRangeSelection(sel) || sel.isCollapsed()) return;
      onChange?.(appliedColor);
    });
  }, [editor, onChange, appliedColor]);

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

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        alignItems: 'center',
        backgroundColor: hovered ? '#EAEAEA' : 'transparent',
        borderRadius: 6,
        display: 'flex',
        height: 36,
        paddingInline: 4,
        transition: 'background-color 100ms',
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
          paddingInline: 6,
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
          style={{
            alignItems: 'center',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            padding: '6px 4px',
          }}
        >
          <ChevronDownIcon color="#9CA3AF" size={12} />
        </div>
      </ColorPicker>
    </div>
  );
};

export default ColorPickerBtn;
