import { isApple } from '@/common/sys';
import type { ModifierCombination } from '@/types/hotkey';

const reservedModifierKeywords = new Set(['shift', 'alt', 'meta', 'mod', 'ctrl', 'control']);

const mappedKeys: Record<string, string> = {
  AltLeft: 'alt',
  AltRight: 'alt',
  ControlLeft: 'ctrl',
  ControlRight: 'ctrl',
  MetaLeft: 'meta',
  MetaRight: 'meta',
  OSLeft: 'meta',
  OSRight: 'meta',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
  down: 'arrowdown',
  esc: 'escape',
  left: 'arrowleft',
  return: 'enter',
  right: 'arrowright',
  up: 'arrowup',
};

export function mapCode(key: string): string {
  return (mappedKeys[key.trim()] || key.trim()).toLowerCase().replace(/key|digit|numpad/, '');
}

export function parseHotkey(hotkey: string): {
  key?: string;
  modifiers: ModifierCombination;
} {
  let keys: string[] = [];

  keys = hotkey
    .toLocaleLowerCase()
    .split('+')
    .map((k) => mapCode(k));

  const modifiers: ModifierCombination = {
    altKey: keys.includes('alt'),
    ctrlKey:
      keys.includes('ctrl') ||
      keys.includes('control') ||
      (!isApple ? keys.includes('mod') : false),
    metaKey: keys.includes('meta') || (isApple ? keys.includes('mod') : false),
    shiftKey: keys.includes('shift'),
  };

  const singleCharKeys = keys.find((k) => !reservedModifierKeywords.has(k));

  return {
    key: singleCharKeys,
    modifiers,
  };
}
