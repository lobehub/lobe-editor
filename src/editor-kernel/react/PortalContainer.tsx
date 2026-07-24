import type { LexicalEditor, LexicalNode } from 'lexical';
import React, { useEffect, useImperativeHandle, useRef } from 'react';

export interface PortalContainerProps {
  children: React.ReactNode;
  className?: string;
  editor: LexicalEditor;
  node: LexicalNode;
  style?: React.CSSProperties;
}

export const LexicalPortalContainer = ({
  ref,
  editor,
  node,
  children,
}: PortalContainerProps & { ref?: React.RefObject<HTMLDivElement | null | null> }) => {
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
};

LexicalPortalContainer.displayName = 'LexicalPortalContainer';

export default LexicalPortalContainer;
