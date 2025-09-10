import { CommandListenerPriority } from 'lexical';

export const KeyEnum = {
  Alt: 'alt',
  Backquote: 'backquote',
  // `
  Backslash: 'backslash',
  // \
  Backspace: 'backspace',
  BracketLeft: 'bracketleft',
  // [
  BracketRight: 'bracketright',
  // ]
  Comma: 'comma',
  // ,
  Ctrl: 'ctrl',
  Down: 'down',
  Enter: 'enter',
  Equal: 'equal',
  // =
  Esc: 'esc',
  Left: 'left',
  LeftClick: 'left-click',
  LeftDoubleClick: 'left-double-click',
  Meta: 'meta',
  // Command on Mac, Win on Win
  MiddleClick: 'middle-click',
  Minus: 'minus',
  // -
  Mod: 'mod',

  Number: '1-9',

  // Command on Mac, Ctrl on Win
  Period: 'period',

  // .
  Plus: 'equal',

  // +
  QuestionMark: 'slash',

  // ?
  Quote: 'quote',
  // '
  Right: 'right',
  RightClick: 'right-click',
  RightDoubleClick: 'right-double-click',

  Semicolon: 'semicolon',
  // ;
  Shift: 'shift',

  Slash: 'slash',
  // /
  Space: 'space',
  Tab: 'tab',
  Up: 'up',
  Zero: '0',
} as const;

export const HotkeyEnum = {
  Bold: 'bold',
  BulletList: 'bulletList',
  CodeInline: 'codeInline',
  Italic: 'italic',
  Link: 'link',
  Mention: 'mention',
  NumberList: 'numberList',
  Redo: 'redo',
  Slash: 'slash',
  Strikethrough: 'strikethrough',
  Underline: 'underline',
  Undo: 'undo',
} as const;

export const HotkeyScopeEnum = {
  Format: 'format',
  Insert: 'insert',
  Plugin: 'plugin',
  Slash: 'slash',
} as const;

export type HotkeyId = (typeof HotkeyEnum)[keyof typeof HotkeyEnum];
export type HotkeyScopeId = (typeof HotkeyScopeEnum)[keyof typeof HotkeyScopeEnum];

export interface HotkeyItem {
  id: HotkeyId;
  keys: string;
  priority: CommandListenerPriority;
  scopes?: HotkeyScopeId[];
}

export type ModifierCombination =
  | { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }
  | Record<string, never>;
