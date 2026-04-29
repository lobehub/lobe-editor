'use client';

import type { LexicalEditor } from 'lexical';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';

import { Meta2dNode } from '../node';
import { Meta2dPlugin } from '../plugin';
import { DiagramEditor } from './DiagramEditor';
import { DiagramPreview } from './DiagramPreview';

export interface ReactMeta2dPluginProps {
  className?: string;
  theme?: {
    meta2d?: string;
  };
}

function Meta2dDecorator({
  className,
  editor: lexicalEditor,
  node,
}: {
  className?: string;
  editor: LexicalEditor;
  node: Meta2dNode;
}) {
  const [editing, setEditing] = useState(false);
  const diagram = node.__diagram;
  const svg = node.__svg;

  useEffect(() => {
    if (!svg) {
      setEditing(true);
    }
  }, [svg]);

  const handleDelete = useCallback(() => {
    lexicalEditor.update(() => {
      const latest = node.getLatest();
      const next = latest.getNextSibling();
      const prev = latest.getPreviousSibling();
      latest.remove();
      if (next) {
        next.selectStart();
        return;
      }
      if (prev) {
        prev.selectEnd();
      }
    });
  }, [lexicalEditor, node]);

  const handleSave = useCallback(
    (newDiagram: string, newSvg: string) => {
      lexicalEditor.update(() => {
        node.updateDiagram(newDiagram, newSvg);
      });
      setEditing(false);
    },
    [lexicalEditor, node],
  );

  const handleSvgReady = useCallback(
    (newSvg: string) => {
      lexicalEditor.update(() => {
        node.updateDiagram(node.__diagram, newSvg);
      });
    },
    [lexicalEditor, node],
  );

  return (
    <div className={className} style={{ margin: 0 }}>
      <DiagramPreview
        diagram={diagram}
        onDelete={handleDelete}
        onEdit={() => setEditing(true)}
        onSvgReady={handleSvgReady}
        svg={svg}
      />
      {editing && (
        <DiagramEditor diagram={diagram} onClose={() => setEditing(false)} onSave={handleSave} />
      )}
    </div>
  );
}

export function ReactMeta2dPlugin({ className, theme }: ReactMeta2dPluginProps) {
  const [editor] = useLexicalComposerContext();

  const decorator = useCallback(
    (node: Meta2dNode, lexicalEditor: LexicalEditor) => {
      return <Meta2dDecorator className={className} editor={lexicalEditor} node={node} />;
    },
    [className],
  );

  useLayoutEffect(() => {
    editor.registerPlugin(Meta2dPlugin, {
      decorator,
      theme,
    });
  }, [decorator, editor, theme]);

  return null;
}
