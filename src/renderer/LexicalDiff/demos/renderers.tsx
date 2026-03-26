import { LexicalDiff } from '@lobehub/editor/renderer';
import type { SerializedEditorState } from 'lexical';

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  margin: '0 auto',
  maxWidth: 980,
  overflow: 'hidden',
};

const panelStyle = {
  background: '#f8fafc',
  borderRadius: 10,
  minHeight: 64,
  padding: 12,
};

const labelStyle = {
  color: '#64748b',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.04em',
  marginBottom: 8,
  textTransform: 'uppercase' as const,
};

const oldValue = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Release Scope',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        tag: 'h2',
        type: 'heading',
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Ship the renderer after docs are ready.',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
} as unknown as SerializedEditorState;

const newValue = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Release Scope',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        tag: 'h2',
        type: 'heading',
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Renderer rollout checklist',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        tag: 'h3',
        type: 'heading',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
} as unknown as SerializedEditorState;

export default () => {
  return (
    <LexicalDiff
      blockRenderers={{
        'heading:h2': ({ renderDefaultNew, renderDefaultOld, row }) => ({
          new: (
            <div style={panelStyle}>
              <div style={labelStyle}>Typed Renderer ({row.kind})</div>
              {renderDefaultNew()}
            </div>
          ),
          old: (
            <div style={panelStyle}>
              <div style={labelStyle}>Typed Renderer ({row.kind})</div>
              {renderDefaultOld()}
            </div>
          ),
        }),
      }}
      labels={{ new: 'Patched', old: 'Base' }}
      newValue={newValue}
      oldValue={oldValue}
      renderBlockDiff={({ blockType, renderDefaultNew, renderDefaultOld, row }) => {
        if (blockType) return null;

        return {
          new: (
            <div
              style={{
                ...panelStyle,
                background: '#ecfeff',
                border: '1px solid #a5f3fc',
              }}
            >
              <div style={labelStyle}>Fallback Renderer ({row.kind})</div>
              {renderDefaultNew()}
            </div>
          ),
          old: (
            <div
              style={{
                ...panelStyle,
                background: '#fff7ed',
                border: '1px solid #fdba74',
              }}
            >
              <div style={labelStyle}>Fallback Renderer ({row.kind})</div>
              {renderDefaultOld()}
            </div>
          ),
        };
      }}
      style={cardStyle}
    />
  );
};
