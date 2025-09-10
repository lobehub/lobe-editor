import { HOTKEYS_REGISTRATION } from '@/const/hotkey';
import { HotkeyId, HotkeyItem, ModifierCombination } from '@/types/hotkey';
import { createDebugLogger } from '@/utils/debug';
import { parseHotkey } from '@/utils/hotkey/parseHotkeys';

import { isHotkeyMatch } from './isHotkeyMatch';

const logger = createDebugLogger('hotkey');

export type HotkeysEvent = {
  key?: string;
  keys: string;
  modifiers: ModifierCombination;
  scopes?: string[];
};

export type HotkeyOptions = {
  enabled?: boolean;
  preventDefault?: boolean;
  stopImmediatePropagation?: boolean;
  stopPropagation?: boolean;
};

export const registerHotkey = (
  hotkey: HotkeyItem,
  callback: (event: KeyboardEvent, handler: HotkeysEvent) => void,
  options: HotkeyOptions = {},
): ((e: KeyboardEvent) => boolean) => {
  return (e: KeyboardEvent) => {
    if (!isHotkeyMatch(e, hotkey.keys)) return false;

    const keys = parseHotkey(hotkey.keys);

    if (options.preventDefault) e.preventDefault();
    if (options.stopPropagation) e.stopPropagation();
    callback(e, { keys: hotkey.keys, ...keys, scopes: hotkey.scopes });

    logger.debug(`⌨️ Hotkey matched: ${hotkey.id} [${hotkey.keys}]`, hotkey);

    return true;
  };
};

export const getHotkeyById = (id: HotkeyId): HotkeyItem => {
  return HOTKEYS_REGISTRATION.find((hotkey) => hotkey.id === id)!;
};
