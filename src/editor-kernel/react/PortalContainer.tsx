import { LexicalEditor, LexicalNode } from 'lexical';
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface PortalContainerProps {
  children: React.ReactNode;
  className?: string;
  editor: LexicalEditor;
  node: LexicalNode;
  style?: React.CSSProperties;
}

export const LexicalPortalContainer = forwardRef<HTMLDivElement | null, PortalContainerProps>(
  ({ editor, node, children }, ref) => {
    const divRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => divRef.current as unknown as HTMLDivElement, []);

    useEffect(() => {
      return () => {
        if (divRef.current) {
          // @ts-expect-error not error
          delete divRef.current[`__lexicalKey_${editor._key}`];
        }
      };
    }, [editor, node]);

    return (
      <div
        ref={(dom) => {
          divRef.current = dom;
          if (dom) {
            const prop = `__lexicalKey_${editor._key}`;
            // @ts-expect-error not error
            dom[prop] = node.getKey();
          }
        }}
      >
        {children}
      </div>
    );
  },
);

LexicalPortalContainer.displayName = 'LexicalPortalContainer';

export default LexicalPortalContainer;
