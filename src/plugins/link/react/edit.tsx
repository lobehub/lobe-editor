import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { mergeRegister } from '@lexical/utils';
import { Input } from '@lobehub/ui';
import { COMMAND_PRIORITY_EDITOR, KEY_ESCAPE_COMMAND, createCommand } from 'lexical';
import type { ChangeEvent, FC } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';

import { LinkNode } from '../node/LinkNode';

export const EDIT_LINK_COMMAND = createCommand<{
  linkNode: LinkNode | null;
  linkNodeDOM: HTMLElement | null;
}>();

export const LinkEdit: FC = () => {
  const divRef = useRef<HTMLDivElement>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDom, setLinkDom] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!linkDom || !divRef.current) {
      return;
    }
    computePosition(linkDom, divRef.current, {
      middleware: [offset(8), flip(), shift()],
      placement: 'bottom-start',
    }).then(({ x, y }) => {
      if (divRef.current) {
        divRef.current.style.left = `${x}px`;
        divRef.current.style.top = `${y}px`;
      }
    });
  }, [linkDom]);

  useLexicalEditor((editor) => {
    return mergeRegister(
      editor.registerCommand(
        EDIT_LINK_COMMAND,
        (payload) => {
          if (!payload.linkNode || !payload.linkNodeDOM) {
            setLinkDom(null);
            setLinkUrl('');
            if (divRef.current) {
              divRef.current.style.left = '-9999px';
              divRef.current.style.top = '-9999px';
            }
            return false;
          }
          setLinkUrl(payload.linkNode.getURL());
          setLinkDom(payload.linkNodeDOM);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (divRef.current) {
            divRef.current.style.left = '-9999px';
            divRef.current.style.top = '-9999px';
          }
          setLinkUrl('');
          setLinkDom(null);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, []);

  return (
    <div className="editor_linkEdit" ref={divRef}>
      <Input
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          // Handle link URL change
          console.log('Link URL changed:', e.target.value);
          setLinkUrl(e.target.value);
        }}
        placeholder="Enter link URL"
        style={{ width: '100%' }}
        value={linkUrl}
      />
    </div>
  );
};
