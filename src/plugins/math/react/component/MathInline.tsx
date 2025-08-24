import { addClassNamesToElement, removeClassNamesFromElement } from '@lexical/utils';
import Katex from 'katex';
import { CLICK_COMMAND, COMMAND_PRIORITY_NORMAL, LexicalEditor } from 'lexical';
import { FC, useEffect, useRef } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { MathBlockNode, MathInlineNode } from '../../node';

export interface MathInlineProps {
  className?: string;
  editor: LexicalEditor;
  node: MathInlineNode | MathBlockNode;
}

export const MathInline: FC<MathInlineProps> = ({ editor, node, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());

  useEffect(() => {
    if (ref.current && node.code) {
      Katex.render(node.code, ref.current, {
        throwOnError: false,
      });
    }
  }, [node.code]);

  useEffect(() => {
    const parent = editor.getElementByKey(node.getKey());
    if (parent) {
      if (isSelected) {
        addClassNamesToElement(parent, 'selected');
      } else {
        removeClassNamesFromElement(parent, 'selected');
      }
    }
  }, [isSelected]);

  useLexicalEditor((editor) => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (payload) => {
        console.info(payload, payload.target, ref.current);
        if (
          payload.target &&
          payload.target instanceof Node &&
          ref.current?.contains(payload.target)
        ) {
          setSelected(true);
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, []);

  return (
    <span className={className} ref={ref}>
      {node.code ? node.code : 'type your math expression'}
    </span>
  );
};
