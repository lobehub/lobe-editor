import { isModifierMatch } from 'lexical';

import { mapCode, parseHotkey } from './parseHotkeys';

export const isHotkeyMatch = (event: KeyboardEvent, hotkey: string): boolean => {
  const keys = parseHotkey(hotkey);

  const modifierMatch = isModifierMatch(event, keys.modifiers);
  if (!modifierMatch) return false;

  if (mapCode(event.code) !== keys.key) return false;

  return true;
};
