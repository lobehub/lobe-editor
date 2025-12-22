import { mergeRegister } from '@lexical/utils';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, LexicalEditor } from 'lexical';

import { IEditorKernel } from '@/types';
import { HotkeyEnum } from '@/types/hotkey';

import {
  $isLinkNode,
  $toggleLink,
  LinkAttributes,
  TOGGLE_LINK_COMMAND,
  formatUrl,
} from '../node/LinkNode';
import { extractUrlFromText, getSelectedNode, sanitizeUrl } from '../utils';

export interface LinkRegistryOptions {
  attributes?: LinkAttributes;
  enableHotkey?: boolean;
  validateUrl?: (url: string) => boolean;
}

export function registerLinkCommands(
  editor: LexicalEditor,
  kernel: IEditorKernel,
  options?: LinkRegistryOptions,
) {
  const { validateUrl, attributes, enableHotkey = true } = options || {};
  const state = { isLink: false };

  const registrations = [
    editor.registerUpdateListener(() => {
      const selection = editor.getEditorState().read(() => $getSelection());
      if (!selection) return;

      if ($isRangeSelection(selection)) {
        editor.getEditorState().read(() => {
          const node = getSelectedNode(selection);
          const parent = node.getParent();
          const isLink = $isLinkNode(parent) || $isLinkNode(node);
          state.isLink = isLink;
        });
      } else {
        state.isLink = false;
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
  ];

  // 注册热键，通过 enabled 选项控制
  registrations.push(
    kernel.registerHotkey(
      HotkeyEnum.Link,
      () => {
        const isLink = state.isLink;
        if (isLink) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
          return;
        }

        let nextUrl = sanitizeUrl('https://');
        let expandTo: { index: number; length: number } | null = null;
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            if (!selection.isCollapsed()) {
              const text = selection.getTextContent().trim();
              const maybeUrl = formatUrl(text);
              if (validateUrl?.(maybeUrl)) {
                nextUrl = maybeUrl;
              }
            } else {
              const lineText = selection.anchor.getNode().getTextContent();
              const found = extractUrlFromText(lineText);
              if (found && validateUrl?.(formatUrl(found.url))) {
                nextUrl = formatUrl(found.url);
                expandTo = { index: found.index, length: found.length };
              }
            }
          }
        });
        editor.update(() => {
          if (expandTo) {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const anchorNode = selection.anchor.getNode();
              selection.anchor.set(anchorNode.getKey(), expandTo.index, 'text');
              selection.focus.set(anchorNode.getKey(), expandTo.index + expandTo.length, 'text');
            }
          }
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, nextUrl);
        });
      },
      {
        enabled: enableHotkey,
        preventDefault: true,
        stopPropagation: true,
      },
    ),
  );

  return mergeRegister(...registrations);
}
