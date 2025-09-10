import { COMMAND_PRIORITY_CRITICAL, COMMAND_PRIORITY_EDITOR } from 'lexical';

import { HotkeyEnum, HotkeyItem, HotkeyScopeEnum, KeyEnum } from '@/types/hotkey';

const combineKeys = (keys: string[]) => keys.join('+');

export type HotkeyRegistration = HotkeyItem[];

export const HOTKEYS_REGISTRATION: HotkeyRegistration = [
  {
    id: HotkeyEnum.Bold,
    keys: combineKeys([KeyEnum.Mod, 'b']),
    priority: COMMAND_PRIORITY_EDITOR,
    scopes: [HotkeyScopeEnum.Format],
  },
  {
    id: HotkeyEnum.Italic,
    keys: combineKeys([KeyEnum.Mod, 'i']),
    priority: COMMAND_PRIORITY_EDITOR,
    scopes: [HotkeyScopeEnum.Format],
  },
  {
    id: HotkeyEnum.Underline,
    keys: combineKeys([KeyEnum.Mod, 'u']),
    priority: COMMAND_PRIORITY_EDITOR,
    scopes: [HotkeyScopeEnum.Format],
  },
  {
    id: HotkeyEnum.Strikethrough,
    keys: combineKeys([KeyEnum.Mod, KeyEnum.Shift, 'x']),
    priority: COMMAND_PRIORITY_EDITOR,
    scopes: [HotkeyScopeEnum.Format],
  },
  {
    id: HotkeyEnum.CodeInline,
    keys: combineKeys([KeyEnum.Mod, 'e']),
    priority: COMMAND_PRIORITY_EDITOR,
    scopes: [HotkeyScopeEnum.Format, HotkeyScopeEnum.Plugin],
  },
  {
    id: HotkeyEnum.Link,
    keys: combineKeys([KeyEnum.Mod, 'k']),
    priority: COMMAND_PRIORITY_EDITOR,
    scopes: [HotkeyScopeEnum.Format, HotkeyScopeEnum.Plugin],
  },

  // List hotkeys
  {
    id: HotkeyEnum.NumberList,
    keys: combineKeys([KeyEnum.Mod, KeyEnum.Shift, '7']),
    priority: COMMAND_PRIORITY_EDITOR,
    scopes: [HotkeyScopeEnum.Insert, HotkeyScopeEnum.Plugin],
  },
  {
    id: HotkeyEnum.BulletList,
    keys: combineKeys([KeyEnum.Mod, KeyEnum.Shift, '8']),
    priority: COMMAND_PRIORITY_EDITOR,
    scopes: [HotkeyScopeEnum.Insert, HotkeyScopeEnum.Plugin],
  },

  // Insert content hotkeys
  {
    id: HotkeyEnum.Mention,
    keys: '@',
    priority: COMMAND_PRIORITY_CRITICAL,
    scopes: [HotkeyScopeEnum.Slash, HotkeyScopeEnum.Plugin],
  },
  {
    id: HotkeyEnum.Slash,
    keys: '/',
    priority: COMMAND_PRIORITY_CRITICAL,
    scopes: [HotkeyScopeEnum.Slash, HotkeyScopeEnum.Plugin],
  },
];
