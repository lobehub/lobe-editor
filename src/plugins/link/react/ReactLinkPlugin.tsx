'use client';

import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { mergeRegister } from '@lexical/utils';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL } from 'lexical';
import { type FC, useLayoutEffect, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { MarkdownPlugin } from '@/plugins/markdown';

import {
  $isLinkNode,
  HOVER_LINK_COMMAND,
  HOVER_OUT_LINK_COMMAND,
  LinkNode,
} from '../node/LinkNode';
import { LinkPlugin } from '../plugin';
import { getSelectedNode } from '../utils';
import LinkEdit, { EDIT_LINK_COMMAND } from './components/LinkEdit';
import LinkToolbar from './components/LinkToolbar';
import { useStyles } from './style';
import { ReactLinkPluginProps } from './type';

export const ReactLinkPlugin: FC<ReactLinkPluginProps> = ({
  theme,
  enableHotkey = true,
  validateUrl,
  attributes,
}) => {
  const [editor] = useLexicalComposerContext();
  const [linkNode, setLinkNode] = useState<LinkNode | null>(null);
  const state = useRef<{ isLink: boolean }>({ isLink: false });
  const divRef = useRef<HTMLDivElement>(null);
  const LinkRef = useRef<HTMLDivElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | number>(-1);
  const { styles } = useStyles();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(LinkPlugin, {
      attributes,
      enableHotkey,
      theme: theme || styles,
      validateUrl,
    });
  }, [attributes, enableHotkey, styles, theme, validateUrl]);

  useLexicalEditor((editor) => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        const selection = editor.read(() => $getSelection());
        if (!selection) return;
        if ($isRangeSelection(selection)) {
          // Update links for UI components
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
      <LinkToolbar
        editor={editor.getLexicalEditor()!}
        linkNode={linkNode}
        onMouseEnter={() => {
          clearTimeout(clearTimerRef.current);
        }}
        ref={divRef}
      />
      <LinkEdit />
    </>
  );
};

ReactLinkPlugin.displayName = 'ReactLinkPlugin';

export default ReactLinkPlugin;
