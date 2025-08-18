import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { mergeRegister } from '@lexical/utils';
import { Icon, Input } from '@lobehub/ui';
import type { InputRef } from 'antd';
import {
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_NORMAL,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  createCommand,
} from 'lexical';
import { LinkIcon } from 'lucide-react';
import {
  type ChangeEvent,
  type FC,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useLexicalComposerContext, useLexicalEditor } from '@/editor-kernel/react';

import { LinkNode } from '../../node/LinkNode';
import { useStyles } from '../style';

export const EDIT_LINK_COMMAND = createCommand<{
  linkNode: LinkNode | null;
  linkNodeDOM: HTMLElement | null;
}>();

export const LinkEdit: FC = () => {
  const divRef = useRef<HTMLDivElement>(null);
  const linkNodeRef = useRef<LinkNode | null>(null);
  const linkInputRef = useRef<InputRef | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDom, setLinkDom] = useState<HTMLElement | null>(null);
  const [editor] = useLexicalComposerContext();
  const { styles, theme } = useStyles();

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

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const lexicalEditor = editor.getLexicalEditor();
      if (!linkNodeRef.current || !linkInputRef.current || !lexicalEditor) {
        return;
      }

      const linkNode = linkNodeRef.current;
      const input = linkInputRef.current;
      const inputDOM = input.input as HTMLInputElement;
      if (event.key === 'Enter') {
        event.preventDefault();
        const currentURL = lexicalEditor.read(() => linkNode.getURL());
        if (currentURL !== inputDOM.value) {
          lexicalEditor.update(() => {
            linkNode.setURL(inputDOM.value);
            lexicalEditor.focus();
          });
        } else {
          lexicalEditor.focus();
        }
        return;
      } else if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault();
        lexicalEditor.focus();
        return;
      }
    },
    [linkNodeRef, linkInputRef],
  );

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
          linkNodeRef.current = payload.linkNode;
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
          linkNodeRef.current = null;
          setLinkUrl('');
          setLinkDom(null);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (payload) => {
          if (linkNodeRef.current && linkInputRef.current) {
            payload.stopImmediatePropagation();
            payload.preventDefault();
            linkInputRef.current.focus();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, []);

  return (
    <div className={styles.editor_linkEdit} ref={divRef}>
      <Input
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          // Handle link URL change
          setLinkUrl(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder="https://enter-link-url"
        prefix={<Icon color={theme.colorTextDescription} icon={LinkIcon} />}
        ref={linkInputRef}
        shadow
        style={{ background: theme.colorBgElevated, maxWidth: '100%', minWidth: 240 }}
        value={linkUrl}
        variant={'outlined'}
      />
    </div>
  );
};
