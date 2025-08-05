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
export const CONTROL_OR_META = { ctrlKey: !IS_APPLE, metaKey: IS_APPLE };

export { IS_APPLE as isApple } from '@lexical/utils';
