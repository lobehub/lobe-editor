import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  KEY_DOWN_COMMAND,
  isModifierMatch,
} from 'lexical';
import { useLayoutEffect, useRef, useState } from 'react';
import * as React from 'react';

import { CONTROL_OR_META } from '@/common/sys';
import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import {
  $isLinkNode,
  $toggleLink,
  HOVER_LINK_COMMAND,
  HOVER_OUT_LINK_COMMAND,
  LinkAttributes,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from '../node/LinkNode';
import { LinkPlugin } from '../plugin';
import { getSelectedNode, sanitizeUrl } from '../utils';
import { EDIT_LINK_COMMAND, LinkEdit } from './edit';
import './index.less';
import { Toolbar } from './toolbar';

export interface ReactLinkPluginProps {
  attributes?: LinkAttributes;
  className?: string;
  validateUrl?: (url: string) => boolean;
}

export const ReactLinkPlugin: React.FC<ReactLinkPluginProps> = ({ validateUrl, attributes }) => {
  const [editor] = useLexicalComposerContext();
  const [linkNode, setLinkNode] = useState<LinkNode | null>(null);
  const state = useRef<{ isLink: boolean }>({ isLink: false });
  const divRef = React.useRef<HTMLDivElement>(null);
  const LinkRef = React.useRef<HTMLDivElement>(null);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout> | number>(-1);

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(LinkPlugin);
  }, []);

  useLexicalEditor((editor) => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        const selection = editor.read(() => $getSelection());
        if (!selection) return;
        if ($isRangeSelection(selection)) {
          // Update links
          editor.read(() => {
            const node = getSelectedNode(selection);
            const parent = node.getParent();
            const isLink = $isLinkNode(parent) || $isLinkNode(node);
            state.current.isLink = isLink;
            if (isLink) {
              const linkNode = $isLinkNode(parent) ? (parent as LinkNode) : (node as LinkNode);
              editor.dispatchCommand(EDIT_LINK_COMMAND, {
                linkNode,
                linkNodeDOM: editor.getElementByKey(linkNode.getKey()),
              });
            } else {
              editor.dispatchCommand(EDIT_LINK_COMMAND, {
                linkNode: null,
                linkNodeDOM: null,
              });
            }
          });
        } else {
          state.current.isLink = false;
        }
        if (divRef.current) {
          divRef.current.style.left = '-9999px';
          divRef.current.style.top = '-9999px';
        }
      }),
      editor.registerCommand(
        TOGGLE_LINK_COMMAND,
        (payload) => {
          if (payload === null) {
            $toggleLink(payload);
            return true;
          } else if (typeof payload === 'string') {
            if (validateUrl === undefined || validateUrl(payload)) {
              $toggleLink(payload, attributes);
              return true;
            }
            return false;
          } else {
            const { url, target, rel, title } = payload;
            $toggleLink(url, {
              ...attributes,
              rel,
              target,
              title,
            });
            return true;
          }
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (e) => {
          // ctrl + k / cmd + k
          if (isModifierMatch(e, CONTROL_OR_META) && 'KeyK' === e.code) {
            const isLink = state.current.isLink;
            e.preventDefault();
            e.stopPropagation();
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, isLink ? null : sanitizeUrl('https://'));
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        HOVER_LINK_COMMAND,
        (payload) => {
          if (!payload.event.target || divRef.current === null) {
            return false;
          }
          setLinkNode(payload.linkNode);
          computePosition(payload.event.target as HTMLElement, divRef.current, {
            middleware: [offset(5), flip(), shift()],
            placement: 'top-start',
          }).then(({ x, y }) => {
            if (!payload.event.target || divRef.current === null) {
              return false;
            }
            LinkRef.current = payload.event.target as HTMLDivElement;
            // const url = editor.read(() => payload.linkNode.getURL());
            divRef.current.style.left = `${x}px`;
            divRef.current.style.top = `${y}px`;
          });
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        HOVER_OUT_LINK_COMMAND,
        () => {
          clearTimeout(clearTimerRef.current);
          clearTimerRef.current = setTimeout(() => {
            if (divRef.current) {
              divRef.current.style.left = '-9999px';
              divRef.current.style.top = '-9999px';
            }
          }, 300);
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, []);

  return (
    <>
      <div
        className="editor_linkPlugin"
        onMouseEnter={() => {
          clearTimeout(clearTimerRef.current);
        }}
        ref={divRef}
      >
        <Toolbar editor={editor.getLexicalEditor()!} linkNode={linkNode} />
      </div>
      <LinkEdit />
    </>
  );
};
