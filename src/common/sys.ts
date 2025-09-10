import { IS_APPLE } from '@lexical/utils';

export const nodeDetect = (): boolean => {
  return typeof process !== 'undefined' && process.versions && !!process.versions.node;
};

export const browserDetect = (): boolean => {
  return typeof window !== 'undefined' && window.document !== undefined;
};

export const isNode = nodeDetect();
export const isBrowser = browserDetect();

export const macOSDetect = (): boolean => {
  if (isNode) {
    return process.platform === 'darwin';
  }
  if (isBrowser) {
    return window.navigator.platform.includes('Mac');
  }
  return false;
};

export const isMac = macOSDetect();

// TODO: 这些常量已经迁移到 @/const/hotkey，建议使用新的统一定义
// 为了向后兼容性保留，但应该逐步迁移到新的 PLATFORM_MODIFIER
/** @deprecated 请使用 @/const/hotkey 中的 PLATFORM_MODIFIER.MOD */
export const CONTROL_OR_META = { ctrlKey: !IS_APPLE, metaKey: IS_APPLE };
/** @deprecated 请使用 @/const/hotkey 中的 PLATFORM_MODIFIER.MOD_SHIFT */
export const CONTROL_OR_META_AND_SHIFT = { ctrlKey: !IS_APPLE, metaKey: IS_APPLE, shiftKey: true };

export { IS_FIREFOX, IS_APPLE as isApple } from '@lexical/utils';
export const isOnServerSide = typeof window === 'undefined';
