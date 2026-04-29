'use client';

import { $isHeadingNode } from '@lexical/rich-text';
import {
  $createNodeSelection,
  $getRoot,
  $isElementNode,
  $setSelection,
  LexicalEditor,
} from 'lexical';
import { type FC, useCallback, useEffect, useState } from 'react';

import { noop } from '@/editor-kernel/utils';
import type { IEditor } from '@/types';

interface HeadingItem {
  key: string;
  level: number;
  text: string; // 1-6
}

interface OutlinePanelProps {
  editor: IEditor;
}

const OutlinePanel: FC<OutlinePanelProps> = ({ editor }) => {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  const $buildHeadings = useCallback(() => {
    const items: HeadingItem[] = [];
    const root = $getRoot();

    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if ($isHeadingNode(node)) {
          const text = node.getTextContent().trim();
          if (text) {
            items.push({
              key: node.getKey(),
              level: parseInt(node.getTag()[1], 10),
              text,
            });
          }
        }
        if ($isElementNode(node)) {
          const children = node.getChildren();
          if (children.length > 0) {
            walk(children);
          }
        }
      }
    };
    walk(root.getChildren());

    setHeadings(items);
  }, []);

  useEffect(() => {
    const lexicalEditor = editor.getLexicalEditor();
    let cleanup: () => void = noop;

    const handleLexicalEditor = (lexicalEditor: LexicalEditor) => {
      cleanup = lexicalEditor.registerUpdateListener(({ editorState }) => {
        editorState.read($buildHeadings);
      });
      lexicalEditor.getEditorState().read($buildHeadings);
      return cleanup;
    };

    if (lexicalEditor) {
      return handleLexicalEditor(lexicalEditor);
    }

    editor.on('initialized', handleLexicalEditor as any);
    return () => {
      cleanup();
      editor.off('initialized', handleLexicalEditor as any);
    };
  }, [editor, $buildHeadings]);

  const handleClick = useCallback(
    (key: string) => {
      const lexicalEditor = editor.getLexicalEditor();
      if (!lexicalEditor) return;

      lexicalEditor.update(() => {
        const selection = $createNodeSelection();
        selection.add(key);
        $setSelection(selection);
      });

      requestAnimationFrame(() => {
        const element = lexicalEditor.getElementByKey(key);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    },
    [editor],
  );

  if (headings.length === 0) return null;

  return (
    <div>
      <div
        style={{
          color: 'rgba(0,0,0,0.45)',
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        OUTLINE
      </div>
      {headings.map((h) => (
        <div
          key={h.key}
          onClick={() => handleClick(h.key)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          style={{
            borderRadius: 4,
            color: 'rgba(0,0,0,0.75)',
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: '28px',
            overflow: 'hidden',
            paddingLeft: (h.level - 1) * 16 + 8,
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {h.text}
        </div>
      ))}
    </div>
  );
};

export default OutlinePanel;
