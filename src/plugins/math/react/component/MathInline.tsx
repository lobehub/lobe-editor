import Katex from 'katex';
import { LexicalEditor } from 'lexical';
import { FC, useEffect, useRef } from 'react';

import { MathInlineNode } from '../../node';

export interface MathInlineProps {
  className?: string;
  editor: LexicalEditor;
  node: MathInlineNode;
}

export const MathInline: FC<MathInlineProps> = ({ node, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      Katex.render(node.code, ref.current, {
        throwOnError: false,
      });
    }
  }, [node.code]);

  return (
    <span className={className} ref={ref}>
      {node.code}
    </span>
  );
};
