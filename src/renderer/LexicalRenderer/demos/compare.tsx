import {
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactFilePlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactLiteXmlPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
  ReactVirtualBlockPlugin,
} from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { LexicalRenderer, loadLanguage } from '@lobehub/editor/renderer';
import type { SerializedEditorState } from 'lexical';
import { useEffect, useState } from 'react';

import fixture from './fixture.json';
import mermaid from './mermaid.json';
import paperParagraph from './paperParagraph.json';

type SampleKey = 'fixture' | 'paper' | 'mermaid';

const samples: Record<SampleKey, SerializedEditorState> = {
  fixture: fixture as unknown as SerializedEditorState,
  mermaid: mermaid as unknown as SerializedEditorState,
  paper: paperParagraph as unknown as SerializedEditorState,
};

// Preload languages used in the fixture
const preloadLanguages = async () => {
  await loadLanguage('typescript');
};
void preloadLanguages();

type Variant = 'default' | 'chat';
type View = 'side' | 'editor' | 'renderer';

const btnStyle = (active: boolean) => ({
  background: active ? '#1677ff' : '#f5f5f5',
  border: 'none',
  borderRadius: 6,
  color: active ? '#fff' : '#333',
  cursor: 'pointer' as const,
  fontSize: 13,
  padding: '6px 16px',
});

export default () => {
  const editor = useEditor();
  const [tab, setTab] = useState<View>('side');
  const [variant, setVariant] = useState<Variant>('default');
  const [sample, setSample] = useState<SampleKey>('fixture');
  const sharedData = samples[sample];

  useEffect(() => {
    editor.setDocument('json', sharedData as any);
  }, [editor, sharedData]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['side', 'editor', 'renderer'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={btnStyle(tab === t)} type="button">
              {t === 'side' ? 'Side by Side' : t === 'editor' ? 'Editor Only' : 'Renderer Only'}
            </button>
          ))}
        </div>
        <div style={{ borderLeft: '1px solid #e8e8e8', display: 'flex', gap: 4, paddingLeft: 16 }}>
          {(['default', 'chat'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              style={btnStyle(variant === v)}
              type="button"
            >
              {v}
            </button>
          ))}
        </div>
        <div style={{ borderLeft: '1px solid #e8e8e8', display: 'flex', gap: 4, paddingLeft: 16 }}>
          {(['fixture', 'paper', 'mermaid'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSample(s)}
              style={btnStyle(sample === s)}
              type="button"
            >
              {s === 'fixture'
                ? 'Full fixture'
                : s === 'paper'
                  ? 'Paper + code paragraph'
                  : 'Mermaid sample'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {(tab === 'side' || tab === 'editor') && (
          <div
            style={{
              border: '1px solid #e8e8e8',
              borderRadius: 8,
              flex: 1,
              minWidth: 0,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                background: '#f5f5f5',
                borderBottom: '1px solid #e8e8e8',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 16px',
              }}
            >
              {'Editor (editable=false)  —  variant=' + variant + '  —  sample=' + sample}
            </div>
            <div style={{ padding: 16 }}>
              <Editor
                content={sharedData as any}
                editable={false}
                editor={editor}
                plugins={[
                  ReactLiteXmlPlugin,
                  ReactListPlugin,
                  ReactLinkPlugin,
                  ReactImagePlugin,
                  ReactVirtualBlockPlugin,
                  ReactCodemirrorPlugin,
                  ReactHRPlugin,
                  ReactTablePlugin,
                  ReactMathPlugin,
                  ReactCodePlugin,
                  ReactFilePlugin,
                ]}
                variant={variant}
              />
            </div>
          </div>
        )}

        {(tab === 'side' || tab === 'renderer') && (
          <div
            style={{
              border: '1px solid #e8e8e8',
              borderRadius: 8,
              flex: 1,
              minWidth: 0,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                background: '#f0f5ff',
                borderBottom: '1px solid #e8e8e8',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 16px',
              }}
            >
              {'LexicalRenderer (headless)  —  variant=' + variant + '  —  sample=' + sample}
            </div>
            <LexicalRenderer style={{ padding: 16 }} value={sharedData} variant={variant} />
          </div>
        )}
      </div>
    </div>
  );
};
