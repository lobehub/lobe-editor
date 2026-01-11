export * from './editor-kernel';
export * from './editor-kernel/react';
export * from './plugins/auto-complete';
export * from './plugins/code';
export * from './plugins/codeblock';
export * from './plugins/codemirror-block';
export * from './plugins/common';
export * from './plugins/file';
export * from './plugins/hr';
export * from './plugins/image';
export * from './plugins/inode';
export * from './plugins/link';
export * from './plugins/link-highlight';
export * from './plugins/list';
export * from './plugins/litexml';
export * from './plugins/markdown';
export * from './plugins/math';
export * from './plugins/mention';
export * from './plugins/slash';
export * from './plugins/table';
export * from './plugins/toolbar';
export * from './plugins/upload';
export * from './plugins/virtual-block';
export type { IEditor } from './types';

// Hotkey utilities
export * from './types/hotkey';
export { getHotkeyById } from './utils/hotkey/registerHotkey';

// URL utilities
export { isPureUrl, isValidUrl } from './utils/url';

// Debug utilities
export {
  browserDebug,
  createDebugLogger,
  debugLogger,
  debugLoggers,
  devConsole,
  prodSafeLogger,
} from './utils/debug';

// Hot reload utilities
export { Kernel } from './editor-kernel/kernel';

/**
 * Enable hot reload mode globally for all editor instances
 * Call this in your app's entry point during development
 */
export function enableHotReload(): void {
  if (typeof window !== 'undefined') {
    const { Kernel } = require('./editor-kernel/kernel');
    const { debugLoggers } = require('./utils/debug');
    Kernel.setGlobalHotReloadMode(true);
    debugLoggers.kernel.info('[LobeHub Editor] Hot reload mode enabled globally');
  }
}

/**
 * Disable hot reload mode globally
 */
export function disableHotReload(): void {
  if (typeof window !== 'undefined') {
    const { Kernel } = require('./editor-kernel/kernel');
    const { debugLoggers } = require('./utils/debug');
    Kernel.setGlobalHotReloadMode(false);
    debugLoggers.kernel.info('[LobeHub Editor] Hot reload mode disabled globally');
  }
}
