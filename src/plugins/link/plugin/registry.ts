import { mergeRegister } from '@lexical/utils';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, LexicalEditor } from 'lexical';

import { IEditorKernel } from '@/types';
import { HotkeyEnum } from '@/types/hotkey';

import { $isLinkNode, $toggleLink, LinkAttributes, TOGGLE_LINK_COMMAND } from '../node/LinkNode';
import { getSelectedNode, sanitizeUrl } from '../utils';

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
      const selection = editor.read(() => $getSelection());
      if (!selection) return;

      if ($isRangeSelection(selection)) {
        editor.read(() => {
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
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, isLink ? null : sanitizeUrl('https://'));
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
